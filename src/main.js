import grapesjsModule from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import 'grapick/dist/grapick.min.css';
import 'font-awesome/css/font-awesome.min.css'; // editor icons, bundled so the editor works offline
import './ui.css';

import formsModule from 'grapesjs-plugin-forms';
import countdownModule from 'grapesjs-component-countdown';
import customCodeModule from 'grapesjs-custom-code';
import styleBgModule from 'grapesjs-style-bg';
import tabsModule from 'grapesjs-tabs';

import { DEVICES, FONTS_URL, FONT_FAMILIES } from './config.js';
import { TEMPLATES, templateHtml } from './templates.js';
import { initAddPanel } from './addpanel.js';
import { initFreeform } from './freeform.js';
import { initTextPopup } from './textpopup.js';
import { initFaqEditor } from './faqeditor.js';
import { initAnimate } from './animate.js';
import { initMedia } from './media.js';
import { initAi } from './ai.js';
import { initAnalyzer } from './analyzer.js';
import { compactForAi, prepareAiHtml, sanitizeCss } from './ai-prompt.js';
import { describe, itemsFromDrop, prepareImport, runImport } from './importer.js';
import * as api from './api.js';

// Some GrapesJS plugins are published as CommonJS/UMD bundles. Depending on the bundler they arrive
// either as the function itself or wrapped as { default: fn }. This accepts both.
const unwrap = (mod) => (mod && typeof mod !== 'function' && mod.default ? mod.default : mod);
const grapesjs = unwrap(grapesjsModule);

const LAST_PAGE_KEY = 'landing-builder:last-page';
const TABS_KEY = 'landing-builder:tabs';
const AUTOSAVE_MS = 1200;

const $ = (id) => document.getElementById(id);
const el = {
  status: $('status'),
  tabs: $('tabs'),
  pagesList: $('pages-list'),
  newDialog: $('new-dialog'),
  newForm: $('new-form'),
  newName: $('new-name'),
  newHint: $('new-slug-hint'),
  newTemplate: $('new-template'),
  newError: $('new-error'),
  settingsDialog: $('settings-dialog'),
  settingsForm: $('settings-form'),
  metaTitle: $('meta-title'),
  metaDescription: $('meta-description'),
};

// ---------- state ----------

let current = null; // name of the open page
let meta = {}; // { title, description }
let lastKey = ''; // snapshot of what is on disk
let saveTimer = null;
let dirty = false;
let busy = false; // true while a page is being loaded, so loading is not mistaken for an edit
let saveQueue = Promise.resolve();
let pagesDir = '';
let pageNames = [];
let openTabs = [];
let designSystemCss = '';
let motionJs = '';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slugify = (text) =>
  String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const humanize = (slug) => slug.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function setStatus(text, kind = '') {
  el.status.textContent = text;
  el.status.className = `tb-status ${kind}`.trim();
  el.status.title = current && pagesDir ? `${pagesDir}/${current}` : '';
}

// ---------- editor ----------

const sizePosition = ['width', 'height', 'min-height', 'top', 'left', 'z-index'];

const editor = grapesjs.init({
  container: '#gjs',
  height: '100%',
  width: 'auto',
  fromElement: false,
  storageManager: false, // saving is handled by this file, not by GrapesJS
  telemetry: false, // do not send anonymous usage data to grapesjs.com
  showOffsets: false, // no margin/padding overlays on hover: they force a layout calculation on every mouse move
  showOffsetsSelected: false,
  cssIcons: '', // icons come from the bundled font-awesome import above, not a CDN
  panels: { defaults: [] }, // the interface is built in index.html
  deviceManager: { devices: DEVICES },
  selectorManager: { componentFirst: true, appendTo: '#sm-selectors' }, // style the selected element, not every element sharing a class
  traitManager: { appendTo: '#sm-traits' },
  layerManager: { appendTo: '#layers-container' },
  styleManager: {
    appendTo: '#sm-styles',
    sectors: [
      { name: 'Size and position', open: true, properties: sizePosition },
      {
        name: 'Text',
        open: false,
        properties: [
          { extend: 'font-family', options: FONT_FAMILIES.map(([label, value]) => ({ id: value, label })) },
          'font-size',
          'font-weight',
          'letter-spacing',
          'color',
          'line-height',
          'text-align',
          'text-decoration',
          {
            property: 'text-transform',
            type: 'select',
            default: 'none',
            options: [
              { id: 'none', label: 'Normal' },
              { id: 'uppercase', label: 'UPPERCASE' },
              { id: 'lowercase', label: 'lowercase' },
              { id: 'capitalize', label: 'Capitalize' },
            ],
          },
          'text-shadow',
        ],
      },
      { name: 'Background', open: false, properties: ['background-color', 'background'] },
      { name: 'Spacing', open: false, properties: ['margin', 'padding'] },
      { name: 'Border and effects', open: false, properties: ['border-radius', 'border', 'box-shadow', 'opacity'] },
    ],
  },
  canvas: { styles: [FONTS_URL, '/design-system.css', '/canvas.css'], scripts: ['/motion.js'] },
  plugins: [unwrap(formsModule), unwrap(countdownModule), unwrap(customCodeModule), unwrap(styleBgModule), unwrap(tabsModule)],
  assetManager: {
    // Uploaded images are saved in pages/<page>/assets/ instead of being embedded in the page data.
    uploadFile: async (event, done) => {
      const files = Array.from(event.dataTransfer ? event.dataTransfer.files : event.target.files || []);
      if (!files.length) return;
      if (!current) {
        setStatus('Open or create a page before uploading images.', 'error');
        return;
      }
      try {
        const urls = await api.uploadAssets(current, files);
        editor.AssetManager.add(
          urls.map((src) => ({ type: 'image', src })),
          { at: 0 },
        );
        if (typeof done === 'function') done({ data: urls });
      } catch (err) {
        setStatus(`Upload failed: ${err.message}`, 'error');
      }
    },
  },
});

window.editor = editor; // handy for poking around in the browser console

initFreeform(editor);
initMedia(editor, { container: document.getElementById('sm-media'), getPage: () => current, say: setStatus });

// ---------- saving ----------

// FAQ answers are always shown while editing, but items start closed on the live page.
const closeFaqItems = (html) =>
  html.replace(/<details\b[^>]*>/g, (tag) =>
    /\bclass="[^"]*\blp-faq\b/.test(tag) ? tag.replace(/\sopen(?:="[^"]*")?(?=[\s>])/, '') : tag,
  );

function buildDocument(name) {
  const title = meta.title || humanize(name);
  let body = editor.getHtml().trim();
  body = closeFaqItems(body);
  if (!/^<body[\s>]/i.test(body)) body = `<body>${body}</body>`;
  const js = (editor.getJs() || '').trim();
  const usesMotion = /\sdata-(enter|fx|scroll|loop)=/.test(body);
  const scripts = [];
  if (usesMotion && motionJs) scripts.push(`<script>${motionJs}</script>`, '<script>LPMotion.init(document);</script>');
  if (js) scripts.push(`<script>${js}</script>`);
  if (scripts.length) body = body.replace(/<\/body>\s*$/i, () => `${scripts.join('\n')}</body>`);

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    usesMotion ? '<script>document.documentElement.classList.add("lp-js");</script>' : '',
    `<title>${escapeHtml(title)}</title>`,
    meta.description ? `<meta name="description" content="${escapeHtml(meta.description)}">` : '',
    ...(meta.headLinks || []).map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`),
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link rel="stylesheet" href="${FONTS_URL}">`,
    '<link rel="stylesheet" href="style.css">',
    '</head>',
    body,
    '</html>',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function doSave(force) {
  if (!current) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  const name = current;
  const project = editor.getProjectData();
  const key = JSON.stringify({ project, meta });
  if (!force && key === lastKey) {
    dirty = false;
    setStatus('All changes saved');
    renderTabs();
    return;
  }
  setStatus('Saving…');
  try {
    const html = buildDocument(name);
    const css = `${designSystemCss}\n\n/* Page styles */\n${editor.getCss()}`;
    await api.savePage(name, { project, html, css, meta });
    if (current === name) {
      lastKey = key;
      dirty = false;
      setStatus(`Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      renderTabs();
    }
  } catch (err) {
    setStatus(`Not saved: ${err.message}`, 'error');
  }
}

function save({ force = false } = {}) {
  saveQueue = saveQueue.then(() => doSave(force));
  return saveQueue;
}

function scheduleSave() {
  if (!current || busy) return;
  dirty = true;
  setStatus('Unsaved changes…');
  renderTabs();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(), AUTOSAVE_MS);
}

editor.on('update', scheduleSave);

const onKeyDown = (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save({ force: true });
  }
};
document.addEventListener('keydown', onKeyDown);
editor.on('load', () => editor.Canvas.getWindow()?.addEventListener('keydown', onKeyDown));

window.addEventListener('beforeunload', (event) => {
  if (dirty) event.preventDefault();
});

// Online stylesheets that an imported page uses (for example web fonts) are loaded into the editor canvas too.
function syncHeadLinks() {
  const head = editor.Canvas.getDocument()?.head;
  if (!head) return;
  head.querySelectorAll('[data-lp-head]').forEach((n) => n.remove());
  for (const href of meta.headLinks || []) {
    const link = head.ownerDocument.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.lpHead = '1';
    head.append(link);
  }
}

// ---------- pages and tabs ----------

const storeTabs = () => localStorage.setItem(TABS_KEY, JSON.stringify(openTabs));

function renderTabs() {
  const tabs = openTabs.map((name) => {
    const tab = document.createElement('div');
    tab.className = `tab${name === current ? ' on' : ''}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(name === current));
    tab.tabIndex = 0;
    const label = document.createElement('span');
    label.className = 'tab-name';
    label.textContent = name;
    tab.append(label);
    if (name === current && dirty) {
      const dot = document.createElement('span');
      dot.className = 'tab-dot';
      dot.title = 'Unsaved changes';
      tab.append(dot);
    }
    if (openTabs.length > 1) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-x';
      close.innerHTML = '&times;';
      close.title = 'Close tab (the page stays saved)';
      close.setAttribute('aria-label', `Close ${name}`);
      close.addEventListener('click', (event) => {
        event.stopPropagation();
        closeTab(name);
      });
      tab.append(close);
    }
    tab.addEventListener('click', () => switchPage(name));
    tab.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        switchPage(name);
      }
    });
    return tab;
  });
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'tab-add';
  add.textContent = '+';
  add.title = 'New page';
  add.setAttribute('aria-label', 'New page');
  add.addEventListener('click', openNewDialog);
  el.tabs.replaceChildren(...tabs, add);
}

function addTab(name) {
  if (!openTabs.includes(name)) openTabs.push(name);
  storeTabs();
  renderTabs();
}

async function closeTab(name) {
  const index = openTabs.indexOf(name);
  if (index < 0 || openTabs.length < 2) return;
  if (name === current) {
    const next = openTabs[index + 1] ?? openTabs[index - 1];
    await switchPage(next);
  }
  openTabs = openTabs.filter((n) => n !== name);
  storeTabs();
  renderTabs();
}

const icon = (body) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

function renderPagesList() {
  el.pagesList.replaceChildren(
    ...pageNames.map((name) => {
      const li = document.createElement('li');
      li.className = `page-row${name === current ? ' on' : ''}`;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'page-open';
      open.textContent = name;
      open.addEventListener('click', () => switchPage(name));
      li.append(open);
      const actions = [
        ['Page settings', icon('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'), () => switchPage(name).then(openSettings)],
        ['Duplicate', icon('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'), () => duplicatePage(name)],
        ['Rename', icon('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>'), () => renamePage(name)],
        ['Delete', icon('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'), () => deletePage(name), 'danger'],
      ];
      for (const [label, svg, handler, extra] of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `page-act${extra ? ` ${extra}` : ''}`;
        button.title = label;
        button.setAttribute('aria-label', `${label} ${name}`);
        button.innerHTML = svg;
        button.addEventListener('click', handler);
        li.append(button);
      }
      return li;
    }),
  );
}

async function refreshPages() {
  const pages = await api.listPages();
  pageNames = pages.map((p) => p.name);
  openTabs = openTabs.filter((name) => pageNames.includes(name));
  storeTabs();
  renderTabs();
  renderPagesList();
}

async function loadAssets() {
  try {
    const urls = await api.listAssets(current);
    editor.AssetManager.getAll().reset(urls.map((src) => ({ type: 'image', src })));
  } catch {
    /* the asset list is a convenience; the editor still works without it */
  }
}

async function openPage(name) {
  busy = true;
  clearTimeout(saveTimer);
  try {
    const data = await api.getPage(name);
    editor.select();
    editor.loadProjectData(data.project);
    editor.UndoManager.clear();
    current = name;
    meta = data.meta || {};
    syncHeadLinks();
    localStorage.setItem(LAST_PAGE_KEY, name);
    addTab(name);
    await refreshPages();
    await loadAssets();
    await wait(300); // let GrapesJS finish applying the project before taking the snapshot
    lastKey = JSON.stringify({ project: editor.getProjectData(), meta });
    dirty = false;
    setStatus('All changes saved');
    renderTabs();
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    busy = false;
  }
}

async function switchPage(name) {
  if (name === current) return;
  await save();
  await openPage(name);
}

async function createPage(name, templateId) {
  await save();
  busy = true;
  clearTimeout(saveTimer);
  editor.select();
  editor.Css.clear();
  editor.setComponents(templateHtml(templateId));
  editor.UndoManager.clear();
  current = name;
  meta = {};
  syncHeadLinks();
  editor.AssetManager.getAll().reset([]);
  await wait(300);
  busy = false;
  await save({ force: true });
  localStorage.setItem(LAST_PAGE_KEY, name);
  addTab(name);
  await refreshPages();
}

async function askForName(message, fallback) {
  const answer = window.prompt(message, fallback);
  if (answer === null) return null;
  const slug = slugify(answer);
  if (!slug) {
    setStatus('Enter a name using letters or numbers.', 'error');
    return null;
  }
  if (pageNames.includes(slug)) {
    setStatus(`A page named "${slug}" already exists.`, 'error');
    return null;
  }
  return slug;
}

async function renamePage(name) {
  const to = await askForName('New name for this page:', name);
  if (!to || to === name) return;
  try {
    if (name === current) await save();
    await api.renamePage(name, to);
    openTabs = openTabs.map((n) => (n === name ? to : n));
    if (name === current) {
      current = null;
      await refreshPages();
      await openPage(to);
    } else {
      await refreshPages();
    }
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function duplicatePage(name) {
  const to = await askForName('Name for the copy:', `${name}-copy`);
  if (!to) return;
  try {
    if (name === current) await save();
    await api.duplicatePage(name, to);
    await refreshPages();
    await switchPage(to);
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function deletePage(name) {
  const ok = window.confirm(
    `Delete "${name}"?\n\nThe folder is moved to pages/.trash, so you can still recover it from your file manager.`,
  );
  if (!ok) return;
  try {
    if (name === current) {
      clearTimeout(saveTimer);
      await saveQueue;
    }
    await api.deletePage(name);
    openTabs = openTabs.filter((n) => n !== name);
    const wasCurrent = name === current;
    if (wasCurrent) {
      current = null;
      dirty = false;
    }
    await refreshPages();
    if (wasCurrent) {
      const next = openTabs[0] ?? pageNames[0];
      if (next) await openPage(next);
      else openNewDialog();
    }
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

// ---------- dialogs ----------

el.newTemplate.replaceChildren(
  ...TEMPLATES.map((t) => {
    const option = document.createElement('option');
    option.value = t.id;
    option.textContent = t.label;
    return option;
  }),
);
el.newTemplate.value = 'freeform';

function openNewDialog() {
  el.newName.value = '';
  el.newHint.textContent = '';
  el.newError.hidden = true;
  el.newDialog.showModal();
  el.newName.focus();
}

el.newName.addEventListener('input', () => {
  const slug = slugify(el.newName.value);
  el.newHint.textContent = slug ? `Saved as pages/${slug}/` : '';
  el.newError.hidden = true;
});

$('new-cancel').addEventListener('click', async () => {
  el.newDialog.close();
  if (!current) await createPage('untitled', 'blank'); // never leave the editor without a page to save into
});

el.newForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const slug = slugify(el.newName.value);
  if (!slug) {
    el.newError.textContent = 'Enter a name using letters or numbers.';
    el.newError.hidden = false;
    return;
  }
  if (pageNames.includes(slug)) {
    el.newError.textContent = `A page named "${slug}" already exists.`;
    el.newError.hidden = false;
    return;
  }
  el.newDialog.close();
  try {
    await createPage(slug, el.newTemplate.value);
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

function openSettings() {
  if (!current) return;
  el.metaTitle.value = meta.title || '';
  el.metaTitle.placeholder = humanize(current);
  el.metaDescription.value = meta.description || '';
  el.settingsDialog.showModal();
}
$('settings-cancel').addEventListener('click', () => el.settingsDialog.close());
el.settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  meta = { ...meta, title: el.metaTitle.value.trim(), description: el.metaDescription.value.trim() };
  el.settingsDialog.close();
  save({ force: true });
});

// ---------- file menu: import and download ----------

const fileMenu = $('file-menu');
const fileButton = $('btn-file');
function toggleFileMenu(show) {
  fileMenu.hidden = !show;
  fileButton.setAttribute('aria-expanded', String(show));
  if (show) {
    const r = fileButton.getBoundingClientRect();
    fileMenu.style.top = `${r.bottom + 6}px`;
    fileMenu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - fileMenu.offsetWidth - 8))}px`;
  }
}
fileButton.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleFileMenu(fileMenu.hidden);
});
document.addEventListener('click', (e) => {
  if (!fileMenu.hidden && !fileMenu.contains(e.target)) toggleFileMenu(false);
});
editor.on('load', () => editor.Canvas.getDocument().addEventListener('mousedown', () => toggleFileMenu(false)));

function download(url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.append(a);
  a.click();
  a.remove();
}

fileMenu.addEventListener('click', async (event) => {
  const item = event.target.closest('[data-file]');
  if (!item) return;
  toggleFileMenu(false);
  const action = item.dataset.file;
  if (action === 'import') return openImport();
  if (!current) return setStatus('Open or create a page first.', 'error');
  try {
    await save({ force: true });
    if (action === 'zip') download(`/api/pages/${encodeURIComponent(current)}/export.zip`);
    if (action === 'all') download('/api/export-all.zip');
    if (action === 'html') {
      const info = await fetch(`/api/pages/${encodeURIComponent(current)}/export-info`).then((r) => r.json());
      if (info.videos?.length && !window.confirm(`This page uses ${info.videos.length} video file${info.videos.length > 1 ? 's' : ''} (${info.videos.slice(0, 3).join(', ')}). Videos cannot be packed inside a single .html file, so they would be missing.\n\nChoose OK to download the single file anyway, or Cancel and use “Download this page (.zip)” instead.`)) return;
      download(`/api/pages/${encodeURIComponent(current)}/export.html`);
    }
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

const imp = {
  dialog: $('import-dialog'),
  drop: $('import-drop'),
  files: $('import-files'),
  dir: $('import-dir'),
  summary: $('import-summary'),
  name: $('import-name'),
  go: $('import-go'),
  bar: $('import-bar'),
  warnings: $('import-warnings'),
  error: $('import-error'),
};
let prepared = null;

function openImport() {
  prepared = null;
  imp.summary.textContent = '';
  imp.name.value = '';
  imp.go.disabled = true;
  imp.warnings.replaceChildren();
  imp.error.hidden = true;
  imp.bar.hidden = true;
  imp.dialog.showModal();
}

async function choose(items) {
  imp.error.hidden = true;
  imp.warnings.replaceChildren();
  imp.summary.textContent = 'Reading…';
  try {
    prepared = await prepareImport(items);
    imp.summary.textContent = describe(prepared);
    if (!imp.name.value) imp.name.value = slugify(prepared.suggestedName) || 'imported-page';
    imp.go.disabled = false;
  } catch (err) {
    prepared = null;
    imp.summary.textContent = '';
    imp.error.textContent = err.message;
    imp.error.hidden = false;
    imp.go.disabled = true;
  }
}

$('import-pick').addEventListener('click', () => imp.files.click());
$('import-folder').addEventListener('click', () => imp.dir.click());
imp.files.addEventListener('change', () => {
  const items = [...imp.files.files].map((file) => ({ file, path: file.name }));
  imp.files.value = '';
  if (items.length) choose(items);
});
imp.dir.addEventListener('change', () => {
  const items = [...imp.dir.files].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
  imp.dir.value = '';
  if (items.length) choose(items);
});
for (const type of ['dragenter', 'dragover']) imp.drop.addEventListener(type, (e) => { e.preventDefault(); imp.drop.classList.add('over'); });
for (const type of ['dragleave', 'drop']) imp.drop.addEventListener(type, () => imp.drop.classList.remove('over'));
imp.drop.addEventListener('drop', async (e) => {
  e.preventDefault();
  const items = await itemsFromDrop(e.dataTransfer);
  if (items.length) choose(items);
});
$('import-cancel').addEventListener('click', () => imp.dialog.close());

$('import-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!prepared) return;
  const slug = slugify(imp.name.value);
  if (!slug) {
    imp.error.textContent = 'Enter a name using letters or numbers.';
    imp.error.hidden = false;
    return;
  }
  if (pageNames.includes(slug)) {
    imp.error.textContent = `A page named "${slug}" already exists. Choose another name.`;
    imp.error.hidden = false;
    return;
  }
  imp.error.hidden = true;
  imp.go.disabled = true;
  imp.bar.hidden = false;
  imp.bar.firstChild.style.width = '0%';
  imp.summary.textContent = 'Importing…';
  try {
    const warnings = await importPrepared(prepared, slug, (f) => (imp.bar.firstChild.style.width = `${Math.round(f * 100)}%`));
    imp.bar.hidden = true;
    imp.summary.textContent = `Imported as “${slug}”.`;
    imp.warnings.replaceChildren(...warnings.map((w) => Object.assign(document.createElement('li'), { textContent: w })));
    if (!warnings.length) imp.dialog.close();
    else {
      imp.go.disabled = true;
      $('import-cancel').textContent = 'Done';
    }
  } catch (err) {
    imp.bar.hidden = true;
    imp.error.textContent = `Import failed: ${err.message}`;
    imp.error.hidden = false;
    imp.go.disabled = false;
  }
});
imp.dialog.addEventListener('close', () => ($('import-cancel').textContent = 'Close'));

async function importPrepared(prep, name, onProgress) {
  await save();
  if (prep.isBackup) {
    const result = await runImport(prep, name, { onProgress });
    await api.savePage(name, { project: result.project, html: result.html, css: result.css, meta: result.meta });
    await refreshPages();
    await openPage(name);
    return result.warnings;
  }
  await createPage(name, 'blank');
  const result = await runImport(prep, name, { onProgress });
  busy = true;
  editor.select();
  editor.Css.clear();
  editor.setComponents(result.body);
  if (result.css) editor.setStyle(result.css);
  editor.UndoManager.clear();
  meta = result.meta;
  syncHeadLinks();
  await wait(400);
  busy = false;
  await loadAssets();
  await save({ force: true });
  return result.warnings;
}

// ---------- AI designer ----------

function aiContext() {
  if (!editor.getWrapper().components().length) return { empty: true };
  const html = compactForAi(editor.getHtml().replace(/^\s*<body[^>]*>/, '').replace(/<\/body>\s*$/, ''));
  const css = editor.getCss({ avoidProtected: true });
  if (html.length + css.length > 150000) return { empty: false, tooLarge: true };
  return { empty: false, html, css };
}

async function applyAi(mode, { html, css, hint, allowedUrls }) {
  const cleanHtml = prepareAiHtml(html, allowedUrls);
  const cleanCss = sanitizeCss(css, allowedUrls);
  if (!cleanHtml.trim()) throw new Error('The AI did not return any page content. Try asking again.');
  const fill = () => {
    editor.select();
    editor.Css.clear();
    editor.setComponents(cleanHtml);
    if (cleanCss) editor.setStyle(cleanCss);
  };

  if (mode === 'new') {
    const words = slugify(hint).split('-').filter(Boolean).slice(0, 4).join('-') || 'page';
    let name = `ai-${words}`;
    for (let n = 2; pageNames.includes(name); n += 1) name = `ai-${words}-${n}`;
    await createPage(name, 'blank');
    fill();
    const heading = new DOMParser().parseFromString(`<body>${cleanHtml}</body>`, 'text/html').querySelector('h1');
    meta = { ...meta, title: (heading?.textContent || '').trim().slice(0, 80) };
    editor.UndoManager.clear();
    await wait(300);
    await save({ force: true });
    return null; // a new page is simply closed or deleted to undo
  }

  if (!current) throw new Error('Open or create a page first.');
  const before = editor.getProjectData();
  const page = current;
  if (mode === 'replace') fill();
  else {
    editor.getWrapper().components().add(cleanHtml);
    if (cleanCss) editor.addStyle(cleanCss);
  }
  return async () => {
    if (current !== page) await switchPage(page);
    editor.select();
    editor.loadProjectData(before);
  };
}

let analyzer = null;
const ai = initAi({
  pane: $('pane-ai'),
  dialog: $('ai-dialog'),
  getContext: aiContext,
  applyToPage: applyAi,
  getProfile: () => analyzer?.getActiveProfile() || null,
});

analyzer = initAnalyzer({
  pane: $('pane-analyzer'),
  dialog: $('analyzer-dialog'),
  onProfileChange: () => ai.updateProfile?.(),
});

// ---------- toolbar, rail, panels ----------

$('btn-new').addEventListener('click', openNewDialog);
$('btn-save').addEventListener('click', () => save({ force: true }));
$('btn-preview').addEventListener('click', async () => {
  if (!current) return;
  await save({ force: true });
  window.open(`/pages/${encodeURIComponent(current)}/index.html`, '_blank');
});

const undoButton = $('btn-undo');
const redoButton = $('btn-redo');
const syncUndo = () => {
  undoButton.disabled = !editor.UndoManager.hasUndo();
  redoButton.disabled = !editor.UndoManager.hasRedo();
};
undoButton.addEventListener('click', () => editor.UndoManager.undo());
redoButton.addEventListener('click', () => editor.UndoManager.redo());
editor.on('update undo redo', syncUndo);
syncUndo();

function setDevice(id) {
  editor.setDevice(id);
  document.querySelectorAll('[data-device]').forEach((b) => {
    const on = b.dataset.device === id;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $('device-note').hidden = id === 'desktop';
}
document.querySelectorAll('[data-device]').forEach((b) => b.addEventListener('click', () => setDevice(b.dataset.device)));

let pane = null;
function showPane(name) {
  pane = pane === name ? null : name;
  const flyout = $('flyout');
  flyout.hidden = !pane;
  flyout.className = (pane === 'add' || pane === 'analyzer') ? 'wide' : pane === 'ai' ? 'chat' : 'narrow';
  for (const id of ['add', 'ai', 'analyzer', 'pages', 'layers']) $(`pane-${id}`).hidden = pane !== id;
  document.querySelectorAll('.rail-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pane === pane)));
}
document.querySelectorAll('.rail-btn').forEach((b) => b.addEventListener('click', () => showPane(b.dataset.pane)));
// Clicking on the page gets the Add, Pages and Analyzer panels out of the way (Layers stays, it is used alongside the page).
editor.on('load', () => {
  editor.Canvas.getFrameEl().contentDocument.addEventListener('mousedown', () => {
    if (pane === 'add' || pane === 'pages' || pane === 'analyzer') showPane(pane);
  });
});
$('fly-close').addEventListener('click', () => showPane(pane));

function showDock(on) {
  $('dock').hidden = !on;
  $('btn-design').setAttribute('aria-pressed', String(on));
}
function dockTab(name) {
  document.querySelectorAll('[data-dock]').forEach((b) => b.classList.toggle('on', b.dataset.dock === name));
  for (const id of ['design', 'animate', 'settings']) $(`dock-${id}`).hidden = id !== name;
}
const openDock = (tab) => {
  showDock(true);
  if (typeof tab === 'string') dockTab(tab);
};
$('btn-design').addEventListener('click', () => showDock($('dock').hidden));
$('dock-close').addEventListener('click', () => showDock(false));
document.querySelectorAll('[data-dock]').forEach((b) => b.addEventListener('click', () => dockTab(b.dataset.dock)));
editor.on('component:toggled', () => {
  $('dock-empty').hidden = !!editor.getSelected();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && pane && !event.target.closest?.('input, textarea, select')) showPane(pane);
});

// ---------- floating windows ----------

const faqEditor = initFaqEditor(editor);
initTextPopup(editor, { openDock, onManageFaq: (list) => faqEditor.open(list) });

const animate = initAnimate(editor, {
  container: $('animate-panel'),
  openAnimate: () => openDock('animate'),
  onPreview: (on) => {
    $('btn-motion').setAttribute('aria-pressed', String(on));
    $('btn-motion').innerHTML = on ? '&#9632; Stop preview' : '&#9654; Preview motion';
  },
});
$('btn-motion').addEventListener('click', () => animate.setPreview(!animate.isPreview()));

// ---------- start ----------

editor.on('load', async () => {
  setDevice('desktop');
  try {
    const [config, css, motion] = await Promise.all([
      api.getConfig(),
      fetch('/design-system.css').then((r) => r.text()),
      fetch('/motion.js').then((r) => r.text()),
    ]);
    pagesDir = config.pagesDir;
    designSystemCss = css;
    motionJs = motion;
    initAddPanel(editor, { container: $('pane-add'), getDesignCss: () => designSystemCss });

    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = FONTS_URL;
    document.head.append(fonts);

    try {
      openTabs = JSON.parse(localStorage.getItem(TABS_KEY) || '[]');
    } catch {
      openTabs = [];
    }
    await refreshPages();
    const last = localStorage.getItem(LAST_PAGE_KEY);
    const first = pageNames.includes(last) ? last : openTabs[0] ?? pageNames[0];
    if (first) await openPage(first);
    else openNewDialog();
    showPane('add'); // start with the Add panel open
  } catch (err) {
    setStatus(err.message, 'error');
  }
});
