// Bringing pages in: a .html file (optionally with its .css and image files), a whole website folder, or a .zip.
// Pages that were exported from this builder (they contain project.json) come back exactly as they were.

import { unzipSync } from 'fflate';
import * as api from './api.js';

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico']);
const VIDEO = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v']);
const FONT = new Set(['woff', 'woff2', 'ttf', 'otf']);
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon', mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime', m4v: 'video/x-m4v', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' };

const ext = (p) => (p.split('.').pop() || '').toLowerCase();
const base = (p) => p.split('/').pop();
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const norm = (p) => p.replace(/\\/g, '/').replace(/^\.?\/+/, '');
const isAsset = (p) => IMAGE.has(ext(p)) || VIDEO.has(ext(p)) || FONT.has(ext(p));

function join(dir, ref) {
  const parts = (ref.startsWith('/') ? ref : `${dir}/${ref}`).split('/');
  const out = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

class Entry {
  constructor(path, source) {
    this.path = path;
    this.source = source; // a File, or bytes from a zip
  }
  get name() {
    return base(this.path);
  }
  async text() {
    if (this.source instanceof Blob) return this.source.text();
    return new TextDecoder().decode(this.source);
  }
  toFile() {
    if (this.source instanceof File) return this.source;
    return new File([this.source instanceof Blob ? this.source : this.source], this.name, { type: MIME[ext(this.path)] || 'application/octet-stream' });
  }
}

// items: [{ file, path }]  (path is the file's place inside a chosen folder, or just its name)
async function collect(items) {
  const entries = new Map();
  for (const { file, path } of items) {
    if (ext(file.name) === 'zip') {
      const unzipped = unzipSync(new Uint8Array(await file.arrayBuffer()));
      for (const [name, bytes] of Object.entries(unzipped)) {
        const clean = norm(name);
        if (!clean || clean.endsWith('/') || clean.startsWith('__MACOSX/') || base(clean) === '.DS_Store') continue;
        entries.set(clean, new Entry(clean, bytes));
      }
    } else {
      const clean = norm(path || file.name);
      entries.set(clean, new Entry(clean, file));
    }
  }
  // If everything sits inside one folder, treat that folder as the site root.
  const tops = new Set([...entries.keys()].map((p) => p.split('/')[0]));
  if (tops.size === 1 && [...entries.keys()].every((p) => p.includes('/'))) {
    const only = [...tops][0];
    const stripped = new Map();
    for (const [p, e] of entries) {
      const next = p.slice(only.length + 1);
      stripped.set(next, new Entry(next, e.source));
    }
    return stripped;
  }
  return entries;
}

export async function prepareImport(items) {
  if (!items.length) throw new Error('Choose at least one file.');
  const entries = await collect(items);
  const pages = [...entries.keys()].filter((p) => /\.html?$/i.test(p));
  if (!pages.length) throw new Error('No .html file found. Choose a page (.html), a website folder, or a .zip that contains one.');
  pages.sort((a, b) => a.split('/').length - b.split('/').length || (/(^|\/)index\.html?$/i.test(b) ? 1 : 0) - (/(^|\/)index\.html?$/i.test(a) ? 1 : 0) || a.localeCompare(b));
  const main = pages[0];
  const dir = dirOf(main);
  const isBackup = entries.has(join(dir, 'project.json')) && /(^|\/)index\.html$/i.test(main);
  const assets = [...entries.keys()].filter(isAsset);
  const css = [...entries.keys()].filter((p) => /\.css$/i.test(p));
  const suggested = isBackup
    ? (base(dirOf(main) || '') || items[0].file.name.replace(/\.zip$/i, ''))
    : base(main).replace(/\.html?$/i, '') === 'index' && dir
      ? base(dir)
      : base(main).replace(/\.html?$/i, '') === 'index'
        ? items[0].file.name.replace(/\.(zip|html?)$/i, '') || 'imported-page'
        : base(main).replace(/\.html?$/i, '');
  return { entries, main, dir, isBackup, assets, css, otherPages: pages.length - 1, suggestedName: suggested };
}

export function describe(prep) {
  const count = (set) => prep.assets.filter((p) => set.has(ext(p))).length;
  const bits = [`${base(prep.main)}`];
  if (prep.css.length) bits.push(`${prep.css.length} stylesheet${prep.css.length > 1 ? 's' : ''}`);
  if (count(IMAGE)) bits.push(`${count(IMAGE)} image${count(IMAGE) > 1 ? 's' : ''}`);
  if (count(VIDEO)) bits.push(`${count(VIDEO)} video${count(VIDEO) > 1 ? 's' : ''}`);
  if (count(FONT)) bits.push(`${count(FONT)} font${count(FONT) > 1 ? 's' : ''}`);
  let text = `Found: ${bits.join(', ')}.`;
  if (prep.isBackup) text += ' This page was exported from the builder, so it will come back fully editable.';
  else if (prep.otherPages) text += ` The folder has ${prep.otherPages} other page${prep.otherPages > 1 ? 's' : ''}; only ${base(prep.main)} is imported (import the others one at a time).`;
  return text;
}

// ---------- address rewriting ----------

function makeResolver(urlFor) {
  const byBase = new Map();
  for (const [path, url] of urlFor) byBase.set(base(path).toLowerCase(), url);
  const missing = new Set();
  const resolve = (ref, baseDir, countMissing = false) => {
    const value = (ref || '').trim();
    if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return ref;
    const cut = value.search(/[?#]/);
    const pathPart = cut < 0 ? value : value.slice(0, cut);
    const rest = cut < 0 ? '' : value.slice(cut);
    let decoded = pathPart;
    try {
      decoded = decodeURI(pathPart);
    } catch {
      /* keep as is */
    }
    const full = join(baseDir, decoded);
    const url = urlFor.get(full) || urlFor.get(norm(decoded)) || byBase.get(base(full).toLowerCase());
    if (url) return url + rest;
    if (countMissing && isAsset(full)) missing.add(base(full));
    return ref;
  };
  return { resolve, missing };
}

const rewriteCss = (css, baseDir, resolve) =>
  css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, ref) => `url(${quote}${resolve(ref, baseDir)}${quote})`);

// ---------- running an import ----------

export async function runImport(prep, name, { onProgress } = {}) {
  const warnings = [];
  const urlFor = new Map();

  // 1) Upload every picture, video and font into the new page's assets folder.
  const toUpload = prep.isBackup
    ? prep.assets.filter((p) => p.startsWith(join(prep.dir, 'assets/')))
    : prep.assets;
  const BATCH = 20;
  let done = 0;
  for (let i = 0; i < toUpload.length; i += BATCH) {
    const slice = toUpload.slice(i, i + BATCH);
    const urls = await api.uploadAssets(name, slice.map((p) => prep.entries.get(p).toFile()), (f) => onProgress?.((done + f * slice.length) / toUpload.length));
    slice.forEach((p, k) => urlFor.set(p, urls[k]));
    done += slice.length;
  }

  const mainEntry = prep.entries.get(prep.main);
  const htmlText = await mainEntry.text();

  // 2) A page exported from this builder: restore it exactly.
  if (prep.isBackup) {
    const projectText = await prep.entries.get(join(prep.dir, 'project.json')).text();
    let retargeted = projectText;
    for (const old of new Set([...projectText.matchAll(/\/pages\/([a-z0-9_-]+)\/assets\//g)].map((m) => m[1]))) {
      retargeted = retargeted.split(`/pages/${old}/assets/`).join(`/pages/${name}/assets/`);
    }
    const metaEntry = prep.entries.get(join(prep.dir, 'meta.json'));
    const cssEntry = prep.entries.get(join(prep.dir, 'style.css'));
    return {
      kind: 'backup',
      project: JSON.parse(retargeted),
      html: htmlText,
      css: cssEntry ? await cssEntry.text() : '',
      meta: metaEntry ? JSON.parse(await metaEntry.text()) : {},
      warnings,
    };
  }

  // 3) Any other web page: turn it into editable components.
  const { resolve, missing } = makeResolver(urlFor);
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const cssParts = [];
  const headLinks = [];

  for (const link of doc.querySelectorAll('link[rel~="stylesheet"][href]')) {
    const href = link.getAttribute('href');
    if (/^(?:https?:)?\/\//i.test(href)) {
      headLinks.push(href.startsWith('//') ? `https:${href}` : href);
      continue;
    }
    const cssPath = join(prep.dir, decodeURI(href.split(/[?#]/)[0]));
    const entry = prep.entries.get(cssPath) || [...prep.entries.values()].find((e) => e.name.toLowerCase() === base(cssPath).toLowerCase() && /\.css$/i.test(e.path));
    if (entry) cssParts.push(rewriteCss(await entry.text(), dirOf(entry.path), (r, d) => resolve(r, d, true)));
    else warnings.push(`The stylesheet ${href} was not included, so its styles are missing. Choose it together with the page, or import a folder or .zip.`);
  }
  for (const style of doc.querySelectorAll('style')) cssParts.push(rewriteCss(style.textContent, prep.dir, (r, d) => resolve(r, d, true)));

  const scripts = doc.querySelectorAll('script').length;
  if (scripts) warnings.push(`${scripts} script${scripts > 1 ? 's were' : ' was'} left out. Imported pages keep their layout and styling, but not their JavaScript behavior.`);
  if (headLinks.length) warnings.push(`Kept ${headLinks.length} online stylesheet link${headLinks.length > 1 ? 's' : ''} (for example web fonts). They need an internet connection.`);

  doc.body.querySelectorAll('script, noscript, style, link').forEach((n) => n.remove());
  let handlers = 0;
  for (const el of doc.body.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name)) {
        el.removeAttribute(attr.name);
        handlers += 1;
      } else if (/^(?:href|src)$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value)) {
        el.setAttribute(attr.name, '#');
        handlers += 1;
      }
    }
  }
  if (handlers) warnings.push(`${handlers} inline event handler${handlers > 1 ? 's' : ''} (such as onclick) ${handlers > 1 ? 'were' : 'was'} removed.`);
  for (const el of doc.body.querySelectorAll('[src], [poster], [data-src], [srcset], [href], [style]')) {
    for (const attr of ['src', 'poster', 'data-src', 'href']) {
      if (el.hasAttribute(attr)) {
        const before = el.getAttribute(attr);
        const after = resolve(before, prep.dir, attr !== 'href');
        if (after !== before) el.setAttribute(attr, after);
      }
    }
    if (el.hasAttribute('srcset')) {
      el.setAttribute('srcset', el.getAttribute('srcset').split(',').map((part) => {
        const [ref, ...size] = part.trim().split(/\s+/);
        return [resolve(ref, prep.dir, true), ...size].join(' ');
      }).join(', '));
    }
    if (el.hasAttribute('style')) el.setAttribute('style', rewriteCss(el.getAttribute('style'), prep.dir, (r, d) => resolve(r, d, true)));
  }
  if (missing.size) warnings.push(`${missing.size} file${missing.size > 1 ? 's' : ''} the page uses ${missing.size > 1 ? 'were' : 'was'} not included (${[...missing].slice(0, 4).join(', ')}${missing.size > 4 ? ', …' : ''}). Choose them together with the page, or import a folder or .zip.`);

  return {
    kind: 'html',
    body: doc.body.innerHTML,
    css: cssParts.join('\n\n'),
    meta: {
      title: (doc.title || '').trim(),
      description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      headLinks: [...new Set(headLinks)],
    },
    warnings,
  };
}

// ---------- dropped folders ----------

export async function itemsFromDrop(dataTransfer) {
  const out = [];
  const readEntry = (entry, prefix) =>
    new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((file) => {
          out.push({ file, path: `${prefix}${file.name}` });
          resolve();
        }, resolve);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const all = [];
        const pump = () =>
          reader.readEntries(async (batch) => {
            if (!batch.length) {
              await Promise.all(all.map((child) => readEntry(child, `${prefix}${entry.name}/`)));
              resolve();
            } else {
              all.push(...batch);
              pump();
            }
          }, resolve);
        pump();
      } else resolve();
    });
  const entries = [...(dataTransfer.items || [])].map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) await Promise.all(entries.map((entry) => readEntry(entry, '')));
  else for (const file of dataTransfer.files) out.push({ file, path: file.name });
  return out;
}
