// Makes elements inside strips behave like a freeform canvas:
// drag to move (with snapping guides), handles to resize, arrow keys to nudge.

const ALL = { tl: 1, tc: 1, tr: 1, cl: 1, cr: 1, bl: 1, bc: 1, br: 1 };
const WIDTH_ONLY = { tl: 0, tc: 0, tr: 0, cl: 1, cr: 1, bl: 0, bc: 0, br: 0 };
const HEIGHT_ONLY = { tl: 0, tc: 0, tr: 0, cl: 0, cr: 0, bl: 0, bc: 1, br: 0 };

const SNAP = 6; // px: how close an edge must be to snap to a guide

export const hasClass = (component, name) => {
  try {
    return component.getClasses().includes(name);
  } catch {
    return false;
  }
};
export const isFree = (component) => !!component && hasClass(component, 'lp-free');

const TEXT_TYPES = ['text', 'link', 'label', 'button'];
export const isTextLike = (component) =>
  !!component && TEXT_TYPES.includes(component.get('type')) && component.get('tagName') !== 'input';

function resizeFor(component) {
  const tag = component.get('tagName');
  if (isTextLike(component) || hasClass(component, 'lp-card') || hasClass(component, 'lp-faq-list') || tag === 'form') {
    return WIDTH_ONLY;
  }
  if (['input', 'select', 'button'].includes(tag)) return WIDTH_ONLY;
  return ALL;
}

const FREE_TOOLBAR = [
  { attributes: { class: 'fa fa-arrow-up', title: 'Select parent' }, command: (ed) => ed.runCommand('core:component-exit', { force: 1 }) },
  { attributes: { class: 'fa fa-clone', title: 'Duplicate' }, command: 'tlb-clone' },
  { attributes: { class: 'fa fa-trash-o', title: 'Delete' }, command: 'tlb-delete' },
];

function prepare(component) {
  if (isFree(component)) {
    component.set({ dmode: 'absolute', resizable: resizeFor(component), toolbar: FREE_TOOLBAR }, { silent: true });
  } else if (hasClass(component, 'lp-strip')) {
    component.set({ resizable: HEIGHT_ONLY, droppable: false }, { silent: true });
  } else if (hasClass(component, 'lp-stage')) {
    component.set({ draggable: false, removable: false, copyable: false, resizable: false }, { silent: true });
  }
}

const frameDoc = (editor) => editor.Canvas.getFrameEl()?.contentDocument;
const isEditingText = (el) => !!el?.closest?.('[contenteditable="true"]');

// Finds the position that lines an edge up with another element or the stage.
function snapAxis(start, size, targets) {
  let best = null;
  for (const anchor of [0, size / 2, size]) {
    for (const target of targets) {
      const delta = target - (start + anchor);
      if (Math.abs(delta) <= SNAP && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line: target };
    }
  }
  return best;
}

export function initFreeform(editor) {
  editor.on('component:add', prepare);
  editor.on('load', () => editor.getWrapper().find('.lp-free, .lp-strip, .lp-stage').forEach(prepare));

  function startMove(event, model, el) {
    const doc = frameDoc(editor);
    const parent = el.offsetParent;
    if (!parent) return;
    const startX = event.screenX;
    const startY = event.screenY;
    const startLeft = el.offsetLeft;
    const startTop = el.offsetTop;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    const siblings = [...parent.children].filter((c) => c !== el && c.classList.contains('lp-free'));
    const xs = [0, pw / 2, pw, ...siblings.flatMap((c) => [c.offsetLeft, c.offsetLeft + c.offsetWidth / 2, c.offsetLeft + c.offsetWidth])];
    const ys = [0, ph / 2, ph, ...siblings.flatMap((c) => [c.offsetTop, c.offsetTop + c.offsetHeight / 2, c.offsetTop + c.offsetHeight])];

    const guideX = doc.createElement('div');
    const guideY = doc.createElement('div');
    for (const g of [guideX, guideY]) {
      g.style.cssText = 'position:absolute;background:#ff4fa3;pointer-events:none;z-index:99999;display:none';
      parent.append(g);
    }

    // While dragging, nothing else should react to the pointer: the editor's hover outline and selection
    // toolbar are hidden and hover events are not passed on. That is what keeps the drag smooth.
    const tools = editor.Canvas.getToolsEl?.();
    const toolsVisibility = tools?.style.visibility;
    let frozen = false;
    const freeze = () => {
      if (frozen) return;
      frozen = true;
      if (tools) tools.style.visibility = 'hidden';
      el.style.willChange = 'translate';
    };
    const stopHover = (e) => e.stopPropagation();
    for (const type of ['mouseover', 'mouseout']) doc.addEventListener(type, stopHover, true);

    let moved = false;
    let pointerX = startX;
    let pointerY = startY;
    let left = startLeft;
    let top = startTop;
    let altKey = false;
    let queued = 0;
    const shown = { x: null, y: null };

    // One update per screen refresh, however many mouse events arrive.
    const paint = () => {
      queued = 0;
      left = startLeft + (pointerX - startX);
      top = startTop + (pointerY - startY);
      const sx = altKey ? null : snapAxis(left, w, xs);
      const sy = altKey ? null : snapAxis(top, h, ys);
      if (sx) left += sx.delta;
      if (sy) top += sy.delta;
      left = Math.min(Math.max(left, -w + 24), pw - 24);
      top = Math.min(Math.max(top, -h + 24), ph - 24);
      el.style.translate = `${Math.round(left - startLeft)}px ${Math.round(top - startTop)}px`;
      const gx = sx ? sx.line : null;
      const gy = sy ? sy.line : null;
      if (gx !== shown.x) {
        shown.x = gx;
        Object.assign(guideX.style, gx == null ? { display: 'none' } : { display: 'block', left: `${gx}px`, top: '0', width: '1px', height: `${ph}px` });
      }
      if (gy !== shown.y) {
        shown.y = gy;
        Object.assign(guideY.style, gy == null ? { display: 'none' } : { display: 'block', top: `${gy}px`, left: '0', height: '1px', width: `${pw}px` });
      }
    };

    const move = (e) => {
      pointerX = e.screenX;
      pointerY = e.screenY;
      altKey = e.altKey;
      if (!moved) {
        if (Math.hypot(pointerX - startX, pointerY - startY) < 4) return;
        moved = true;
        freeze();
      }
      if (!queued) queued = doc.defaultView.requestAnimationFrame(paint);
    };

    const end = () => {
      for (const target of [document, doc]) {
        target.removeEventListener('mousemove', move, true);
        target.removeEventListener('mouseup', end, true);
      }
      for (const type of ['mouseover', 'mouseout']) doc.removeEventListener(type, stopHover, true);
      if (queued) {
        doc.defaultView.cancelAnimationFrame(queued);
        paint();
      }
      guideX.remove();
      guideY.remove();
      el.style.removeProperty('translate');
      el.style.removeProperty('will-change');
      if (tools) tools.style.visibility = toolsVisibility || '';
      if (moved) {
        model.addStyle({ left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
        // The click that follows a drag must not change the selection.
        const swallow = (e) => {
          e.stopPropagation();
          e.preventDefault();
        };
        doc.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => doc.removeEventListener('click', swallow, true), 0);
        editor.select(model);
      }
    };

    for (const target of [document, doc]) {
      target.addEventListener('mousemove', move, true);
      target.addEventListener('mouseup', end, true);
    }
  }

  editor.on('load', () => {
    const doc = frameDoc(editor);
    if (!doc) return;

    // Press on a freeform element and drag: it follows the mouse.
    doc.addEventListener(
      'mousedown',
      (event) => {
        if (event.button !== 0 || isEditingText(event.target)) return;
        if (doc.body.classList.contains('lp-motion')) return; // previewing animations: let clicks through
        const el = event.target.closest?.('.lp-free');
        if (!el) return;
        if (editor.Canvas.getWindow().getComputedStyle(el).position !== 'absolute') return; // stacked on small screens
        const model = el.__gjsv?.model;
        if (!model) return;
        if (editor.getSelected() !== model) editor.select(model);
        startMove(event, model, el);
      },
      true,
    );

    // The browser's own drag-and-drop must not start for freeform elements: it launches the editor's built-in
    // dragger on top of this one, which doubled the work and made dragging stutter.
    doc.addEventListener(
      'dragstart',
      (event) => {
        if (event.target.closest?.('.lp-free')) {
          event.preventDefault();
          event.stopPropagation(); // so the editor's own dragstart handler never sees it
        }
      },
      true,
    );

    // The browser must not toggle FAQ items while you are editing them.
    doc.addEventListener('click', (event) => {
      if (event.target.closest?.('summary')) event.preventDefault();
    });
  });

  // Arrow keys nudge the selected element (hold Shift for bigger steps).
  const nudge = (event) => {
    const keys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = keys[event.key];
    if (!delta) return;
    if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const model = editor.getSelected();
    if (!isFree(model)) return;
    const el = model.getEl();
    if (!el || editor.Canvas.getWindow().getComputedStyle(el).position !== 'absolute') return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    model.addStyle({
      left: `${Math.round(el.offsetLeft + delta[0] * step)}px`,
      top: `${Math.round(el.offsetTop + delta[1] * step)}px`,
    });
  };
  document.addEventListener('keydown', nudge);
  editor.on('load', () => frameDoc(editor)?.addEventListener('keydown', nudge));
}
