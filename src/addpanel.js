import { BLOCKS } from './blocks.js';
import { CATEGORIES, ELEMENTS, STRIP_HTML, isSection } from './elements.js';
import { isTextLike } from './freeform.js';

const AUTO_WIDTH_IDS = new Set(['badge', 'f-submit']);
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const first = (result) => (Array.isArray(result) ? result[0] : result); // GrapesJS returns one component or a list

// Ready-made sections become items too (they drop as whole strips, between existing ones).
const SECTION_ITEMS = BLOCKS.map((b) => ({
  id: `section-${b.id}`,
  cat: 'sections',
  group: b.cat.label,
  label: b.label,
  html: b.content,
  w: 1100,
}));

export function initAddPanel(editor, { container, getDesignCss }) {
  const ghost = document.getElementById('drag-ghost');
  const dropLine = document.getElementById('drop-line');

  container.innerHTML = `
    <div class="add-search"><input type="search" placeholder="Search elements" aria-label="Search elements"></div>
    <div class="add-body">
      <nav class="add-cats" aria-label="Categories"></nav>
      <div class="add-items"></div>
    </div>`;
  const search = container.querySelector('input');
  const catsEl = container.querySelector('.add-cats');
  const itemsEl = container.querySelector('.add-items');

  let activeCat = 'text';
  let items = [];

  const available = () =>
    [...ELEMENTS, ...SECTION_ITEMS].filter((item) => !item.plugin || editor.Components.getType(item.plugin));

  function renderCategories() {
    catsEl.replaceChildren(
      ...CATEGORIES.map((cat) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `add-cat${cat.id === activeCat && !search.value ? ' on' : ''}`;
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cat.icon}</svg><span>${cat.label}</span>`;
        button.addEventListener('click', () => {
          search.value = '';
          activeCat = cat.id;
          render();
        });
        return button;
      }),
    );
  }

  // ---------- previews ----------

  function renderPreview(host, item) {
    const css = getDesignCss().replace(':root', ':host').replace(/^body\s*\{/m, '.pv-body {');
    const root = host.attachShadow({ mode: 'open' });
    const section = isSection(item);
    const width = section ? 1100 : item.w || 200;
    const fixedH = item.h ? `height:${item.h}px;` : '';
    const inner = item.preview ? `<div style="width:100%;${item.h ? `height:${item.h}px` : 'height:90px'}">${item.preview}</div>` : item.html;
    root.innerHTML = `
      <style>
        ${css}
        .pv-body { font-size: 17px; pointer-events: none; }
        .pv-wrap { position: relative; width: ${width}px; ${section ? '' : fixedH} transform-origin: top left; }
        .pv-wrap .lp-free { position: static !important; width: ${item.h || item.setH ? '100%' : 'auto'} !important; ${item.setH ? 'height:100% !important;' : ''} max-width: 100%; }
        .pv-wrap .lp-strip { height: ${item.id === 'strip-tall' ? 340 : item.id === 'strip-short' ? 110 : 220}px !important; }
        .pv-wrap .lp-stage:empty::after { content: ''; position: absolute; inset: 14px; border: 2px dashed #c3cfe3; border-radius: 10px; }
        .pv-wrap details { pointer-events: none; }
      </style>
      <div class="pv-body"><div class="pv-wrap">${inner}</div></div>`;
    const wrap = root.querySelector('.pv-wrap');
    requestAnimationFrame(() => {
      const boxW = host.clientWidth || 130;
      const boxH = section ? Infinity : host.clientHeight || 80;
      const contentH = wrap.scrollHeight || 60;
      const scale = Math.min(boxW / width, boxH / contentH, 1);
      wrap.style.transform = `scale(${scale})`;
      if (section) {
        host.style.height = `${Math.min(contentH * scale, 200)}px`;
      } else {
        wrap.style.marginLeft = `${Math.max(0, (boxW - width * scale) / 2)}px`;
        wrap.style.marginTop = `${Math.max(0, (boxH - contentH * scale) / 2)}px`;
      }
    });
  }

  // ---------- list ----------

  function card(item) {
    const button = document.createElement('div');
    button.className = `add-card${isSection(item) && item.cat === 'sections' ? ' wide' : ''}`;
    button.tabIndex = 0;
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', `Add ${item.label}`);
    const prev = document.createElement('div');
    prev.className = `add-prev${item.dark ? ' dark' : ''}`;
    const label = document.createElement('span');
    label.textContent = item.label;
    button.append(prev, label);
    bindItem(button, item);
    requestAnimationFrame(() => renderPreview(prev, item));
    return button;
  }

  function render() {
    items = available();
    renderCategories();
    const query = search.value.trim().toLowerCase();
    const list = query
      ? items.filter((i) => `${i.label} ${i.group} ${i.cat}`.toLowerCase().includes(query))
      : items.filter((i) => i.cat === activeCat);

    const groups = new Map();
    for (const item of list) {
      const title = query ? CATEGORIES.find((c) => c.id === item.cat)?.label : item.group;
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(item);
    }
    itemsEl.replaceChildren();
    itemsEl.scrollTop = 0;
    if (!list.length) {
      itemsEl.innerHTML = '<p class="add-empty">Nothing matches that search.</p>';
      return;
    }
    for (const [title, group] of groups) {
      const heading = document.createElement('h3');
      heading.textContent = title;
      const grid = document.createElement('div');
      grid.className = 'add-grid';
      grid.append(...group.map(card));
      itemsEl.append(heading, grid);
    }
  }

  search.addEventListener('input', render);

  // ---------- placing things on the canvas ----------

  const frameEl = () => editor.Canvas.getFrameEl();
  const frameRect = () => frameEl().getBoundingClientRect();
  const wrapper = () => editor.getWrapper();
  const modelOf = (el) => el?.__gjsv?.model;

  function topLevelIndex(frameY) {
    const children = wrapper().components().models;
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getEl()?.getBoundingClientRect();
      if (rect && frameY < rect.top + rect.height / 2) return { index: i, y: rect.top };
    }
    const last = children[children.length - 1]?.getEl()?.getBoundingClientRect();
    return { index: children.length, y: last ? last.bottom : 0 };
  }

  const contentOf = (item) => (item.component ? item.component(editor) : item.html);

  function addSection(item, index) {
    const added = first(wrapper().components().add(item.html, { at: index }));
    editor.select(added);
    editor.Canvas.scrollTo(added, { behavior: 'smooth' });
    return added;
  }

  function newStrip(index) {
    return first(wrapper().components().add(STRIP_HTML(''), { at: index }));
  }

  function stageElOf(strip) {
    return strip.getEl()?.querySelector(':scope > .lp-stage');
  }

  // ----- dropping into an ordinary (non-freeform) div: the element is inserted in the flow, where you point -----

  const FLOW_BLOCKS = 'div, section, article, aside, header, footer, main, form, blockquote';
  const HOLDS_CHILDREN = /^(DIV|SECTION|ARTICLE|ASIDE|HEADER|FOOTER|MAIN|LI|FORM|BLOCKQUOTE)$/;
  const flowBlockOf = (el) => el?.closest?.(FLOW_BLOCKS) || null;

  function flowContent(item) {
    const content = contentOf(item);
    if (typeof content === 'string') return content.replace(/\blp-free\b\s*/, '');
    return { ...content, classes: (content.classes || []).filter((k) => k !== 'lp-free') };
  }

  function flowStyle(item) {
    if (item.id === 'video' || item.id === 'map') return { width: '100%', height: 'auto', 'aspect-ratio': '16 / 9' };
    if (item.id === 'image' || item.id === 'image-wide') return { width: '100%', height: 'auto' };
    if (item.setH && item.h) return { width: `${item.w}px`, height: `${item.h}px`, 'max-width': '100%' };
    return {};
  }

  // target: the component to insert into (or next to). pointer: frame coordinates, or null.
  function flowInsert(item, target, pointer) {
    const el = target.getEl();
    const canHold = target.get('droppable') !== false && !isTextLike(target) && HOLDS_CHILDREN.test(el?.tagName || '');
    let parent = target;
    let index;
    if (!canHold) {
      parent = target.parent();
      // Never put something inside a list or table: go up and place it after the whole list or table instead.
      const LIST = /^(UL|OL|DL|TABLE|THEAD|TBODY|TFOOT|TR|SELECT)$/;
      while (parent && LIST.test(parent.getEl()?.tagName || '')) {
        target = parent;
        parent = parent.parent();
      }
      if (!parent) return null;
      index = parent.components().indexOf(target) + 1; // right after it
    } else {
      const kids = parent.components().models.filter((k) => k.getEl()?.getBoundingClientRect);
      index = parent.components().length;
      if (pointer && kids.length) {
        let best = null;
        kids.forEach((k, i) => {
          const r = k.getEl().getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const d = Math.hypot(pointer.x - cx, pointer.y - cy);
          if (!best || d < best.d) best = { d, k, cx, cy, r };
        });
        // Neighbours side by side (columns, rows of cards) are compared left to right; stacked blocks top to bottom.
        const parentWidth = el.getBoundingClientRect().width || 1;
        const sideBySide = best.r.width < parentWidth * 0.7 && pointer.y >= best.r.top && pointer.y <= best.r.bottom;
        const before = sideBySide ? pointer.x < best.cx : pointer.y < best.cy;
        index = parent.components().indexOf(best.k) + (before ? 0 : 1);
      }
    }
    const added = first(parent.components().add(flowContent(item), { at: index }));
    if (!added) return null;
    const style = flowStyle(item);
    if (Object.keys(style).length) added.addStyle(style);
    editor.select(added);
    added.getEl()?.scrollIntoView?.({ block: 'nearest' });
    return added;
  }

  function placeElement(item, x, y) {
    // x, y are in canvas (iframe) coordinates, or null to use a sensible default spot
    const doc = frameEl().contentDocument;
    const hostOf = (el) => el?.closest?.('.lp-group') || el?.closest?.('.lp-strip')?.querySelector(':scope > .lp-stage') || null;
    let stageEl = null;
    if (x != null) {
      const hit = doc.elementFromPoint(x, y);
      stageEl = hostOf(hit);
      if (!stageEl) {
        const block = modelOf(flowBlockOf(hit));
        if (block && block !== wrapper()) return flowInsert(item, block, { x, y });
      }
    }
    if (!stageEl) {
      const selected = editor.getSelected();
      stageEl = hostOf(selected?.getEl());
      // With an ordinary element selected, "click to add" puts the new element inside it (or right after it).
      if (!stageEl && x == null && selected && selected !== wrapper() && selected.getEl()) return flowInsert(item, selected, null);
      if (!stageEl && x == null) {
        const strips = wrapper().find('.lp-strip');
        stageEl = strips.length ? stageElOf(strips[strips.length - 1]) : null;
      }
    }
    if (!stageEl) {
      const at = x != null ? topLevelIndex(y).index : wrapper().components().length;
      stageEl = stageElOf(newStrip(at));
      x = null;
    }
    const stage = modelOf(stageEl);
    if (!stage) return;

    const w = item.w || 200;
    const h = item.h || 60;
    const stageRect = stageEl.getBoundingClientRect();
    const spread = (stage.components().length % 5) * 22;
    const left = x == null ? (stageEl.offsetWidth - w) / 2 + spread : x - stageRect.left - w / 2;
    const top = y == null || x == null ? 60 + spread : y - stageRect.top - h / 2;

    const added = first(stage.append(contentOf(item)));
    if (!added) return;
    const style = {
      left: `${Math.round(clamp(left, 0, Math.max(0, stageEl.offsetWidth - w)))}px`,
      top: `${Math.round(clamp(top, 0, Math.max(0, stageEl.offsetHeight - Math.min(h, stageEl.offsetHeight))))}px`,
    };
    if (item.w && !(item.cat === 'button' || AUTO_WIDTH_IDS.has(item.id))) style.width = `${item.w}px`;
    if (item.setH && item.h) style.height = `${item.h}px`;
    added.addStyle(style);
    editor.select(added);
    return added;
  }

  function clickAdd(item) {
    if (isSection(item)) {
      const selected = editor.getSelected();
      let index = wrapper().components().length;
      if (selected) {
        let top = selected;
        while (top.parent() && top.parent() !== wrapper()) top = top.parent();
        if (top.parent() === wrapper()) index = wrapper().components().indexOf(top) + 1;
      }
      addSection(item, index);
    } else {
      placeElement(item, null, null);
    }
  }

  // ---------- drag from the panel ----------

  function showGhost(item, event) {
    ghost.textContent = item.label;
    ghost.hidden = false;
    moveGhost(event);
  }
  const moveGhost = (event) => {
    ghost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 14}px)`;
  };

  let highlighted = null;
  function clearHints() {
    dropLine.hidden = true;
    highlighted?.classList.remove('lp-drop-target');
    highlighted = null;
  }

  function overCanvas(event) {
    const r = frameRect();
    return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
  }

  function showHints(item, event) {
    clearHints();
    const flyout = document.getElementById('flyout');
    const fr = flyout.getBoundingClientRect();
    const overFlyout = !flyout.hidden && event.clientX < fr.right && event.clientY > fr.top;
    if (!overCanvas(event) || overFlyout) return;
    const r = frameRect();
    const fx = event.clientX - r.left;
    const fy = event.clientY - r.top;
    if (isSection(item)) {
      const { y } = topLevelIndex(fy);
      dropLine.style.left = `${r.left}px`;
      dropLine.style.width = `${r.width}px`;
      dropLine.style.top = `${r.top + y - 1}px`;
      dropLine.hidden = false;
    } else {
      const under = frameEl().contentDocument.elementFromPoint(fx, fy);
      const strip = under?.closest('.lp-group, .lp-strip') || under?.closest(FLOW_BLOCKS);
      if (strip) {
        strip.classList.add('lp-drop-target');
        highlighted = strip;
      }
    }
  }

  function drop(item, event) {
    const flyout = document.getElementById('flyout');
    const fr = flyout.getBoundingClientRect();
    const overFlyout = !flyout.hidden && event.clientX < fr.right && event.clientY > fr.top;
    if (!overCanvas(event) || overFlyout) return;
    const r = frameRect();
    const fx = event.clientX - r.left;
    const fy = event.clientY - r.top;
    if (isSection(item)) addSection(item, topLevelIndex(fy).index);
    else placeElement(item, fx, fy);
  }

  function bindItem(node, item) {
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        clickAdd(item);
      }
    });
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const startX = event.clientX;
      const startY = event.clientY;
      let dragging = false;
      node.setPointerCapture(event.pointerId);

      const move = (e) => {
        if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
          dragging = true;
          showGhost(item, e);
          editor.select(); // nothing selected while dragging, so guides and popups stay out of the way
        }
        if (dragging) {
          moveGhost(e);
          showHints(item, e);
        }
      };
      const finish = (e, cancelled) => {
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
        node.removeEventListener('pointercancel', cancel);
        try {
          node.releasePointerCapture(event.pointerId);
        } catch {
          /* already released */
        }
        ghost.hidden = true;
        clearHints();
        if (cancelled) return;
        if (dragging) drop(item, e);
        else clickAdd(item);
      };
      const up = (e) => finish(e, false);
      const cancel = (e) => finish(e, true);
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', cancel);
    });
  }

  render();
  return { refresh: render };
}
