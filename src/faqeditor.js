// FAQ editor window. Select an FAQ (or press "Edit questions and answers" from the text window)
// to type every question and answer in one place, add new ones, remove or reorder them.

import { hasClass } from './freeform.js';

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const NEW_ITEM = '<details class="lp-faq" open><summary>Type your question here</summary><p>Type the answer here.</p></details>';

export function initFaqEditor(editor) {
  const root = document.getElementById('faq-popup');
  root.innerHTML = `
    <div class="tp-head" data-grip>
      <span class="tp-title">Questions and answers</span>
      <button type="button" class="tp-x" data-act="close" title="Close" aria-label="Close">&times;</button>
    </div>
    <div class="faq-body">
      <div class="faq-list"></div>
      <button type="button" class="faq-add" data-act="add">+ Add a question</button>
    </div>`;
  const listEl = root.querySelector('.faq-list');

  let list = null; // the FAQ list component being edited
  let moved = false;

  const frame = () => editor.Canvas.getFrameEl();
  const items = () => (list ? list.components().models.filter((c) => hasClass(c, 'lp-faq')) : []);
  const questionOf = (item) => item.find('summary')[0];
  const answerOf = (item) => item.find('p')[0];
  const textOf = (c) => (c?.getEl()?.textContent || '').trim();
  const setText = (c, value) => c?.components(escapeHtml(value));

  function render() {
    const rows = items().map((item, i, all) => {
      const row = document.createElement('div');
      row.className = 'faq-row';
      row.innerHTML = `
        <div class="faq-row-head">
          <span>Question ${i + 1}</span>
          <span class="faq-tools">
            <button type="button" data-row="up" title="Move up" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
            <button type="button" data-row="down" title="Move down" aria-label="Move down" ${i === all.length - 1 ? 'disabled' : ''}>&darr;</button>
            <button type="button" data-row="remove" title="Delete this question" aria-label="Delete this question">&times;</button>
          </span>
        </div>
        <input type="text" class="faq-q" aria-label="Question ${i + 1}" placeholder="Question">
        <textarea class="faq-a" rows="3" aria-label="Answer ${i + 1}" placeholder="Answer"></textarea>`;
      row.querySelector('.faq-q').value = textOf(questionOf(item));
      row.querySelector('.faq-a').value = textOf(answerOf(item));

      row.querySelector('.faq-q').addEventListener('input', (e) => setText(questionOf(item), e.target.value));
      row.querySelector('.faq-a').addEventListener('input', (e) => setText(answerOf(item), e.target.value));
      row.addEventListener('click', (e) => {
        const button = e.target.closest('[data-row]');
        if (!button) return;
        const action = button.dataset.row;
        if (action === 'remove') item.remove();
        if (action === 'up') item.move(list, { at: i - 1 });
        if (action === 'down') item.move(list, { at: i + 1 });
        setTimeout(() => {
          render();
          position();
        }, 0);
      });
      return row;
    });
    listEl.replaceChildren(...rows);
    if (!rows.length) listEl.innerHTML = '<p class="faq-empty">No questions yet. Add your first one below.</p>';
  }

  function position() {
    if (!list || root.hidden || moved) return;
    const el = list.getEl();
    if (!el) return;
    const fr = frame().getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pw = root.offsetWidth;
    const ph = root.offsetHeight;
    const minTop = fr.top + 8;
    let top = fr.top + r.bottom + 14;
    if (top + ph > window.innerHeight - 8) top = fr.top + r.top - ph - 14;
    top = clamp(top, minTop, Math.max(minTop, window.innerHeight - ph - 8));
    const left = clamp(fr.left + r.left + r.width / 2 - pw / 2, fr.left + 8, window.innerWidth - pw - 8);
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
  }

  function open(model) {
    if (list !== model) moved = false;
    list = model;
    root.hidden = false;
    render();
    requestAnimationFrame(position);
  }

  function close() {
    list = null;
    root.hidden = true;
  }

  // Open when the FAQ itself (or one of its items) is selected.
  editor.on('component:toggled', () => {
    setTimeout(() => {
      const selected = editor.getSelected();
      const el = selected?.getEl();
      const owner = el?.closest?.('.lp-faq-list')?.__gjsv?.model;
      if (owner && (hasClass(selected, 'lp-faq-list') || hasClass(selected, 'lp-faq'))) open(owner);
      else if (!owner || owner !== list) close();
    }, 0);
  });
  editor.on('update', () => {
    if (!list || root.hidden) return;
    // Refresh text boxes unless the person is typing in one of them.
    if (!root.contains(document.activeElement)) render();
    requestAnimationFrame(position);
  });
  window.addEventListener('resize', () => requestAnimationFrame(position));

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    if (button.dataset.act === 'close') close();
    if (button.dataset.act === 'add' && list) {
      list.append(NEW_ITEM);
      setTimeout(() => {
        render();
        position();
        listEl.lastElementChild?.querySelector('.faq-q')?.select();
      }, 0);
    }
  });

  root.querySelector('[data-grip]').addEventListener('pointerdown', (event) => {
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

  return { open };
}
