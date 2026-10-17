// What the AI is told, how its answer is read, and how it is cleaned before it reaches your page.

import { BLOCKS, PATHS, ph } from './blocks.js';

// ---------- turning the page into something compact to send ----------

// The builder's placeholder pictures are long data addresses. Send a short token instead.
export function compactForAi(html) {
  return String(html)
    .replace(/src="data:image\/svg\+xml,([^"]+)"/g, (match, encoded) => {
      let w = 1200;
      let h = 800;
      try {
        const svg = decodeURIComponent(encoded);
        w = /width="(\d+)"/.exec(svg)?.[1] || w;
        h = /height="(\d+)"/.exec(svg)?.[1] || h;
      } catch {
        /* keep defaults */
      }
      return `src="placeholder:${w}x${h}"`;
    })
    .replace(/src="data:[^"]{200,}"/g, 'src="placeholder:1200x800"')
    .replace(/url\((["']?)data:[^)]{200,}\)/g, 'url(placeholder:1200x800)');
}

// ---------- the system prompt ----------

const SECTION_IDS = ['nav-simple', 'announcement-bar', 'hero-split', 'hero-center', 'hero-dark', 'hero-signup', 'logo-strip', 'stats', 'features-3', 'feature-row', 'feature-row-reverse', 'steps-3', 'testimonials-3', 'pricing-3', 'faq', 'cta-banner', 'newsletter', 'contact', 'footer-columns'];

let cached = '';
export function systemPrompt() {
  if (cached) return cached;
  const patterns = SECTION_IDS.map((id) => {
    const block = BLOCKS.find((b) => b.id === id);
    return block ? `<!-- ${block.label} -->\n${compactForAi(block.content)}` : '';
  }).filter(Boolean).join('\n\n');
  const icons = Object.entries(PATHS).map(([name, d]) => `${name}: ${d}`).join('\n');

  cached = `You are a senior web designer and copywriter. You build landing pages inside a visual page builder. The person describes a page (or asks for changes) and you answer with the page's HTML, which the builder turns into editable elements.

# Output format (follow exactly)
1. One or two short sentences saying what you built or changed. No headings, no lists.
2. Then ONE fenced code block marked html that contains the COMPLETE page body.
3. Only if you truly need extra CSS: then ONE fenced block marked css. Prefer the classes listed below and avoid custom CSS.
4. Nothing after the code blocks.

# The page body
- Return body content only: a sequence of top-level <header>, <section> and <footer> elements. Never output <html>, <head>, <body>, <script>, <style>, <link>, or <iframe>.
- Use ONLY the classes below. They are responsive and already styled, so do not set fixed pixel widths on containers and avoid inline style (small tweaks such as max-width are fine).
- Every image must be written as <img class="lp-img" src="placeholder:WIDTHxHEIGHT" alt="a useful description"> (for example placeholder:1200x900). The person will replace the pictures. Never use external image addresses, and never invent file names.
- Write specific, benefit-led copy for the business described. No lorem ipsum, no "Brandname" or "Your headline here". Invent a fitting brand name if none is given. Keep sentences short.
- A typical landing page has 6 to 9 sections: navigation, hero with one clear primary call to action, social proof, features or benefits, how it works or pricing, FAQ, a closing call to action, footer. Fit the page to what was asked.
- Navigation links use anchors (#features, #pricing, #faq, #signup) and the matching sections carry those ids.
- Alternate section backgrounds for rhythm: default white, lp-tint (light grey), lp-dark (dark). Put the lp-* classes on the <section>.
- FAQ items use <details class="lp-faq"><summary>Question</summary><p>Answer</p></details> inside <div class="lp-faq-list">.
- Forms are layout only, so use action="#" and method="post".
- Never invent facts such as customer counts, awards or prices unless the person gave them. Where a number is needed, use a clearly plausible placeholder wording they can edit, such as "Plans from $19 a month".

# Design system classes
Layout: lp-section (padding), lp-container (max width, centered), lp-tint, lp-dark, lp-center (centers text), lp-head (centered section heading block: h2 + p), lp-lead (larger intro paragraph), lp-grid-2, lp-grid-3, lp-grid-4, lp-grid-2e (equal columns), lp-row and lp-row-reverse (image beside text).
Buttons: lp-btn with lp-btn-primary, lp-btn-ghost, lp-btn-light (on dark), lp-btn-outline-light. Wrap several in <div class="lp-btns">.
Cards and bits: lp-card, lp-icon (icon tile, contains an inline svg), lp-pill (small badge), lp-checks (a <ul> with check marks), lp-img, lp-divider, lp-note (small print under a hero), lp-person, lp-avatar (initials circle).
Navigation: <header class="lp-navbar"><nav class="lp-nav"><a class="lp-brand">…</a><div class="lp-links">…</div></nav></header>.
Heroes: lp-hero with lp-hero-center, lp-hero-split or lp-hero-dark.
Social proof: lp-logos, lp-logo, lp-logos-title, lp-stats, lp-stat (a <strong> number and a <span> label), lp-quote-card, lp-big-quote.
Features: lp-feature, lp-steps, lp-step, lp-step-num.
Pricing: lp-plan, lp-plan-featured, lp-price, lp-table-wrap, lp-table, lp-yes, lp-no.
Other: lp-cta (a rounded call-to-action band inside a section), lp-team-card, lp-gallery (with lp-wide), lp-form, lp-field, lp-input, lp-inline-form, lp-contact-info, lp-footer, lp-footer-grid, lp-footer-bottom, lp-footer-simple, lp-faq-list, lp-faq.
Colors come from the system, so do not hard-code colors.

# Icons
Icons are inline SVG inside the lp-icon tile: <span class="lp-icon"><svg viewBox="0 0 24 24" aria-hidden="true">PATH</svg></span>. Available paths (use these only):
${icons}

# Section patterns to copy (adapt the text, keep the structure)
${patterns}

# Optional animation (use sparingly: a few entrance effects are enough)
Add data-enter="fade", "slide-up", "zoom", "from-left", "from-right" or "reveal-left" to a heading, paragraph, card or image to animate it when it scrolls into view. Optional: data-enter-delay="0.15" (seconds). On a button, data-loop="breathe" makes it gently pulse.

# Changing an existing page
When the person asks for changes, the message ends with the CURRENT PAGE (its html, and css if any). Return the complete updated page. Keep everything they did not ask to change exactly as it is, including ids, classes, inline style attributes and data-* attributes. Elements with class lp-free inside lp-strip and lp-stage are positioned freely with absolute coordinates: keep their style attributes. Images that already have real addresses (starting with /pages/) stay as they are.`;
  return cached;
}

// ---------- reading the answer ----------

export function extractPage(text) {
  const read = (lang) => {
    const start = new RegExp(`\`\`\`${lang}[^\\n]*\\n`, 'i').exec(text);
    if (!start) return null;
    const from = start.index + start[0].length;
    const end = text.indexOf('```', from);
    return { code: text.slice(from, end < 0 ? undefined : end), complete: end >= 0, start: start.index, end: end < 0 ? text.length : end + 3 };
  };
  const html = read('html');
  const css = read('css');
  let explanation = text;
  for (const block of [html, css].filter(Boolean).sort((a, b) => b.start - a.start)) explanation = explanation.slice(0, block.start) + explanation.slice(block.end);
  return {
    html: html?.code.trim() || '',
    htmlComplete: !!html?.complete,
    hasHtml: !!html,
    css: css?.code.trim() || '',
    explanation: explanation.replace(/```[\s\S]*$/, '').trim(),
  };
}

export const omitCode = (text) => text.replace(/```(?:html|css)[^\n]*\n[\s\S]*?(?:```|$)/gi, '[page code omitted: the current page is sent with each request]');

// ---------- cleaning what the AI wrote ----------

const PALETTES = [['#dbe5ff', '#b4c6fb'], ['#e6efe9', '#bfd8c8'], ['#fbe9d7', '#f5c9a1'], ['#efe3f7', '#d4b9ea']];
let paletteIndex = 0;
const placeholder = (w, h) => {
  const [a, b] = PALETTES[paletteIndex++ % PALETTES.length];
  return ph(Math.min(2400, Math.max(40, Number(w) || 1200)), Math.min(2400, Math.max(40, Number(h) || 800)), a, b);
};

const SAFE_FRAME = /^https:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/embed|player\.vimeo\.com\/video|maps\.google\.com|www\.google\.com\/maps\/embed)/i;

export function sanitizeCss(css) {
  return String(css || '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(|javascript:|behavior\s*:|-moz-binding/gi, '')
    .replace(/url\(\s*(['"]?)https?:[^)]*\)/gi, 'none')
    .slice(0, 60000);
}

export function prepareAiHtml(html, allowedUrls = []) {
  const doc = new DOMParser().parseFromString(`<body>${String(html)}</body>`, 'text/html');
  doc.body.querySelectorAll('script, style, link, meta, base, object, embed, title, noscript').forEach((n) => n.remove());
  doc.body.querySelectorAll('iframe').forEach((f) => {
    if (!SAFE_FRAME.test(f.getAttribute('src') || '')) f.remove();
  });
  for (const el of doc.body.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name) || /^srcset$/i.test(attr.name)) el.removeAttribute(attr.name);
      else if (/^(?:href|src|action|formaction|xlink:href)$/i.test(attr.name) && /^\s*(?:javascript|vbscript|data:text\/html)/i.test(attr.value)) el.setAttribute(attr.name, '#');
    }
    if (el.hasAttribute('style')) {
      el.setAttribute(
        'style',
        el.getAttribute('style')
          .replace(/url\(\s*(['"]?)placeholder:(\d+)x(\d+)\1\s*\)/gi, (m, q, w, h) => `url("${placeholder(w, h)}")`)
          .replace(/url\(\s*(['"]?)https?:[^)]*\)/gi, 'none')
          .replace(/expression\s*\(|javascript:/gi, ''),
      );
    }
  }
  for (const img of doc.body.querySelectorAll('img')) {
    const src = (img.getAttribute('src') || '').trim();
    const m = /^placeholder:(\d+)x(\d+)/i.exec(src);
    if (m) img.setAttribute('src', placeholder(m[1], m[2]));
    else if (!src || (/^(?:https?:)?\/\//i.test(src) && !allowedUrls.includes(src))) {
      // An address the AI made up would be a broken picture. Use a placeholder the person can replace.
      img.setAttribute('src', placeholder(img.getAttribute('width') || 1200, img.getAttribute('height') || 800));
    }
    if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
    if (!img.classList.length) img.classList.add('lp-img');
  }
  return doc.body.innerHTML;
}
