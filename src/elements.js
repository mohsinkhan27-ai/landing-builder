// Freeform elements and strips for the "Add" panel.
//
// Elements are dropped into a strip's stage and can be moved anywhere with the mouse.
// html          the markup that is inserted (no position: that is set where you drop it)
// component     alternative to html, for GrapesJS plugin components (tabs, countdown...)
// w, h          default size in px. setH: also fix the height (shapes, images)

import { ph, PATHS } from './blocks.js';

const st = (obj) => Object.entries(obj).map(([k, v]) => `${k}:${v}`).join(';');
const HEAD = 'var(--lp-font-head)';
const INK = '#0e1a2b';

const heading = (tag, size, text) =>
  `<${tag} class="lp-free" style="${st({ 'font-size': `${size}px`, 'line-height': 1.1, 'font-weight': 700, 'letter-spacing': '-0.02em', color: INK, 'font-family': HEAD })}">${text}</${tag}>`;

const para = (size, text, extra = {}) =>
  `<p class="lp-free" style="${st({ 'font-size': `${size}px`, 'line-height': 1.6, color: '#3a4a5d', ...extra })}">${text}</p>`;

const icon = (name, color = '#2457f5') =>
  `<div class="lp-free lp-ico" style="${st({ color })}"><svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]}</svg></div>`;

const faqItem = (q, a) => `<details class="lp-faq" open><summary>${q}</summary><p>${a}</p></details>`;

const featureCard = (ic, title, text) =>
  `<div class="lp-free lp-card"><span class="lp-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[ic]}</svg></span><h3>${title}</h3><p>${text}</p></div>`;

export const CATEGORIES = [
  { id: 'text', label: 'Text', icon: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>' },
  { id: 'button', label: 'Buttons', icon: '<rect x="3" y="8" width="18" height="8" rx="4"/>' },
  { id: 'media', label: 'Image & video', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>' },
  { id: 'shapes', label: 'Boxes & shapes', icon: '<rect x="3" y="3" width="10" height="10" rx="1"/><circle cx="16" cy="16" r="5"/>' },
  { id: 'icons', label: 'Icons', icon: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>' },
  { id: 'cards', label: 'Cards', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h4"/>' },
  { id: 'forms', label: 'Forms', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8"/><rect x="8" y="16" width="5" height="2" rx="1"/>' },
  { id: 'interactive', label: 'Interactive', icon: '<path d="M9 11V5a2 2 0 0 1 4 0v6m0 0V9a2 2 0 0 1 4 0v5a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-3-4a2 2 0 0 1 3-2l1 1"/>' },
  { id: 'animated', label: 'Animated', icon: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>' },
  { id: 'strips', label: 'Strips', icon: '<rect x="3" y="5" width="18" height="6" rx="1"/><rect x="3" y="13" width="18" height="6" rx="1"/>' },
  { id: 'sections', label: 'Ready-made sections', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>' },
];

export const STRIP_HTML = (variant = '', height = 520) =>
  `<section class="lp-strip ${variant}" style="height:${height}px"><div class="lp-stage"></div></section>`;

export const ELEMENTS = [
  // ---------- Text ----------
  { id: 'h1', cat: 'text', group: 'Headings', label: 'Heading 1', w: 620, html: heading('h1', 56, 'Your headline here') },
  { id: 'h2', cat: 'text', group: 'Headings', label: 'Heading 2', w: 520, html: heading('h2', 40, 'A section heading') },
  { id: 'h3', cat: 'text', group: 'Headings', label: 'Heading 3', w: 420, html: heading('h3', 28, 'A smaller heading') },
  {
    id: 'lead', cat: 'text', group: 'Paragraphs', label: 'Lead paragraph', w: 520,
    html: para(22, 'Write one or two sentences that explain what you offer and why it matters.'),
  },
  {
    id: 'para', cat: 'text', group: 'Paragraphs', label: 'Paragraph', w: 460,
    html: para(17, 'Add your text here. Click it, then use the editing window to change the font, size, color and style.'),
  },
  { id: 'small', cat: 'text', group: 'Paragraphs', label: 'Small text', w: 360, html: para(14, 'Fine print, captions and notes go here.', { color: '#68788c' }) },
  {
    id: 'quote', cat: 'text', group: 'Paragraphs', label: 'Quote', w: 520,
    html: `<blockquote class="lp-free" style="${st({ 'font-size': '28px', 'line-height': 1.35, 'font-family': HEAD, color: INK, 'border-left': '4px solid #2457f5', 'padding-left': '20px' })}">A short, memorable quote from a happy customer.</blockquote>`,
  },
  {
    id: 'badge', cat: 'text', group: 'Labels', label: 'Badge', w: 150,
    html: `<span class="lp-free lp-pill" style="margin:0">New this month</span>`,
  },

  // ---------- Buttons ----------
  { id: 'btn-primary', cat: 'button', group: 'Buttons', label: 'Primary button', w: 170, html: `<a class="lp-free lp-btn lp-btn-primary" href="#">Get started</a>` },
  { id: 'btn-ghost', cat: 'button', group: 'Buttons', label: 'Outline button', w: 170, html: `<a class="lp-free lp-btn lp-btn-ghost" href="#">Learn more</a>` },
  { id: 'btn-light', cat: 'button', group: 'Buttons', label: 'Light button', w: 170, dark: true, html: `<a class="lp-free lp-btn lp-btn-light" href="#">Try it free</a>` },
  {
    id: 'btn-link', cat: 'button', group: 'Buttons', label: 'Text link', w: 140,
    html: `<a class="lp-free" href="#" style="${st({ 'font-weight': 600, 'font-size': '17px', color: '#2457f5', 'text-decoration': 'underline' })}">Read the story</a>`,
  },

  // ---------- Image & video ----------
  { id: 'image', cat: 'media', group: 'Images', label: 'Image', w: 360, h: 260, setH: true, html: `<img class="lp-free lp-img" src="${ph(1200, 900)}" alt="Image" style="object-fit:cover;border-radius:16px">` },
  { id: 'image-wide', cat: 'media', group: 'Images', label: 'Wide image', w: 620, h: 300, setH: true, html: `<img class="lp-free lp-img" src="${ph(1600, 760, '#e6efe9', '#bfd8c8')}" alt="Image" style="object-fit:cover;border-radius:16px">` },
  { id: 'image-round', cat: 'media', group: 'Images', label: 'Round image', w: 160, h: 160, setH: true, html: `<img class="lp-free lp-img" src="${ph(400, 400, '#fbe9d7', '#f5c9a1')}" alt="Image" style="object-fit:cover;border-radius:50%">` },
  {
    id: 'video', cat: 'media', group: 'Video and maps', label: 'YouTube video', w: 560, h: 315, setH: true,
    component: () => ({ type: 'video', provider: 'yt', videoId: 'jNQXAC9IVRw', src: 'https://www.youtube.com/embed/jNQXAC9IVRw', classes: ['lp-free', 'lp-embed'], style: { 'border-radius': '16px', overflow: 'hidden' } }),
    preview: `<div style="width:100%;height:100%;background:#0e1a2b;border-radius:12px;display:flex;align-items:center;justify-content:center"><div style="width:0;height:0;border-left:26px solid #fff;border-top:16px solid transparent;border-bottom:16px solid transparent"></div></div>`,
  },
  {
    id: 'map', cat: 'media', group: 'Video and maps', label: 'Google map', w: 560, h: 315, setH: true,
    component: () => ({ type: 'map', address: 'Mumbai, India', zoom: 13, classes: ['lp-free', 'lp-embed'], style: { 'border-radius': '16px', overflow: 'hidden' } }),
    preview: `<div style="width:100%;height:100%;background:linear-gradient(135deg,#dfe9f7,#c4d6ee);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#2457f5;font:600 18px system-ui">Map</div>`,
  },

  // ---------- Boxes & shapes ----------
  { id: 'box', cat: 'shapes', group: 'Boxes', label: 'Rounded box', w: 300, h: 200, setH: true, html: `<div class="lp-free lp-box"></div>` },
  { id: 'box-shadow', cat: 'shapes', group: 'Boxes', label: 'Box with shadow', w: 300, h: 200, setH: true, html: `<div class="lp-free lp-box" style="border:0;box-shadow:0 12px 32px rgba(14,26,43,.12)"></div>` },
  { id: 'box-dark', cat: 'shapes', group: 'Boxes', label: 'Dark box', w: 300, h: 200, setH: true, html: `<div class="lp-free lp-box" style="background:#0e1a2b;border:0"></div>` },
  { id: 'box-gradient', cat: 'shapes', group: 'Boxes', label: 'Gradient box', w: 300, h: 200, setH: true, html: `<div class="lp-free lp-box" style="background:linear-gradient(140deg,#2457f5,#7aa2ff);border:0"></div>` },
  { id: 'container', cat: 'shapes', group: 'Containers', label: 'Container (holds other elements)', w: 340, h: 240, setH: true, html: `<div class="lp-free lp-box lp-group"></div>` },
  { id: 'circle', cat: 'shapes', group: 'Shapes', label: 'Circle', w: 160, h: 160, setH: true, deco: true, html: `<div class="lp-free lp-box lp-deco" style="background:#e8eefe;border:0;border-radius:50%"></div>` },
  { id: 'pill', cat: 'shapes', group: 'Shapes', label: 'Pill', w: 220, h: 64, setH: true, deco: true, html: `<div class="lp-free lp-box lp-deco" style="background:#ffb703;border:0;border-radius:999px"></div>` },
  { id: 'line', cat: 'shapes', group: 'Shapes', label: 'Line', w: 400, h: 2, setH: true, deco: true, html: `<div class="lp-free lp-deco" style="background:#0e1a2b"></div>` },

  // ---------- Icons ----------
  ...Object.keys(PATHS).map((name) => ({
    id: `icon-${name}`, cat: 'icons', group: 'Icons', label: name[0].toUpperCase() + name.slice(1), w: 56, h: 56, setH: true, html: icon(name),
  })),

  // ---------- Cards ----------
  { id: 'card-feature', cat: 'cards', group: 'Cards', label: 'Feature card', w: 280, html: featureCard('bolt', 'A clear benefit', 'Explain this feature in one or two short sentences.') },
  {
    id: 'card-stat', cat: 'cards', group: 'Cards', label: 'Stat card', w: 220,
    html: `<div class="lp-free lp-card lp-stat"><strong>98%</strong><span>Customer satisfaction</span></div>`,
  },
  {
    id: 'card-testimonial', cat: 'cards', group: 'Cards', label: 'Testimonial card', w: 340,
    html: `<figure class="lp-free lp-card lp-quote-card" style="margin:0"><p>It saved us hours every week. I would not go back.</p><figcaption class="lp-person"><span class="lp-avatar">AR</span><div><strong>Aisha Rahman</strong><span>Operations lead</span></div></figcaption></figure>`,
  },
  {
    id: 'card-price', cat: 'cards', group: 'Cards', label: 'Pricing card', w: 280,
    html: `<div class="lp-free lp-card lp-plan lp-plan-featured"><h3>Pro</h3><p>For people who do this daily</p><div class="lp-price">$24<small> / month</small></div><ul class="lp-checks"><li>Unlimited projects</li><li>Priority support</li><li>Custom domain</li></ul><a class="lp-btn lp-btn-primary" href="#">Choose Pro</a></div>`,
  },
  {
    id: 'card-profile', cat: 'cards', group: 'Cards', label: 'Profile card', w: 240,
    html: `<div class="lp-free lp-card lp-team-card"><img src="${ph(400, 400)}" alt="Profile photo"><h3>Priya Nair</h3><p>Founder</p></div>`,
  },

  // ---------- Forms ----------
  { id: 'f-text', cat: 'forms', group: 'Fields', label: 'Text field', w: 300, html: `<input class="lp-free lp-input" type="text" name="name" placeholder="Your name">` },
  { id: 'f-email', cat: 'forms', group: 'Fields', label: 'Email field', w: 300, html: `<input class="lp-free lp-input" type="email" name="email" placeholder="you@example.com" required>` },
  { id: 'f-area', cat: 'forms', group: 'Fields', label: 'Message box', w: 380, h: 140, setH: true, html: `<textarea class="lp-free lp-input" name="message" placeholder="Your message"></textarea>` },
  {
    id: 'f-select', cat: 'forms', group: 'Fields', label: 'Dropdown', w: 300,
    html: `<select class="lp-free lp-input" name="choice"><option>Choose an option</option><option>Option one</option><option>Option two</option></select>`,
  },
  { id: 'f-submit', cat: 'forms', group: 'Fields', label: 'Submit button', w: 170, html: `<button class="lp-free lp-btn lp-btn-primary" type="submit">Send message</button>` },
  {
    id: 'f-subscribe', cat: 'forms', group: 'Complete forms', label: 'Subscribe bar', w: 520,
    html: `<form class="lp-free lp-inline-form" action="#" method="post"><input class="lp-input" type="email" name="email" placeholder="you@example.com" aria-label="Email address" required><button class="lp-btn lp-btn-primary" type="submit">Subscribe</button></form>`,
  },
  {
    id: 'f-contact', cat: 'forms', group: 'Complete forms', label: 'Contact form', w: 440,
    html: `<form class="lp-free lp-form" action="#" method="post"><div class="lp-field"><label for="cf-name">Name</label><input class="lp-input" id="cf-name" type="text" name="name" required></div><div class="lp-field"><label for="cf-email">Email</label><input class="lp-input" id="cf-email" type="email" name="email" required></div><div class="lp-field"><label for="cf-msg">Message</label><textarea class="lp-input" id="cf-msg" name="message" required></textarea></div><button class="lp-btn lp-btn-primary" type="submit">Send message</button></form>`,
  },

  // ---------- Interactive ----------
  {
    id: 'faq', cat: 'interactive', group: 'Accordions', label: 'FAQ accordion', w: 700,
    html:
      `<div class="lp-free lp-faq-list">` +
      faqItem('Is there a free plan?', 'Yes. The Starter plan is free for as long as you like, with no card required.') +
      faqItem('Can I cancel at any time?', 'Yes. Cancel from your account page and you will not be charged again.') +
      faqItem('How long does setup take?', 'Most people are finished in under ten minutes.') +
      `</div>`,
  },
  {
    id: 'tabs', cat: 'interactive', group: 'Widgets', label: 'Tabs', w: 600, plugin: 'tabs',
    component: () => ({ type: 'tabs', classes: ['lp-free'] }),
    preview: `<div style="font:600 14px system-ui;color:#3a4a5d;border:1px solid #e1e7ef;border-radius:10px;background:#fff;height:100%"><div style="display:flex;gap:2px;border-bottom:1px solid #e1e7ef"><span style="padding:10px 14px;color:#2457f5;border-bottom:2px solid #2457f5">Tab 1</span><span style="padding:10px 14px">Tab 2</span></div></div>`,
  },
  {
    id: 'countdown', cat: 'interactive', group: 'Widgets', label: 'Countdown timer', w: 480, plugin: 'countdown',
    component: () => ({ type: 'countdown', classes: ['lp-free'], startfrom: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10) }),
    preview: `<div style="font:700 26px system-ui;color:#0e1a2b;display:flex;gap:10px;align-items:center;justify-content:center;height:100%">14 : 08 : 32</div>`,
  },
  {
    id: 'custom-code', cat: 'interactive', group: 'Widgets', label: 'Custom HTML / embed', w: 480, h: 200, plugin: 'custom-code',
    component: () => ({ type: 'custom-code', classes: ['lp-free'] }),
    preview: `<div style="font:600 18px ui-monospace,monospace;color:#2457f5;display:flex;align-items:center;justify-content:center;height:100%;background:#f1f4f9;border-radius:10px">&lt;/&gt;</div>`,
  },

  // ---------- Animated (ready-made examples of each animation type) ----------
  {
    id: 'anim-enter-fade', cat: 'animated', group: 'Entrance (when scrolled into view)', label: 'Fade-in heading', w: 520,
    html: `<h2 class="lp-free" data-enter="fade" data-enter-duration="0.9" style="${st({ 'font-size': '40px', 'line-height': 1.1, 'font-weight': 700, 'letter-spacing': '-0.02em', color: INK, 'font-family': HEAD })}">Fades in as you scroll</h2>`,
  },
  {
    id: 'anim-enter-slide', cat: 'animated', group: 'Entrance (when scrolled into view)', label: 'Slide-up text', w: 460,
    html: para(18, 'This text rises into place the moment it scrolls into view.').replace('<p class="lp-free"', '<p class="lp-free" data-enter="slide-up" data-enter-duration="0.9" data-enter-delay="0.15"'),
  },
  {
    id: 'anim-enter-reveal', cat: 'animated', group: 'Entrance (when scrolled into view)', label: 'Reveal image', w: 360, h: 260, setH: true,
    html: `<img class="lp-free lp-img" data-enter="reveal-left" data-enter-duration="1.1" src="${ph(1200, 900, '#fbe9d7', '#f5c9a1')}" alt="Image" style="object-fit:cover;border-radius:16px">`,
  },
  {
    id: 'anim-hover-card', cat: 'animated', group: 'Hover (container, button, child)', label: 'Hover card', w: 330, h: 250, setH: true,
    html:
      `<div class="lp-free lp-box lp-group" style="background:#ffffff;border:0;border-radius:20px;box-shadow:0 12px 32px rgba(14,26,43,.12)" data-fx='${JSON.stringify([
        { on: 'hover', t: 'self', kind: 'bg', v: '#e8eefe', props: { bg: '#e8eefe' }, dur: 0.4, ease: 'ease' },
        { on: 'hover', t: 'btn', kind: 'rotate', v: 360, props: { rotate: 360 }, dur: 0.7, ease: 'ease-in-out' },
        { on: 'hover', t: 'more', kind: 'fadein', props: { opacity: 1 }, base: { opacity: 0 }, dur: 0.5, ease: 'ease' },
      ])}'>` +
      `<h3 class="lp-free" style="left:28px;top:28px;width:270px;font-size:26px;line-height:1.15;color:${INK};font-family:${HEAD}">Hover over this card</h3>` +
      `<p class="lp-free" data-fx-id="more" style="left:28px;top:84px;width:270px;font-size:16px;line-height:1.55;color:#3a4a5d">The color shifts, the button spins and this text fades in.</p>` +
      `<a class="lp-free lp-btn lp-btn-primary" data-fx-id="btn" href="#" style="left:28px;top:172px;width:52px;height:52px;padding:0;display:flex;align-items:center;justify-content:center;font-size:26px;line-height:1">+</a>` +
      `</div>`,
  },
  {
    id: 'anim-click-gallery', cat: 'animated', group: 'Click (toggle)', label: 'Click to move images away', w: 560, h: 260, setH: true,
    html:
      `<div class="lp-free lp-box lp-group" style="background:#f1f4f9;border:0;border-radius:20px" data-fx='${JSON.stringify([
        { on: 'click', t: 'imgA', kind: 'move', x: -340, y: 0, props: { x: -340, y: 0 }, dur: 0.7, ease: 'ease-in-out', toggle: true },
        { on: 'click', t: 'imgB', kind: 'move', x: 340, y: 0, props: { x: 340, y: 0 }, dur: 0.7, ease: 'ease-in-out', toggle: true },
      ])}'>` +
      `<p class="lp-free" style="left:0;top:104px;width:560px;text-align:center;font-size:22px;font-weight:600;color:${INK};font-family:${HEAD}">Click again to bring them back</p>` +
      `<img class="lp-free lp-img" data-fx-id="imgA" src="${ph(600, 600, '#dbe5ff', '#b4c6fb')}" alt="Image" style="left:70px;top:30px;width:200px;height:200px;object-fit:cover;border-radius:16px">` +
      `<img class="lp-free lp-img" data-fx-id="imgB" src="${ph(600, 600, '#fbe9d7', '#f5c9a1')}" alt="Image" style="left:290px;top:30px;width:200px;height:200px;object-fit:cover;border-radius:16px">` +
      `</div>`,
  },
  {
    id: 'anim-sticky-strip', cat: 'animated', group: 'Scroll (shrinks while you scroll)', label: 'Sticky strip that shrinks', section: true,
    html:
      `<section class="lp-strip lp-hero-dark" data-sticky="1" data-sticky-top="0" data-scroll="shrink" data-scroll-to="0.72" data-scroll-range="520" data-scroll-radius="40" style="height:560px"><div class="lp-stage">` +
      `<h1 class="lp-free" style="left:20px;top:170px;width:620px;font-size:56px;line-height:1.08;font-weight:700;letter-spacing:-0.02em;color:#ffffff;font-family:${HEAD}">This strip shrinks as you scroll</h1>` +
      `<p class="lp-free" style="left:20px;top:340px;width:520px;font-size:20px;line-height:1.6;color:#cfdaea">It stays pinned to the top while the next strip slides over it.</p>` +
      `</div></section>`,
  },
  {
    id: 'anim-loop-button', cat: 'animated', group: 'Loop (never stops)', label: 'Breathing button', w: 170,
    html: `<a class="lp-free lp-btn lp-btn-primary" href="#" data-loop="breathe" data-loop-duration="3" data-loop-strength="8">Get started</a>`,
  },
  {
    id: 'anim-loop-circle', cat: 'animated', group: 'Loop (never stops)', label: 'Breathing shape', w: 160, h: 160, setH: true, deco: true,
    html: `<div class="lp-free lp-box lp-deco" data-loop="breathe" data-loop-duration="5" data-loop-strength="10" style="background:linear-gradient(140deg,#2457f5,#7aa2ff);border:0;border-radius:50%"></div>`,
  },

  // ---------- Strips ----------
  { id: 'strip-white', cat: 'strips', group: 'Strips', label: 'White strip', strip: '', html: STRIP_HTML('') },
  { id: 'strip-tint', cat: 'strips', group: 'Strips', label: 'Light grey strip', strip: 'lp-tint', html: STRIP_HTML('lp-tint') },
  { id: 'strip-dark', cat: 'strips', group: 'Strips', label: 'Dark strip', strip: 'lp-dark', html: STRIP_HTML('lp-dark') },
  { id: 'strip-gradient', cat: 'strips', group: 'Strips', label: 'Gradient strip', strip: 'lp-hero-dark', html: STRIP_HTML('lp-hero-dark') },
  { id: 'strip-short', cat: 'strips', group: 'Strips', label: 'Short strip', strip: '', html: STRIP_HTML('', 240) },
  { id: 'strip-tall', cat: 'strips', group: 'Strips', label: 'Tall strip', strip: '', html: STRIP_HTML('', 760) },
];

// Elements that are whole top-level sections rather than free elements.
export const isSection = (item) => item.cat === 'strips' || item.cat === 'sections' || !!item.section;
