// Local server for the landing page builder.
// - Serves the editor (Vite in dev, ./dist in production)
// - Saves pages as plain files in ./pages/<name>/
// - Binds to 127.0.0.1 only: there is no login, so it must not be reachable from the network.

import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mountExport } from './server/export.js';
import { mountAi } from './server/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.resolve(process.env.PAGES_DIR || path.join(__dirname, 'pages'));
const TRASH_DIR = path.join(PAGES_DIR, '.trash');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PORT = Number(process.env.PORT) || 3000;
// Running on your own computer (default) needs no password. To put it on the internet, set HOST=0.0.0.0 AND a
// BUILDER_PASSWORD: the builder can edit and delete pages and can spend your AI key, so it must never be open to everyone.
const HOST = process.env.HOST || '127.0.0.1';
const PASSWORD = process.env.BUILDER_PASSWORD || '';
const LOCAL_ONLY = ['127.0.0.1', 'localhost', '::1'].includes(HOST);
if (!LOCAL_ONLY && !PASSWORD) {
  console.error('\n  Refusing to start: HOST is set to a public address but BUILDER_PASSWORD is not set.');
  console.error('  Without a password, anyone with the link could edit your pages and use your AI key.');
  console.error('  Set BUILDER_PASSWORD to a long password and start again.\n');
  process.exit(1);
}
const PROD = process.argv.includes('--prod');

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,59}$/;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.ogv', '.mov', '.m4v']);
const FONT_EXT = new Set(['.woff', '.woff2', '.ttf', '.otf']);
const ASSET_EXT = new Set([...IMAGE_EXT, ...VIDEO_EXT, ...FONT_EXT]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function pageDir(name) {
  if (!NAME_RE.test(name || '')) {
    throw new HttpError(400, 'Page names may only use lowercase letters, numbers, "-" and "_".');
  }
  const dir = path.join(PAGES_DIR, name);
  if (path.dirname(dir) !== PAGES_DIR) throw new HttpError(400, 'Invalid page name.');
  return dir;
}

async function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data, 'utf8');
  await fs.rename(tmp, file);
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

// Images are referenced as /pages/<name>/assets/x.png inside the editor.
// In the exported files they become relative (assets/x.png) so the folder works anywhere.
const toRelativeAssets = (text, name) => String(text ?? '').replaceAll(`/pages/${name}/assets/`, 'assets/');
const retargetAssets = (text, from, to) => text.replaceAll(`/pages/${from}/assets/`, `/pages/${to}/assets/`);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const app = express();
app.disable('x-powered-by');

if (!LOCAL_ONLY) app.set('trust proxy', true); // behind a hosting provider's proxy, so the real visitor address is known

// For hosting services that ask "is it running?" without a password.
app.get('/healthz', (req, res) => res.type('text').send('ok'));

// Password protection (only when BUILDER_PASSWORD is set). The browser shows its own sign-in box.
// Anyone who guesses wrong too many times is locked out for a while.
if (PASSWORD) {
  const digest = (text) => crypto.createHash('sha256').update(String(text)).digest();
  const failures = new Map(); // address -> { count, since }
  app.use((req, res, next) => {
    const now = Date.now();
    const record = failures.get(req.ip);
    if (record && now - record.since > 10 * 60 * 1000) failures.delete(req.ip);
    if ((failures.get(req.ip)?.count || 0) >= 10) return res.status(429).type('text').send('Too many wrong passwords. Try again in 10 minutes.');
    const [scheme, encoded] = String(req.headers.authorization || '').split(' ');
    if (/^basic$/i.test(scheme) && encoded) {
      const text = Buffer.from(encoded, 'base64').toString('utf8');
      if (crypto.timingSafeEqual(digest(text.slice(text.indexOf(':') + 1)), digest(PASSWORD))) return next();
      const entry = failures.get(req.ip) || { count: 0, since: now };
      entry.count += 1;
      failures.set(req.ip, entry);
    }
    res.set('WWW-Authenticate', 'Basic realm="Landing Builder", charset="UTF-8"').status(401).type('text').send('Password required');
  });
}

// Which pages may talk to this server. On your own computer: only the builder open at localhost (this also stops
// DNS-rebinding tricks). Online: the password is the protection, and state-changing requests must come from this same site.
const HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`]);
app.use((req, res, next) => {
  const host = String(req.headers.host || '').toLowerCase();
  if (LOCAL_ONLY && !HOSTS.has(host)) return res.status(403).json({ error: 'Unexpected host.' });
  const origin = req.headers.origin;
  if (origin && !['GET', 'HEAD'].includes(req.method)) {
    let allowed = false;
    try {
      allowed = new URL(origin).host.toLowerCase() === host;
    } catch {
      /* not a valid origin */
    }
    if (!allowed) return res.status(403).json({ error: 'Requests from other websites are not allowed.' });
  }
  next();
});

app.use(express.json({ limit: '100mb' }));

// ---------- API ----------

app.get('/api/config', (req, res) => res.json({ pagesDir: PAGES_DIR }));

app.get('/api/pages', wrap(async (req, res) => {
  await fs.mkdir(PAGES_DIR, { recursive: true });
  const entries = await fs.readdir(PAGES_DIR, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !NAME_RE.test(entry.name)) continue;
    const projectFile = path.join(PAGES_DIR, entry.name, 'project.json');
    if (!existsSync(projectFile)) continue;
    const stat = await fs.stat(projectFile);
    pages.push({ name: entry.name, updatedAt: stat.mtimeMs });
  }
  pages.sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ pages });
}));

app.get('/api/pages/:name', wrap(async (req, res) => {
  const dir = pageDir(req.params.name);
  const project = await readJson(path.join(dir, 'project.json'));
  if (!project) throw new HttpError(404, 'Page not found.');
  const meta = await readJson(path.join(dir, 'meta.json'), {});
  res.json({ project, meta });
}));

app.put('/api/pages/:name', wrap(async (req, res) => {
  const { name } = req.params;
  const dir = pageDir(name);
  const { project, html, css, meta } = req.body || {};
  if (!project || typeof html !== 'string' || typeof css !== 'string') {
    throw new HttpError(400, 'Expected { project, html, css }.');
  }
  await fs.mkdir(dir, { recursive: true });
  await writeAtomic(path.join(dir, 'project.json'), JSON.stringify(project, null, 2));
  await writeAtomic(path.join(dir, 'index.html'), toRelativeAssets(html, name));
  await writeAtomic(path.join(dir, 'style.css'), toRelativeAssets(css, name));
  if (meta) await writeAtomic(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  res.json({ ok: true, savedAt: Date.now() });
}));

app.post('/api/pages/:name/rename', wrap(async (req, res) => {
  const from = req.params.name;
  const to = req.body?.to;
  const fromDir = pageDir(from);
  const toDir = pageDir(to);
  if (!existsSync(fromDir)) throw new HttpError(404, 'Page not found.');
  if (existsSync(toDir)) throw new HttpError(409, 'A page with that name already exists.');
  await fs.rename(fromDir, toDir);
  const projectFile = path.join(toDir, 'project.json');
  await writeAtomic(projectFile, retargetAssets(await fs.readFile(projectFile, 'utf8'), from, to));
  res.json({ ok: true, name: to });
}));

app.post('/api/pages/:name/duplicate', wrap(async (req, res) => {
  const from = req.params.name;
  const to = req.body?.to;
  const fromDir = pageDir(from);
  const toDir = pageDir(to);
  if (!existsSync(fromDir)) throw new HttpError(404, 'Page not found.');
  if (existsSync(toDir)) throw new HttpError(409, 'A page with that name already exists.');
  await fs.cp(fromDir, toDir, { recursive: true });
  const projectFile = path.join(toDir, 'project.json');
  await writeAtomic(projectFile, retargetAssets(await fs.readFile(projectFile, 'utf8'), from, to));
  res.json({ ok: true, name: to });
}));

// Deleting moves the folder to pages/.trash so nothing is lost by accident.
app.delete('/api/pages/:name', wrap(async (req, res) => {
  const dir = pageDir(req.params.name);
  if (!existsSync(dir)) throw new HttpError(404, 'Page not found.');
  await fs.mkdir(TRASH_DIR, { recursive: true });
  await fs.rename(dir, path.join(TRASH_DIR, `${req.params.name}-${Date.now()}`));
  res.json({ ok: true });
}));

const assetUrl = (name, file) => `/pages/${name}/assets/${file}`;

app.get('/api/pages/:name/assets', wrap(async (req, res) => {
  const dir = path.join(pageDir(req.params.name), 'assets');
  const kinds = { image: IMAGE_EXT, video: VIDEO_EXT, all: ASSET_EXT };
  const allowed = kinds[req.query.kind] || IMAGE_EXT;
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => allowed.has(path.extname(f).toLowerCase()));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  res.json({ data: files.map((f) => assetUrl(req.params.name, f)) });
}));

const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 300 },
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const dir = path.join(pageDir(req.params.name), 'assets');
        fs.mkdir(dir, { recursive: true }).then(() => cb(null, dir), cb);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ASSET_EXT.has(ext)) return cb(new HttpError(400, `Unsupported file type: ${ext || 'unknown'}. Allowed: images, mp4/webm/ogv/mov/m4v video, woff/woff2/ttf/otf fonts.`));
      const base = path.basename(file.originalname, ext).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
      const dir = path.join(pageDir(req.params.name), 'assets');
      let candidate = `${base}${ext}`;
      for (let i = 1; existsSync(path.join(dir, candidate)); i++) candidate = `${base}-${i}${ext}`;
      cb(null, candidate);
    },
  }),
});

app.post('/api/pages/:name/assets', upload.array('files', 300), (req, res) => {
  res.json({ data: (req.files || []).map((f) => assetUrl(req.params.name, f.filename)) });
});

mountExport(app, { PAGES_DIR, pageDir, wrap, HttpError });
mountAi(app, { DATA_DIR, wrap, HttpError });

// ---------- Saved pages (preview + assets) ----------

await fs.mkdir(PAGES_DIR, { recursive: true });
app.use('/pages', (req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  // An SVG opened directly must not be able to run scripts on this origin.
  if (req.path.toLowerCase().endsWith('.svg')) res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  next();
}, express.static(PAGES_DIR, { dotfiles: 'ignore' }));

// ---------- Editor UI ----------

if (PROD) {
  const dist = path.join(__dirname, 'dist');
  if (!existsSync(dist)) {
    console.error('No dist/ folder found. Run "npm run build" first (or use "npm start").');
    process.exit(1);
  }
  app.use(express.static(dist));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: __dirname, appType: 'spa', server: { middlewareMode: true } });
  app.use(vite.middlewares);
}

// ---------- Errors ----------

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong.' });
});

app.listen(PORT, HOST, () => {
  console.log(`\n  Landing Builder running at  ${LOCAL_ONLY ? `http://localhost:${PORT}` : `port ${PORT} (password protected)`}`);
  console.log(`  Pages are saved in          ${PAGES_DIR}\n`);
});
