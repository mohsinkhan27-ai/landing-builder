// The Animate tab: lets you add the five animation types to the selected element.
// Everything is stored as data-* attributes on the element and played by public/motion.js.

import { hasClass } from './freeform.js';

const ENTER_TYPES = [
  ['', 'None'],
  ['fade', 'Fade in'],
  ['slide-up', 'Slide up'],
  ['slide-down', 'Slide down'],
  ['from-left', 'Slide in from the left'],
  ['from-right', 'Slide in from the right'],
  ['zoom', 'Zoom in'],
  ['reveal-left', 'Reveal from the left'],
  ['reveal-up', 'Reveal from the bottom'],
];
const SLIDES = new Set(['slide-up', 'slide-down', 'from-left', 'from-right']);
const EASES = [
  ['ease-out', 'Smooth stop'],
  ['ease-in-out', 'Smooth start and stop'],
  ['ease', 'Gentle'],
  ['linear', 'Constant speed'],
  ['spring', 'Springy'],
];
const LOOPS = [
  ['', 'None'],
  ['breathe', 'Breathe (grow and shrink)'],
  ['pulse', 'Pulse'],
  ['float', 'Float up and down'],
  ['spin', 'Spin'],
];

// What each effect does. build() returns the end state; base() the starting state, if it has one.
const EFFECTS = {
  bg: { label: 'Change background color', init: { v: '#2457f5' }, build: (r) => ({ bg: r.v }) },
  color: { label: 'Change text color', init: { v: '#ffffff' }, build: (r) => ({ color: r.v }) },
  rotate: { label: 'Rotate', init: { v: 360 }, build: (r) => ({ rotate: Number(r.v) || 0 }) },
  fadein: { label: 'Fade in (hidden until triggered)', init: {}, build: () => ({ opacity: 1 }), base: () => ({ opacity: 0 }) },
  fadeout: { label: 'Fade out', init: {}, build: () => ({ opacity: 0 }) },
  opacity: { label: 'Set opacity', init: { v: 0.5 }, build: (r) => ({ opacity: Number(r.v) }) },
  move: { label: 'Move', init: { x: 80, y: 0 }, build: (r) => ({ x: Number(r.x) || 0, y: Number(r.y) || 0 }) },
  scale: { label: 'Scale', init: { v: 1.15 }, build: (r) => ({ scale: Number(r.v) || 1 }) },
};

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'value') el.value = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) if (child != null) el.append(child);
  return el;
}

const select = (options, value, onChange) =>
  h('select', { onchange: (e) => onChange(e.target.value) }, options.map(([v, label]) => h('option', { value: v, text: label, selected: v === value })));

const number = (value, onChange, props = {}) =>
  h('input', { type: 'number', value, ...props, onchange: (e) => onChange(e.target.value) });

const field = (label, control) => h('label', { class: 'an-field' }, h('span', { text: label }), control);

const check = (label, checked, onChange) =>
  h('label', { class: 'an-check' }, h('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) }), h('span', { text: label }));

export function initAnimate(editor, { container, openAnimate, onPreview }) {
  let comp = null;
  let previewOn = false;
  let timer = null;

  const win = () => editor.Canvas.getWindow();
  const doc = () => editor.Canvas.getDocument();

  // ---------- attributes ----------

  const attrs = () => comp.getAttributes();
  const attr = (name, fallback = '') => attrs()[name] ?? fallback;
  const setAttrs = (obj) => {
    const add = {};
    const remove = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value === '' || value == null || value === false) remove.push(key);
      else add[key] = value === true ? '1' : String(value);
    }
    if (remove.length) comp.removeAttributes(remove);
    if (Object.keys(add).length) comp.addAttributes(add);
    editor.trigger('change:canvasOffset');
    editor.trigger('update');
  };
  const isStrip = () => hasClass(comp, 'lp-strip');

  // ---------- hover and click effects ----------

  const getRules = () => {
    try {
      const rules = JSON.parse(attr('data-fx', '[]'));
      return Array.isArray(rules) ? rules : [];
    } catch {
      return [];
    }
  };
  let rules = [];
  const commit = () => setAttrs({ 'data-fx': rules.length ? JSON.stringify(rules) : '' });

  const finish = (rule) => {
    const effect = EFFECTS[rule.kind];
    rule.props = effect.build(rule);
    if (effect.base) rule.base = effect.base(rule);
    else delete rule.base;
  };

  function ensureFxId(target) {
    let id = target.getAttributes()['data-fx-id'];
    if (!id) {
      id = `fx${Math.random().toString(36).slice(2, 6)}`;
      target.addAttributes({ 'data-fx-id': id });
    }
    return id;
  }

  function targetLabel(target, n) {
    const el = target.getEl();
    const tag = el?.tagName.toLowerCase() || '';
    const text = (el?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (tag === 'img') return `Image ${n.img}`;
    if (tag === 'a' || tag === 'button') return `Button${text ? `: ${text}` : ''}`;
    if (/^h[1-6]$/.test(tag)) return `Heading${text ? `: ${text}` : ''}`;
    if (tag === 'p' || tag === 'blockquote') return `Text${text ? `: ${text}` : ''}`;
    if (hasClass(target, 'lp-ico')) return 'Icon';
    if (hasClass(target, 'lp-group')) return 'Container';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'Form field';
    if (hasClass(target, 'lp-box')) return 'Shape';
    return text ? `Text: ${text}` : tag;
  }

  // Things inside the selected element that an effect can aim at.
  function targets() {
    const counts = { img: 0 };
    const list = [];
    comp.find('*').forEach((child) => {
      const el = child.getEl();
      if (!el || hasClass(child, 'lp-stage') || ['summary', 'details', 'option', 'label', 'span', 'li', 'ul'].includes(el.tagName.toLowerCase()) && !hasClass(child, 'lp-free')) return;
      if (el.tagName === 'IMG') counts.img += 1;
      list.push({ comp: child, label: targetLabel(child, counts) });
    });
    return list;
  }

  function ruleRow(rule, all) {
    const list = targets();
    const current = rule.t === 'self' || !rule.t ? 'self' : String(list.findIndex((t) => t.comp.getAttributes()['data-fx-id'] === rule.t));
    const targetSelect = select(
      [['self', 'This element'], ...list.map((t, i) => [String(i), t.label])],
      current,
      (value) => {
        rule.t = value === 'self' ? 'self' : ensureFxId(list[Number(value)].comp);
        commit();
      },
    );

    const params = h('span', { class: 'an-params' });
    const paramInputs = () => {
      params.replaceChildren();
      const kind = rule.kind;
      const edit = (key, ctl) => params.append(ctl);
      if (kind === 'bg' || kind === 'color') {
        edit('v', h('input', { type: 'color', value: rule.v || '#2457f5', oninput: (e) => { rule.v = e.target.value; finish(rule); commit(); } }));
      } else if (kind === 'rotate') {
        edit('v', h('span', { class: 'an-unit' }, number(rule.v ?? 360, (v) => { rule.v = v; finish(rule); commit(); }, { step: 15 }), h('em', { text: '°' })));
      } else if (kind === 'opacity') {
        edit('v', number(rule.v ?? 0.5, (v) => { rule.v = v; finish(rule); commit(); }, { step: 0.1, min: 0, max: 1 }));
      } else if (kind === 'scale') {
        edit('v', number(rule.v ?? 1.15, (v) => { rule.v = v; finish(rule); commit(); }, { step: 0.05, min: 0.1, max: 4 }));
      } else if (kind === 'move') {
        params.append(
          h('span', { class: 'an-unit' }, h('em', { text: 'X' }), number(rule.x ?? 0, (v) => { rule.x = v; finish(rule); commit(); })),
          h('span', { class: 'an-unit' }, h('em', { text: 'Y' }), number(rule.y ?? 0, (v) => { rule.y = v; finish(rule); commit(); })),
        );
      }
    };
    paramInputs();

    const effectSelect = select(
      Object.entries(EFFECTS).map(([key, e]) => [key, e.label]),
      rule.kind,
      (kind) => {
        Object.assign(rule, { v: undefined, x: undefined, y: undefined }, EFFECTS[kind].init, { kind });
        finish(rule);
        commit();
        paramInputs();
      },
    );

    return h(
      'div',
      { class: 'an-rule' },
      h('div', { class: 'an-rule-top' }, h('span', { class: 'an-rule-label', text: 'On' }), targetSelect),
      h('div', { class: 'an-rule-top' }, h('span', { class: 'an-rule-label', text: 'Do' }), effectSelect),
      params,
      h('button', { type: 'button', class: 'an-x', title: 'Remove this effect', 'aria-label': 'Remove this effect', text: '×', onclick: () => {
        all.splice(all.indexOf(rule), 1);
        commit();
        render();
      } }),
    );
  }

  function effectsSection(on) {
    const mine = rules.filter((r) => r.on === on);
    const body = h('div', { class: 'an-body' });
    body.append(
      h('p', { class: 'an-help', text: on === 'hover'
        ? 'When the pointer is over this element, apply these effects. They reverse when the pointer leaves. On touch screens a tap does the same.'
        : 'When this element is clicked, apply these effects. Click again to undo them.' }),
    );
    mine.forEach((rule) => body.append(ruleRow(rule, rules)));

    const add = h('button', { type: 'button', class: 'an-add', text: '+ Add an effect', onclick: () => {
      const kind = 'bg';
      const rule = { on, t: 'self', kind, ...EFFECTS[kind].init, dur: mine[0]?.dur ?? 0.4, ease: mine[0]?.ease ?? 'ease' };
      if (on === 'click') rule.toggle = mine[0]?.toggle ?? true;
      finish(rule);
      rules.push(rule);
      commit();
      render();
    } });
    body.append(add);

    if (mine.length) {
      const setAll = (key, value) => {
        mine.forEach((r) => { r[key] = value; });
        commit();
      };
      body.append(
        h('div', { class: 'an-two' },
          field('Duration (s)', number(mine[0].dur ?? 0.4, (v) => setAll('dur', Number(v) || 0.4), { step: 0.1, min: 0.1, max: 10 })),
          field('Easing', select(EASES, mine[0].ease || 'ease', (v) => setAll('ease', v))),
        ),
      );
      if (on === 'click') body.append(check('Click again to undo', mine[0].toggle !== false, (v) => setAll('toggle', v)));
    }

    if (on === 'click') {
      body.append(
        h('button', { type: 'button', class: 'an-ghost', text: 'Quick set-up: move the images inside away', onclick: () => {
          const imgs = comp.find('img');
          if (!imgs.length) {
            hint.textContent = 'There are no images inside this element. Put images in a container first.';
            return;
          }
          const box = comp.getEl().getBoundingClientRect();
          const centre = box.left + box.width / 2;
          const dist = Math.round(box.width / 2 + 40);
          rules = rules.filter((r) => !(r.on === 'click' && imgs.some((i) => i.getAttributes()['data-fx-id'] === r.t)));
          imgs.forEach((img) => {
            const r = img.getEl().getBoundingClientRect();
            const dir = r.left + r.width / 2 < centre ? -1 : 1;
            const rule = { on: 'click', t: ensureFxId(img), kind: 'move', x: dir * dist, y: 0, dur: 0.7, ease: 'ease-in-out', toggle: true };
            finish(rule);
            rules.push(rule);
          });
          commit();
          render();
        } }),
      );
    }
    return section(on === 'hover' ? 'Hover' : 'Click', mine.length, body);
  }

  // ---------- sections ----------

  const section = (title, active, body) =>
    h('details', { class: 'an-section', open: active ? true : null },
      h('summary', {}, h('span', { text: title }), active ? h('i', { class: 'an-dot', title: 'In use' }) : null),
      body);

  function entranceSection() {
    const type = attr('data-enter');
    const body = h('div', { class: 'an-body' });
    body.append(
      h('p', { class: 'an-help', text: 'Plays once when the element first scrolls into view.' }),
      field('Effect', select(ENTER_TYPES, type, (v) => {
        setAttrs({ 'data-enter': v, ...(v ? {} : { 'data-enter-duration': '', 'data-enter-delay': '', 'data-enter-ease': '', 'data-enter-distance': '', 'data-enter-repeat': '' }) });
        render();
        if (v && comp) {
          setTimeout(() => win().LPMotion?.replay(comp.getEl()), 60);
        }
      })),
    );
    if (type) {
      body.append(
        h('div', { class: 'an-two' },
          field('Duration (s)', number(attr('data-enter-duration', 0.8), (v) => setAttrs({ 'data-enter-duration': v }), { step: 0.1, min: 0.1, max: 10 })),
          field('Delay (s)', number(attr('data-enter-delay', 0), (v) => setAttrs({ 'data-enter-delay': v }), { step: 0.1, min: 0, max: 10 })),
        ),
        field('Easing', select(EASES, attr('data-enter-ease', 'ease-out'), (v) => setAttrs({ 'data-enter-ease': v }))),
      );
      if (SLIDES.has(type)) body.append(field('Distance (px)', number(attr('data-enter-distance', 40), (v) => setAttrs({ 'data-enter-distance': v }), { step: 5, min: 0, max: 400 })));
      body.append(
        check('Play every time it scrolls into view', attr('data-enter-repeat') === '1', (v) => setAttrs({ 'data-enter-repeat': v })),
        h('button', { type: 'button', class: 'an-ghost', text: '▶ Play this animation', onclick: () => win().LPMotion?.replay(comp.getEl()) }),
      );
    }
    return section('Entrance', !!type, body);
  }

  function scrollSection() {
    const on = attr('data-scroll') === 'shrink';
    const body = h('div', { class: 'an-body' });
    body.append(
      h('p', { class: 'an-help', text: isStrip()
        ? 'Make this strip shrink as the visitor scrolls. Turn on sticky to pin it to the top while the next strips slide over it.'
        : 'Make this element shrink as the visitor scrolls past it.' }),
      field('Effect', select([['', 'None'], ['shrink', 'Shrink while scrolling']], on ? 'shrink' : '', (v) => {
        setAttrs(v ? { 'data-scroll': 'shrink' } : { 'data-scroll': '', 'data-scroll-to': '', 'data-scroll-range': '', 'data-scroll-radius': '', 'data-sticky': '', 'data-sticky-top': '' });
        render();
      })),
    );
    if (on) {
      body.append(
        h('div', { class: 'an-two' },
          field('Shrinks to (%)', number(Math.round(Number(attr('data-scroll-to', 0.7)) * 100), (v) => setAttrs({ 'data-scroll-to': (Math.min(100, Math.max(20, Number(v) || 70)) / 100).toFixed(2) }), { min: 20, max: 100, step: 5 })),
          field('Over (px of scrolling)', number(attr('data-scroll-range', 500), (v) => setAttrs({ 'data-scroll-range': v }), { min: 60, max: 3000, step: 50 })),
        ),
        field('Round the corners to (px)', number(attr('data-scroll-radius', 0), (v) => setAttrs({ 'data-scroll-radius': v }), { min: 0, max: 200, step: 4 })),
      );
      if (isStrip()) {
        body.append(
          check('Sticky: pin to the top while scrolling', attr('data-sticky') === '1', (v) => {
            setAttrs({ 'data-sticky': v, ...(v ? {} : { 'data-sticky-top': '' }) });
            render();
          }),
        );
        if (attr('data-sticky') === '1') {
          body.append(field('Distance from the top (px)', number(attr('data-sticky-top', 0), (v) => setAttrs({ 'data-sticky-top': v }), { min: 0, max: 400, step: 10 })));
        }
      }
    }
    return section('Scroll', on, body);
  }

  function loopSection() {
    const kind = attr('data-loop');
    const body = h('div', { class: 'an-body' });
    body.append(
      h('p', { class: 'an-help', text: 'Plays continuously, in a smooth loop.' }),
      field('Effect', select(LOOPS, kind, (v) => {
        setAttrs({ 'data-loop': v, ...(v ? {} : { 'data-loop-duration': '', 'data-loop-strength': '' }) });
        render();
      })),
    );
    if (kind) {
      body.append(field('One loop takes (s)', number(attr('data-loop-duration', 4), (v) => setAttrs({ 'data-loop-duration': v }), { min: 0.5, max: 30, step: 0.5 })));
      if (kind !== 'spin') {
        const label = kind === 'float' ? 'Distance (px)' : 'Size change (%)';
        const fallback = kind === 'float' ? 14 : kind === 'pulse' ? 8 : 6;
        body.append(field(label, number(attr('data-loop-strength', fallback), (v) => setAttrs({ 'data-loop-strength': v }), { min: 1, max: 60, step: 1 })));
      }
    }
    return section('Loop', !!kind, body);
  }

  // ---------- panel ----------

  const hint = h('p', { class: 'an-hint', role: 'status' });
  const previewButton = h('button', { type: 'button', class: 'an-preview', onclick: () => setPreview(!previewOn) });

  function paintPreviewButton() {
    previewButton.textContent = previewOn ? '■ Stop previewing' : '▶ Preview motion on the page';
    previewButton.classList.toggle('on', previewOn);
  }

  function render() {
    hint.textContent = '';
    container.replaceChildren();
    paintPreviewButton();
    container.append(previewButton);
    if (!comp) {
      container.append(h('p', { class: 'an-empty', text: 'Click an element on the page, then add animations to it here.' }));
      return;
    }
    rules = getRules();
    const el = comp.getEl();
    const name = hasClass(comp, 'lp-strip') ? 'Strip' : hasClass(comp, 'lp-group') ? 'Container' : (el?.tagName || '').toLowerCase();
    container.append(
      h('p', { class: 'an-selected' }, h('span', { text: 'Animating' }), h('strong', { text: name })),
      entranceSection(),
      effectsSection('hover'),
      effectsSection('click'),
      scrollSection(),
      loopSection(),
      hint,
    );
  }

  // ---------- preview in the canvas ----------

  function setPreview(on) {
    previewOn = on;
    doc().body.classList.toggle('lp-motion', on);
    if (on) win().LPMotion?.init(doc());
    else win().LPMotion?.destroy();
    paintPreviewButton();
    onPreview?.(on);
  }

  editor.on('update', () => {
    if (!previewOn) return;
    clearTimeout(timer);
    timer = setTimeout(() => win().LPMotion?.init(doc()), 350);
  });
  editor.on('load', () => {
    const stop = (event) => {
      if (event.key === 'Escape' && previewOn) setPreview(false);
    };
    document.addEventListener('keydown', stop);
    doc().addEventListener('keydown', stop);
  });

  // ---------- selection, toolbar button ----------

  editor.Commands.add('lp-animate', { run: () => openAnimate() });
  const BOLT = { attributes: { class: 'fa fa-bolt', title: 'Animate' }, command: 'lp-animate' };

  editor.on('component:selected', (selected) => {
    const toolbar = selected.get('toolbar') || [];
    if (!toolbar.some((t) => t.command === 'lp-animate')) selected.set('toolbar', [...toolbar, BOLT]);
  });
  editor.on('component:toggled', () => {
    const selected = editor.getSelected();
    comp = selected && editor.getSelectedAll().length === 1 ? selected : null;
    render();
  });

  render();
  return { setPreview, isPreview: () => previewOn };
}
