/*
  Landing Builder motion runtime (no dependencies).
  Exported pages include this file inline. The editor loads it to preview animations.

  Reads these attributes, written by the Animate panel:
    data-enter                 fade | slide-up | slide-down | from-left | from-right | zoom | reveal-left | reveal-up
    data-enter-duration/-delay/-ease/-distance/-repeat
    data-fx                    JSON list of hover and click effects (see rules below)
    data-fx-id                 names an element so an effect can target it
    data-scroll="shrink"       with data-scroll-to / -range / -radius, and data-sticky / data-sticky-top
    data-loop                  breathe | float | pulse | spin   with data-loop-duration / -strength

  Effect rule: { on: 'hover'|'click', t: 'self'|<data-fx-id>, props: {...}, base: {...}, dur, ease, toggle }
  props / base keys: bg, color, opacity, x, y, rotate, scale
*/
(function (global) {
  'use strict';

  var state = null;

  var EASE = {
    ease: 'ease',
    linear: 'linear',
    'ease-out': 'cubic-bezier(.22,.61,.36,1)',
    'ease-in-out': 'cubic-bezier(.65,0,.35,1)',
    spring: 'cubic-bezier(.34,1.56,.64,1)',
  };
  var ease = function (name) { return EASE[name] || EASE['ease-out']; };
  var num = function (value, fallback) { var n = parseFloat(value); return isNaN(n) ? fallback : n; };
  var clamp = function (n, min, max) { return Math.min(Math.max(n, min), max); };
  var qsa = function (root, selector) { return Array.prototype.slice.call(root.querySelectorAll(selector)); };

  // ----- inline style bookkeeping, so everything can be undone (used by the editor preview) -----

  function setProp(el, prop, value) {
    if (state) {
      if (!el.__lpOrig) el.__lpOrig = {};
      if (!(prop in el.__lpOrig)) el.__lpOrig[prop] = el.style.getPropertyValue(prop);
      if (state.touched.indexOf(el) < 0) state.touched.push(el);
    }
    if (value === '' || value == null) el.style.removeProperty(prop);
    else el.style.setProperty(prop, String(value));
  }

  function cssFor(st) {
    var out = {};
    if (!st) return out;
    if (st.bg != null) out['background-color'] = st.bg;
    if (st.color != null) out.color = st.color;
    if (st.opacity != null) out.opacity = String(st.opacity);
    if (st.x != null || st.y != null) out.translate = (st.x || 0) + 'px ' + (st.y || 0) + 'px';
    if (st.rotate != null) out.rotate = st.rotate + 'deg';
    if (st.scale != null) out.scale = String(st.scale);
    return out;
  }

  // ----- entrance: fade / slide / zoom / reveal when scrolled into view -----

  function entranceTransition(el) {
    var d = num(el.getAttribute('data-enter-duration'), 0.8);
    var delay = num(el.getAttribute('data-enter-delay'), 0);
    var e = ease(el.getAttribute('data-enter-ease'));
    return ['opacity', 'translate', 'scale', 'clip-path']
      .map(function (p) { return p + ' ' + d + 's ' + e + ' ' + delay + 's'; })
      .join(',');
  }

  function prepareEntrance(el) {
    setProp(el, 'transition', entranceTransition(el));
    setProp(el, '--lp-dist', num(el.getAttribute('data-enter-distance'), 40) + 'px');
  }

  function playEntrance(el) {
    el.classList.add('lp-in');
    var total = (num(el.getAttribute('data-enter-duration'), 0.8) + num(el.getAttribute('data-enter-delay'), 0)) * 1000 + 60;
    setTimeout(function () {
      if (!el.classList.contains('lp-in')) return;
      // The entrance is over: hand transitions back, so hover effects on the same element work normally.
      setProp(el, 'transition', el.__lpFxTransition || '');
      if ((el.getAttribute('data-enter') || '').indexOf('reveal') === 0) setProp(el, 'clip-path', 'none');
    }, total);
  }

  function resetEntrance(el) {
    setProp(el, 'transition', 'none');
    setProp(el, 'clip-path', '');
    el.classList.remove('lp-in');
    void el.offsetWidth;
    setProp(el, 'transition', entranceTransition(el));
  }

  function setupEntrance(doc, win) {
    var els = qsa(doc, '[data-enter]');
    if (!els.length) return;
    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches || !win.IntersectionObserver) {
      els.forEach(function (el) { el.classList.add('lp-in'); });
      return;
    }
    var io = new win.IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var el = entry.target;
          var repeat = el.getAttribute('data-enter-repeat') === '1';
          if (entry.isIntersecting) {
            playEntrance(el);
            if (!repeat) io.unobserve(el);
          } else if (repeat) {
            resetEntrance(el);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach(function (el) {
      prepareEntrance(el);
      io.observe(el);
    });
    state.cleanups.push(function () { io.disconnect(); });
  }

  // ----- hover and click interactions -----

  function setupEffects(doc, win) {
    var touchOnly = win.matchMedia && win.matchMedia('(hover: none)').matches;

    qsa(doc, '[data-fx]').forEach(function (trigger) {
      var rules;
      try { rules = JSON.parse(trigger.getAttribute('data-fx')); } catch (err) { return; }
      if (!Array.isArray(rules)) return;

      var items = [];
      rules.forEach(function (rule) {
        var target = !rule.t || rule.t === 'self' ? trigger : trigger.querySelector('[data-fx-id="' + rule.t + '"]');
        if (!target) return;
        items.push({
          rule: rule,
          el: target,
          css: cssFor(rule.props),
          base: cssFor(rule.base),
          // On devices without hover, hover effects work as a tap toggle.
          kind: rule.on === 'hover' && touchOnly ? 'click' : rule.on,
        });
      });

      // Starting state (for example "hidden until hovered"), set before any transition exists so it never animates.
      items.forEach(function (item) {
        Object.keys(item.base).forEach(function (p) { setProp(item.el, p, item.base[p]); });
      });
      void trigger.offsetWidth;

      // One combined transition per target element.
      var perEl = [];
      items.forEach(function (item) {
        var entry = perEl.filter(function (p) { return p.el === item.el; })[0];
        if (!entry) perEl.push((entry = { el: item.el, parts: {} }));
        var timing = num(item.rule.dur, 0.4) + 's ' + ease(item.rule.ease);
        Object.keys(item.css).concat(Object.keys(item.base)).forEach(function (p) { entry.parts[p] = p + ' ' + timing; });
      });
      perEl.forEach(function (entry) {
        var value = Object.keys(entry.parts).map(function (p) { return entry.parts[p]; }).join(',');
        entry.el.__lpFxTransition = value;
        setProp(entry.el, 'transition', value);
      });

      function apply(item, on) {
        Object.keys(item.css).forEach(function (p) {
          setProp(item.el, p, on ? item.css[p] : item.base[p] != null ? item.base[p] : '');
        });
      }
      var of = function (kind) { return items.filter(function (i) { return i.kind === kind; }); };

      var hover = of('hover');
      if (hover.length) {
        var enter = function () { hover.forEach(function (i) { apply(i, true); }); };
        var leave = function () { hover.forEach(function (i) { apply(i, false); }); };
        trigger.addEventListener('mouseenter', enter);
        trigger.addEventListener('mouseleave', leave);
        state.cleanups.push(function () {
          trigger.removeEventListener('mouseenter', enter);
          trigger.removeEventListener('mouseleave', leave);
        });
      }

      var click = of('click');
      if (click.length) {
        var on = false;
        var toggle = click[0].rule.toggle !== false;
        var onClick = function () {
          on = toggle ? !on : true;
          click.forEach(function (i) { apply(i, on); });
        };
        trigger.addEventListener('click', onClick);
        setProp(trigger, 'cursor', 'pointer');
        state.cleanups.push(function () { trigger.removeEventListener('click', onClick); });
      }
    });
  }

  // ----- scroll effect: shrink (optionally while the strip is sticky) -----

  function documentTop(el) {
    var y = 0;
    var node = el;
    while (node) { y += node.offsetTop; node = node.offsetParent; }
    return y;
  }

  function setupScroll(doc, win) {
    var els = qsa(doc, '[data-scroll="shrink"]');
    if (!els.length) return;
    var items = els.map(function (el) {
      var sticky = el.hasAttribute('data-sticky');
      var stickyTop = num(el.getAttribute('data-sticky-top'), 0);
      if (sticky) setProp(el, '--lp-sticky-top', stickyTop + 'px');
      return {
        el: el,
        sticky: sticky,
        stickyTop: stickyTop,
        to: clamp(num(el.getAttribute('data-scroll-to'), 0.7), 0.2, 1),
        range: Math.max(60, num(el.getAttribute('data-scroll-range'), 500)),
        radius: Math.max(0, num(el.getAttribute('data-scroll-radius'), 0)),
        top: 0,
      };
    });

    function measure() {
      items.forEach(function (item) {
        if (item.sticky) {
          // A stuck element reports its stuck position, so add up what sits above it instead.
          var top = 0;
          for (var s = item.el.previousElementSibling; s; s = s.previousElementSibling) top += s.offsetHeight;
          item.top = top;
        } else {
          item.top = documentTop(item.el);
        }
      });
    }

    var queued = false;
    function update() {
      queued = false;
      var y = win.pageYOffset || doc.documentElement.scrollTop || 0;
      var vh = win.innerHeight;
      items.forEach(function (item) {
        var p = item.sticky ? (y - item.top + item.stickyTop) / item.range : (y + vh * 0.85 - item.top) / item.range;
        p = clamp(p, 0, 1);
        setProp(item.el, 'scale', String(1 - (1 - item.to) * p));
        if (item.radius) setProp(item.el, 'border-radius', Math.round(item.radius * p) + 'px');
      });
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      win.requestAnimationFrame(update);
    }
    function onResize() { measure(); update(); }

    measure();
    update();
    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('resize', onResize);
    state.cleanups.push(function () {
      win.removeEventListener('scroll', onScroll);
      win.removeEventListener('resize', onResize);
    });
  }

  // ----- loop animations (the movement itself is CSS; this passes the settings) -----

  function setupLoops(doc) {
    qsa(doc, '[data-loop]').forEach(function (el) {
      var kind = el.getAttribute('data-loop');
      var strength = num(el.getAttribute('data-loop-strength'), kind === 'float' ? 14 : kind === 'pulse' ? 8 : 6);
      setProp(el, '--lp-dur', num(el.getAttribute('data-loop-duration'), 4) + 's');
      if (kind === 'breathe' || kind === 'pulse') setProp(el, '--lp-s', String(1 + strength / 100));
      if (kind === 'float') setProp(el, '--lp-d', strength + 'px');
    });
  }

  // ----- public API -----

  function destroy() {
    if (!state) return;
    var s = state;
    state = null;
    s.cleanups.forEach(function (fn) { fn(); });
    s.touched.forEach(function (el) {
      var orig = el.__lpOrig || {};
      Object.keys(orig).forEach(function (p) {
        if (orig[p]) el.style.setProperty(p, orig[p]);
        else el.style.removeProperty(p);
      });
      delete el.__lpOrig;
    });
    qsa(s.doc, '.lp-in').forEach(function (el) { el.classList.remove('lp-in'); });
    if (!s.hadJs) s.doc.documentElement.classList.remove('lp-js');
  }

  function init(root) {
    destroy();
    var doc = root && root.ownerDocument ? root.ownerDocument : root || document;
    var win = doc.defaultView;
    state = { doc: doc, cleanups: [], touched: [], hadJs: doc.documentElement.classList.contains('lp-js') };
    doc.documentElement.classList.add('lp-js');
    setupEntrance(doc, win);
    setupEffects(doc, win);
    setupScroll(doc, win);
    setupLoops(doc);
  }

  // Editor only: replay one element's entrance animation.
  function replay(el) {
    var doc = el.ownerDocument;
    var root = doc.documentElement;
    var hadJs = root.classList.contains('lp-js');
    var previous = el.style.getPropertyValue('transition');
    root.classList.add('lp-js');
    el.style.setProperty('transition', 'none');
    el.style.setProperty('--lp-dist', num(el.getAttribute('data-enter-distance'), 40) + 'px');
    el.classList.remove('lp-in');
    void el.offsetWidth;
    el.style.setProperty('transition', entranceTransition(el));
    doc.defaultView.requestAnimationFrame(function () {
      doc.defaultView.requestAnimationFrame(function () { el.classList.add('lp-in'); });
    });
    var total = (num(el.getAttribute('data-enter-duration'), 0.8) + num(el.getAttribute('data-enter-delay'), 0)) * 1000 + 250;
    setTimeout(function () {
      if (previous) el.style.setProperty('transition', previous);
      else el.style.removeProperty('transition');
      el.style.removeProperty('--lp-dist');
      el.classList.remove('lp-in');
      if (!hadJs && !state) root.classList.remove('lp-js');
    }, total);
  }

  global.LPMotion = { init: init, destroy: destroy, replay: replay };
})(window);
