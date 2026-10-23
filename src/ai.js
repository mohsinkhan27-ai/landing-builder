// The AI designer: connect an AI provider, describe a page, and the builder creates it.

import { extractPage, omitCode, systemPrompt } from './ai-prompt.js';

const PROVIDER_HELP = {
  openai: 'Use an API key from your OpenAI developer account.',
  anthropic: 'Use an API key from your Anthropic developer console.',
  gemini: 'Use an API key from Google AI Studio.',
  custom: 'Works with any service that uses the OpenAI chat format: OpenRouter, Groq, Together, DeepSeek, Mistral, or a program on your own computer such as Ollama (http://localhost:11434/v1) or LM Studio (http://localhost:1234/v1). Local programs usually need no key.',
};

const SUGGESTIONS = [
  'A landing page for a boutique yoga studio, with a class schedule, pricing and a free-trial sign-up',
  'A SaaS landing page for an invoicing tool for freelancers, with pricing and an FAQ',
  'A one-page site for a neighborhood bakery with menu highlights, reviews and opening hours',
  'A launch page for a mobile app with a waitlist sign-up and a short how-it-works',
];

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((x) => x != null));
  return el;
}

export function initAi({ pane, dialog, getContext, applyToPage, getProfile }) {
  let settings = { active: null, providers: {} };
  let messages = []; // { role, text, error, applied }
  let abort = null;

  // ---------- server calls ----------

  const json = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };
  const put = (body) => json('/api/ai/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const loadSettings = async () => {
    try {
      settings = await json('/api/ai/settings');
    } catch {
      /* the panel shows "not connected" */
    }
    // Re-render the welcome screen too: it is built from the settings and would otherwise
    // still say "Connect your AI" after the settings arrive.
    renderMessages();
    renderComposer();
  };

  const active = () => (settings.active ? { id: settings.active, ...settings.providers[settings.active] } : null);
  const connected = () => {
    const a = active();
    return !!(a && a.configured && a.model);
  };

  // ---------- panel ----------

  const header = h('div', { class: 'ai-head' });
  const list = h('div', { class: 'ai-messages', role: 'log', 'aria-live': 'polite' });
  const form = h('form', { class: 'ai-composer' });
  pane.append(header, list, form);

  function renderHeader() {
    const a = active();
    const ready = connected();
    const configured = Object.entries(settings.providers).filter(([, p]) => p.configured);
    const switcher = configured.length > 1
      ? h('select', { 'aria-label': 'AI provider', onchange: async (e) => { settings = await put({ provider: e.target.value }); renderHeader(); renderComposer(); } },
          configured.map(([id, p]) => h('option', { value: id, text: p.label, selected: id === settings.active })))
      : null;
    const prof = getProfile?.();
    header.replaceChildren(
      h('div', { class: 'ai-title' },
        h('b', { text: 'AI designer' }),
        h('span', { class: `ai-status${ready ? ' on' : ''}`, text: ready ? `${a.label.split(' (')[0]} · ${a.model}` : 'Not connected' }),
        prof ? h('span', { class: 'ai-profile-badge', title: `Styling guided by: ${prof.name} (${prof.url})`, text: `🎨 ${prof.name}` }) : null),
      h('div', { class: 'ai-actions' },
        switcher,
        h('button', { type: 'button', class: 'ai-link', text: ready ? 'Settings' : 'Connect', onclick: openConnect }),
        messages.length ? h('button', { type: 'button', class: 'ai-link', text: 'New chat', onclick: () => { abort?.abort(); messages = []; renderMessages(); renderComposer(); } }) : null),
    );
  }

  function renderComposer() {
    const ready = connected();
    const busy = !!abort;
    const input = h('textarea', { rows: 3, placeholder: ready ? 'Describe the page you want, or what to change…' : 'Connect an AI provider to begin', disabled: !ready || busy, 'aria-label': 'Message to the AI designer' });
    const context = h('input', { type: 'checkbox', checked: true, id: 'ai-context' });
    const send = busy
      ? h('button', { type: 'button', class: 'ai-send stop', text: 'Stop', onclick: () => abort?.abort() })
      : h('button', { type: 'submit', class: 'ai-send', text: 'Send', disabled: !ready });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.onsubmit = (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (text && ready && !abort) submit(text, context.checked);
    };
    form.replaceChildren(
      input,
      h('div', { class: 'ai-composer-row' },
        h('label', { class: 'ai-check' }, context, h('span', { text: 'Include the current page' })),
        send),
    );
    form.dataset.ready = String(ready);
    if (ready && !busy) input.focus();
  }

  function welcome() {
    const ready = connected();
    return h('div', { class: 'ai-welcome' },
      h('h3', { text: ready ? 'What should we build?' : 'Connect your AI' }),
      h('p', { text: ready
        ? 'Describe the page in plain words. I will design it, you can then change anything by hand, or keep chatting to refine it.'
        : 'Link ChatGPT (OpenAI), Claude (Anthropic), Gemini (Google) or any compatible service, then describe a page and it appears here, ready to edit.' }),
      ready
        ? h('div', { class: 'ai-chips' }, SUGGESTIONS.map((s) => h('button', { type: 'button', text: s, onclick: () => { const t = form.querySelector('textarea'); t.value = s; t.focus(); } })))
        : h('div', {},
            h('button', { type: 'button', class: 'ai-primary', text: 'Connect an AI provider', onclick: openConnect }),
            h('p', { class: 'ai-fine', text: 'A ChatGPT, Claude or Gemini subscription is not the same as API access. You need an API key from the provider, which is billed by how much you use it. The key stays on this computer.' })));
  }

  function bubble(msg, index) {
    if (msg.role === 'user') return h('div', { class: 'ai-msg user' }, h('p', { text: msg.text }));
    const page = extractPage(msg.text);
    const node = h('div', { class: 'ai-msg assistant' });
    if (page.explanation) node.append(h('p', { text: page.explanation }));
    if (msg.error) {
      node.append(h('div', { class: 'ai-error' }, h('p', { text: msg.error }), h('button', { type: 'button', class: 'ai-link', text: 'Check connection', onclick: openConnect })));
    }
    if (page.hasHtml) {
      if (!msg.done) {
        node.append(h('div', { class: 'ai-building' }, h('i'), h('span', { text: `Designing the page… ${page.html.length.toLocaleString()} characters` })));
      } else if (!page.htmlComplete) {
        node.append(h('div', { class: 'ai-error' },
          h('p', { text: 'The AI answer was cut off before the page was complete, so it cannot be applied. Try again; if it keeps happening, pick a model with a larger output limit.' })));
      } else {
        const card = h('div', { class: 'ai-card' }, h('b', { text: 'Page ready' }));
        const apply = async (mode) => {
          try {
            const undo = await applyToPage(mode, { html: page.html, css: page.css, hint: messages.slice(0, index).filter((m) => m.role === 'user').map((m) => m.text)[0] || 'page', allowedUrls: messages.filter((m) => m.role === 'user').flatMap((m) => m.text.match(/https?:\/\/[^\s"')]+/g) || []) });
            msg.applied = { mode, undo };
          } catch (err) {
            msg.error = err.message;
          }
          renderMessages();
        };
        if (msg.applied) {
          card.append(
            ...[
              h('span', { class: 'ai-done', text: msg.applied.mode === 'new' ? '✓ Created as a new page' : msg.applied.mode === 'replace' ? '✓ Replaced this page' : '✓ Added to this page' }),
              msg.applied.undo ? h('button', { type: 'button', class: 'ai-link', text: 'Undo', onclick: async () => { await msg.applied.undo(); msg.applied = null; renderMessages(); } }) : null,
            ].filter(Boolean),
          );
        } else {
          card.append(
            h('div', { class: 'ai-apply' },
              h('button', { type: 'button', class: 'ai-primary', text: 'Create as a new page', onclick: () => apply('new') }),
              h('button', { type: 'button', text: 'Replace this page', onclick: () => apply('replace') }),
              h('button', { type: 'button', text: 'Add to the end of this page', onclick: () => apply('append') })));
        }
        node.append(card);
      }
    }
    if (!msg.done && !msg.error && !page.hasHtml && !page.explanation) node.append(h('div', { class: 'ai-building' }, h('i'), h('span', { text: 'Thinking…' })));
    return node;
  }

  function renderMessages() {
    list.replaceChildren(...(messages.length ? messages.map(bubble) : [welcome()]));
    list.scrollTop = list.scrollHeight;
    renderHeader();
  }

  // ---------- sending ----------

  async function submit(text, withPage) {
    const context = withPage ? getContext() : { empty: true };
    const history = messages.filter((m) => !m.error || m.text).map((m) => ({ role: m.role, content: m.role === 'assistant' ? omitCode(m.text) : m.text }));
    let content = text;
    if (!context.empty) {
      content += context.tooLarge
        ? '\n\n(The current page is too large to include. Answer based on my description.)'
        : `\n\n---\nCURRENT PAGE (if I asked for changes, return the complete updated page):\n\`\`\`html\n${context.html}\n\`\`\`${context.css ? `\n\`\`\`css\n${context.css}\n\`\`\`` : ''}`;
    }
    messages.push({ role: 'user', text });
    const reply = { role: 'assistant', text: '', done: false };
    messages.push(reply);
    abort = new AbortController();
    renderMessages();
    renderComposer();

    let frame = 0;
    const refresh = () => {
      frame = 0;
      const before = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
      const last = list.lastElementChild;
      if (last) last.replaceWith(bubble(reply, messages.length - 1));
      if (before) list.scrollTop = list.scrollHeight;
    };
    try {
      const a = active();
      const prof = getProfile?.();
      const sys = systemPrompt(prof);
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: a.id, model: a.model, system: sys, messages: [...history, { role: 'user', content }] }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut;
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const line = buffer.slice(0, cut).replace(/^data: ?/, '');
          buffer = buffer.slice(cut + 2);
          let event;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (event.delta) reply.text += event.delta;
          if (event.error) reply.error = event.error;
          if (event.done) reply.done = true;
        }
        if (!frame) frame = requestAnimationFrame(refresh);
      }
      reply.done = true;
      if (!reply.text && !reply.error) reply.error = 'The AI returned an empty answer. Try again, or pick a different model.';
    } catch (err) {
      if (err.name === 'AbortError') {
        reply.done = true;
        reply.text = reply.text || '';
        if (!reply.text) messages.splice(messages.indexOf(reply) - 1, 2);
        else reply.text += '\n\n(Stopped.)';
      } else reply.error = err.message;
    } finally {
      reply.done = true;
      abort = null;
      cancelAnimationFrame(frame);
      renderMessages();
      renderComposer();
    }
  }

  // ---------- connect dialog ----------

  function openConnect() {
    const providerIds = Object.keys(settings.providers);
    const selected = settings.active || 'anthropic';
    dialog.replaceChildren();

    const provider = h('select', { id: 'ai-provider' }, providerIds.map((id) => h('option', { value: id, text: `${settings.providers[id].label}${settings.providers[id].configured ? '  ✓' : ''}`, selected: id === selected })));
    const key = h('input', { type: 'password', id: 'ai-key', autocomplete: 'off', spellcheck: 'false' });
    const keyNote = h('p', { class: 'hint' });
    const base = h('input', { type: 'text', id: 'ai-base', autocomplete: 'off', spellcheck: 'false' });
    const baseRow = h('div', {}, h('label', { for: 'ai-base', text: 'Service address' }), base, h('p', { class: 'hint', id: 'ai-base-hint' }));
    const model = h('input', { type: 'text', id: 'ai-model', list: 'ai-models', autocomplete: 'off', spellcheck: 'false', placeholder: 'Press “Load models” and choose one' });
    const datalist = h('datalist', { id: 'ai-models' });
    const help = h('p', { class: 'hint' });
    const status = h('p', { class: 'ai-dialog-msg', role: 'status' });
    const say = (text, bad) => {
      status.textContent = text;
      status.className = `ai-dialog-msg ${bad ? 'bad' : 'good'}`;
    };

    const fill = () => {
      const p = settings.providers[provider.value] || {};
      key.value = '';
      key.placeholder = p.configured && p.keyHint ? `Saved key ending ${p.keyHint}${p.keySource === 'environment' ? ' (from environment)' : ''}. Leave blank to keep it.` : provider.value === 'custom' ? 'API key (leave blank for local programs)' : 'Paste your API key';
      keyNote.textContent = 'Saved only on this computer, in this project’s data folder. It is sent only to the provider you choose.';
      base.value = p.baseUrl || '';
      base.placeholder = p.defaultBaseUrl || 'http://localhost:11434/v1';
      baseRow.querySelector('label').textContent = provider.value === 'custom' ? 'Service address' : 'Service address (leave as is unless you use a proxy)';
      model.value = p.model || '';
      datalist.replaceChildren();
      help.textContent = PROVIDER_HELP[provider.value];
      status.textContent = '';
    };
    provider.addEventListener('change', fill);

    const loadModels = h('button', { type: 'button', text: 'Load models', onclick: async () => {
      say('Connecting…');
      try {
        const data = await json('/api/ai/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: provider.value, apiKey: key.value.trim() || undefined, baseUrl: base.value.trim() || undefined }) });
        datalist.replaceChildren(...data.models.map((m) => h('option', { value: m })));
        say(`Connected. ${data.models.length} model${data.models.length === 1 ? '' : 's'} available: choose one below (type to search).`);
        if (!model.value && data.models.length) model.focus();
      } catch (err) {
        say(err.message, true);
      }
    } });

    const save = h('button', { type: 'submit', class: 'primary', text: 'Save and use' });
    const disconnect = h('button', { type: 'button', class: 'danger', text: 'Remove this key', onclick: async () => {
      try {
        settings = await json(`/api/ai/settings/${provider.value}`, { method: 'DELETE' });
        renderHeader(); renderComposer(); renderMessages();
        fill();
        say('Removed.');
      } catch (err) {
        say(err.message, true);
      }
    } });

    const formEl = h('form', { method: 'dialog', onsubmit: async (e) => {
      e.preventDefault();
      if (!model.value.trim()) return say('Choose a model first (press “Load models”, or type its name).', true);
      if (provider.value === 'custom' && !base.value.trim()) return say('Enter the service address.', true);
      try {
        settings = await put({ provider: provider.value, apiKey: key.value.trim() || undefined, model: model.value.trim(), baseUrl: base.value.trim() });
        renderHeader(); renderComposer(); renderMessages();
        dialog.close();
      } catch (err) {
        say(err.message, true);
      }
    } },
      h('h2', { text: 'Connect an AI' }),
      h('p', { class: 'hint', text: 'Pick the service, add your API key, choose a model. Then describe a page and the builder creates it.' }),
      h('label', { for: 'ai-provider', text: 'Service' }), provider, help,
      h('label', { for: 'ai-key', text: 'API key' }), key, keyNote,
      baseRow,
      h('label', { for: 'ai-model', text: 'Model' }), h('div', { class: 'ai-model-row' }, model, loadModels), datalist,
      status,
      h('div', { class: 'dialog-actions' }, disconnect, h('span', { style: 'flex:1' }), h('button', { type: 'button', text: 'Cancel', onclick: () => dialog.close() }), save));
    dialog.append(formEl);
    fill();
    dialog.showModal();
    key.focus();
  }

  renderMessages();
  renderComposer();
  loadSettings();
  return { refresh: loadSettings, open: openConnect, updateProfile: () => { renderHeader(); renderComposer(); } };
}
