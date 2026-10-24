// Block library.
//
// Each block is plain HTML built from the lp-* classes in public/design-system.css.
// To add your own: copy any entry in BLOCKS, change the id/label/content, and it shows up
// in the editor's Blocks panel after a refresh.

// ---------- helpers ----------

// Soft gradient placeholder; swap it in the editor by double-clicking the image.
export const ph = (w = 1200, h = 900, a = '#dbe5ff', b = '#b4c6fb') => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<circle cx="${w * 0.78}" cy="${h * 0.26}" r="${Math.min(w, h) * 0.16}" fill="#ffffff" fill-opacity="0.45"/>` +
    `<path d="M0 ${h} L${w * 0.34} ${h * 0.58} L${w * 0.6} ${h * 0.82} L${w * 0.8} ${h * 0.66} L${w} ${h * 0.86} V${h} Z" fill="#ffffff" fill-opacity="0.38"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const PATHS = {
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-6"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4.5 1.8 4.5 4.5"/>',
  code: '<path d="m8 8-5 4 5 4"/><path d="m16 8 5 4-5 4"/><path d="m14 5-4 14"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
};
const icon = (name) => `<span class="lp-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]}</svg></span>`;

// Small wireframe icons for the Blocks panel.
const THUMBS = {
  announce: '<rect x="3" y="9" width="18" height="6" rx="1"/>',
  nav: '<rect x="3" y="5" width="18" height="5" rx="1"/><path d="M6 7.5h3M14 7.5h4M3 15h18M3 19h10"/>',
  hero: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 10h10M9 13h6"/><rect x="9.5" y="15.5" width="5" height="2" rx="1"/>',
  heroSplit: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 9h6M6 12h5"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  logos: '<path d="M4 8h4M10 8h4M16 8h4M4 16h4M10 16h4M16 16h4"/>',
  stats: '<path d="M5 19V9M10 19V5M15 19v-7M20 19V8"/>',
  quote: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  grid3: '<rect x="3" y="6" width="5" height="12" rx="1"/><rect x="9.5" y="6" width="5" height="12" rx="1"/><rect x="16" y="6" width="5" height="12" rx="1"/>',
  grid6: '<rect x="3" y="4" width="5" height="7" rx="1"/><rect x="9.5" y="4" width="5" height="7" rx="1"/><rect x="16" y="4" width="5" height="7" rx="1"/><rect x="3" y="13" width="5" height="7" rx="1"/><rect x="9.5" y="13" width="5" height="7" rx="1"/><rect x="16" y="13" width="5" height="7" rx="1"/>',
  row: '<rect x="3" y="6" width="8" height="12" rx="1"/><path d="M14 8h7M14 12h7M14 16h5"/>',
  rowReverse: '<rect x="13" y="6" width="8" height="12" rx="1"/><path d="M3 8h7M3 12h7M3 16h5"/>',
  steps: '<circle cx="5.5" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="18.5" cy="12" r="2.5"/><path d="M8 12h1.5M14.5 12H16"/>',
  price: '<rect x="3" y="5" width="5" height="14" rx="1"/><rect x="9.5" y="3" width="5" height="18" rx="1"/><rect x="16" y="5" width="5" height="14" rx="1"/>',
  table: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M9 5v14M15 5v14"/>',
  faq: '<path d="M4 7h12M4 12h12M4 17h12M19 7v0M19 12v0M19 17v0"/>',
  cta: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M8 12h8"/>',
  team: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 20c0-3 2.5-5 5-5M21 20c0-3-2.5-5-5-5"/>',
  gallery: '<rect x="3" y="4" width="8" height="7" rx="1"/><rect x="13" y="4" width="8" height="7" rx="1"/><rect x="3" y="13" width="8" height="7" rx="1"/><rect x="13" y="13" width="8" height="7" rx="1"/>',
  form: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8"/><rect x="8" y="16" width="5" height="2" rx="1"/>',
  mail: PATHS.mail,
  footer: '<rect x="3" y="14" width="18" height="6" rx="1"/><path d="M6 8h4M13 8h5"/>',
  space: '<path d="M12 4v16M8 7l4-3 4 3M8 17l4 3 4-3"/>',
  divider: '<path d="M3 12h18"/>',
  text: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  button: '<rect x="4" y="8" width="16" height="8" rx="4"/>',
  pill: '<rect x="6" y="9" width="12" height="6" rx="3"/>',
};
const thumb = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${THUMBS[name]}</svg>`;

const initials = (text) => `<span class="lp-avatar">${text}</span>`;

const feature = (ic, title, text) =>
  `<div class="lp-feature">${icon(ic)}<h3>${title}</h3><p>${text}</p></div>`;

const testimonial = (quote, ini, name, role) =>
  `<figure class="lp-card lp-quote-card" style="margin:0"><p>${quote}</p><figcaption class="lp-person">${initials(ini)}<div><strong>${name}</strong><span>${role}</span></div></figcaption></figure>`;

const faq = (q, a) => `<details class="lp-faq"><summary>${q}</summary><p>${a}</p></details>`;

const plan = ({ name, blurb, price, features, cta, featured }) =>
  `<div class="lp-card lp-plan${featured ? ' lp-plan-featured' : ''}">` +
  `<h3>${name}</h3><p>${blurb}</p>` +
  `<div class="lp-price">${price}<small> / month</small></div>` +
  `<ul class="lp-checks">${features.map((f) => `<li>${f}</li>`).join('')}</ul>` +
  `<a class="lp-btn ${featured ? 'lp-btn-primary' : 'lp-btn-ghost'}" href="#">${cta}</a></div>`;

const footerLinks = (title, links) =>
  `<div><h4>${title}</h4><ul>${links.map((l) => `<li><a href="#">${l}</a></li>`).join('')}</ul></div>`;

const sectionHead = (title, text) =>
  `<div class="lp-head"><h2>${title}</h2><p>${text}</p></div>`;

// ---------- categories ----------

const CATS = {
  nav: { id: 'navigation', label: 'Navigation', open: false },
  hero: { id: 'hero', label: 'Hero', open: true },
  proof: { id: 'social-proof', label: 'Social proof', open: false },
  features: { id: 'features', label: 'Features and steps', open: false },
  pricing: { id: 'pricing', label: 'Pricing', open: false },
  content: { id: 'content', label: 'Content', open: false },
  forms: { id: 'signup-forms', label: 'Sign-up and contact', open: false },
  footer: { id: 'footers', label: 'Footers', open: false },
  utility: { id: 'utility', label: 'Utility', open: false },
};

// ---------- blocks ----------

export const BLOCKS = [
  // Navigation
  {
    id: 'announcement-bar', label: 'Announcement bar', cat: CATS.nav, thumb: 'announce',
    content: `<div class="lp-announce">Version 2 is here. <a href="#">See what is new</a></div>`,
  },
  {
    id: 'nav-simple', label: 'Navigation bar', cat: CATS.nav, thumb: 'nav',
    content:
      `<header class="lp-navbar"><nav class="lp-nav"><a class="lp-brand" href="#">Brandname</a>` +
      `<div class="lp-links"><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a>` +
      `<a class="lp-btn lp-btn-primary" href="#signup">Get started</a></div></nav></header>`,
  },

  // Hero
  {
    id: 'hero-center', label: 'Hero, centered', cat: CATS.hero, thumb: 'hero',
    content:
      `<section class="lp-section lp-hero lp-hero-center lp-center"><div class="lp-container">` +
      `<h1>Turn busy work into finished work</h1>` +
      `<p class="lp-lead">One clear sentence about what you offer, who it is for, and why it is worth their next five minutes.</p>` +
      `<div class="lp-btns"><a class="lp-btn lp-btn-primary" href="#signup">Start free</a><a class="lp-btn lp-btn-ghost" href="#features">See how it works</a></div>` +
      `</div></section>`,
  },
  {
    id: 'hero-split', label: 'Hero with image', cat: CATS.hero, thumb: 'heroSplit',
    content:
      `<section class="lp-section lp-hero lp-hero-split"><div class="lp-container lp-grid-2"><div>` +
      `<h1>Plan the work. Skip the meetings about the work.</h1>` +
      `<p class="lp-lead">Explain the main benefit in plain words. Keep it to two short sentences so it is read, not skimmed past.</p>` +
      `<div class="lp-btns"><a class="lp-btn lp-btn-primary" href="#signup">Try it free</a><a class="lp-btn lp-btn-ghost" href="#">Watch the demo</a></div>` +
      `<p class="lp-note">No credit card needed. Cancel any time.</p></div>` +
      `<img class="lp-img" src="${ph(1200, 1000)}" alt="Product screenshot"></div></section>`,
  },
  {
    id: 'hero-dark', label: 'Hero, dark gradient', cat: CATS.hero, thumb: 'hero',
    content:
      `<section class="lp-section lp-hero lp-hero-dark lp-center"><div class="lp-container">` +
      `<h1>The faster way to get your idea in front of people</h1>` +
      `<p class="lp-lead">Describe the outcome your visitors get, not the features you built to deliver it.</p>` +
      `<div class="lp-btns"><a class="lp-btn lp-btn-light" href="#signup">Get early access</a><a class="lp-btn lp-btn-ghost" href="#">Talk to us</a></div>` +
      `</div></section>`,
  },
  {
    id: 'hero-signup', label: 'Hero with email sign-up', cat: CATS.hero, thumb: 'hero',
    content:
      `<section class="lp-section lp-hero lp-hero-center lp-center lp-tint"><div class="lp-container">` +
      `<h1>Be first in line when we open the doors</h1>` +
      `<p class="lp-lead">Join the waitlist and get a launch-day discount for early supporters.</p>` +
      `<form class="lp-inline-form" action="#" method="post"><input class="lp-input" type="email" name="email" placeholder="you@example.com" aria-label="Email address" required>` +
      `<button class="lp-btn lp-btn-primary" type="submit">Join the waitlist</button></form>` +
      `<p class="lp-note">We send one email at launch. Nothing else.</p></div></section>`,
  },

  // Social proof
  {
    id: 'logo-marquee', label: 'Logo marquee (scrolling)', cat: CATS.proof, thumb: 'logos',
    content:
      `<section class="lp-section" style="padding-top:40px;padding-bottom:40px;overflow:hidden"><div class="lp-container">` +
      `<p class="lp-logos-title">Trusted by industry leaders and over 10,000 teams</p></div>` +
      `<div class="lp-marquee-wrap"><div class="lp-marquee">` +
      `<div class="lp-marquee-track">` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg><span>Vertex</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg><span>Globex</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg><span>BoltHQ</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m9 12 2 2 4-4"/></svg><span>Acme Corp</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg><span>Pulse AI</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg><span>Horizon</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span>Starlight</span></div>` +
      `</div>` +
      `<div class="lp-marquee-track" aria-hidden="true">` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg><span>Vertex</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg><span>Globex</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg><span>BoltHQ</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m9 12 2 2 4-4"/></svg><span>Acme Corp</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg><span>Pulse AI</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg><span>Horizon</span></div>` +
      `<div class="lp-marquee-item"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span>Starlight</span></div>` +
      `</div>` +
      `</div></div></section>`,
  },
  {
    id: 'logo-strip', label: 'Logo strip', cat: CATS.proof, thumb: 'logos',
    content:
      `<section class="lp-section" style="padding-top:48px;padding-bottom:48px"><div class="lp-container">` +
      `<p class="lp-logos-title">Trusted by teams at</p>` +
      `<div class="lp-logos"><span class="lp-logo">Northwind</span><span class="lp-logo">Acme Co</span><span class="lp-logo">Globex</span><span class="lp-logo">Initech</span><span class="lp-logo">Umbrella</span></div>` +
      `</div></section>`,
  },
  {
    id: 'stats', label: 'Stats row', cat: CATS.proof, thumb: 'stats',
    content:
      `<section class="lp-section lp-tint"><div class="lp-container"><div class="lp-stats">` +
      `<div class="lp-stat"><strong>12k+</strong><span>Active customers</span></div>` +
      `<div class="lp-stat"><strong>98%</strong><span>Say they would recommend us</span></div>` +
      `<div class="lp-stat"><strong>4.9</strong><span>Average review score</span></div>` +
      `<div class="lp-stat"><strong>24/7</strong><span>Human support</span></div>` +
      `</div></div></section>`,
  },
  {
    id: 'testimonials-3', label: 'Testimonials, three', cat: CATS.proof, thumb: 'quote',
    content:
      `<section class="lp-section"><div class="lp-container">` +
      sectionHead('What customers say after the first month', 'Real words from real people. Replace these with your own.') +
      `<div class="lp-grid-3">` +
      testimonial('We cut our weekly reporting from half a day to twenty minutes. Nobody wants to go back.', 'AR', 'Aisha Rahman', 'Operations lead') +
      testimonial('Setup took one afternoon. The team was using it by the next morning without being asked.', 'MO', 'Marcus Oyelaran', 'Founder') +
      testimonial('Support answered in minutes, and they fixed the thing I reported the same day.', 'LC', 'Lena Cho', 'Product manager') +
      `</div></div></section>`,
  },
  {
    id: 'testimonial-big', label: 'Testimonial, featured', cat: CATS.proof, thumb: 'quote',
    content:
      `<section class="lp-section"><div class="lp-container lp-big-quote">` +
      `<blockquote>It is the first tool we adopted that nobody on the team complained about.</blockquote>` +
      `<div class="lp-person">${initials('DS')}<div style="text-align:left"><strong>Dana Silva</strong><span>Head of Operations, Northwind</span></div></div>` +
      `</div></section>`,
  },

  // Features and steps
  {
    id: 'features-3', label: 'Features, three', cat: CATS.features, thumb: 'grid3',
    content:
      `<section class="lp-section" id="features"><div class="lp-container">` +
      sectionHead('Everything you need, nothing you will not use', 'A short introduction to the three things that matter most.') +
      `<div class="lp-grid-3">` +
      feature('bolt', 'Fast from the start', 'Describe the first benefit in one or two sentences. Be specific about what changes for the reader.') +
      feature('shield', 'Safe by default', 'Describe the second benefit. Numbers and concrete details beat adjectives every time.') +
      feature('chart', 'Clear results', 'Describe the third benefit. End with what the reader can do next.') +
      `</div></div></section>`,
  },
  {
    id: 'features-6', label: 'Features, six', cat: CATS.features, thumb: 'grid6',
    content:
      `<section class="lp-section lp-tint" id="features"><div class="lp-container">` +
      sectionHead('Built for the way you actually work', 'Six reasons people switch and stay.') +
      `<div class="lp-grid-3">` +
      feature('layers', 'Organized', 'Keep everything in one place and find it again in seconds.') +
      feature('users', 'Shared', 'Invite your team and see who is working on what.') +
      feature('clock', 'Always on time', 'Reminders that arrive when they are useful, not before.') +
      feature('lock', 'Private', 'Your data stays yours, with controls you can understand.') +
      feature('globe', 'Anywhere', 'Works the same on your phone, tablet, and laptop.') +
      feature('code', 'Connected', 'Plays well with the tools you already pay for.') +
      `</div></div></section>`,
  },
  {
    id: 'feature-row', label: 'Feature, image left', cat: CATS.features, thumb: 'row',
    content:
      `<section class="lp-section"><div class="lp-container lp-row">` +
      `<img class="lp-img" src="${ph(1200, 900, '#e6efe9', '#bfd8c8')}" alt="Feature illustration">` +
      `<div><h2>Say what this feature does for the reader</h2>` +
      `<p>Add two or three sentences that explain how it works and why it saves them effort.</p>` +
      `<ul class="lp-checks"><li>A concrete outcome they care about</li><li>Another specific advantage</li><li>One more reason to keep reading</li></ul></div>` +
      `</div></section>`,
  },
  {
    id: 'feature-row-reverse', label: 'Feature, image right', cat: CATS.features, thumb: 'rowReverse',
    content:
      `<section class="lp-section lp-tint"><div class="lp-container lp-row lp-row-reverse">` +
      `<img class="lp-img" src="${ph(1200, 900, '#fbe9d7', '#f5c9a1')}" alt="Feature illustration">` +
      `<div><h2>Show the next thing they will want to know</h2>` +
      `<p>Alternate the image side from one section to the next so the page keeps a steady rhythm as people scroll.</p>` +
      `<div class="lp-btns"><a class="lp-btn lp-btn-primary" href="#">Learn more</a></div></div>` +
      `</div></section>`,
  },
  {
    id: 'steps-3', label: 'How it works, three steps', cat: CATS.features, thumb: 'steps',
    content:
      `<section class="lp-section"><div class="lp-container">` +
      sectionHead('Up and running in three steps', 'No training, no long setup.') +
      `<div class="lp-grid-3 lp-steps">` +
      `<div class="lp-step"><div class="lp-step-num">1</div><h3>Create your account</h3><p>It takes under a minute and needs only an email address.</p></div>` +
      `<div class="lp-step"><div class="lp-step-num">2</div><h3>Add your details</h3><p>Import what you have or start from a template.</p></div>` +
      `<div class="lp-step"><div class="lp-step-num">3</div><h3>Share the result</h3><p>Send a link or publish it. You are done.</p></div>` +
      `</div></div></section>`,
  },

  // Pricing
  {
    id: 'pricing-3', label: 'Pricing, three plans', cat: CATS.pricing, thumb: 'price',
    content:
      `<section class="lp-section lp-tint" id="pricing"><div class="lp-container">` +
      sectionHead('Simple pricing that scales with you', 'Start free. Upgrade when you need more.') +
      `<div class="lp-grid-3">` +
      plan({ name: 'Starter', blurb: 'For trying things out', price: '$0', features: ['1 project', 'Community support', 'Basic templates'], cta: 'Start free' }) +
      plan({ name: 'Pro', blurb: 'For people who do this daily', price: '$24', features: ['Unlimited projects', 'Priority support', 'All templates', 'Custom domain'], cta: 'Choose Pro', featured: true }) +
      plan({ name: 'Team', blurb: 'For groups that work together', price: '$79', features: ['Everything in Pro', '10 team seats', 'Shared workspaces', 'Admin controls'], cta: 'Contact sales' }) +
      `</div></div></section>`,
  },
  {
    id: 'comparison-table', label: 'Comparison table', cat: CATS.pricing, thumb: 'table',
    content:
      `<section class="lp-section"><div class="lp-container">` +
      sectionHead('Compare the plans', 'See exactly what is included before you decide.') +
      `<div class="lp-table-wrap"><table class="lp-table"><thead><tr><th>Feature</th><th>Starter</th><th>Pro</th><th>Team</th></tr></thead><tbody>` +
      `<tr><td>Projects</td><td>1</td><td>Unlimited</td><td>Unlimited</td></tr>` +
      `<tr><td>Custom domain</td><td class="lp-no">No</td><td class="lp-yes">Yes</td><td class="lp-yes">Yes</td></tr>` +
      `<tr><td>Team seats</td><td class="lp-no">No</td><td class="lp-no">No</td><td class="lp-yes">10</td></tr>` +
      `<tr><td>Priority support</td><td class="lp-no">No</td><td class="lp-yes">Yes</td><td class="lp-yes">Yes</td></tr>` +
      `</tbody></table></div></div></section>`,
  },

  // Content
  {
    id: 'faq', label: 'FAQ', cat: CATS.content, thumb: 'faq',
    content:
      `<section class="lp-section" id="faq"><div class="lp-container">` +
      sectionHead('Questions people ask before they sign up', 'Cannot find your answer? Get in touch and we will reply within a day.') +
      `<div class="lp-faq-list">` +
      faq('Is there a free plan?', 'Yes. The Starter plan is free for as long as you like, with no card required.') +
      faq('Can I cancel at any time?', 'Yes. Cancel from your account page and you will not be charged again.') +
      faq('How long does setup take?', 'Most people are finished in under ten minutes.') +
      faq('Do you offer refunds?', 'If it is not right for you, tell us within 30 days and we will refund the full amount.') +
      faq('Where is my data stored?', 'Your data is encrypted and stored in the region you choose when you sign up.') +
      `</div></div></section>`,
  },
  {
    id: 'cta-banner', label: 'Call to action banner', cat: CATS.content, thumb: 'cta',
    content:
      `<section class="lp-section" id="signup"><div class="lp-cta">` +
      `<h2>Ready to get started?</h2>` +
      `<p>Join thousands of people who stopped putting this off. It takes about two minutes.</p>` +
      `<div class="lp-btns"><a class="lp-btn lp-btn-light" href="#">Create your free account</a></div>` +
      `</div></section>`,
  },
  {
    id: 'cta-dark', label: 'Call to action, dark', cat: CATS.content, thumb: 'cta',
    content:
      `<section class="lp-section lp-dark"><div class="lp-container lp-grid-2" style="grid-template-columns:1.4fr 1fr">` +
      `<div><h2>Still deciding? Try it for two weeks.</h2><p class="lp-lead" style="margin:0">Full access, no card, no pressure.</p></div>` +
      `<div class="lp-btns" style="margin:0;justify-content:flex-end"><a class="lp-btn lp-btn-primary" href="#">Start the trial</a><a class="lp-btn lp-btn-ghost" href="#">Book a demo</a></div>` +
      `</div></section>`,
  },
  {
    id: 'team', label: 'Team', cat: CATS.content, thumb: 'team',
    content:
      `<section class="lp-section"><div class="lp-container">` +
      sectionHead('The people behind it', 'A small team that answers its own email.') +
      `<div class="lp-grid-4">` +
      [['Priya Nair', 'Founder', '#dbe5ff', '#b4c6fb'], ['Tomas Berg', 'Engineering', '#e6efe9', '#bfd8c8'], ['Amara Okafor', 'Design', '#fbe9d7', '#f5c9a1'], ['Jonas Weber', 'Support', '#efe3f7', '#d4b9ea']]
        .map(([name, role, a, b]) => `<div class="lp-team-card"><img src="${ph(400, 400, a, b)}" alt="${name}"><h3>${name}</h3><p>${role}</p></div>`)
        .join('') +
      `</div></div></section>`,
  },
  {
    id: 'gallery', label: 'Image gallery', cat: CATS.content, thumb: 'gallery',
    content:
      `<section class="lp-section"><div class="lp-container">` +
      sectionHead('A look at the work', 'Double-click any image to replace it with your own.') +
      `<div class="lp-gallery">` +
      `<img class="lp-wide" src="${ph(1600, 600, '#dbe5ff', '#b4c6fb')}" alt="Gallery image 1">` +
      `<img src="${ph(800, 600, '#e6efe9', '#bfd8c8')}" alt="Gallery image 2">` +
      `<img src="${ph(800, 600, '#fbe9d7', '#f5c9a1')}" alt="Gallery image 3">` +
      `<img src="${ph(800, 600, '#efe3f7', '#d4b9ea')}" alt="Gallery image 4">` +
      `<img src="${ph(800, 600, '#dbe5ff', '#b4c6fb')}" alt="Gallery image 5">` +
      `<img src="${ph(800, 600, '#e6efe9', '#bfd8c8')}" alt="Gallery image 6">` +
      `</div></div></section>`,
  },

  // Sign-up and contact
  {
    id: 'newsletter', label: 'Newsletter sign-up', cat: CATS.forms, thumb: 'mail',
    content:
      `<section class="lp-section lp-tint lp-center" id="signup"><div class="lp-container">` +
      `<h2>Get the short version in your inbox</h2>` +
      `<p class="lp-lead">One email a month with what we shipped and what we learned.</p>` +
      `<form class="lp-inline-form" action="#" method="post"><input class="lp-input" type="email" name="email" placeholder="you@example.com" aria-label="Email address" required>` +
      `<button class="lp-btn lp-btn-primary" type="submit">Subscribe</button></form>` +
      `</div></section>`,
  },
  {
    id: 'contact', label: 'Contact form', cat: CATS.forms, thumb: 'form',
    content:
      `<section class="lp-section" id="contact"><div class="lp-container lp-grid-2" style="align-items:start"><div>` +
      `<h2>Let us talk about your project</h2>` +
      `<p class="lp-lead">Tell us a little about what you need. A real person replies within one working day.</p>` +
      `<ul class="lp-contact-info"><li><strong>Email</strong>hello@example.com</li><li><strong>Phone</strong>+1 (555) 010-2030</li><li><strong>Office</strong>123 Example Street, Your City</li></ul></div>` +
      `<form class="lp-form" action="#" method="post">` +
      `<div class="lp-field"><label for="c-name">Name</label><input class="lp-input" id="c-name" type="text" name="name" required></div>` +
      `<div class="lp-field"><label for="c-email">Email</label><input class="lp-input" id="c-email" type="email" name="email" required></div>` +
      `<div class="lp-field"><label for="c-msg">Message</label><textarea class="lp-input" id="c-msg" name="message" required></textarea></div>` +
      `<button class="lp-btn lp-btn-primary" type="submit">Send message</button></form>` +
      `</div></section>`,
  },

  // Footers
  {
    id: 'footer-columns', label: 'Footer, columns', cat: CATS.footer, thumb: 'footer',
    content:
      `<footer class="lp-footer"><div class="lp-footer-grid">` +
      `<div><a class="lp-brand" href="#">Brandname</a><p>A short line about what you do and who you do it for.</p></div>` +
      footerLinks('Product', ['Features', 'Pricing', 'Changelog']) +
      footerLinks('Company', ['About', 'Careers', 'Contact']) +
      footerLinks('Legal', ['Privacy', 'Terms']) +
      `</div><div class="lp-footer-bottom"><span>&copy; 2026 Brandname. All rights reserved.</span><span>Made with care.</span></div></footer>`,
  },
  {
    id: 'footer-simple', label: 'Footer, simple', cat: CATS.footer, thumb: 'footer',
    content:
      `<footer class="lp-footer-simple"><div class="lp-nav"><a class="lp-brand" href="#">Brandname</a>` +
      `<p>&copy; 2026 Brandname. All rights reserved.</p>` +
      `<div class="lp-links"><a href="#">Privacy</a><a href="#">Terms</a></div></div></footer>`,
  },

  // Utility
  {
    id: 'text-block', label: 'Heading and text', cat: CATS.utility, thumb: 'text',
    content:
      `<section class="lp-section"><div class="lp-container" style="max-width:720px"><h2>A clear heading</h2>` +
      `<p>Write a short paragraph here. Keep lines comfortably short so the text is easy to read.</p></div></section>`,
  },
  {
    id: 'button', label: 'Button', cat: CATS.utility, thumb: 'button',
    content: `<a class="lp-btn lp-btn-primary" href="#">Button text</a>`,
  },
  {
    id: 'pill', label: 'Badge', cat: CATS.utility, thumb: 'pill',
    content: `<span class="lp-pill">New this month</span>`,
  },
  {
    id: 'divider', label: 'Divider', cat: CATS.utility, thumb: 'divider',
    content: `<hr class="lp-divider">`,
  },
  {
    id: 'spacer', label: 'Spacer', cat: CATS.utility, thumb: 'space',
    content: `<div class="lp-spacer"></div>`,
  },
];

export const blockContent = (id) => BLOCKS.find((b) => b.id === id)?.content ?? '';

// GrapesJS plugin that registers every block above.
export default function blocksPlugin(editor) {
  for (const b of BLOCKS) {
    editor.Blocks.add(`lp-${b.id}`, {
      label: b.label,
      category: b.cat,
      media: thumb(b.thumb),
      content: b.content,
      select: true,
    });
  }
}
