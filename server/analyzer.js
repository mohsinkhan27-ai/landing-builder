// Analyzes external websites to extract their design system (colors, fonts, spacing,
// buttons, backgrounds, etc.) and stores design profiles that the AI designer can use.
//
// - POST /api/analyze         { url } → extracted design tokens
// - GET  /api/design-profiles        → list all saved profiles
// - GET  /api/design-profiles/:name  → one profile
// - PUT  /api/design-profiles/:name  → save or update a profile
// - DELETE /api/design-profiles/:name → delete a profile

import fs from 'node:fs/promises';
import path from 'node:path';
import { analyzeRenderedPage } from './browser-analyzer.js';
import { assertPublicUrl, safeFetch } from './url-guard.js';

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,59}$/;
const MAX_CSS = 512 * 1024; // 500 KB cap on total CSS fetched
const FETCH_TIMEOUT = 15000;

// ---------- color utilities ----------

const NAMED_COLORS = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', orange: '#ffa500', purple: '#800080',
  pink: '#ffc0cb', gray: '#808080', grey: '#808080', silver: '#c0c0c0', navy: '#000080',
  teal: '#008080', maroon: '#800000', olive: '#808000', lime: '#00ff00', aqua: '#00ffff',
  coral: '#ff7f50', salmon: '#fa8072', tomato: '#ff6347', gold: '#ffd700', indigo: '#4b0082',
  violet: '#ee82ee', beige: '#f5f5dc', ivory: '#fffff0', linen: '#faf0e6',
  wheat: '#f5deb3', snow: '#fffafa', azure: '#f0ffff', lavender: '#e6e6fa',
  khaki: '#f0e68c', plum: '#dda0dd', orchid: '#da70d6', tan: '#d2b48c',
  crimson: '#dc143c', turquoise: '#40e0d0', sienna: '#a0522d', chocolate: '#d2691e',
  firebrick: '#b22222', darkblue: '#00008b', darkgreen: '#006400', darkred: '#8b0000',
  darkgray: '#a9a9a9', darkgrey: '#a9a9a9', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
  whitesmoke: '#f5f5f5', gainsboro: '#dcdcdc', aliceblue: '#f0f8ff', ghostwhite: '#f8f8ff',
  mintcream: '#f5fffa', honeydew: '#f0fff0', seashell: '#fff5ee', oldlace: '#fdf5e6',
  floralwhite: '#fffaf0', cornsilk: '#fff8dc', lemonchiffon: '#fffacd', papayawhip: '#ffefd5',
  blanchedalmond: '#ffebcd', bisque: '#ffe4c4', moccasin: '#ffe4b5', navajowhite: '#ffdead',
  peachpuff: '#ffdab9', mistyrose: '#ffe4e1', lightyellow: '#ffffe0', lightcyan: '#e0ffff',
  lightblue: '#add8e6', lightpink: '#ffb6c1', lightgreen: '#90ee90', lightsalmon: '#ffa07a',
  lightcoral: '#f08080', lightsteelblue: '#b0c4de', lightslategray: '#778899',
  slategray: '#708090', slategrey: '#708090', dimgray: '#696969', dimgrey: '#696969',
  steelblue: '#4682b4', cadetblue: '#5f9ea0', cornflowerblue: '#6495ed', royalblue: '#4169e1',
  dodgerblue: '#1e90ff', deepskyblue: '#00bfff', skyblue: '#87ceeb', mediumblue: '#0000cd',
  midnightblue: '#191970', darkslateblue: '#483d8b', slateblue: '#6a5acd',
  mediumslateblue: '#7b68ee', mediumpurple: '#9370db', blueviolet: '#8a2be2',
  darkviolet: '#9400d3', darkorchid: '#9932cc', darkmagenta: '#8b008b',
  mediumorchid: '#ba55d3', mediumvioletred: '#c71585', deeppink: '#ff1493',
  hotpink: '#ff69b4', palevioletred: '#db7093', indianred: '#cd5c5c', darkkhaki: '#bdb76b',
  darkolivegreen: '#556b2f', olivedrab: '#6b8e23', yellowgreen: '#9acd32',
  lawngreen: '#7cfc00', chartreuse: '#7fff00', greenyellow: '#adff2f', springgreen: '#00ff7f',
  mediumspringgreen: '#00fa9a', limegreen: '#32cd32', forestgreen: '#228b22',
  seagreen: '#2e8b57', mediumseagreen: '#3cb371', darkseagreen: '#8fbc8f',
  palegreen: '#98fb98', mediumaquamarine: '#66cdaa', darkcyan: '#008b8b',
  lightseagreen: '#20b2aa', mediumturquoise: '#48d1cc', darkturquoise: '#00ced1',
  powderblue: '#b0e0e6', paleturquoise: '#afeeee', aquamarine: '#7fffd4',
  sandybrown: '#f4a460', goldenrod: '#daa520', darkgoldenrod: '#b8860b',
  peru: '#cd853f', rosybrown: '#bc8f8f', saddlebrown: '#8b4513', burlywood: '#deb887',
  antiquewhite: '#faebd7', transparent: null, inherit: null, initial: null, unset: null, currentcolor: null,
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length === 8) hex = hex.slice(0, 6); // drop alpha
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [Math.round(hue2rgb(p, q, h + 1/3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1/3) * 255)];
}

// Parse any CSS color string to hex (returns null for unknowns).
function parseColor(str) {
  if (!str) return null;
  str = str.trim().toLowerCase();

  // #hex
  if (/^#([0-9a-f]{3,8})$/.test(str)) {
    let hex = str.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length === 4) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]; // drop alpha nibble
    return '#' + hex.slice(0, 6);
  }

  // rgb() / rgba()
  const rgbMatch = /^rgba?\(\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)/.exec(str);
  if (rgbMatch) {
    const parse = (v) => v.endsWith('%') ? Math.round(parseFloat(v) * 2.55) : Math.round(parseFloat(v));
    return rgbToHex(parse(rgbMatch[1]), parse(rgbMatch[2]), parse(rgbMatch[3]));
  }

  // hsl() / hsla()
  const hslMatch = /^hsla?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%/.exec(str);
  if (hslMatch) {
    const [r, g, b] = hslToRgb(parseFloat(hslMatch[1]), parseFloat(hslMatch[2]), parseFloat(hslMatch[3]));
    return rgbToHex(r, g, b);
  }

  // Named colors
  const named = NAMED_COLORS[str];
  return named || null; // returns null for transparent, inherit, etc.
}

// ---------- extraction helpers ----------

function mostCommon(arr) {
  const counts = new Map();
  for (const item of arr) counts.set(item, (counts.get(item) || 0) + 1);
  let best = null, max = 0;
  for (const [item, count] of counts) {
    if (count > max) { best = item; max = count; }
  }
  return best;
}

function topN(arr, n) {
  const counts = new Map();
  for (const item of arr) counts.set(item, (counts.get(item) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([item]) => item);
}

function unique(arr) {
  return [...new Set(arr)];
}

// Resolve var(--name) references from the collected stylesheets. Without this, sites built on
// Bootstrap/Tailwind hand back token names such as --bs-font-sans-serif instead of a real font,
// and the AI is then told to use an invalid font-family value.
function resolveCssVariables(css) {
  const vars = new Map();
  for (const m of css.matchAll(/--([\w-]+)\s*:\s*([^;}{]+)/g)) vars.set(`--${m[1]}`, m[2].trim());
  if (!vars.size) return css;

  const seen = new Set();
  const resolve = (value, depth = 0) => {
    if (depth > 8) return value;
    return String(value).replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (match, name, fallback) => {
      const next = vars.get(name);
      if (next == null) return fallback != null ? fallback : match;
      if (seen.has(name)) return fallback != null ? fallback : '';
      seen.add(name);
      const out = resolve(next, depth + 1);
      seen.delete(name);
      return out;
    });
  };

  return css.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (match, name, fallback) => {
    const value = vars.get(name);
    if (value == null) return fallback != null ? fallback : match;
    return resolve(value);
  });
}

// Extract all CSS color values from a text blob.
function extractColors(css) {
  const colors = [];
  // Hex colors
  for (const m of css.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    const c = parseColor(m[0]);
    if (c) colors.push(c);
  }
  // rgb/rgba
  for (const m of css.matchAll(/rgba?\([^)]+\)/gi)) {
    const c = parseColor(m[0]);
    if (c) colors.push(c);
  }
  // hsl/hsla
  for (const m of css.matchAll(/hsla?\([^)]+\)/gi)) {
    const c = parseColor(m[0]);
    if (c) colors.push(c);
  }
  // Named colors in property values (only after a colon, to avoid matching class names).
  // Match "color: red", "background: white", etc.
  const namedRe = new RegExp(`:\\s*(${Object.keys(NAMED_COLORS).filter((n) => NAMED_COLORS[n]).join('|')})\\s*[;!}]`, 'gi');
  for (const m of css.matchAll(namedRe)) {
    const c = parseColor(m[1]);
    if (c) colors.push(c);
  }
  return colors;
}

// Classify colors into roles based on HSL.
function classifyColors(colors) {
  const counts = new Map();
  for (const c of colors) counts.set(c, (counts.get(c) || 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const backgrounds = []; // light colors (L > 85%)
  const texts = [];       // dark colors (L < 30%)
  const vivids = [];      // saturated colors (S > 30%, 20% < L < 85%)
  const neutrals = [];    // low saturation grays

  for (const [hex] of sorted) {
    const [r, g, b] = hexToRgb(hex);
    const { s, l } = rgbToHsl(r, g, b);
    // Saturated colors are brand colors even when they are dark (for example a navy CTA),
    // so check saturation before treating a dark color as body text.
    if (l > 85 && s < 25) backgrounds.push(hex);
    else if (s > 30 && l > 12) vivids.push(hex);
    else if (l < 35) texts.push(hex);
    else neutrals.push(hex);
  }

  return {
    primary: vivids[0] || neutrals[0] || '#2457f5',
    secondary: vivids[1] || neutrals[1] || '#3a4a5d',
    accent: vivids[2] || vivids[0] || '#ffb703',
    background: backgrounds[0] || '#ffffff',
    surface: backgrounds[1] || backgrounds[0] || '#f1f4f9',
    text: texts[0] || '#0e1a2b',
    textMuted: texts[1] || neutrals[0] || '#3a4a5d',
    palette: unique(sorted.slice(0, 20).map(([hex]) => hex)),
  };
}

// Extract font-family values and classify into heading vs body.
function extractFonts(css) {
  const allFonts = [];
  const headingFonts = [];
  const bodyFonts = [];

  // Split CSS into rule blocks (simple brace matching).
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(ruleRe)) {
    const selector = m[1].toLowerCase();
    const body = m[2];
    const fontMatch = body.match(/font-family\s*:\s*([^;]+)/i);
    if (!fontMatch) continue;
    const raw = fontMatch[1].trim().replace(/!important/gi, '').trim();
    // Take the first font from the stack.
    const first = raw.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    if (!first || /^var\(/i.test(first) || /icon/i.test(first) || /^(inherit|initial|unset|system-ui|serif|sans-serif|monospace|cursive|fantasy|-apple-system|BlinkMacSystemFont|Segoe\s+UI)$/i.test(first)) continue;
    allFonts.push(first);
    if (/\bh[1-6]\b|heading|title|display|hero/i.test(selector)) headingFonts.push(first);
    if (/\bbody\b|\bp\b|text|content|paragraph|article|main/i.test(selector)) bodyFonts.push(first);
  }

  const heading = mostCommon(headingFonts) || allFonts[0] || '';
  const body = mostCommon(bodyFonts) || (allFonts.length > 1 ? allFonts.find((f) => f !== heading) : allFonts[0]) || '';

  return {
    heading: heading || body,
    body: body || heading,
    all: unique(allFonts).slice(0, 10),
  };
}

// Extract spacing, border-radius, shadows, line-height.
function extractGeneral(css) {
  const radii = [];
  const shadows = [];
  const lineHeights = [];
  const letterSpacings = [];
  const sectionPaddings = [];
  const maxWidths = [];
  const gaps = [];

  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(ruleRe)) {
    const selector = m[1].toLowerCase();
    const body = m[2];

    // Border radius
    for (const br of body.matchAll(/border-radius\s*:\s*([^;]+)/gi)) {
      const val = br[1].trim().split(/\s+/)[0]; // take first value
      if (/^\d/.test(val)) radii.push(val);
    }

    // Box shadow
    for (const bs of body.matchAll(/box-shadow\s*:\s*([^;]+)/gi)) {
      const val = bs[1].trim();
      if (val !== 'none' && val !== 'inherit') shadows.push(val);
    }

    // Line height
    for (const lh of body.matchAll(/line-height\s*:\s*([^;]+)/gi)) {
      const val = lh[1].trim();
      if (/^[\d.]+/.test(val)) lineHeights.push(val);
    }

    // Letter spacing
    for (const ls of body.matchAll(/letter-spacing\s*:\s*([^;]+)/gi)) {
      const val = ls[1].trim();
      if (val !== 'normal' && val !== 'inherit') letterSpacings.push(val);
    }

    // Section padding (on section, .section, etc.)
    if (/section|hero|banner|block|wrapper/i.test(selector)) {
      for (const pd of body.matchAll(/padding\s*:\s*([^;]+)/gi)) {
        sectionPaddings.push(pd[1].trim());
      }
    }

    // Max width on containers
    if (/container|wrapper|content|main|inner/i.test(selector)) {
      for (const mw of body.matchAll(/max-width\s*:\s*([^;]+)/gi)) {
        const val = mw[1].trim();
        if (/^\d/.test(val)) maxWidths.push(val);
      }
    }

    // Gap
    for (const g of body.matchAll(/(?:^|;|\s)gap\s*:\s*([^;]+)/gi)) {
      const val = g[1].trim().split(/\s+/)[0];
      if (/^\d/.test(val)) gaps.push(val);
    }
  }

  return {
    borderRadius: mostCommon(radii) || '',
    boxShadow: shadows[0] || '',
    lineHeight: mostCommon(lineHeights) || '',
    letterSpacing: mostCommon(letterSpacings) || '',
    sectionPadding: mostCommon(sectionPaddings) || '',
    containerMaxWidth: mostCommon(maxWidths) || '',
    elementGap: mostCommon(gaps) || '',
  };
}

// Extract button styling.
function extractButtons(css) {
  const btnRadii = [];
  const btnPaddings = [];
  const btnFontSizes = [];
  const btnFontWeights = [];
  const btnTransforms = [];

  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(ruleRe)) {
    const selector = m[1].toLowerCase();
    if (!/btn|button|cta|submit|action/i.test(selector)) continue;
    const body = m[2];

    for (const br of body.matchAll(/border-radius\s*:\s*([^;]+)/gi)) btnRadii.push(br[1].trim().split(/\s+/)[0]);
    for (const pd of body.matchAll(/padding\s*:\s*([^;]+)/gi)) btnPaddings.push(pd[1].trim());
    for (const fs of body.matchAll(/font-size\s*:\s*([^;]+)/gi)) btnFontSizes.push(fs[1].trim());
    for (const fw of body.matchAll(/font-weight\s*:\s*([^;]+)/gi)) btnFontWeights.push(fw[1].trim());
    for (const tt of body.matchAll(/text-transform\s*:\s*([^;]+)/gi)) btnTransforms.push(tt[1].trim());
  }

  const radius = mostCommon(btnRadii) || '';
  const numRadius = parseFloat(radius) || 0;
  const style = numRadius >= 20 ? 'pill' : numRadius >= 4 ? 'rounded' : numRadius > 0 ? 'square' : '';

  return {
    borderRadius: radius,
    padding: mostCommon(btnPaddings) || '',
    fontSize: mostCommon(btnFontSizes) || '',
    fontWeight: mostCommon(btnFontWeights) || '',
    textTransform: mostCommon(btnTransforms) || '',
    style,
  };
}

// ---------- fetching ----------

async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await safeFetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,text/css,*/*',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

// ---------- main analysis ----------

export async function analyzeCssFallback(url) {
  // Fetch the page HTML.
  let res;
  try {
    res = await fetchWithTimeout(url);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The site took too long to respond (15 seconds). Try again or check the address.');
    throw new Error(`Could not reach the site. ${err.cause?.code === 'ECONNREFUSED' ? 'Nothing is listening there.' : 'Check the address and try again.'}`);
  }
  if (!res.ok) throw new Error(`The site returned an error (HTTP ${res.status}).`);
  const html = (await res.text()).slice(0, 2 * 1024 * 1024);

  // Collect CSS from <style> blocks.
  let totalCss = '';
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    totalCss += '\n' + m[1];
  }

  // Collect CSS from <link rel="stylesheet"> tags.
  const linkRe = /<link[^>]+rel\s*=\s*["']?stylesheet["']?[^>]*>/gi;
  const hrefRe = /href\s*=\s*["']([^"']+)["']/i;
  const cssUrls = [];
  for (const m of html.matchAll(linkRe)) {
    const hrefMatch = hrefRe.exec(m[0]);
    if (hrefMatch) {
      const cssUrl = resolveUrl(url, hrefMatch[1]);
      if (cssUrl) cssUrls.push(cssUrl);
    }
  }

  // Fetch external stylesheets (in parallel, up to MAX_CSS total).
  let fetched = totalCss.length;
  const promises = cssUrls.slice(0, 20).map(async (cssUrl) => {
    if (fetched >= MAX_CSS) return '';
    try {
      const r = await fetchWithTimeout(cssUrl, 10000);
      if (!r.ok) return '';
      const text = await r.text();
      fetched += text.length;
      return text.slice(0, MAX_CSS);
    } catch {
      return '';
    }
  });
  const sheets = await Promise.all(promises);
  for (const sheet of sheets) totalCss += '\n' + sheet;

  // Collect inline styles from style="" attributes.
  for (const m of html.matchAll(/style\s*=\s*"([^"]+)"/gi)) {
    totalCss += '\n._inline_{' + m[1] + '}';
  }

  // Ensure we got *something*.
  if (totalCss.trim().length < 20) {
    throw new Error('Could not find enough CSS on the page to analyze. The site may load styles differently (JavaScript-rendered).');
  }

  // Extract design tokens.
  const resolvedCss = resolveCssVariables(totalCss);
  const colors = classifyColors(extractColors(resolvedCss));
  const fonts = extractFonts(resolvedCss);
  const general = extractGeneral(resolvedCss);
  const buttons = extractButtons(resolvedCss);

  return {
    url,
    finalUrl: res.url || url,
    title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim(),
    analyzedAt: new Date().toISOString(),
    source: 'css',
    confidence: { colors: 0.6, fonts: 0.55, layout: 0.35, overall: 0.5 },
    warnings: [],
    colors,
    fonts,
    typography: {
      heading: fonts.heading,
      body: fonts.body,
      scale: [],
      weights: {},
      lineHeight: general.lineHeight,
      letterSpacing: general.letterSpacing,
    },
    spacing: {
      sectionPadding: general.sectionPadding,
      containerMaxWidth: general.containerMaxWidth,
      elementGap: general.elementGap,
      scale: [],
    },
    buttons,
    general: {
      borderRadius: general.borderRadius,
      boxShadow: general.boxShadow,
      lineHeight: general.lineHeight,
      letterSpacing: general.letterSpacing,
    },
    components: {},
    responsive: {},
  };
}

async function analyzeUrl(url) {
  let browserError = '';
  try {
    return await analyzeRenderedPage(url);
  } catch (err) {
    browserError = err.message || String(err);
  }
  const profile = await analyzeCssFallback(url);
  profile.warnings = [`Rendered browser analysis failed (${browserError}). This profile was read from raw CSS instead.`];
  return profile;
}

// ---------- mount routes ----------

export function mountAnalyzer(app, { DATA_DIR, wrap, HttpError }) {
  const file = path.join(DATA_DIR, 'design-profiles.json');

  async function loadProfiles() {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      return [];
    }
  }

  async function saveProfiles(profiles) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(profiles, null, 2), 'utf8');
    await fs.rename(tmp, file);
  }

  // Analyze a URL and return the extracted design tokens.
  app.post('/api/analyze', wrap(async (req, res) => {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') throw new HttpError(400, 'Provide a URL to analyze.');
    let parsed;
    try {
      parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      throw new HttpError(400, 'That does not look like a valid web address.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new HttpError(400, 'Only http and https addresses are supported.');
    try {
      await assertPublicUrl(parsed.href);
    } catch (err) {
      throw new HttpError(400, err.message);
    }
    try {
      const profile = await analyzeUrl(parsed.href);
      res.json({ profile });
    } catch (err) {
      throw new HttpError(502, err.message);
    }
  }));

  // List all saved design profiles.
  app.get('/api/design-profiles', wrap(async (req, res) => {
    const profiles = await loadProfiles();
    res.json({ profiles: profiles.map((p) => ({ name: p.name, url: p.url, savedAt: p.savedAt })) });
  }));

  // Get one profile.
  app.get('/api/design-profiles/:name', wrap(async (req, res) => {
    const profiles = await loadProfiles();
    const profile = profiles.find((p) => p.name === req.params.name);
    if (!profile) throw new HttpError(404, 'Profile not found.');
    res.json({ profile });
  }));

  // Save or update a profile.
  app.put('/api/design-profiles/:name', wrap(async (req, res) => {
    const { name } = req.params;
    if (!NAME_RE.test(name)) throw new HttpError(400, 'Profile names may only use lowercase letters, numbers, "-" and "_".');
    const data = req.body;
    if (!data || !data.colors) throw new HttpError(400, 'Invalid profile data.');
    const profiles = await loadProfiles();
    const existing = profiles.findIndex((p) => p.name === name);
    const entry = { ...data, name, savedAt: new Date().toISOString() };
    if (existing >= 0) profiles[existing] = entry;
    else profiles.push(entry);
    await saveProfiles(profiles);
    res.json({ ok: true, profile: entry });
  }));

  // Delete a profile.
  app.delete('/api/design-profiles/:name', wrap(async (req, res) => {
    const profiles = await loadProfiles();
    const filtered = profiles.filter((p) => p.name !== req.params.name);
    if (filtered.length === profiles.length) throw new HttpError(404, 'Profile not found.');
    await saveProfiles(filtered);
    res.json({ ok: true });
  }));
}
