import { chromium } from 'playwright-core';
import { assertPublicUrl, isBlockedRequestUrl } from './url-guard.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CHANNELS = process.env.ANALYZER_BROWSER_CHANNEL
  ? [process.env.ANALYZER_BROWSER_CHANNEL]
  : [null, 'chrome', 'msedge'];
const VIEWPORTS = [['tablet', 834, 1112], ['mobile', 390, 844]];

async function launchBrowser() {
  let lastError;
  for (const channel of CHANNELS) {
    try {
      const options = { headless: true, args: ['--disable-dev-shm-usage'] };
      if (channel) options.channel = channel;
      return await chromium.launch(options);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('No Chromium, Chrome, or Edge browser was found.');
}

const collect = () => {
  const toHex = (value) => {
    if (!value) return '';
    const text = String(value).trim().toLowerCase();
    if (text === 'transparent') return '';
    const match = /^rgba?\(([^)]+)\)$/.exec(text);
    if (!match) return /^#[0-9a-f]{3,8}$/.test(text) ? text : '';
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || !parts.slice(0, 3).every(Number.isFinite)) return '';
    if (parts.length > 3 && parts[3] === 0) return '';
    return '#' + parts.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
  };
  const toSolidHex = (value, base = [255, 255, 255]) => {
    const text = String(value || '').trim().toLowerCase();
    if (!text || text === 'transparent') return '';
    const match = /^rgba?\(([^)]+)\)$/.exec(text);
    if (!match) return toHex(text);
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || !parts.slice(0, 3).every(Number.isFinite)) return '';
    const alpha = parts.length > 3 && Number.isFinite(parts[3]) ? Math.max(0, Math.min(1, parts[3])) : 1;
    if (alpha === 0) return '';
    return '#' + parts.slice(0, 3)
      .map((n, i) => Math.round(n * alpha + base[i] * (1 - alpha)))
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
  };
  const colorsIn = (value) => {
    const text = String(value || '');
    const found = text.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi) || [];
    return [...new Set(found.map((token) => toHex(token)).filter(Boolean))];
  };
  const firstFont = (value) => String(value || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  const num = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const paddingSides = (value) => String(value || '')
    .trim().split(/\s+/).map(parseFloat).filter((n) => Number.isFinite(n));
  const hasCtaPadding = (value) => {
    const sides = paddingSides(value);
    if (!sides.length) return false;
    const top = sides[0];
    const right = sides[3] ?? sides[1] ?? top;
    const bottom = sides[2] ?? top;
    const left = sides[3] ?? sides[1] ?? sides[0];
    return Math.min(top, bottom) >= 6 && Math.min(right, left) >= 8;
  };
  const add = (map, key, weight = 1) => {
    if (key) map.set(key, (map.get(key) || 0) + weight);
  };
  const top = (map, size) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, size);
  const visible = (el, rect, style) => rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.01;
  const textOf = (el) => String(el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 300);
  const styleOf = (el) => getComputedStyle(el);
  const rectOf = (el) => el.getBoundingClientRect();
  const tagOf = (el) => el.tagName.toLowerCase();
  const classOf = (el) => String(el.className || '').toLowerCase();
  const isHeading = (tag) => /^h[1-6]$/.test(tag);
  const isParagraph = (tag) => ['p', 'li', 'blockquote', 'dt', 'dd'].includes(tag);
  const isSection = (tag, cls, area) => {
    if (['section', 'header', 'footer', 'main'].includes(tag)) return true;
    if (area <= 8000) return false;
    return cls.split(/\s+/).some((token) => token === 'hero' || token === 'banner' || token === 'footer'
      || token === 'cta' || token === 'showcase' || token === 'split' || token === 'section' || token.startsWith('section-'));
  };
  const isCard = (tag, cls) => tag === 'article' || /card|tile|feature|testimonial|pricing|plan|panel|faq/.test(cls);
  const isButton = (el, tag, cls) => tag === 'button'
    || (tag === 'input' && /submit|button/i.test(el.type || ''))
    || el.getAttribute('role') === 'button'
    || /(^|[-_ ])(btn|button|cta|submit|action)([-_ ]|$)/.test(cls);

  const textColors = new Map();
  const bgColors = new Map();
  const sectionBgColors = new Map();
  const borderColors = new Map();
  const linkColors = new Map();
  const buttonBgColors = new Map();
  const headingFonts = new Map();
  const bodyFonts = new Map();
  const allFonts = new Map();
  const headingSizes = new Map();
  const bodySizes = new Map();
  const buttonSizes = new Map();
  const fontWeights = new Map();
  const headingWeights = new Map();
  const bodyWeights = new Map();
  const lineHeights = new Map();
  const letterSpacings = new Map();
  const radii = new Map();
  const shadows = new Map();
  const gaps = new Map();
  const maxWidths = new Map();
  const sectionPaddings = new Map();
  const cardPaddings = new Map();
  const buttons = [];
  const sections = [];
  const cards = [];
  const images = [];
  const grids = [];
  const seenButtons = new Set();
  let headingCount = 0;
  let paragraphCount = 0;
  let linkCount = 0;

  const bodyStyle = styleOf(document.body);
  const htmlStyle = styleOf(document.documentElement);
  const elements = [...document.querySelectorAll('body *')];

  for (const el of elements.slice(0, 5000)) {
    const style = styleOf(el);
    const rect = rectOf(el);
    if (!visible(el, rect, style)) continue;
    const tag = tagOf(el);
    const cls = classOf(el);
    const area = Math.max(1, rect.width * rect.height);
    const text = textOf(el);
    const font = firstFont(style.fontFamily);
    if (font) add(allFonts, font, Math.max(1, Math.sqrt(area)));

    const background = toHex(style.backgroundColor);
    const bgImage = style.backgroundImage && style.backgroundImage !== 'none' ? style.backgroundImage : '';
    if (background && area > 800) add(bgColors, background, area);
    const border = toHex(style.borderTopColor);
    if (border && parseFloat(style.borderTopWidth) > 0 && area > 800) add(borderColors, border, area);
    if (text) {
      const color = toHex(style.color);
      if (color) add(textColors, color, Math.min(300, text.length) * Math.max(1, Math.sqrt(area)));
    }

    const radius = style.borderRadius && style.borderRadius !== '0px' ? style.borderRadius.split(' ')[0] : '';
    if (radius) add(radii, radius, area > 1500 ? 2 : 1);
    if (style.boxShadow && style.boxShadow !== 'none') add(shadows, style.boxShadow, 1);
    if ((style.display === 'grid' || style.display === 'flex') && style.gap && !['normal', '0px'].includes(style.gap)) add(gaps, style.gap, 1);
    if (style.maxWidth && !['none', '100%', 'auto'].includes(style.maxWidth)) add(maxWidths, style.maxWidth, 1);

    if (isHeading(tag)) {
      headingCount += 1;
      if (font) add(headingFonts, font, text.length || 1);
      add(headingSizes, style.fontSize, 1);
      add(fontWeights, style.fontWeight, 1);
      add(headingWeights, style.fontWeight, 1);
      if (style.lineHeight !== 'normal') add(lineHeights, style.lineHeight, 1);
      if (style.letterSpacing !== 'normal') add(letterSpacings, style.letterSpacing, 1);
    } else if (isParagraph(tag) && text) {
      paragraphCount += 1;
      if (font) add(bodyFonts, font, text.length || 1);
      add(bodySizes, style.fontSize, 1);
      add(fontWeights, style.fontWeight, 1);
      add(bodyWeights, style.fontWeight, 1);
      if (style.lineHeight !== 'normal') add(lineHeights, style.lineHeight, 1);
    }

    if (tag === 'a' && text) {
      linkCount += 1;
      const color = toHex(style.color);
      if (color) add(linkColors, color, text.length * Math.max(1, Math.sqrt(area)));
    }

    if (isButton(el, tag, cls) && text && !seenButtons.has(el)) {
      seenButtons.add(el);
      const buttonBg = toHex(style.backgroundColor);
      const buttonColor = toHex(style.color);
      const buttonBorder = toHex(style.borderTopColor);
      const buttonBgImage = style.backgroundImage && style.backgroundImage !== 'none' ? style.backgroundImage : '';
      if (buttonBg) add(buttonBgColors, buttonBg, area);
      if (hasCtaPadding(style.padding)) {
        for (const color of colorsIn(buttonBgImage)) add(buttonBgColors, color, area);
      }
      add(buttonSizes, style.fontSize, 1);
      add(fontWeights, style.fontWeight, 1);
      buttons.push({
        text: text.slice(0, 80),
        tag,
        bg: buttonBg,
        bgImage: buttonBgImage,
        color: buttonColor,
        border: buttonBorder,
        borderWidth: style.borderTopWidth,
        radius,
        padding: style.padding,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        textTransform: style.textTransform,
        boxShadow: style.boxShadow && style.boxShadow !== 'none' ? style.boxShadow : '',
        area: Math.round(area),
      });
    }

    if (isSection(tag, cls, area)) {
      const paddingTop = num(style.paddingTop);
      const paddingBottom = num(style.paddingBottom);
      const tint = toSolidHex(style.backgroundColor);
      if (tint && area > 8000) add(sectionBgColors, tint, area);
      if (paddingTop != null && paddingTop > 0) add(sectionPaddings, `${paddingTop}px`, area > 10000 ? 3 : 1);
      if (paddingBottom != null && paddingBottom > 0) add(sectionPaddings, `${paddingBottom}px`, area > 10000 ? 3 : 1);
      if (sections.length < 40) {
        sections.push({
          tag,
          cls: cls.slice(0, 80),
          bg: background,
          bgImage,
          paddingTop,
          paddingBottom,
          maxWidth: style.maxWidth,
          display: style.display,
          columns: style.display.includes('grid') ? style.gridTemplateColumns.split(' ').filter(Boolean).length : 0,
          gap: style.gap,
          color: toHex(style.color),
          headings: el.querySelectorAll('h1,h2,h3,h4').length,
          images: el.querySelectorAll('img,picture,video').length,
          area: Math.round(area),
        });
      }
    }

    if (isCard(tag, cls) && text && area > 1200 && cards.length < 30) {
      cards.push({
        tag,
        bg: background,
        bgImage,
        border,
        radius,
        shadow: style.boxShadow,
        padding: style.padding,
        area: Math.round(area),
      });
      const padding = num(style.paddingTop);
      if (padding != null && padding > 0) add(cardPaddings, `${padding}px`, 1);
    }

    if (tag === 'img' && images.length < 20) {
      images.push({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        naturalWidth: el.naturalWidth || 0,
        naturalHeight: el.naturalHeight || 0,
        radius,
        objectFit: style.objectFit,
        area: Math.round(area),
        alt: String(el.alt || '').slice(0, 80),
      });
    }

    if (style.display === 'grid') {
      const children = [...el.children].filter((child) => {
        const childStyle = styleOf(child);
        const childRect = rectOf(child);
        return visible(child, childRect, childStyle);
      });
      if (children.length >= 2 && grids.length < 20) {
        const declaredColumns = style.gridTemplateColumns.split(' ').filter(Boolean).length;
        const visualColumns = new Set(children.map((child) => Math.round(rectOf(child).left))).size;
        grids.push({
          columns: Math.max(declaredColumns, visualColumns),
          gap: style.gap,
          items: children.length,
          area: Math.round(area),
        });
      }
    }
  }

  const navEl = document.querySelector('header nav, nav, header');
  const navStyle = navEl ? styleOf(navEl) : null;
  const navRect = navEl ? rectOf(navEl) : null;
  const heroEl = [...document.querySelectorAll('section')].find((el) => {
    const rect = rectOf(el);
    const style = styleOf(el);
    return visible(el, rect, style) && el.querySelector('h1');
  }) || document.querySelector('h1')?.closest('header,section,div') || null;
  const heroStyle = heroEl ? styleOf(heroEl) : null;
  const heroRect = heroEl ? rectOf(heroEl) : null;
  const heroHeading = heroEl?.querySelector('h1') || document.querySelector('h1');
  const heroLayoutEl = heroEl ? ([...heroEl.querySelectorAll('*')].find((el) => {
    const elStyle = styleOf(el);
    if (!elStyle.display.includes('grid') && !elStyle.display.includes('flex')) return false;
    if (!el.contains(heroHeading)) return false;
    return [...el.children].filter((child) => visible(child, rectOf(child), styleOf(child))).length >= 2;
  }) || heroEl) : null;
  const heroLayoutStyle = heroLayoutEl ? styleOf(heroLayoutEl) : null;
  const footerEl = document.querySelector('footer');
  const footerStyle = footerEl ? styleOf(footerEl) : null;
  const footerGrid = footerEl ? [...footerEl.children].find((child) => styleOf(child).display.includes('grid') || styleOf(child).display.includes('flex')) : null;

  const nav = navEl ? {
    height: navRect ? Math.round(navRect.height) : 0,
    display: navStyle.display,
    position: navStyle.position,
    sticky: ['sticky', 'fixed'].includes(navStyle.position),
    gap: navStyle.gap,
    links: navEl.querySelectorAll('a').length,
    background: toHex(navStyle.backgroundColor),
    backgroundImage: navStyle.backgroundImage && navStyle.backgroundImage !== 'none' ? navStyle.backgroundImage : '',
    radius: navStyle.borderRadius,
    shadow: navStyle.boxShadow && navStyle.boxShadow !== 'none' ? navStyle.boxShadow : '',
    borderBottom: toHex(navStyle.borderBottomColor),
  } : null;
  const pseudoLayers = heroEl ? ['::before', '::after'].map((pseudo) => {
    const ps = getComputedStyle(heroEl, pseudo);
    if (!ps || ps.content === 'none' || ps.display === 'none' || Number(ps.opacity) <= 0.01) return null;
    const bgImage = ps.backgroundImage && ps.backgroundImage !== 'none' ? ps.backgroundImage : '';
    const background = toSolidHex(ps.backgroundColor);
    if (!bgImage && !background) return null;
    return {
      pseudo,
      background,
      backgroundImage: bgImage,
      opacity: Number(ps.opacity),
    };
  }).filter(Boolean) : [];
  const heroColumns = heroLayoutStyle?.display.includes('grid')
    ? heroLayoutStyle.gridTemplateColumns.split(' ').filter(Boolean).length
    : heroLayoutStyle?.display.includes('flex') && heroLayoutStyle.flexDirection.startsWith('row')
      ? [...(heroLayoutEl?.children || [])].filter((child) => visible(child, rectOf(child), styleOf(child))).length
      : 0;
  const hero = heroEl ? {
    display: heroLayoutStyle?.display || heroStyle.display,
    columns: heroColumns,
    layout: heroColumns >= 2 ? 'split' : (heroEl.querySelector('img,picture,video') ? 'image' : 'centered'),
    hasImage: !!heroEl.querySelector('img,picture,video'),
    headingSize: heroHeading ? styleOf(heroHeading).fontSize : '',
    headingWeight: heroHeading ? styleOf(heroHeading).fontWeight : '',
    headingColor: heroHeading ? toHex(styleOf(heroHeading).color) : '',
    align: heroLayoutStyle?.textAlign || heroStyle.textAlign,
    paddingTop: num(heroStyle.paddingTop),
    background: toHex(heroStyle.backgroundColor),
    backgroundImage: heroStyle.backgroundImage && heroStyle.backgroundImage !== 'none' ? heroStyle.backgroundImage : '',
    overlays: pseudoLayers,
    area: heroRect ? Math.round(heroRect.width * heroRect.height) : 0,
  } : null;
  const footer = footerEl ? {
    display: footerStyle.display,
    background: toHex(footerStyle.backgroundColor),
    paddingTop: num(footerStyle.paddingTop),
    columns: footerGrid ? (footerGrid.children.length || 0) : footerEl.children.length,
    links: footerEl.querySelectorAll('a').length,
  } : null;

  const bodyBackground = toHex(htmlStyle.backgroundColor) || toHex(bodyStyle.backgroundColor);
  const gridColumns = grids.map((grid) => grid.columns).sort((a, b) => b - a)[0] || 0;

  return {
    title: document.title,
    lang: document.documentElement.lang,
    summary: {
      width: window.innerWidth,
      navDisplay: navStyle ? navStyle.display : 'none',
      heroColumns: hero?.columns || 0,
      gridColumns,
      bodyFontSize: bodyStyle.fontSize,
      h1Size: heroHeading ? styleOf(heroHeading).fontSize : '',
      pageHeight: document.documentElement.scrollHeight,
    },
    body: {
      background: bodyBackground,
      color: toHex(bodyStyle.color),
      fontFamily: firstFont(bodyStyle.fontFamily),
      fontSize: bodyStyle.fontSize,
      lineHeight: bodyStyle.lineHeight,
      letterSpacing: bodyStyle.letterSpacing,
    },
    textColors: top(textColors, 30),
    bgColors: top(bgColors, 30),
    sectionBgColors: top(sectionBgColors, 20),
    borderColors: top(borderColors, 20),
    linkColors: top(linkColors, 20),
    buttonBgColors: top(buttonBgColors, 20),
    headingFonts: top(headingFonts, 10),
    bodyFonts: top(bodyFonts, 10),
    allFonts: top(allFonts, 20),
    headingSizes: top(headingSizes, 12).map(([value]) => value),
    bodySizes: top(bodySizes, 12).map(([value]) => value),
    buttonSizes: top(buttonSizes, 12).map(([value]) => value),
    fontWeights: top(fontWeights, 10).map(([value]) => value),
    headingWeights: top(headingWeights, 10).map(([value]) => value),
    bodyWeights: top(bodyWeights, 10).map(([value]) => value),
    lineHeights: top(lineHeights, 10).map(([value]) => value),
    letterSpacings: top(letterSpacings, 10).map(([value]) => value),
    radii: top(radii, 12).map(([value]) => value),
    shadows: top(shadows, 8).map(([value]) => value),
    gaps: top(gaps, 12).map(([value]) => value),
    maxWidths: top(maxWidths, 10).map(([value]) => value),
    sectionPaddings: top(sectionPaddings, 12).map(([value]) => value),
    cardPaddings: top(cardPaddings, 12).map(([value]) => value),
    buttons: buttons.sort((a, b) => b.area - a.area).slice(0, 30),
    sections,
    cards,
    images,
    grids: grids.sort((a, b) => b.area - a.area).slice(0, 10),
    nav,
    hero,
    footer,
    counts: {
      headings: headingCount,
      paragraphs: paragraphCount,
      links: linkCount,
      buttons: buttons.length,
      sections: sections.length,
      cards: cards.length,
      grids: grids.length,
    },
  };
};

const collectResponsive = () => {
  const styleOf = (el) => getComputedStyle(el);
  const rectOf = (el) => el.getBoundingClientRect();
  const visible = (el) => {
    const style = styleOf(el);
    const rect = rectOf(el);
    return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const nav = document.querySelector('header nav, nav, header');
  const hero = [...document.querySelectorAll('section')].find((el) => visible(el) && el.querySelector('h1'))
    || document.querySelector('h1')?.closest('header,section,div')
    || null;
  const grids = [...document.querySelectorAll('*')].filter((el) => {
    const style = styleOf(el);
    return visible(el) && style.display === 'grid' && el.children.length >= 2;
  });
  const columnsOf = (el) => {
    const style = styleOf(el);
    const children = [...el.children].filter((child) => visible(child));
    const declared = style.display.includes('grid') ? style.gridTemplateColumns.split(' ').filter(Boolean).length : 0;
    const visual = children.length >= 2 ? new Set(children.map((child) => Math.round(rectOf(child).left))).size : 0;
    return Math.max(declared, visual);
  };
  const gridColumns = grids.map((el) => columnsOf(el)).sort((a, b) => b - a)[0] || 0;
  const heading = document.querySelector('h1');
  return {
    width: window.innerWidth,
    navDisplay: nav ? styleOf(nav).display : 'none',
    heroDisplay: hero ? styleOf(hero).display : 'none',
    heroColumns: hero ? columnsOf(hero) : 0,
    gridColumns,
    bodyFontSize: styleOf(document.body).fontSize,
    h1Size: heading ? styleOf(heading).fontSize : '',
    pageHeight: document.documentElement.scrollHeight,
  };
};

function hexToHsl(hex) {
  const value = String(hex || '').replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  const n = parseInt(value, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
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

const isHex = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ''));
const hexLuminance = (hex) => {
  const value = String(hex || '').replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return 1;
  const n = parseInt(value, 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
const unique = (values) => [...new Set(values.filter(Boolean))];
const tokenToHex = (token) => {
  const text = String(token || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  const match = /^rgba?\(([^)]+)\)$/.exec(text);
  if (!match) return '';
  const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || !parts.slice(0, 3).every(Number.isFinite)) return '';
  return '#' + parts.slice(0, 3)
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
};
const colorsInGradient = (value) => unique(
  (String(value || '').match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi) || [])
    .map(tokenToHex)
    .filter(Boolean),
);

function pick(entries, predicate, exclude = []) {
  const skip = new Set(exclude.filter(Boolean).map((value) => String(value).toLowerCase()));
  for (const [value] of entries || []) {
    if (!isHex(value) || skip.has(value.toLowerCase())) continue;
    if (predicate(value)) return value;
  }
  return '';
}

const isVivid = (hex) => {
  const hsl = hexToHsl(hex);
  return !!hsl && hsl.s > 35 && hsl.l > 10 && hsl.l < 80;
};
const isHighlight = (hex) => {
  const hsl = hexToHsl(hex);
  return !!hsl && hsl.s > 30 && hsl.l >= 55;
};
const isLight = (hex) => {
  const hsl = hexToHsl(hex);
  return !!hsl && hsl.l > 85 && hsl.s < 30;
};
const isSoft = (hex) => {
  const hsl = hexToHsl(hex);
  return !!hsl && hsl.l > 82 && hsl.l < 100;
};
const validGradientCss = (value) => {
  const text = String(value || '').trim();
  return /^(linear|radial|conic)-gradient\(/i.test(text) && !/url\s*\(/i.test(text) ? text : '';
};
const hasCtaPadding = (value) => {
  const sides = String(value || '').trim().split(/\s+/).map(parseFloat).filter((n) => Number.isFinite(n));
  if (!sides.length) return false;
  const top = sides[0];
  const right = sides[3] ?? sides[1] ?? top;
  const bottom = sides[2] ?? top;
  const left = sides[3] ?? sides[1] ?? sides[0];
  return Math.min(top, bottom) >= 6 && Math.min(right, left) >= 8;
};
const paddingScore = (value) => String(value || '').trim().split(/\s+/).map(parseFloat)
  .filter((n) => Number.isFinite(n)).reduce((sum, n) => sum + n, 0);
const isDark = (hex) => {
  const hsl = hexToHsl(hex);
  return !!hsl && hsl.l < 42;
};
const isNeutral = (hex) => {
  const hsl = hexToHsl(hex);
  return !!hsl && hsl.s < 22;
};

function mergeEntries(...maps) {
  const merged = new Map();
  for (const entries of maps) {
    for (const [value, weight] of entries || []) {
      merged.set(value, (merged.get(value) || 0) + weight);
    }
  }
  return [...merged.entries()].sort((a, b) => b[1] - a[1]);
}

const GENERIC_FONT = /^(inherit|initial|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|BlinkMacSystemFont|Segoe UI|ui-sans-serif|ui-serif|ui-monospace|Arial|Helvetica|Times New Roman)$/i;

function pickFont(entries, avoid = '') {
  for (const [font] of entries || []) {
    if (font && font !== avoid && !GENERIC_FONT.test(font) && !/icon/i.test(font)) return font;
  }
  return '';
}

function sizeValue(value, min, max) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= min && n <= max ? `${Math.round(n)}px` : '';
}

function pickSize(values, min, max) {
  for (const value of values || []) {
    const size = sizeValue(value, min, max);
    if (size) return size;
  }
  return '';
}

function typeScale(values) {
  const sizes = unique(values.map((value) => parseFloat(value)).filter((value) => Number.isFinite(value) && value >= 10 && value <= 200));
  return sizes.sort((a, b) => b - a).slice(0, 8).map((value) => `${Math.round(value)}px`);
}

function buildProfile(url, finalUrl, title, data, responsive) {
  const allColors = mergeEntries(data.textColors, data.bgColors, data.buttonBgColors, data.linkColors, data.borderColors);
  const background = data.body.background || pick(data.bgColors, isLight) || '#ffffff';
  const text = pick(data.textColors, isDark) || data.body.color || '#0e1a2b';
  const textLum = hexLuminance(text);
  const textMuted = pick(data.textColors, (hex) => {
    const lum = hexLuminance(hex);
    return lum > textLum + 0.04 && lum < 0.82;
  }, [text]) || text;
  const primary = pick(data.buttonBgColors, isVivid)
    || pick(data.linkColors, isVivid)
    || pick(data.textColors, isVivid)
    || pick(data.bgColors, isVivid)
    || '#2457f5';
  const secondary = pick(data.textColors, (hex) => isDark(hex) && !isNeutral(hex), [text])
    || pick(data.buttonBgColors, isVivid, [primary])
    || pick(data.linkColors, isVivid, [primary])
    || pick(allColors, isVivid, [primary])
    || '#3a4a5d';
  const accent = pick(allColors, isHighlight, [primary, secondary, background]) || primary;
  const surface = pick(data.sectionBgColors, isSoft, [background])
    || pick(data.bgColors, isLight, [background])
    || '#f1f4f9';
  const palette = unique([
    primary, secondary, accent, background, surface, text, textMuted,
    ...allColors.map(([value]) => value),
  ]).slice(0, 20);

  const bodyFont = pickFont(data.bodyFonts) || data.body.fontFamily || '';
  const headingFont = pickFont(data.headingFonts, bodyFont) || bodyFont || pickFont(data.allFonts) || '';
  const fonts = {
    heading: headingFont || bodyFont,
    body: bodyFont || headingFont,
    all: unique([
      ...data.headingFonts.map(([value]) => value),
      ...data.bodyFonts.map(([value]) => value),
      ...data.allFonts.map(([value]) => value),
    ]).slice(0, 10),
  };

  const buttonGroups = new Map();
  for (const button of data.buttons) {
    const key = [button.bg, button.bgImage, button.color, button.border, button.radius].join('|');
    const group = buttonGroups.get(key) || { area: 0, count: 0, sample: button };
    group.area += button.area;
    group.count += 1;
    if (paddingScore(button.padding) > paddingScore(group.sample.padding)
      || (paddingScore(button.padding) === paddingScore(group.sample.padding) && button.area > group.sample.area)) {
      group.sample = button;
    }
    if (!buttonGroups.has(key)) buttonGroups.set(key, group);
  }
  const allButtonVariants = [...buttonGroups.values()].sort((a, b) => b.area - a.area);
  const sizedButtons = allButtonVariants.filter((group) => hasCtaPadding(group.sample.padding));
  const coloredButtons = sizedButtons.filter((group) => (group.sample.bg && isVivid(group.sample.bg))
    || colorsInGradient(group.sample.bgImage).some(isVivid));
  const byProminence = (a, b) => paddingScore(b.sample.padding) - paddingScore(a.sample.padding)
    || b.area - a.area;
  const primaryButton = coloredButtons.slice().sort(byProminence)[0]
    || sizedButtons.find((group) => validGradientCss(group.sample.bgImage)
      && colorsInGradient(group.sample.bgImage).some(isVivid))
    || sizedButtons.find((group) => group.sample.bg && isVivid(group.sample.bg))
    || sizedButtons.find((group) => group.sample.bg && !isLight(group.sample.bg))
    || sizedButtons.find((group) => group.sample.bg)
    || sizedButtons[0]
    || allButtonVariants[0]
    || {};
  const button = primaryButton.sample || {};
  const ghostGroup = allButtonVariants.find((group) => group !== primaryButton
    && group.sample.bg && isLight(group.sample.bg)
    && group.sample.color && isDark(group.sample.color));
  const ghost = ghostGroup ? {
    bg: ghostGroup.sample.bg,
    color: ghostGroup.sample.color,
    border: parseFloat(ghostGroup.sample.borderWidth) > 0 ? ghostGroup.sample.border : '',
    padding: ghostGroup.sample.padding,
    radius: ghostGroup.sample.radius,
  } : null;
  const buttonVariants = allButtonVariants.slice(0, 4);
  if (primaryButton.sample && !buttonVariants.includes(primaryButton)) {
    if (buttonVariants.length >= 4) buttonVariants[3] = primaryButton;
    else buttonVariants.push(primaryButton);
  }
  const rawRadius = button.radius || pickSize(data.radii, 0, 64) || '';
  const buttonRadiusNum = parseFloat(rawRadius) || 0;
  const buttonRadius = buttonRadiusNum > 64 ? '999px' : rawRadius;
  const buttons = {
    borderRadius: buttonRadius,
    padding: button.padding || '',
    fontSize: button.fontSize || '',
    fontWeight: button.fontWeight || '',
    textTransform: button.textTransform || '',
    color: button.color || '',
    backgroundImage: validGradientCss(button.bgImage),
    boxShadow: button.boxShadow || '',
    ghost,
    style: buttonRadiusNum >= 20 ? 'pill' : buttonRadiusNum >= 4 ? 'rounded' : buttonRadiusNum > 0 ? 'square' : '',
    variants: buttonVariants.map((group) => ({
      count: group.count,
      bg: group.sample.bg,
      bgImage: validGradientCss(group.sample.bgImage),
      color: group.sample.color,
      border: group.sample.border,
      radius: group.sample.radius,
      padding: group.sample.padding,
      fontWeight: group.sample.fontWeight,
      textTransform: group.sample.textTransform,
      boxShadow: group.sample.boxShadow || '',
    })),
  };

  const radius = pickSize(data.radii, 0, 64);
  const sectionPadding = pickSize(data.sectionPaddings, 16, 240);
  const containerMaxWidth = pickSize(data.maxWidths, 600, 2000);
  const elementGap = pickSize(data.gaps, 4, 200);
  const lineHeight = data.lineHeights[0] || '';
  const letterSpacing = data.letterSpacings[0] || '';
  const spacingScale = unique(
    [...data.sectionPaddings, ...data.gaps, ...data.cardPaddings]
      .map((value) => parseFloat(value))
      .filter((value) => Number.isFinite(value) && value > 0 && value <= 240)
      .sort((a, b) => a - b)
      .map((value) => `${Math.round(value)}px`),
  ).slice(0, 8);

  const confidence = {
    colors: Math.min(1, (data.textColors.length + data.bgColors.length + data.buttons.length) / 15),
    fonts: Math.min(1, (data.headingFonts.length + data.bodyFonts.length) / 4),
    layout: Math.min(1, (data.sections.length + data.grids.length) / 8),
  };
  confidence.overall = Math.round(((confidence.colors + confidence.fonts + confidence.layout) / 3) * 100) / 100;

  const heroOverlay = (data.hero?.overlays || []).find((layer) => validGradientCss(layer.backgroundImage))
    || (data.hero?.overlays || []).find((layer) => layer.background)
    || null;
  const heroRamp = heroOverlay ? colorsInGradient(heroOverlay.backgroundImage) : [];
  const heroComponent = data.hero ? {
    ...data.hero,
    overlayImage: heroOverlay ? validGradientCss(heroOverlay.backgroundImage) : '',
    overlayColor: heroOverlay?.background || heroRamp[heroRamp.length - 1] || '',
    overlayOpacity: heroOverlay?.opacity || 1,
  } : null;

  const warnings = [];
  if (!data.counts.headings) warnings.push('No headings were visible, so typography is based on body text.');
  if (!data.buttons.length) warnings.push('No buttons were found; button styling may be incomplete.');
  if (!data.grids.length) warnings.push('No grid layouts were detected.');
  if (data.body.background && !isLight(data.body.background) && !isDark(data.body.background)) warnings.push('The page background is mid-tone; check the background token.');

  return {
    url,
    finalUrl,
    title,
    analyzedAt: new Date().toISOString(),
    source: 'browser',
    confidence,
    warnings,
    colors: {
      primary,
      secondary,
      accent,
      background,
      surface,
      text,
      textMuted,
      palette,
    },
    fonts,
    typography: {
      heading: fonts.heading,
      body: fonts.body,
      scale: typeScale([...data.headingSizes, ...data.bodySizes, ...data.buttonSizes]),
      weights: {
        heading: data.hero?.headingWeight || data.headingWeights[0] || data.fontWeights[0] || '',
        body: data.bodyWeights[0] || data.fontWeights[1] || data.fontWeights[0] || '',
      },
      lineHeight,
      letterSpacing,
    },
    spacing: {
      sectionPadding,
      containerMaxWidth,
      elementGap,
      scale: spacingScale,
    },
    buttons,
    general: {
      borderRadius: radius,
      boxShadow: data.shadows[0] || '',
      lineHeight,
      letterSpacing,
    },
    components: {
      nav: data.nav,
      hero: heroComponent,
      grids: data.grids.slice(0, 3),
      cards: data.cards.slice(0, 3),
      footer: data.footer,
      sections: data.sections.slice(0, 6),
    },
    responsive,
    counts: data.counts,
  };
}

export async function analyzeRenderedPage(url, { timeout = 25000 } = {}) {
  await assertPublicUrl(url);
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: USER_AGENT,
      ignoreHTTPSErrors: process.env.ANALYZER_IGNORE_TLS === '1',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    await page.route('**/*', (route) => (isBlockedRequestUrl(route.request().url()) ? route.abort() : route.continue()));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(200);

    const data = await page.evaluate(collect);
    if (!data?.counts?.headings && !data?.counts?.sections && !data?.counts?.buttons && !data?.counts?.paragraphs) {
      throw new Error('The page rendered without recognizable design elements.');
    }
    const responsive = { desktop: data.summary };
    for (const [name, width, height] of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(350);
      responsive[name] = await page.evaluate(collectResponsive);
    }
    return buildProfile(url, page.url(), await page.title(), data, responsive);
  } finally {
    await browser.close().catch(() => {});
  }
}
