// Site Analyzer: lets the user analyze an external site's design system (colors, fonts,
// spacing, buttons) and save it as a profile. The active profile is attached to AI prompts
// so generated pages match the analyzed site's look and feel.

export function initAnalyzer({ pane, dialog, onProfileChange }) {
  let profiles = [];
  let activeProfile = null; // the currently selected profile (full object)
  let activeProfileName = localStorage.getItem('landing-builder:design-profile') || '';

  // ---------- helpers ----------

  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    el.append(...kids.flat().filter((x) => x != null));
    return el;
  }

  const json = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };

  // ---------- API ----------

  async function loadProfiles() {
    try {
      const data = await json('/api/design-profiles');
      profiles = data.profiles || [];
    } catch {
      profiles = [];
    }
    // Restore the active profile if one was saved.
    if (activeProfileName && profiles.some((p) => p.name === activeProfileName)) {
      try {
        const data = await json(`/api/design-profiles/${encodeURIComponent(activeProfileName)}`);
        activeProfile = data.profile;
        onProfileChange(activeProfile);
      } catch {
        activeProfile = null;
        activeProfileName = '';
      }
    } else {
      activeProfile = null;
      activeProfileName = '';
    }
    render();
  }

  async function selectProfile(name) {
    if (!name) {
      activeProfile = null;
      activeProfileName = '';
      localStorage.removeItem('landing-builder:design-profile');
      onProfileChange(null);
      render();
      return;
    }
    try {
      const data = await json(`/api/design-profiles/${encodeURIComponent(name)}`);
      activeProfile = data.profile;
      activeProfileName = name;
      localStorage.setItem('landing-builder:design-profile', name);
      onProfileChange(activeProfile);
    } catch {
      activeProfile = null;
      activeProfileName = '';
    }
    render();
  }

  async function deleteProfile(name) {
    if (!confirm(`Delete the design profile "${name}"?`)) return;
    try {
      await json(`/api/design-profiles/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (activeProfileName === name) await selectProfile('');
      await loadProfiles();
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------- panel rendering ----------

  function render() {
    pane.replaceChildren(
      h('div', { class: 'pane-head' },
        h('h2', { text: 'Site Analyzer' }),
        h('button', { type: 'button', class: 'tb-btn primary', text: '+ Analyze a site', onclick: openAnalyzeDialog }),
      ),
      renderActiveProfile(),
      renderProfilesList(),
    );
  }

  function renderActiveProfile() {
    if (!activeProfile) {
      return h('div', { class: 'sa-empty' },
        h('p', { text: 'No design profile active. Analyze a site or select a saved profile to guide the AI designer.' }),
      );
    }
    return h('div', { class: 'sa-active' },
      h('div', { class: 'sa-active-head' },
        h('b', { text: activeProfile.name }),
        h('span', { class: 'sa-url', text: activeProfile.url }),
        h('button', { type: 'button', class: 'sa-remove', text: '✕', title: 'Deactivate this profile', onclick: () => selectProfile('') }),
      ),
      renderProfilePreview(activeProfile),
    );
  }

  function renderProfilePreview(profile) {
    const c = profile.colors || {};
    const f = profile.fonts || {};
    const b = profile.buttons || {};
    const t = profile.typography || {};
    const s = profile.spacing || {};
    const comp = profile.components || {};
    const responsive = profile.responsive || {};
    const confidence = Math.round((profile.confidence?.overall || 0) * 100);
    const sourceLabel = profile.source === 'browser'
      ? 'Rendered browser analysis'
      : profile.source === 'css'
        ? 'CSS fallback analysis'
        : 'Saved profile';
    const chips = (...items) => h('div', { class: 'sa-detail' }, ...items.filter(Boolean));
    const nav = comp.nav;
    const hero = comp.hero;
    const grid = (comp.grids || [])[0];
    const footer = comp.footer;

    return h('div', { class: 'sa-preview' },
      h('div', { class: 'sa-section' },
        h('label', { text: 'Analysis' }),
        chips(
          h('span', { text: sourceLabel }),
          confidence ? h('span', { text: `${confidence}% confidence` }) : null,
          profile.counts?.headings ? h('span', { text: `${profile.counts.headings} headings` }) : null,
          profile.counts?.buttons ? h('span', { text: `${profile.counts.buttons} buttons` }) : null,
        ),
        profile.warnings?.length ? h('p', { class: 'sa-warning', text: profile.warnings[0] }) : null,
      ),
      h('div', { class: 'sa-section' },
        h('label', { text: 'Colors' }),
        h('div', { class: 'sa-swatches' },
          ...(c.palette || []).slice(0, 12).map((hex) =>
            h('div', { class: 'sa-swatch', style: `background:${hex}`, title: hex }),
          ),
        ),
        h('div', { class: 'sa-color-roles' },
          colorTag('Primary', c.primary),
          colorTag('Secondary', c.secondary),
          colorTag('Accent', c.accent),
          colorTag('Background', c.background),
          colorTag('Text', c.text),
        ),
      ),
      (f.heading || f.body || t.scale?.length) ? h('div', { class: 'sa-section' },
        h('label', { text: 'Typography' }),
        f.heading ? h('div', { class: 'sa-font' }, h('span', { text: 'Heading:' }), h('b', { text: f.heading })) : null,
        f.body ? h('div', { class: 'sa-font' }, h('span', { text: 'Body:' }), h('b', { text: f.body })) : null,
        t.scale?.length ? chips(...t.scale.slice(0, 8).map((size) => h('span', { text: size }))) : null,
        t.lineHeight ? chips(h('span', { text: `Line height ${t.lineHeight}` })) : null,
      ) : null,
      (s.sectionPadding || s.containerMaxWidth || s.elementGap || s.scale?.length) ? h('div', { class: 'sa-section' },
        h('label', { text: 'Spacing' }),
        chips(
          s.sectionPadding ? h('span', { text: `Section ${s.sectionPadding}` }) : null,
          s.containerMaxWidth ? h('span', { text: `Container ${s.containerMaxWidth}` }) : null,
          s.elementGap ? h('span', { text: `Gap ${s.elementGap}` }) : null,
        ),
        s.scale?.length ? chips(...s.scale.slice(0, 8).map((size) => h('span', { text: size }))) : null,
      ) : null,
      b.style ? h('div', { class: 'sa-section' },
        h('label', { text: 'Buttons' }),
        chips(
          b.style ? h('span', { text: `Style: ${b.style}` }) : null,
          b.borderRadius ? h('span', { text: `Radius: ${b.borderRadius}` }) : null,
          b.fontWeight ? h('span', { text: `Weight: ${b.fontWeight}` }) : null,
          b.variants?.length ? h('span', { text: `${b.variants.length} variants` }) : null,
        ),
      ) : null,
      (nav || hero || grid || footer) ? h('div', { class: 'sa-section' },
        h('label', { text: 'Layout' }),
        chips(
          nav ? h('span', { text: `Nav: ${nav.display}${nav.sticky ? ' · sticky' : ''} · ${nav.links} links` }) : null,
          hero ? h('span', { text: `Hero: ${hero.layout || hero.display}${hero.hasImage ? ' · image' : ''}` }) : null,
          grid ? h('span', { text: `Grid: ${grid.columns} col · ${grid.gap || 'no gap'}` }) : null,
          footer ? h('span', { text: `Footer: ${footer.columns} col` }) : null,
        ),
      ) : null,
      (responsive.desktop || responsive.tablet || responsive.mobile) ? h('div', { class: 'sa-section' },
        h('label', { text: 'Responsive' }),
        chips(
          ...['desktop', 'tablet', 'mobile'].map((name) => {
            const view = responsive[name];
            return view ? h('span', { text: `${name}: ${view.navDisplay || 'nav'} · h1 ${view.h1Size || '-'} · ${view.gridColumns || 0} col` }) : null;
          }),
        ),
      ) : null,
      profile.general?.borderRadius ? h('div', { class: 'sa-section' },
        h('label', { text: 'General' }),
        chips(
          profile.general.borderRadius ? h('span', { text: `Border radius: ${profile.general.borderRadius}` }) : null,
          profile.general.lineHeight ? h('span', { text: `Line height: ${profile.general.lineHeight}` }) : null,
          profile.general.boxShadow ? h('span', { text: 'Shadow' }) : null,
        ),
      ) : null,
    );
  }

  function colorTag(label, hex) {
    if (!hex) return null;
    return h('div', { class: 'sa-color-tag' },
      h('div', { class: 'sa-swatch-sm', style: `background:${hex}` }),
      h('span', { text: label }),
      h('code', { text: hex }),
    );
  }

  function renderProfilesList() {
    if (!profiles.length) return h('div');
    return h('div', { class: 'sa-profiles' },
      h('label', { text: 'Saved profiles' }),
      h('ul', { class: 'sa-list' },
        ...profiles.map((p) =>
          h('li', { class: `sa-item${p.name === activeProfileName ? ' on' : ''}` },
            h('button', { type: 'button', class: 'sa-item-name', onclick: () => selectProfile(p.name) },
              h('b', { text: p.name }),
              h('span', { class: 'sa-url', text: p.url }),
            ),
            h('button', { type: 'button', class: 'sa-item-del', title: 'Delete', text: '✕', onclick: () => deleteProfile(p.name) }),
          ),
        ),
      ),
    );
  }

  // ---------- analyze dialog ----------

  function openAnalyzeDialog() {
    dialog.replaceChildren();
    let analyzed = null;
    const urlInput = h('input', { type: 'url', id: 'sa-url', autocomplete: 'off', placeholder: 'https://example.com', required: true });
    const nameInput = h('input', { type: 'text', id: 'sa-name', autocomplete: 'off', placeholder: 'e.g. stripe-style' });
    const status = h('p', { class: 'sa-dialog-status', role: 'status' });
    const previewBox = h('div', { class: 'sa-dialog-preview' });
    const saveBtn = h('button', { type: 'submit', class: 'primary', text: 'Save profile', disabled: true });

    const say = (text, bad) => {
      status.textContent = text;
      status.className = `sa-dialog-status ${bad ? 'bad' : ''}`;
    };

    const analyzeBtn = h('button', { type: 'button', class: 'primary', text: 'Analyze', onclick: async () => {
      const url = urlInput.value.trim();
      if (!url) return say('Enter a URL first.', true);
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Analyzing…';
      say('Fetching and analyzing the site…');
      previewBox.replaceChildren();
      try {
        const data = await json('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        analyzed = data.profile;
        const confidence = Math.round((analyzed.confidence?.overall || 0) * 100);
        const mode = analyzed.source === 'browser' ? 'Rendered analysis' : analyzed.source === 'css' ? 'CSS fallback' : 'Analysis';
        say(`${mode} complete${confidence ? ` (${confidence}% confidence)` : ''}. Review the results and save the profile.`);
        previewBox.replaceChildren(renderProfilePreview(analyzed));
        // Suggest a name from the URL.
        if (!nameInput.value) {
          try {
            nameInput.value = new URL(analyzed.url).hostname.replace(/^www\./, '').replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40);
          } catch { /* keep empty */ }
        }
        saveBtn.disabled = false;
      } catch (err) {
        analyzed = null;
        say(err.message, true);
        saveBtn.disabled = true;
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze';
      }
    }});

    const formEl = h('form', { method: 'dialog', onsubmit: async (e) => {
      e.preventDefault();
      if (!analyzed) return;
      const name = nameInput.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
      if (!name) return say('Enter a name for this profile.', true);
      try {
        await json(`/api/design-profiles/${encodeURIComponent(name)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(analyzed),
        });
        await loadProfiles();
        await selectProfile(name);
        dialog.close();
      } catch (err) {
        say(err.message, true);
      }
    }},
      h('h2', { text: 'Analyze a website' }),
      h('p', { class: 'hint', text: 'Enter a website URL to render it and extract its design system: colors, fonts, spacing, buttons, layout, and responsive behavior. The profile will guide the AI to match that look.' }),
      h('label', { for: 'sa-url', text: 'Website URL' }),
      h('div', { class: 'sa-url-row' }, urlInput, analyzeBtn),
      status,
      previewBox,
      h('label', { for: 'sa-name', text: 'Profile name' }),
      nameInput,
      h('div', { class: 'dialog-actions' },
        h('button', { type: 'button', text: 'Cancel', onclick: () => dialog.close() }),
        saveBtn,
      ),
    );

    dialog.append(formEl);
    dialog.showModal();
    urlInput.focus();
  }

  // ---------- public API ----------

  render();
  loadProfiles();

  return {
    getActiveProfile: () => activeProfile,
    refresh: loadProfiles,
    open: openAnalyzeDialog,
  };
}

// ---------- design profile → AI prompt section ----------

// Converts a design profile into the MANDATORY override block prepended to the AI system prompt.
export function profileToPrompt(profile) {
  if (!profile) return '';

  const c = profile.colors || {};
  const f = profile.fonts || {};
  const b = profile.buttons || {};
  const g = profile.general || {};
  const s = profile.spacing || {};

  const GENERIC = /^(inherit|initial|unset|revert|revert-layer|serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|BlinkMacSystemFont|Segoe UI|ui-sans-serif|ui-serif|ui-monospace)$/i;
  const cleanFont = (value) => String(value || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  const isRealFont = (value) => !!value && !/^var\(/i.test(value) && !GENERIC.test(value) && !/icon/i.test(value);
  const detected = (Array.isArray(f.all) ? f.all : []).map(cleanFont).filter(isRealFont);
  const pickFont = (value, avoid, fallback) => {
    const own = cleanFont(value);
    if (isRealFont(own)) return own;
    return detected.find((font) => font !== avoid) || avoid || fallback;
  };
  const escapeFont = (value) => String(value).replace(/'/g, "\\'");
  const headingFont = pickFont(f.heading, '', 'Bricolage Grotesque');
  const bodyFont = pickFont(f.body, headingFont, 'Figtree');

  const validColor = (value) => /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(String(value || '').trim()) ? String(value).trim() : '';
  const validGradient = (value) => {
    const text = String(value || '').trim();
    return /^(linear|radial|conic)-gradient\(/i.test(text) && !/url\s*\(/i.test(text) && !/[;{}]/.test(text) ? text : '';
  };
  const validShadow = (value) => {
    const text = String(value || '').trim();
    return text && text !== 'none' && !/[;{}]/.test(text) && !/url\s*\(/i.test(text) ? text : '';
  };
  const primary = validColor(c.primary);
  const secondary = validColor(c.secondary);
  const accent = validColor(c.accent);
  const background = validColor(c.background);
  const surface = validColor(c.surface);
  const text = validColor(c.text);
  const textMuted = validColor(c.textMuted);
  const buttonColor = validColor(b.color);
  const buttonGradient = validGradient(b.backgroundImage);
  const hero = profile.components?.hero || {};
  const nav = profile.components?.nav || {};
  const heroGradient = validGradient(hero.overlayImage) || validGradient(hero.backgroundImage);
  const heroText = validColor(hero.headingColor);
  const heroBg = validColor(hero.overlayColor);
  const navGradient = validGradient(nav.backgroundImage);
  const navShadow = validShadow(nav.shadow);
  const ghost = b.ghost || {};
  const ghostBg = validColor(ghost.bg);
  const ghostColor = validColor(ghost.color);
  const ghostBorder = validColor(ghost.border);
  const buttonShadow = validShadow(b.boxShadow);
  const headingWeight = /^[1-9]00$/.test(String(profile.typography?.weights?.heading || ''))
    ? profile.typography.weights.heading
    : '';

  const size = (value, min = 0, max = 2000) => {
    const m = /^(\d+(?:\.\d+)?)(px|rem|em|%)?$/i.exec(String(value || '').trim());
    if (!m) return '';
    const n = parseFloat(m[1]);
    return Number.isFinite(n) && n >= min && n <= max ? `${m[1]}${m[2] || 'px'}` : '';
  };
  const darken = (hex) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '';
    const n = parseInt(m[1], 16);
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => Math.max(0, Math.round(v * 0.82)).toString(16).padStart(2, '0'))
      .join('');
  };
  const luminance = (hex) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 1;
    const n = parseInt(m[1], 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };

  const radius = size(g.borderRadius, 0, 64);
  const buttonRadius = b.style === 'pill' ? '999px' : size(b.borderRadius, 0, 64);
  const maxWidth = size(s.containerMaxWidth, 800, 1600);
  const sectionPadding = size(s.sectionPadding, 16, 240);
  const buttonPadding = /^\S+\s+\S+$/.test(String(b.padding || '').trim()) && !/^\.25rem/i.test(String(b.padding).trim())
    ? String(b.padding).trim()
    : '';

  const css = [':root {'];
  if (primary) css.push(`  --lp-primary: ${primary};`);
  const primaryDark = primary
    ? (secondary && luminance(secondary) < luminance(primary) ? secondary : darken(primary))
    : '';
  if (primaryDark) css.push(`  --lp-primary-dark: ${primaryDark};`);
  if (accent) css.push(`  --lp-accent: ${accent};`);
  if (surface) css.push(`  --lp-primary-soft: ${surface};`);
  if (text) css.push(`  --lp-ink: ${text};`);
  if (text) css.push(`  --lp-text: ${text};`);
  if (textMuted) css.push(`  --lp-muted: ${textMuted};`);
  if (background) css.push(`  --lp-paper: ${background};`);
  if (surface) css.push(`  --lp-mist: ${surface};`);
  css.push(`  --lp-font-head: '${escapeFont(headingFont)}', sans-serif;`);
  css.push(`  --lp-font-body: '${escapeFont(bodyFont)}', sans-serif;`);
  if (radius) css.push(`  --lp-radius: ${radius};`);
  if (maxWidth) css.push(`  --lp-max: ${maxWidth};`);
  css.push('}');

  if (background) css.push(`body { background: ${background}; }`);
  if (text) css.push(`body { color: ${text}; }`);
  css.push('h1, h2, h3, h4 { font-family: var(--lp-font-head); }');
  css.push('body, p, li, section, footer { font-family: var(--lp-font-body); }');
  if (background) css.push(`.lp-navbar, .lp-section:not(.lp-dark):not(.lp-tint) { background: ${background}; }`);
  if (navGradient) {
    const props = [`background-image: ${navGradient};`];
    if (navShadow) props.push(`box-shadow: ${navShadow};`);
    css.push(`.lp-navbar { ${props.join(' ')} }`);
  }
  if (surface) css.push(`.lp-card, .lp-tint { background: ${surface}; }`);
  if (heroGradient) {
    const props = [
      `background-image: ${heroGradient};`,
      `background-color: ${heroBg || 'transparent'};`,
    ];
    if (heroText) props.push(`color: ${heroText};`);
    css.push(`.lp-hero.lp-section:not(.lp-hero-dark) { ${props.join(' ')} }`);
    if (heroText) {
      css.push(`.lp-hero .lp-lead, .lp-hero p, .lp-hero .lp-note { color: ${heroText}; opacity: .82; }`);
    }
    if (headingWeight) css.push(`.lp-hero h1 { font-weight: ${headingWeight}; }`);
  }

  const buttonCss = [];
  if (buttonRadius) buttonCss.push(`border-radius: ${buttonRadius};`);
  if (buttonPadding) buttonCss.push(`padding: ${buttonPadding};`);
  if (b.fontWeight) buttonCss.push(`font-weight: ${b.fontWeight};`);
  if (b.textTransform && b.textTransform !== 'none') buttonCss.push(`text-transform: ${b.textTransform};`);
  if (buttonCss.length) css.push(`.lp-btn { ${buttonCss.join(' ')} }`);
  if (buttonGradient) {
    const props = [
      `background-image: ${buttonGradient};`,
      'background-color: transparent;',
      'border-color: transparent;',
    ];
    if (buttonColor) props.push(`color: ${buttonColor};`);
    if (buttonShadow) props.push(`box-shadow: ${buttonShadow};`);
    css.push(`.lp-btn-primary { ${props.join(' ')} }`);
  } else if (primary) {
    const props = [`background: ${primary};`, `border-color: ${primary};`];
    if (buttonColor) props.push(`color: ${buttonColor};`);
    if (buttonShadow) props.push(`box-shadow: ${buttonShadow};`);
    css.push(`.lp-btn-primary { ${props.join(' ')} }`);
  }
  if (ghostBg || ghostColor) {
    const props = [];
    if (ghostBg) props.push(`background: ${ghostBg};`);
    if (ghostColor) props.push(`color: ${ghostColor};`);
    if (ghostBorder) props.push(`border-color: ${ghostBorder};`);
    css.push(`.lp-btn-ghost { ${props.join(' ')} }`);
  } else if (secondary) {
    css.push(`.lp-btn-ghost { color: ${secondary}; border-color: ${secondary}; }`);
  }
  if (sectionPadding) css.push(`.lp-section { padding-top: ${sectionPadding}; padding-bottom: ${sectionPadding}; }`);

  const lines = [
    '# ⚠ MANDATORY REFERENCE DESIGN SYSTEM — READ THIS FIRST',
    `The user has provided a reference design profile extracted from: ${profile.url}`,
    'The page you generate MUST use the colors, fonts and button shapes below.',
    'Keep the builder classes (lp-*) so the layout and responsiveness keep working, but override their design tokens with the css block provided here.',
    'These overrides take priority over the default palette described later in this prompt.',
    '',
    '## Reference tokens',
  ];

  if (background) lines.push(`- Page background: ${background}`);
  if (surface) lines.push(`- Card / tinted surface: ${surface}`);
  if (text) lines.push(`- Headings / dark text: ${text}`);
  if (textMuted) lines.push(`- Body / muted text: ${textMuted}`);
  if (primary) lines.push(`- Primary brand / CTA: ${primary}`);
  if (secondary) lines.push(`- Secondary accent: ${secondary}`);
  if (accent) lines.push(`- Highlight accent: ${accent}`);
  lines.push(`- Heading font: ${headingFont}`);
  lines.push(`- Body font: ${bodyFont}`);
  if (buttonRadius) lines.push(`- Button radius: ${buttonRadius}`);
  if (buttonPadding) lines.push(`- Button padding: ${buttonPadding}`);
  if (b.fontWeight) lines.push(`- Button weight: ${b.fontWeight}`);
  if (b.textTransform && b.textTransform !== 'none') lines.push(`- Button text transform: ${b.textTransform}`);
  if (buttonGradient) lines.push('- Primary CTA: use the reference gradient fill and shadow.');
  if (heroGradient) lines.push('- Hero background: use the reference gradient wash.');
  if (radius) lines.push(`- Card / element radius: ${radius}`);
  if (maxWidth) lines.push(`- Container max-width: ${maxWidth}`);
  const typography = profile.typography || {};
  const typeScale = Array.isArray(typography.scale) ? typography.scale.map((value) => size(value, 8, 240)).filter(Boolean).slice(0, 8) : [];
  if (typeScale.length) lines.push(`- Type scale: ${typeScale.join(', ')}`);
  if (typography.weights?.heading) lines.push(`- Heading weight: ${typography.weights.heading}`);
  if (heroText) lines.push(`- Hero text color: ${heroText}`);
  if (typography.weights?.body) lines.push(`- Body weight: ${typography.weights.body}`);
  if (/^\d+(\.\d+)?(px|rem|em|%)?$/.test(String(typography.lineHeight || ''))) {
    lines.push(`- Body line-height: ${typography.lineHeight}`);
  }
  const spacingScale = Array.isArray(s.scale) ? s.scale.map((value) => size(value, 0, 240)).filter(Boolean).slice(0, 8) : [];
  if (spacingScale.length) lines.push(`- Spacing scale: ${spacingScale.join(', ')}`);
  lines.push('');

  lines.push('## Required css block (copy it exactly into the css block of your answer)');
  lines.push('```css');
  lines.push(...css);
  lines.push('```');
  lines.push('');

  const comp = profile.components || {};
  const responsive = profile.responsive || {};
  const layoutHints = [];
  if (comp.nav) {
    layoutHints.push(`- Navigation: ${comp.nav.display}${comp.nav.sticky ? ', sticky' : ''}, ${comp.nav.links || 0} links.`);
  }
  if (comp.hero) {
    layoutHints.push(`- Hero: ${comp.hero.layout || comp.hero.display}${comp.hero.hasImage ? ', with visual' : ''}, ${comp.hero.align || 'start'}-aligned.`);
  }
  const grid = (comp.grids || [])[0];
  if (grid) layoutHints.push(`- Section grid: ${grid.columns || 1} columns${grid.gap ? `, ${grid.gap} gap` : ''}.`);
  if (comp.cards?.length) {
    const card = comp.cards[0];
    layoutHints.push(`- Cards: ${comp.cards.length} sampled, ${card.cols || 1} columns, ${card.radius || 'square'} radius${card.shadow ? ', shadowed' : ''}.`);
  }
  if (comp.footer) layoutHints.push(`- Footer: ${comp.footer.columns || 1} columns.`);
  if (responsive.mobile) {
    layoutHints.push(`- Mobile: navigation ${responsive.mobile.navDisplay || 'unchanged'}, h1 ${responsive.mobile.h1Size || 'unchanged'}, ${responsive.mobile.gridColumns || 0} grid columns.`);
  }
  if (layoutHints.length) {
    lines.push('## Reference layout cues');
    lines.push(...layoutHints);
    lines.push('Reuse this section rhythm and component language without copying the reference site verbatim.');
    lines.push('');
  }

  lines.push([
    '## Implementation instructions',
    '1. Return the html block first, then ONE css block containing the required token overrides above. The css block is mandatory.',
    '2. Use the existing lp-* classes for layout; do not switch to a different component library.',
    '3. Add inline styles only where a single element needs a special color or background. The css block must do the main theming.',
    '4. Every section, card and button must visibly use the reference palette and typefaces.',
    '5. The finished page must look like it belongs to the brand of the reference site.',
  ].join('\n'));

  return lines.join('\n');
}
