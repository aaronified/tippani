#!/usr/bin/env node
// Generates docs/ui-glossary.html.
//
// WHY THIS EXISTS. The page used to be 149 entries of hand-written HTML that nothing
// could check, and it rotted exactly the way hand-written documentation rots: it went
// on offering a "Paper / Film aesthetic" toggle for a whole release after v3 deleted
// aesthetics, driving a `data-aesthetic` attribute that appears zero times in
// index.css. A control that does nothing, in the one document whose job is to say what
// the controls are. Nobody was careless; there was simply no mechanism.
//
// So the page is now generated, and the three things it used to restate from memory it
// now reads from the code that defines them:
//
//   - the ENTRIES come from scripts/glossary/catalogue.js and from the `glossary`
//     declarations beside the components themselves;
//   - the RULES section comes from src/tokens.js, so a constant cannot be retyped;
//   - the THEME DATA comes from running theme.js's own applyTheme() in a jsdom
//     document and capturing the custom properties it actually sets. Not a mirror of
//     theme.js — theme.js's own output. That is the part that could never drift again,
//     because there is nothing here to keep in step.
//
// HOW IT LOADS THE APP. `ui.jsx` cannot be imported by bare node: api.js reads
// import.meta.env at module scope and i18n.js imports .txt with `?raw`, so almost the
// whole tree needs Vite. It also cannot be imported without a DOM, because theme.js
// calls window.matchMedia at import time — the same reason test/setup-dom.js patches
// it. So: jsdom globals first, then Vite's SSR loader, then react-dom/server imported
// NATIVELY rather than through Vite, which mangles its CJS entry.
//
//   node scripts/glossary-build.mjs           write docs/ui-glossary.html
//   node scripts/glossary-build.mjs --check    exit 1 if it is out of date (CI)
//
// Run it from web/frontend (npm run glossary / make glossary) — it needs this
// package's node_modules, which is why it does not live in the repo-root scripts/
// directory beside the dependency-free ones.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND = join(HERE, '..')
const ROOT = join(FRONTEND, '..', '..')
const PAGE = join(ROOT, 'docs', 'ui-glossary.html')
const ASSETS = join(ROOT, 'web', 'dist', 'assets')
const CHECK = process.argv.includes('--check')

const fail = (msg) => { console.error(`glossary-build: ${msg}`); process.exit(1) }

// ---- 1. a DOM, before anything imports theme.js -----------------------------
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>',
  { pretendToBeVisual: true, url: 'http://localhost/' })
const w = dom.window
// jsdom has no matchMedia and theme.js calls it at import time. Same patch, same
// reason, as test/setup-dom.js.
if (!w.matchMedia) {
  w.matchMedia = (media) => ({ matches: false, media, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })
}
// Node 22 makes globalThis.navigator getter-only, so a plain assignment throws.
const put = (k, v) => {
  try { globalThis[k] = v } catch { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }) }
}
put('window', w); put('document', w.document); put('navigator', w.navigator)
for (const k of ['HTMLElement', 'Element', 'Node', 'SVGElement', 'getComputedStyle', 'matchMedia',
  'localStorage', 'sessionStorage', 'requestAnimationFrame', 'cancelAnimationFrame',
  'CustomEvent', 'Event', 'DOMParser', 'Image']) put(k, w[k])

// react-dom/server natively: Vite's SSR transform breaks its CJS entry ("require is
// not defined"). React itself is externalised by Vite for SSR, so the instance the
// components close over and the one here are the same module.
const React = (await import('react')).default
const { renderToStaticMarkup } = await import('react-dom/server')

// ---- 2. the app, through Vite ----------------------------------------------
const { createServer } = await import('vite')
const server = await createServer({
  configFile: join(FRONTEND, 'vite.config.js'),
  root: FRONTEND,
  server: { middlewareMode: true, watch: null },
  appType: 'custom',
  logLevel: 'error',
  // The dep scanner walks index.html into main.jsx and chokes on its JSX; nothing
  // here needs a browser bundle, only SSR.
  optimizeDeps: { noDiscovery: true, include: [] },
})

let out
try {
  const theme = await server.ssrLoadModule('/src/theme.js')
  const tokens = await server.ssrLoadModule('/src/tokens.js')
  const ui = await server.ssrLoadModule('/src/ui.jsx')
  const { SECTIONS } = await import('./glossary/catalogue.js')

  // ---- 3. the built stylesheet ---------------------------------------------
  if (!existsSync(ASSETS)) fail('web/dist/assets is missing — run `npm run build` first')
  const cssFiles = readdirSync(ASSETS).filter((f) => /^index-.*\.css$/.test(f))
  if (!cssFiles.length) fail('no web/dist/assets/index-*.css — run `npm run build` first')
  // Two means a dirty web/dist, and picking one silently is how the page ends up
  // showing CSS from a build nobody remembers making.
  if (cssFiles.length > 1) fail(`web/dist/assets holds ${cssFiles.length} index-*.css files (${cssFiles.join(', ')}) — clear web/dist and rebuild`)
  const appcss = readFileSync(join(ASSETS, cssFiles[0]), 'utf8')
    // Vite writes url(/assets/…) or url(assets/…) depending on `base`; the page is
    // served from docs/, one level up.
    .replace(/url\((["']?)\/?assets\//g, 'url($1../web/dist/assets/')

  // ---- 4. theme data, captured from theme.js's own output -------------------
  // applyTheme writes onto document.documentElement. Run it once per combination the
  // toolbar offers and keep what it wrote, so the page reproduces the app's styling
  // by replaying it rather than by reimplementing it.
  //
  // STORED AS A BASE PLUS DELTAS, because storing all 64 whole cost 151KB. Every set
  // in a given mode and accent writes the same palette; what actually changes between
  // Manuscript and Quarry is the four tile stacks and their grain sizes. So the first
  // set's output is the base for that mode+accent, and every other set keeps only the
  // declarations that differ from it. Read through the CSSOM rather than by splitting
  // the style string on `;` — a background stack holds semicolons inside url() and
  // gradients, and a naive split silently truncates the surface it was reading.
  const root = w.document.documentElement
  const setNames = Object.keys(theme.MAT_SETS)
  const accentNames = Object.keys(theme.ACCENTS)
  const declsOf = () => {
    const d = {}
    for (let i = 0; i < root.style.length; i++) {
      const prop = root.style.item(i)
      d[prop] = root.style.getPropertyValue(prop)
    }
    return d
  }
  const capture = (mode, set, accent) => {
    root.removeAttribute('style')
    theme.applyTheme({ theme: mode, materialSet: set, accent })
    return declsOf()
  }
  const themeBase = {}
  const themeDelta = {}
  for (const mode of ['light', 'dark']) {
    for (const accent of accentNames) {
      const base = capture(mode, setNames[0], accent)
      themeBase[`${mode}|${accent}`] = base
      for (const set of setNames.slice(1)) {
        const full = capture(mode, set, accent)
        const delta = {}
        for (const [k, v] of Object.entries(full)) if (base[k] !== v) delta[k] = v
        // A property the base sets and this set does not must be cleared, or a
        // Manuscript tile would survive a switch to Atrium, which has none.
        for (const k of Object.keys(base)) if (!(k in full)) delta[k] = ''
        themeDelta[`${mode}|${set}|${accent}`] = delta
      }
    }
  }
  root.removeAttribute('style')

  // ---- 5. the page ----------------------------------------------------------
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const attr = (s) => esc(s).replace(/"/g, '&quot;')

  const toolbar = () => {
    const group = (id, label, buttons) =>
      `    <span><span class="g-tlabel">${label}</span>\n      <span class="g-group" id="${id}">\n${buttons}\n      </span>\n    </span>`
    const btn = (v, text, on, extra = '') =>
      `        <button data-v="${attr(v)}"${extra} aria-pressed="${on}">${text}</button>`
    return '  <div class="g-toolbar" role="group" aria-label="Preview controls">\n' +
      group('g-theme', 'Theme',
        ['light', 'dark'].map((m, i) => btn(m, m[0].toUpperCase() + m.slice(1), i === 0)).join('\n')) + '\n' +
      // The material set replaced an "Aesthetic: Paper / Film" pair that drove
      // data-aesthetic — an attribute v3 deleted and index.css mentions zero times.
      // The names come from MAT_SETS, so an eighth set appears here by existing.
      group('g-mat', 'Material set',
        setNames.map((s, i) => btn(s, esc(s.replace(/-/g, ' ')), i === 0)).join('\n')) + '\n' +
      group('g-accent', 'Accent',
        accentNames.map((a, i) => btn(a, '', i === 0,
          ` class="g-sw" title="${attr(a)}" style="background:${theme.ACCENTS[a]}"`)).join('\n')) +
      '\n  </div>'
  }

  // AN ENTRY'S DEMO COMES FROM THE COMPONENT WHERE THE COMPONENT WILL HAVE IT.
  //
  // The link is `src`, which already reads "GhostButton — ui.jsx" on every entry that
  // documents one: the hand-written page had been naming its own source all along. So
  // there is no per-entry wiring to add and no second key to keep in step — putting a
  // `glossary` declaration on a component is the whole act, and that entry stops using
  // carried markup and starts rendering the real thing on the next build.
  //
  // Everything without one keeps the markup extracted from the old page. That is the
  // migration: it can proceed one component at a time, and glossary-registry.test.js
  // counts what is left so the number can only fall.
  const liveOf = (e) => {
    const m = /^([A-Z][A-Za-z0-9_]*)\b/.exec(String(e.src || ''))
    const C = m && ui[m[1]]
    return C && C.glossary && typeof C.glossary.demo === 'function' ? C : null
  }
  const renderEntry = (e) => {
    let demo = ''
    const live = liveOf(e)
    if (live) {
      demo = renderToStaticMarkup(live.glossary.demo(React.createElement, ui))
    } else if (e.html != null) {
      demo = e.html
    }
    const cls = e.demoClass || 'g-demo'
    const at = e.demoAttrs ? ' ' + e.demoAttrs : ''
    const parts = []
    if (demo) parts.push(`        <div class="${cls}"${at}>${demo}</div>`)
    parts.push(`        <div class="g-name">${e.name}</div>`)
    if (e.src) parts.push(`        <div class="g-src">${e.src}</div>`)
    if (e.desc) parts.push(`        <div class="g-desc">${e.desc}</div>`)
    return `      <div class="g-item${e.wide ? ' wide' : ''}">\n${parts.join('\n')}\n      </div>`
  }

  const renderSection = (s) =>
    `  <section class="g-section">\n    <h2>${s.title}</h2>\n` +
    (s.lede ? `    <p>${s.lede}</p>\n` : '') +
    `    <div class="g-grid">\n${s.entries.map(renderEntry).join('\n')}\n    </div>\n  </section>`

  // The rules section, written from tokens.js. This is the half of the page that used
  // to be a paragraph somebody typed a number into.
  const rulesSection = () => {
    const rows = Object.entries(tokens.GEOMETRY).map(([, t]) =>
      `      <div class="g-item">\n        <div class="g-name"><code>${esc(t.value)}</code></div>\n` +
      `        <div class="g-desc">${esc(t.of)}</div>\n      </div>`).join('\n')
    const ink = tokens.INK_ROLES.map(([token, of]) =>
      `      <div class="g-item">\n        <div class="g-name"><code>${esc(token)}</code></div>\n` +
      `        <div class="g-desc">${esc(of)}</div>\n      </div>`).join('\n')
    return '  <section class="g-section">\n    <h2>The rules that are not components</h2>\n' +
      '    <p>Constants and ink roles, read from <code>src/tokens.js</code> rather than restated here. ' +
      'A number typed into a screen instead of taken from there is a bug, not a decision — ' +
      'and <code>tokens.test.js</code> fails when one of these stops matching the stylesheet.</p>\n' +
      `    <div class="g-grid">\n${rows}\n${ink}\n    </div>\n  </section>`
  }

  const pageScript = `<script>
  // Theme data captured from theme.js's own applyTheme() at build time — not a mirror
  // of it. Each value is the exact style attribute the app sets for that combination,
  // so this page cannot disagree with the app about what a material set looks like.
  const BASE = ${JSON.stringify(themeBase)};
  const DELTA = ${JSON.stringify(themeDelta)};
  const FIRST_SET = ${JSON.stringify(setNames[0])};
  const state = { mode: 'light', mat: FIRST_SET, accent: ${JSON.stringify(accentNames[0])} };
  const root = document.documentElement;
  function apply() {
    const base = BASE[state.mode + '|' + state.accent] || {};
    const delta = state.mat === FIRST_SET ? {} : (DELTA[state.mode + '|' + state.mat + '|' + state.accent] || {});
    root.removeAttribute('style');
    for (const k in base) if (!(k in delta)) root.style.setProperty(k, base[k]);
    for (const k in delta) if (delta[k] !== '') root.style.setProperty(k, delta[k]);
    root.dataset.theme = state.mode;
    root.dataset.matSet = state.mat;
  }
  function wire(id, key) {
    const box = document.getElementById(id);
    if (!box) return;
    box.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-v]');
      if (!b) return;
      state[key] = b.dataset.v;
      for (const other of box.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === b));
      apply();
    });
  }
  wire('g-theme', 'mode'); wire('g-mat', 'mat'); wire('g-accent', 'accent');
  apply();
<\/script>`

  const template = readFileSync(join(HERE, 'glossary', 'template.html'), 'utf8')
  out = template
    .replace('<style id="appcss">/*APPCSS*/</style>', () => `<style id="appcss">${appcss}</style>`)
    .replace('  <!--TOOLBAR-->', () => toolbar())
    .replace('  <!--SECTIONS-->', () => [...SECTIONS.map(renderSection), rulesSection()].join('\n\n'))
    .replace('<!--SCRIPT-->', () => pageScript)

  for (const marker of ['/*APPCSS*/', '<!--TOOLBAR-->', '<!--SECTIONS-->', '<!--SCRIPT-->']) {
    if (out.includes(marker)) fail(`template marker ${marker} was not replaced`)
  }
} finally {
  await server.close()
}

const current = existsSync(PAGE) ? readFileSync(PAGE, 'utf8') : ''
if (CHECK) {
  if (current !== out) fail('docs/ui-glossary.html is out of date — run `make glossary`')
  console.log('glossary-build: docs/ui-glossary.html is up to date')
} else {
  writeFileSync(PAGE, out)
  const entries = (out.match(/class="g-name"/g) || []).length
  console.log(`glossary-build: wrote docs/ui-glossary.html — ${entries} entries, ${(out.length / 1024).toFixed(0)}KB`)
}
