// Video and embeds.
//
// - A "Video source" box in Design panel > Settings accepts any of: a link to a video file on the internet,
//   YouTube, Vimeo, Google Drive and Dropbox links, a video uploaded from this computer, or one you uploaded earlier.
// - Google Drive videos can only be shown through Google's own player, so they become an "embed" (an iframe).
// - Pasting a full YouTube or Vimeo link into the Video ID or Source boxes of the standard video settings also works.

import { hasClass } from './freeform.js';
import * as api from './api.js';

const YOUTUBE = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO = /vimeo\.com\/(?:video\/|[\w-]+\/)?(\d{6,})/;
const DRIVE_FILE = /(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?(?:.*&)?id=|uc\?(?:.*&)?id=)([\w-]{10,})/;
const LOCAL = /^(?:[a-zA-Z]:[\\/]|\\\\|file:|~[\\/]|\/(?:Users|home|mnt|Volumes)\/)/;
const VIDEO_FILE = /\.(mp4|webm|ogv|mov|m4v)(?:$|[?#])/i;

export function classify(raw) {
  const text = String(raw || '').trim();
  if (!text) return { kind: 'empty' };
  if (LOCAL.test(text)) return { kind: 'local' };
  const yt = YOUTUBE.exec(text);
  if (yt) return { kind: 'yt', id: yt[1] };
  const vi = VIMEO.exec(text);
  if (vi) return { kind: 'vi', id: vi[1] };
  const drive = DRIVE_FILE.exec(text);
  if (drive) return { kind: 'drive', id: drive[1] };
  if (/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\//.test(text)) return { kind: 'drive-folder' };
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (/(^|\.)dropbox\.com$/i.test(url.hostname)) {
        url.searchParams.delete('dl');
        url.searchParams.set('raw', '1');
        return { kind: 'direct', url: url.toString(), note: 'Dropbox link converted to a direct link.' };
      }
      return { kind: 'direct', url: text, file: VIDEO_FILE.test(text) };
    } catch {
      return { kind: 'invalid' };
    }
  }
  if (/^(?:\.{0,2}\/)?[\w@%+.\-/]+\.(?:mp4|webm|ogv|mov|m4v)$/i.test(text)) return { kind: 'direct', url: text, file: true };
  return { kind: 'invalid' };
}

export function initMedia(editor, { container, getPage, say }) {
  // ---------- a general embed element (iframe), used for Google Drive videos and imported iframes ----------

  editor.Components.addType('lp-iframe', {
    isComponent: (el) => el.tagName === 'IFRAME' && { type: 'lp-iframe' },
    model: {
      defaults: {
        tagName: 'iframe',
        droppable: false,
        traits: [{ type: 'text', name: 'src', label: 'Address', placeholder: 'https://…' }],
        attributes: { frameborder: '0', allowfullscreen: 'allowfullscreen', allow: 'autoplay; fullscreen; picture-in-picture' },
      },
    },
    view: {
      // In the editor the iframe sits inside a wrapper, so clicks select it instead of going into the embedded page.
      tagName: 'div',
      init() {
        this.listenTo(this.model, 'change:attributes', this.render);
      },
      onRender({ el, model }) {
        const frame = document.createElement('iframe');
        frame.src = model.getAttributes().src || 'about:blank';
        frame.style.cssText = 'width:100%;height:100%;border:0;pointer-events:none;display:block';
        el.replaceChildren(frame);
      },
    },
  });

  // ---------- forgiving standard settings: paste a full link into Video ID or Source ----------

  const fix = (component, key) => {
    if (component.get('type') !== 'video') return;
    const found = classify(component.get(key));
    if (found.kind !== 'yt' && found.kind !== 'vi') return;
    component.set({ provider: found.kind, videoId: found.id });
    component.updateSrc?.(); // rebuild the address that gets exported
  };
  editor.on('component:update:videoId', (c) => fix(c, 'videoId'));
  editor.on('component:update:src', (c) => fix(c, 'src'));

  // ---------- the Video source box ----------

  let comp = null;
  const isVideoLike = (c) => !!c && (c.get('type') === 'video' || c.get('type') === 'lp-iframe');

  function swap(old, definition) {
    const parent = old.parent();
    const at = parent.components().indexOf(old);
    const style = { ...old.getStyle() };
    const created = parent.components().add(definition, { at });
    const added = Array.isArray(created) ? created[0] : created;
    added.addStyle(style);
    old.remove();
    editor.select(added);
    return added;
  }

  const classes = (c) => (hasClass(c, 'lp-free') ? ['lp-free', 'lp-embed'] : ['lp-embed']);
  // Changing the provider makes GrapesJS clear the source, so the provider is set first and the rest afterwards.
  function asVideo(c, props) {
    const { provider, ...rest } = props;
    if (c.get('type') === 'video') {
      if (provider && c.get('provider') !== provider) c.set({ provider });
      c.set(rest);
      return c;
    }
    const added = swap(c, { type: 'video', classes: classes(c), provider });
    added.set(rest);
    return added;
  }
  const asEmbed = (c, src) =>
    c.get('type') === 'lp-iframe'
      ? (c.addAttributes({ src }), c)
      : swap(c, { type: 'lp-iframe', tagName: 'iframe', classes: classes(c), attributes: { src } });

  function apply(text) {
    const found = classify(text);
    switch (found.kind) {
      case 'empty':
        return { error: 'Paste a link first.' };
      case 'local':
        return {
          error:
            'That is a file on your computer, and a web page cannot open files by their location. Use “Upload a video from this computer” instead. It copies the video into this page’s folder so it plays here and on the finished page.',
        };
      case 'drive-folder':
        return { error: 'That is a Google Drive folder. Open the video itself, choose Share, and paste that file’s link.' };
      case 'invalid':
        return { error: 'That does not look like a web address. It should start with https://' };
      case 'yt':
      case 'vi': {
        const target = asVideo(comp, { provider: found.kind });
        target.set('videoId', found.id);
        target.updateSrc?.();
        comp = target;
        return { ok: found.kind === 'yt' ? 'Playing from YouTube.' : 'Playing from Vimeo.' };
      }
      case 'drive':
        comp = asEmbed(comp, `https://drive.google.com/file/d/${found.id}/preview`);
        return { ok: 'Playing through Google Drive’s player. In Drive, set the video’s sharing to “Anyone with the link”, or visitors will see a sign-in screen.' };
      default: {
        comp = asVideo(comp, { provider: 'so', src: found.url, controls: true });
        const note = found.file === false ? ' If it does not play, the link may be a web page rather than a video file.' : '';
        return { ok: `${found.note || 'Playing from that link.'}${note}` };
      }
    }
  }

  const el = (tag, props = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    node.append(...kids.flat().filter(Boolean));
    return node;
  };

  function currentLabel() {
    if (comp.get('type') === 'lp-iframe') return `Embedded page: ${comp.getAttributes().src || 'nothing yet'}`;
    const provider = comp.get('provider');
    if (provider === 'yt' || provider === 'ytnc') return `YouTube video ${comp.get('videoId') || ''}`;
    if (provider === 'vi') return `Vimeo video ${comp.get('videoId') || ''}`;
    const src = comp.get('src');
    return src ? `Video file: ${src.split('/').pop()}` : 'No video chosen yet';
  }

  function render(initial) {
    container.replaceChildren();
    if (!isVideoLike(comp)) return;
    const message = el('p', { class: 'md-msg', role: 'status' });
    const show = (r) => {
      message.className = `md-msg ${r.error ? 'bad' : 'good'}`;
      message.textContent = r.error || r.ok;
    };
    const input = el('input', { type: 'text', placeholder: 'https://… (video file, YouTube, Vimeo, Google Drive, Dropbox)', 'aria-label': 'Video link' });
    const go = () => {
      const result = apply(input.value);
      if (result.ok) render(result);
      else show(result);
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && go());

    const bar = el('div', { class: 'md-bar', hidden: true }, el('i'));
    const file = el('input', { type: 'file', accept: 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v,.mp4,.webm,.ogv,.mov,.m4v', hidden: true });
    file.addEventListener('change', async () => {
      const chosen = file.files[0];
      file.value = '';
      if (!chosen) return;
      const page = getPage();
      if (!page) return show({ error: 'Open or create a page first.' });
      bar.hidden = false;
      bar.firstChild.style.width = '0%';
      show({ ok: `Uploading ${chosen.name}…` });
      try {
        const [url] = await api.uploadAssets(page, [chosen], (fraction) => (bar.firstChild.style.width = `${Math.round(fraction * 100)}%`));
        const big = chosen.size > 100 * 1024 * 1024 ? ' It is a large file, so the page may load slowly. A video hosting service would be better for long videos.' : '';
        const odd = /\.(mov|m4v)$/i.test(chosen.name) ? ' MOV and M4V files do not play in every browser. MP4 (H.264) or WebM is safest.' : '';
        comp = asVideo(comp, { provider: 'so', src: url, controls: true });
        render({ ok: `Uploaded. Playing ${chosen.name} from this page’s folder.${big}${odd}` });
      } catch (err) {
        show({ error: err.message });
      } finally {
        bar.hidden = true;
      }
    });

    const existing = el('select', { 'aria-label': 'Videos already uploaded to this page' }, el('option', { value: '', text: 'Choose an uploaded video…' }));
    existing.addEventListener('change', () => {
      if (!existing.value) return;
      comp = asVideo(comp, { provider: 'so', src: existing.value, controls: true });
      render({ ok: 'Playing the video you chose.' });
    });
    const page = getPage();
    if (page) {
      api.listAssets(page, 'video').then((urls) => {
        for (const url of urls) existing.append(el('option', { value: url, text: url.split('/').pop() }));
        existing.closest('label').hidden = urls.length === 0;
      }).catch(() => {});
    }

    container.append(
      el('div', { class: 'md-box' },
        el('h4', { text: 'Video source' }),
        el('p', { class: 'md-current', text: currentLabel() }),
        el('label', {}, el('span', { text: 'Paste a link' }), el('div', { class: 'md-row' }, input, el('button', { type: 'button', text: 'Use', onclick: go }))),
        el('div', { class: 'md-or', text: 'or' }),
        el('button', { type: 'button', class: 'md-upload', text: 'Upload a video from this computer', onclick: () => file.click() }),
        file,
        bar,
        el('label', { hidden: true }, el('span', { text: 'Videos already in this page' }), existing),
        message,
      ),
    );
    if (initial) show(initial);
  }

  editor.on('component:toggled', () => {
    const selected = editor.getSelected();
    comp = selected && editor.getSelectedAll().length === 1 ? selected : null;
    render();
  });
  render();
  return { apply, classify };
}
