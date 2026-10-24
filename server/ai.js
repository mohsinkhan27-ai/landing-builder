// Connects the builder to an AI provider of your choice.
//
// - Your API key is saved in data/ai-settings.json on this computer and is never sent back to the browser.
//   (You can also provide keys as environment variables: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY.)
// - The browser talks to this server, and this server talks to the provider. That avoids browser CORS limits
//   and keeps the key out of the page.
// - Supported: OpenAI (ChatGPT), Anthropic (Claude), Google (Gemini), and anything that speaks the OpenAI
//   chat format ("custom": OpenRouter, Groq, Together, DeepSeek, Mistral, Ollama, LM Studio, ...).

import fs from 'node:fs/promises';
import path from 'node:path';

const PROVIDERS = {
  openai: { label: 'OpenAI (ChatGPT)', baseUrl: 'https://api.openai.com/v1', env: 'OPENAI_API_KEY' },
  anthropic: { label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com', env: 'ANTHROPIC_API_KEY' },
  gemini: { label: 'Google (Gemini)', baseUrl: 'https://generativelanguage.googleapis.com', env: 'GEMINI_API_KEY' },
  custom: { label: 'Other or local (OpenAI-compatible)', baseUrl: '', env: 'AI_API_KEY' },
};
const MAX_OUTPUT_TOKENS = 16000;

class ProviderError extends Error {}

export function mountAi(app, { DATA_DIR, wrap, HttpError }) {
  const file = path.join(DATA_DIR, 'ai-settings.json');

  // ---------- settings ----------

  async function load() {
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      return { active: data.active || null, providers: data.providers || {} };
    } catch {
      return { active: null, providers: {} };
    }
  }
  async function save(data) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    await fs.rename(tmp, file);
  }

  const envKey = (id) => (id === 'gemini' ? process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY : process.env[PROVIDERS[id].env]) || '';
  const hint = (key) => (key ? `…${key.slice(-4)}` : '');

  function publicView(settings) {
    const providers = {};
    for (const [id, info] of Object.entries(PROVIDERS)) {
      const saved = settings.providers[id] || {};
      const key = saved.apiKey || envKey(id);
      providers[id] = {
        label: info.label,
        configured: !!key || (id === 'custom' && !!saved.baseUrl),
        keyHint: hint(key),
        keySource: saved.apiKey ? 'saved' : envKey(id) ? 'environment' : '',
        model: saved.model || '',
        baseUrl: saved.baseUrl || '',
        defaultBaseUrl: info.baseUrl,
      };
    }
    return { active: settings.active, providers };
  }

  function resolve(settings, id, override = {}) {
    if (!PROVIDERS[id]) throw new HttpError(400, 'Unknown AI provider.');
    const saved = settings.providers[id] || {};
    const baseUrl = String(override.baseUrl || saved.baseUrl || PROVIDERS[id].baseUrl).replace(/\/+$/, '');
    if (!baseUrl) throw new HttpError(400, 'Enter the address of the service (for example http://localhost:11434/v1).');
    const apiKey = String(override.apiKey || saved.apiKey || envKey(id) || '').trim();
    if (!apiKey && id !== 'custom') throw new HttpError(400, `Add your ${PROVIDERS[id].label} API key first.`);
    return { id, baseUrl, apiKey, model: String(override.model || saved.model || '').trim() };
  }

  // ---------- talking to providers ----------

  const redact = (text, key) => (key ? String(text).split(key).join('…') : String(text));

  async function failure(res, key) {
    let message = '';
    try {
      const raw = await res.text();
      try {
        const j = JSON.parse(raw);
        message = j.error?.message || j.message || (typeof j.error === 'string' ? j.error : '') || raw;
      } catch {
        message = raw;
      }
    } catch {
      /* no body */
    }
    message = redact(message, key).trim().slice(0, 400);
    return new ProviderError(`${message || res.statusText || 'Request failed'} (HTTP ${res.status})`);
  }

  async function call(url, init, key, signal) {
    let res;
    try {
      res = await fetch(url, { ...init, signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new ProviderError(`Could not reach ${new URL(url).origin}. ${err.cause?.code === 'ECONNREFUSED' ? 'Nothing is listening there.' : 'Check the address and your internet connection.'}`);
    }
    if (!res.ok) throw await failure(res, key);
    return res;
  }

  async function* sseEvents(res) {
    const decoder = new TextDecoder();
    let buffer = '';
    const parse = (block) => {
      let event = '';
      const data = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      return data.length ? { event, data: data.join('\n') } : null;
    };
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n');
      let cut;
      while ((cut = buffer.indexOf('\n\n')) >= 0) {
        const item = parse(buffer.slice(0, cut));
        buffer = buffer.slice(cut + 2);
        if (item) yield item;
      }
    }
    const rest = parse(buffer);
    if (rest) yield rest;
  }

  // Providers want turns to alternate user / assistant.
  function mergeTurns(messages) {
    const out = [];
    for (const m of messages) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const text = String(m.content ?? '');
      if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += `\n\n${text}`;
      else out.push({ role, content: text });
    }
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  const adapters = {
    // OpenAI and anything compatible with it
    async listOpenAI(cfg, signal) {
      const headers = cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {};
      let baseUrl = cfg.baseUrl;
      let raw = await (await call(`${baseUrl}/models`, { headers }, cfg.apiKey, signal)).text();
      // Local routers often show a web UI at / and expose the API at /v1.
      if (raw.trimStart().startsWith('<') && new URL(baseUrl).pathname === '/') {
        baseUrl = `${baseUrl}/v1`;
        raw = await (await call(`${baseUrl}/models`, { headers }, cfg.apiKey, signal)).text();
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        if (raw.trimStart().startsWith('<')) {
          throw new ProviderError(`That address returned a web page, not an OpenAI-compatible API. Enter its API base URL, which usually ends in /v1 (for example ${cfg.baseUrl}/v1).`);
        }
        throw new ProviderError('The service returned something that is not valid JSON. Check the service address.');
      }
      let ids = (body.data || body.models || []).map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
      if (cfg.id === 'openai') ids = ids.filter((id) => !/embedding|whisper|tts|dall-e|moderation|davinci|babbage|image|audio|realtime|transcribe|search|computer-use/i.test(id));
      return ids.sort();
    },
    async *streamOpenAI(cfg, { system, messages }, signal) {
      const init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          stream: true,
          messages: [{ role: 'system', content: system }, ...mergeTurns(messages)],
        }),
      };
      let res = await call(`${cfg.baseUrl}/chat/completions`, init, cfg.apiKey, signal);
      if ((res.headers.get('content-type') || '').includes('text/html') && new URL(cfg.baseUrl).pathname === '/') {
        res = await call(`${cfg.baseUrl}/v1/chat/completions`, init, cfg.apiKey, signal);
      }
      if ((res.headers.get('content-type') || '').includes('text/html')) {
        throw new ProviderError(`That address returned a web page, not an OpenAI-compatible API. Enter its API base URL, which usually ends in /v1 (for example ${cfg.baseUrl}/v1).`);
      }
      for await (const { data } of sseEvents(res)) {
        if (data === '[DONE]') return;
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        if (json.error) throw new ProviderError(redact(json.error.message || JSON.stringify(json.error), cfg.apiKey));
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) yield delta;
      }
    },

    // Anthropic (Claude)
    async listAnthropic(cfg, signal) {
      const res = await call(`${cfg.baseUrl}/v1/models?limit=100`, { headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' } }, cfg.apiKey, signal);
      return ((await res.json()).data || []).map((m) => m.id).filter(Boolean);
    },
    async *streamAnthropic(cfg, { system, messages }, signal) {
      const res = await call(
        `${cfg.baseUrl}/v1/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: cfg.model, max_tokens: MAX_OUTPUT_TOKENS, stream: true, system, messages: mergeTurns(messages) }),
        },
        cfg.apiKey,
        signal,
      );
      for await (const { data } of sseEvents(res)) {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        if (json.type === 'error') throw new ProviderError(redact(json.error?.message || 'The provider reported an error.', cfg.apiKey));
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta' && json.delta.text) yield json.delta.text;
        if (json.type === 'message_stop') return;
      }
    },

    // Google (Gemini)
    async listGemini(cfg, signal) {
      const res = await call(`${cfg.baseUrl}/v1beta/models?pageSize=200`, { headers: { 'x-goog-api-key': cfg.apiKey } }, cfg.apiKey, signal);
      return ((await res.json()).models || [])
        .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => String(m.name).replace(/^models\//, ''))
        .filter((id) => !/embedding|aqa|imagen|veo|tts/i.test(id))
        .sort();
    },
    async *streamGemini(cfg, { system, messages }, signal) {
      const res = await call(
        `${cfg.baseUrl}/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: mergeTurns(messages).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
          }),
        },
        cfg.apiKey,
        signal,
      );
      for await (const { data } of sseEvents(res)) {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        if (json.error) throw new ProviderError(redact(json.error.message || 'The provider reported an error.', cfg.apiKey));
        if (json.promptFeedback?.blockReason) throw new ProviderError(`The request was blocked by the provider (${json.promptFeedback.blockReason}).`);
        const text = (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
        if (text) yield text;
      }
    },
  };

  const kind = (id) => (id === 'anthropic' ? 'Anthropic' : id === 'gemini' ? 'Gemini' : 'OpenAI');

  // ---------- routes ----------

  app.get('/api/ai/settings', wrap(async (req, res) => res.json(publicView(await load()))));

  app.put('/api/ai/settings', wrap(async (req, res) => {
    const { provider, apiKey, model, baseUrl, active } = req.body || {};
    if (!PROVIDERS[provider]) throw new HttpError(400, 'Unknown AI provider.');
    if (baseUrl && !/^https?:\/\/[^\s]+$/i.test(baseUrl)) throw new HttpError(400, 'The address must start with http:// or https://');
    const settings = await load();
    const entry = { ...(settings.providers[provider] || {}) };
    if (typeof apiKey === 'string' && apiKey.trim()) entry.apiKey = apiKey.trim();
    if (typeof model === 'string') entry.model = model.trim();
    if (typeof baseUrl === 'string') entry.baseUrl = baseUrl.trim().replace(/\/+$/, '');
    settings.providers[provider] = entry;
    if (active !== false) settings.active = provider;
    await save(settings);
    res.json(publicView(settings));
  }));

  app.delete('/api/ai/settings/:provider', wrap(async (req, res) => {
    if (!PROVIDERS[req.params.provider]) throw new HttpError(400, 'Unknown AI provider.');
    const settings = await load();
    delete settings.providers[req.params.provider];
    if (settings.active === req.params.provider) settings.active = Object.keys(settings.providers)[0] || null;
    await save(settings);
    res.json(publicView(settings));
  }));

  app.post('/api/ai/models', wrap(async (req, res) => {
    const { provider, apiKey, baseUrl } = req.body || {};
    const cfg = resolve(await load(), provider, { apiKey, baseUrl });
    try {
      res.json({ models: await adapters[`list${kind(provider)}`](cfg) });
    } catch (err) {
      if (err instanceof ProviderError) throw new HttpError(502, err.message);
      throw err;
    }
  }));

  app.post('/api/ai/chat', async (req, res) => {
    const { provider, model, system, messages } = req.body || {};
    let cfg;
    try {
      const settings = await load();
      cfg = resolve(settings, provider || settings.active, { model });
      if (!cfg.model) throw new HttpError(400, 'Choose a model first (open Connect, press “Load models”, and pick one).');
      if (!Array.isArray(messages) || !messages.length) throw new HttpError(400, 'Nothing to send.');
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const send = (obj) => !res.writableEnded && res.write(`data: ${JSON.stringify(obj)}\n\n`);
    try {
      for await (const delta of adapters[`stream${kind(cfg.id)}`](cfg, { system: String(system || ''), messages }, abort.signal)) send({ delta });
      send({ done: true });
    } catch (err) {
      if (!abort.signal.aborted) send({ error: err instanceof ProviderError ? err.message : 'Something went wrong while talking to the provider.' });
      if (!(err instanceof ProviderError) && err.name !== 'AbortError') console.error(err);
    }
    res.end();
  });

  async function generateText(cfg, { system, messages, maxTokens = 2000 }, timeoutMs = 120000) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const k = kind(cfg.id);
      if (k === 'OpenAI') {
        const init = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
          body: JSON.stringify({
            model: cfg.model,
            max_tokens: maxTokens,
            stream: false,
            messages: [{ role: 'system', content: system }, ...mergeTurns(messages)],
          }),
        };
        let res = await call(`${cfg.baseUrl}/chat/completions`, init, cfg.apiKey, abort.signal);
        if ((res.headers.get('content-type') || '').includes('text/html') && new URL(cfg.baseUrl).pathname === '/') {
          res = await call(`${cfg.baseUrl}/v1/chat/completions`, init, cfg.apiKey, abort.signal);
        }
        const json = await res.json();
        if (json.error) throw new ProviderError(redact(json.error.message || JSON.stringify(json.error), cfg.apiKey));
        return json.choices?.[0]?.message?.content || '';
      } else if (k === 'Anthropic') {
        const res = await call(
          `${cfg.baseUrl}/v1/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, stream: false, system, messages: mergeTurns(messages) }),
          },
          cfg.apiKey,
          abort.signal,
        );
        const json = await res.json();
        if (json.type === 'error') throw new ProviderError(redact(json.error?.message || 'The provider reported an error.', cfg.apiKey));
        return (json.content || []).map((c) => c.text || '').join('');
      } else if (k === 'Gemini') {
        const res = await call(
          `${cfg.baseUrl}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: mergeTurns(messages).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
              generationConfig: { maxOutputTokens: maxTokens },
            }),
          },
          cfg.apiKey,
          abort.signal,
        );
        const json = await res.json();
        if (json.error) throw new ProviderError(redact(json.error.message || 'The provider reported an error.', cfg.apiKey));
        return (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      }
      return '';
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err.name === 'AbortError') throw new ProviderError('The request took too long and timed out.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  app.post('/api/ai/rewrite', wrap(async (req, res) => {
    const { text, instruction } = req.body || {};
    if (!text || typeof text !== 'string') throw new HttpError(400, 'Provide text to rewrite.');
    const settings = await load();
    if (!settings.active) throw new HttpError(400, 'No AI provider connected. Open the AI panel and connect a provider first.');
    const cfg = resolve(settings, settings.active);
    if (!cfg.model) throw new HttpError(400, 'Choose an AI model in the AI panel first.');

    const system = 'You are an elite conversion-rate copywriter for landing pages. Rewrite the user\'s text according to their instruction. Return ONLY the rewritten text, with no quotes, formatting, or commentary.';
    const messages = [
      { role: 'user', content: `Text:\n${text}\n\nInstruction: ${instruction || 'Make it punchier, clearer, and more engaging for a high-converting landing page'}` }
    ];

    try {
      const result = await generateText(cfg, { system, messages, maxTokens: 600 });
      res.json({ ok: true, result: result.trim().replace(/^["']|["']$/g, '') });
    } catch (err) {
      if (err instanceof ProviderError) throw new HttpError(502, err.message);
      throw err;
    }
  }));

  app.post('/api/ai/section', wrap(async (req, res) => {
    const { prompt, profile } = req.body || {};
    if (!prompt || typeof prompt !== 'string') throw new HttpError(400, 'Provide a description for the section.');
    const settings = await load();
    if (!settings.active) throw new HttpError(400, 'No AI provider connected. Open the AI panel and connect a provider first.');
    const cfg = resolve(settings, settings.active);
    if (!cfg.model) throw new HttpError(400, 'Choose an AI model in the AI panel first.');

    let system = `You are an expert landing page designer. Generate ONLY one clean, responsive, beautiful HTML section using the classes in the Landing Builder design system (lp-section, lp-container, lp-hero, lp-feature, lp-card, lp-btn, lp-btn-primary, etc.). Return ONLY the raw HTML starting with <section class="lp-section"> and ending with </section>. Do NOT use markdown code fences (no \`\`\`html). Do NOT include any <script> tags or inline JavaScript.

CRITICAL DESIGN SYSTEM & THEMING RULES:
1. NEVER use hardcoded hex color codes (e.g. do NOT write #2457f5, #860edf, #111, #fff, #faf7ff in style attributes).
2. ALWAYS use Landing Builder design system classes and CSS variables so that the section automatically adapts when any theme is applied:
   - Primary action buttons: class="lp-btn lp-btn-primary"
   - Ghost / outline buttons: class="lp-btn lp-btn-ghost"
   - Card / feature containers: class="lp-card"
   - Subtle tinted backgrounds: class="lp-section lp-tint" (or background: var(--lp-mist))
   - Standard light backgrounds: class="lp-section" (or background: var(--lp-paper))
   - Dark high-contrast section: class="lp-section lp-dark"
   - Badges / tags: class="lp-pill" or background: var(--lp-primary-soft), color: var(--lp-primary)
   - Icons / highlights: color: var(--lp-primary)
   - Headings: <h2>, <h3> naturally inherit var(--lp-font-head) and var(--lp-ink) (do NOT set inline font-family or color in style)
   - Body text: <p> naturally inherits var(--lp-font-body) and var(--lp-text) (do NOT set inline font-family or color in style)
   - Muted text: class="lp-muted" or color: var(--lp-muted)
3. Do NOT add fixed pixel width or height on the <section>. Use <div class="lp-container"> for layout width and centering.`;

    const messages = [
      { role: 'user', content: `Create a single landing page section for: ${prompt}` }
    ];

    try {
      let raw = await generateText(cfg, { system, messages, maxTokens: 2500 });
      raw = raw.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();
      res.json({ ok: true, html: raw });
    } catch (err) {
      if (err instanceof ProviderError) throw new HttpError(502, err.message);
      throw err;
    }
  }));
}
