// Starter pages, built by stacking blocks from blocks.js.
// Add your own by listing block ids in the order they should appear.

import { blockContent } from './blocks.js';
import { ELEMENTS, STRIP_HTML } from './elements.js';

const stack = (...ids) => ids.map(blockContent).join('\n');

const element = (id) => ELEMENTS.find((e) => e.id === id).html;

// Adds position (and size) to the first tag of an element's markup.
const at = (html, left, top, width, height) => {
  const props = `left:${left}px;top:${top}px;${width ? `width:${width}px;` : ''}${height ? `height:${height}px;` : ''}`;
  return html.replace(/^(<\w+)([^>]*)>/, (match, tag, attrs) =>
    /style="/.test(attrs) ? `${tag}${attrs.replace('style="', `style="${props}`)}>` : `${tag}${attrs} style="${props}">`,
  );
};

const freeformHero = STRIP_HTML('', 540).replace(
  '<div class="lp-stage"></div>',
  `<div class="lp-stage">${[
    at(element('badge'), 20, 96),
    at(element('h1'), 20, 140, 520),
    at(element('lead'), 20, 292, 440),
    at(element('btn-primary'), 20, 404),
    at(element('btn-ghost'), 200, 404),
    at(element('box-gradient'), 590, 86, 290, 360),
    at(element('image'), 560, 120, 290, 360),
  ].join('')}</div>`,
);

export const TEMPLATES = [
  { id: 'blank', label: 'Blank page', html: '' },
  { id: 'freeform', label: 'Freeform hero (drag everything)', html: `${stack('nav-simple')}${freeformHero}` },
  {
    id: 'saas',
    label: 'Product / SaaS',
    html: stack(
      'announcement-bar', 'nav-simple', 'hero-split', 'logo-strip', 'features-3',
      'feature-row', 'feature-row-reverse', 'stats', 'testimonials-3', 'pricing-3',
      'faq', 'cta-banner', 'footer-columns',
    ),
  },
  {
    id: 'launch',
    label: 'Launch / waitlist',
    html: stack(
      'nav-simple', 'hero-dark', 'steps-3', 'features-6', 'testimonial-big',
      'newsletter', 'footer-simple',
    ),
  },
  {
    id: 'services',
    label: 'Portfolio / services',
    html: stack(
      'nav-simple', 'hero-center', 'gallery', 'features-3', 'feature-row',
      'testimonials-3', 'team', 'contact', 'footer-simple',
    ),
  },
];

export const templateHtml = (id) => TEMPLATES.find((t) => t.id === id)?.html ?? '';
