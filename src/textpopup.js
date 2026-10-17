// Floating "Edit text" window. Opens whenever a text element is selected and holds every
// text setting in one place: font, size, color, bold/italic/underline/strikethrough,
// alignment, spacing, case, position and layering.

import { FONT_FAMILIES } from './config.js';
import { isFree, isTextLike } from './freeform.js';

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

function toHex(color) {
  const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(color || '');
  if (!m) return '#000000';
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

const svg = (body) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
  left: svg('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
  center: svg('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
  right: svg('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
  justify: svg('<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  front: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'),
  back: svg('<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 8v10a2 2 0 0 1-2 2H8"/>'),
  faq: svg('<path d="M9 9a3 3 0 1 1 4 2.8c-.7.4-1 1-1 1.7"/><path d="M12 17h.01"/>'),
};

export function initTextPopup(editor, { openDock, onManageFaq }) {
  const root = document.getElementById('text-popup');
  root.innerHTML = `
    <div class="tp-head" data-grip>
      <span class="tp-title">Edit text</span>
      <button type="button" class="tp-x" data-act="close" title="Close" aria-label="Close">&times;</button>
    </div>
    <div class="tp-body">
      <label class="tp-label" for="tp-font">Font</label>
      <select id="tp-font" class="tp-select"></select>

      <div class="tp-row">
        <div class="tp-stepper" title="Font size">
          <button type="button" data-act="size-dec" aria-label="Smaller">&minus;</button>
          <input id="tp-size" type="number" min="6" max="400" aria-label="Font size in pixels">
          <button type="button" data-act="size-inc" aria-label="Larger">+</button>
        </div>
        <label class="tp-color" title="Text color"><input id="tp-color" type="color" aria-label="Text color"><span></span></label>
        <span class="tp-sep"></span>
        <button type="button" class="tp-btn" data-cmd="bold" title="Bold"><b>B</b></button>
        <button type="button" class="tp-btn" data-cmd="italic" title="Italic"><i>I</i></button>
        <button type="button" class="tp-btn" data-cmd="underline" title="Underline"><u>U</u></button>
        <button type="button" class="tp-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
      </div>

      <div class="tp-row">
        <button type="button" class="tp-btn" data-align="left" title="Align left">${ICONS.left}</button>
        <button type="button" class="tp-btn" data-align="center" title="Align center">${ICONS.center}</button>
        <button type="button" class="tp-btn" data-align="right" title="Align right">${ICONS.right}</button>
        <button type="button" class="tp-btn" data-align="justify" title="Justify">${ICONS.justify}</button>
        <span class="tp-sep"></span>
        <button type="button" class="tp-btn" data-act="link" title="Add a link to the selected words">${ICONS.link}</button>
      </div>

      <div class="tp-grid">
        <label>Line height<input id="tp-lh" type="number" step="0.1" min="0.5" max="4"></label>
        <label>Letter spacing<input id="tp-ls" type="number" step="0.5" min="-10" max="40"></label>
        <label>Capitals
          <select id="tp-case">
            <option value="none">Normal</option>
            <option value="uppercase">UPPERCASE</option>
            <option value="lowercase">lowercase</option>
            <option value="capitalize">Capitalize</option>
          </select>
        </label>
      </div>

      <div class="tp-section" data-free-only>
        <span class="tp-label">Position</span>
        <div class="tp-grid tp-pos">
          <label>X<input id="tp-x" type="number"></label>
          <label>Y<input id="tp-y" type="number"></label>
          <label>Width<input id="tp-w" type="number" min="20"></label>
        </div>
        <div class="tp-row">
          <button type="button" class="tp-wide" data-act="front">${ICONS.front} Bring forward</button>
          <button type="button" class="tp-wide" data-act="back">${ICONS.back} Send back</button>
        </div>
      </div>

      <div class="tp-foot">
        <button type="button" class="tp-wide" data-act="faq" hidden>${ICONS.faq} Edit questions and answers</button>
        <div class="tp-row">
          <button type="button" class="tp-wide" data-act="animate">&#9889; Animate</button>
          <button type="button" class="tp-wide" data-act="more">More design options</button>
        </div>
      </div>
      <p class="tp-hint" role="status"></p>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const fontSel = $('#tp-font');
  const sizeIn = $('#tp-size');
  const colorIn = $('#tp-color');
  const lhIn = $('#tp-lh');
  const lsIn = $('#tp-ls');
  const caseSel = $('#tp-case');
  const xIn = $('#tp-x');
  const yIn = $('#tp-y');
  const wIn = $('#tp-w');
  const hint = $('.tp-hint');

  fontSel.replaceChildren(
    ...FONT_FAMILIES.map(([label, value]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.style.fontFamily = value;
      return option;
    }),
  );

  let comp = null;
  let moved = false; // the person dragged the window somewhere: stop auto-placing it
  let hintTimer = null;

  const frame = () => editor.Canvas.getFrameEl();
  const win = () => editor.Canvas.getWindow();
  const doc = () => frame().contentDocument;
  const style = () => {
    const el = comp?.getEl();
    return el ? win().getComputedStyle(el) : null;
  };

  const say = (text) => {
    hint.textContent = text;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => (hint.textContent = ''), 3500);
  };

  // ---------- text selection helpers ----------

  // Pressing a button in this window moves focus out of the page and clears the text selection there,
  // so the selection is remembered and put back before a formatting command runs.
  let lastRange = null; // last selected words inside the text being edited
  let heldRange = null; // the selection at the moment a button in this window was pressed

  function liveRange() {
    const el = comp?.getEl();
    const selection = win().getSelection();
    if (!el || !selection || !selection.rangeCount) return null;
    if (el.getAttribute('contenteditable') !== 'true') return null;
    const range = selection.getRangeAt(0);
    return el.contains(range.commonAncestorContainer) ? range : null;
  }

  function selectionRange() {
    const live = liveRange();
    if (live && !live.collapsed) return live;
    const el = comp?.getEl();
    const remembered = heldRange || lastRange;
    if (remembered && !remembered.collapsed && el?.contains(remembered.commonAncestorContainer)) return remembered;
    return null;
  }

  function restore(range) {
    comp?.getEl()?.focus();
    const selection = win().getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function trackSelection() {
    const live = liveRange();
    if (!live) return;
    if (live.collapsed) lastRange = null;
    else lastRange = live.cloneRange();
  }

  const exec = (command, value) => {
    const range = selectionRange();
    if (range) restore(range);
    doc().execCommand('styleWithCSS', false, true);
    doc().execCommand(command, false, value);
    const after = liveRange();
    if (after && !after.collapsed) lastRange = after.cloneRange();
  };

  // ---------- reading values into the controls ----------

  function refresh() {
    const cs = style();
    if (!cs || !comp) return;
    const size = parseFloat(cs.fontSize) || 16;

    const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
    const match = FONT_FAMILIES.find(([label]) => label.toLowerCase() === family);
    if (!match && family) {
      let custom = fontSel.querySelector('[data-custom]');
      if (!custom) {
        custom = document.createElement('option');
        custom.dataset.custom = '1';
        fontSel.prepend(custom);
      }
      custom.value = cs.fontFamily;
      custom.textContent = cs.fontFamily.split(',')[0].replace(/["']/g, '');
      fontSel.value = custom.value;
    } else {
      fontSel.value = match ? match[1] : fontSel.value;
    }

    sizeIn.value = Math.round(size * 10) / 10;
    colorIn.value = toHex(cs.color);
    colorIn.nextElementSibling.style.background = colorIn.value;
    lhIn.value = cs.lineHeight === 'normal' ? 1.2 : round(parseFloat(cs.lineHeight) / size);
    lsIn.value = cs.letterSpacing === 'normal' ? 0 : round(parseFloat(cs.letterSpacing));
    caseSel.value = cs.textTransform || 'none';

    const inSelection = !!liveRange() && !liveRange().collapsed;
    const active = {
      bold: inSelection ? doc().queryCommandState('bold') : parseInt(cs.fontWeight, 10) >= 600,
      italic: inSelection ? doc().queryCommandState('italic') : cs.fontStyle === 'italic',
      underline: inSelection ? doc().queryCommandState('underline') : cs.textDecorationLine.includes('underline'),
      strikeThrough: inSelection ? doc().queryCommandState('strikeThrough') : cs.textDecorationLine.includes('line-through'),
    };
    root.querySelectorAll('[data-cmd]').forEach((b) => b.classList.toggle('on', !!active[b.dataset.cmd]));

    const align = cs.textAlign === 'start' ? 'left' : cs.textAlign === 'end' ? 'right' : cs.textAlign;
    root.querySelectorAll('[data-align]').forEach((b) => b.classList.toggle('on', b.dataset.align === align));

    const free = isFree(comp) && cs.position === 'absolute';
    $('[data-free-only]').hidden = !free;
    if (free) {
      const el = comp.getEl();
      xIn.value = Math.round(el.offsetLeft);
      yIn.value = Math.round(el.offsetTop);
      wIn.value = Math.round(el.offsetWidth);
    }
    $('[data-act="faq"]').hidden = !comp.getEl()?.closest('.lp-faq-list');
  }

  // ---------- placing the window ----------

  function position() {
    if (!comp || root.hidden || moved) return;
    const el = comp.getEl();
    if (!el) return;
    const fr = frame().getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pw = root.offsetWidth;
    const ph = root.offsetHeight;
    const gap = 14;
    const minTop = fr.top + 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const box = { left: fr.left + r.left, right: fr.left + r.right, top: fr.top + r.top, bottom: fr.top + r.bottom };
    const centered = clamp((box.left + box.right) / 2 - pw / 2, fr.left + 8, vw - pw - 8);
    const sideTop = clamp(box.top, minTop, Math.max(minTop, vh - ph - 8));
    let left;
    let top;
    if (box.top - ph - gap >= minTop) {
      left = centered;
      top = box.top - ph - gap; // above the text
    } else if (box.bottom + gap + ph <= vh - 8) {
      left = centered;
      top = box.bottom + gap; // below the text
    } else if (box.right + gap + pw <= vw - 8) {
      left = box.right + gap; // to the right
      top = sideTop;
    } else if (box.left - gap - pw >= fr.left + 8) {
      left = box.left - gap - pw; // to the left
      top = sideTop;
    } else {
      left = centered;
      top = Math.max(minTop, vh - ph - 8);
    }
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
  }

  let raf = 0;
  const reposition = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      position();
    });
  };

  function sync() {
    const selected = editor.getSelected();
    if (isTextLike(selected) && selected.getEl()) {
      if (comp !== selected) {
        moved = false;
        lastRange = null;
      }
      comp = selected;
      root.hidden = false;
      refresh();
      reposition();
    } else {
      comp = null;
      root.hidden = true;
    }
  }

  editor.on('component:toggled', () => setTimeout(sync, 0));
  editor.on('rte:enable', () => setTimeout(sync, 0));
  editor.on('update', () => {
    if (!comp) return;
    refresh();
    reposition();
  });
  editor.on('load', () => {
    frame().contentWindow.addEventListener('scroll', reposition, true);
    doc().addEventListener('selectionchange', () => {
      if (!comp) return;
      trackSelection();
      refresh();
    });
  });
  window.addEventListener('resize', reposition);

  // ---------- dragging the window itself ----------

  $('[data-grip]').addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    const startX = event.clientX - root.offsetLeft;
    const startY = event.clientY - root.offsetTop;
    const grip = event.currentTarget;
    grip.setPointerCapture(event.pointerId);
    const move = (e) => {
      moved = true;
      root.style.left = `${clamp(e.clientX - startX, 0, window.innerWidth - root.offsetWidth)}px`;
      root.style.top = `${clamp(e.clientY - startY, 0, window.innerHeight - 60)}px`;
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
  });

  // ---------- applying changes ----------

  const apply = (props) => {
    if (!comp) return;
    comp.addStyle(props);
    refresh();
    reposition();
  };

  // GrapesJS ends text editing on any mouse press in the page. Presses inside this window must not reach it.
  root.addEventListener('mousedown', (event) => event.stopPropagation());

  // Hold on to the selected words when something in this window is pressed.
  root.addEventListener(
    'mousedown',
    (event) => {
      const range = selectionRange();
      heldRange = range ? range.cloneRange() : null;
      setTimeout(() => (heldRange = null), 600);
      if (event.target.closest('button') && !event.target.closest('input, select')) event.preventDefault();
    },
    true,
  );

  fontSel.addEventListener('change', () => apply({ 'font-family': fontSel.value }));
  sizeIn.addEventListener('change', () => apply({ 'font-size': `${clamp(parseFloat(sizeIn.value) || 16, 6, 400)}px` }));
  lhIn.addEventListener('change', () => apply({ 'line-height': String(clamp(parseFloat(lhIn.value) || 1.2, 0.5, 4)) }));
  lsIn.addEventListener('change', () => apply({ 'letter-spacing': `${parseFloat(lsIn.value) || 0}px` }));
  caseSel.addEventListener('change', () => apply({ 'text-transform': caseSel.value }));

  colorIn.addEventListener('input', () => {
    colorIn.nextElementSibling.style.background = colorIn.value;
    if (selectionRange()) exec('foreColor', colorIn.value);
    else apply({ color: colorIn.value });
  });

  const placeFromInputs = () => {
    if (!comp) return;
    apply({
      left: `${parseFloat(xIn.value) || 0}px`,
      top: `${parseFloat(yIn.value) || 0}px`,
      width: `${Math.max(20, parseFloat(wIn.value) || 20)}px`,
    });
  };
  [xIn, yIn, wIn].forEach((input) => input.addEventListener('change', placeFromInputs));

  function layer(direction) {
    const siblings = comp.parent()?.components().models || [];
    const zs = siblings.map((c) => parseInt(win().getComputedStyle(c.getEl()).zIndex, 10) || 0);
    const next = direction === 'front' ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1;
    apply({ 'z-index': String(next) });
  }

  root.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target || !comp) return;

    if (target.dataset.cmd) {
      const cmd = target.dataset.cmd;
      if (selectionRange()) {
        exec(cmd);
        refresh();
        return;
      }
      const cs = style();
      if (cmd === 'bold') apply({ 'font-weight': parseInt(cs.fontWeight, 10) >= 600 ? '400' : '700' });
      if (cmd === 'italic') apply({ 'font-style': cs.fontStyle === 'italic' ? 'normal' : 'italic' });
      if (cmd === 'underline' || cmd === 'strikeThrough') {
        const line = cmd === 'underline' ? 'underline' : 'line-through';
        const lines = new Set(cs.textDecorationLine.split(' ').filter((l) => l && l !== 'none'));
        lines.has(line) ? lines.delete(line) : lines.add(line);
        apply({ 'text-decoration': lines.size ? [...lines].join(' ') : 'none' });
      }
      return;
    }

    if (target.dataset.align) return apply({ 'text-align': target.dataset.align });

    switch (target.dataset.act) {
      case 'close':
        editor.select();
        break;
      case 'size-dec':
      case 'size-inc': {
        const step = target.dataset.act === 'size-inc' ? 1 : -1;
        apply({ 'font-size': `${clamp((parseFloat(sizeIn.value) || 16) + step, 6, 400)}px` });
        break;
      }
      case 'link': {
        const range = selectionRange()?.cloneRange();
        if (comp.get('type') === 'link' && !range) {
          const url = window.prompt('Link address', comp.getAttributes().href || 'https://');
          if (url) comp.addAttributes({ href: url });
        } else if (range) {
          const url = window.prompt('Link address', 'https://');
          if (url) {
            heldRange = range;
            exec('createLink', url);
          }
        } else {
          say('Double-click the text and select some words first.');
        }
        break;
      }
      case 'front':
      case 'back':
        layer(target.dataset.act);
        break;
      case 'faq': {
        const list = comp.getEl()?.closest('.lp-faq-list')?.__gjsv?.model;
        if (list) onManageFaq(list);
        break;
      }
      case 'more':
        openDock('design');
        break;
      case 'animate':
        openDock('animate');
        break;
      default:
    }
  });

  // Escape closes the window.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !root.hidden && root.contains(document.activeElement)) editor.select();
  });
}
