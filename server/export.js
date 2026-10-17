// Downloads: a page as a zip (website files plus the data needed to edit it again), a page as one
// self-contained .html file, and every page in one zip.

import { ZipArchive } from 'archiver';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
};
const VIDEO = new Set(['.mp4', '.webm', '.ogv', '.mov', '.m4v']);
const MAX_EMBED = 8 * 1024 * 1024; // files bigger than this stay as separate files in the single-file export

const esc = (s) => String(s).replace(/"/g, '');

export function mountExport(app, { PAGES_DIR, pageDir, wrap, HttpError }) {
  const send = (res, name, type) => {
    res.set('Content-Type', type);
    res.set('Content-Disposition', `attachment; filename="${esc(name)}"`);
  };

  async function zipTo(res, filename, build) {
    send(res, filename, 'application/zip');
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('error', () => res.destroy());
    archive.pipe(res);
    build(archive);
    await archive.finalize();
  }

  app.get('/api/pages/:name/export.zip', wrap(async (req, res) => {
    const dir = pageDir(req.params.name);
    if (!existsSync(path.join(dir, 'index.html'))) throw new HttpError(404, 'Save the page first.');
    await zipTo(res, `${req.params.name}.zip`, (zip) => zip.directory(dir, false));
  }));

  app.get('/api/pages/:name/export-info', wrap(async (req, res) => {
    const dir = pageDir(req.params.name);
    const videos = [];
    try {
      for (const file of await fs.readdir(path.join(dir, 'assets'))) {
        if (VIDEO.has(path.extname(file).toLowerCase())) videos.push(file);
      }
    } catch {
      /* no assets folder */
    }
    res.json({ videos });
  }));

  app.get('/api/pages/:name/export.html', wrap(async (req, res) => {
    const dir = pageDir(req.params.name);
    if (!existsSync(path.join(dir, 'index.html'))) throw new HttpError(404, 'Save the page first.');
    let html = await fs.readFile(path.join(dir, 'index.html'), 'utf8');
    let css = await fs.readFile(path.join(dir, 'style.css'), 'utf8').catch(() => '');

    // Small images and fonts are embedded; anything else keeps its relative address.
    const cache = new Map();
    const embed = async (text) => {
      const refs = [...new Set([...text.matchAll(/assets\/([^"')\s?#<>]+)/g)].map((m) => m[1]))];
      for (const file of refs) {
        const ext = path.extname(file).toLowerCase();
        if (!MIME[ext]) continue;
        if (!cache.has(file)) {
          const full = path.join(dir, 'assets', path.basename(decodeURIComponent(file)));
          const stat = await fs.stat(full).catch(() => null);
          cache.set(file, stat && stat.size <= MAX_EMBED ? `data:${MIME[ext]};base64,${(await fs.readFile(full)).toString('base64')}` : null);
        }
        const uri = cache.get(file);
        if (uri) text = text.split(`assets/${file}`).join(uri);
      }
      return text;
    };
    css = await embed(css);
    html = await embed(html);
    html = html.replace(/<link rel="stylesheet" href="style\.css">/, () => `<style>\n${css}\n</style>`);
    send(res, `${req.params.name}.html`, 'text/html; charset=utf-8');
    res.send(html);
  }));

  app.get('/api/export-all.zip', wrap(async (req, res) => {
    const entries = await fs.readdir(PAGES_DIR, { withFileTypes: true });
    const names = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.') && existsSync(path.join(PAGES_DIR, e.name, 'index.html'))).map((e) => e.name);
    if (!names.length) throw new HttpError(404, 'There are no pages to export yet.');
    const index = `<!doctype html><meta charset="utf-8"><title>Pages</title><body style="font:17px system-ui;max-width:640px;margin:48px auto;line-height:1.8"><h1>Pages</h1><ul>${names
      .map((n) => `<li><a href="${n}/index.html">${n}</a></li>`)
      .join('')}</ul>`;
    await zipTo(res, 'all-pages.zip', (zip) => {
      zip.append(index, { name: 'index.html' });
      for (const n of names) zip.directory(path.join(PAGES_DIR, n), n);
    });
  }));
}
