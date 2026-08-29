// Can the words be read? — every ink, on every paper, in every skin.
//
// The third of the readability family. quote-image-readability.test.jsx
// rasterises the share card and measures the pixels; surface-readability
// composites the TEXTURED fills and measures those. This one covers the rest of
// the interface — the buttons and the type — where the paper is a colour rather
// than a photograph or a tile, and where the failure is a token pair nobody ever
// multiplied out: four accents times two modes times seven material sets is
// fifty-six skins, and a pair chosen by eye was chosen in one of them.
//
// WHAT IT CAN AND CANNOT SEE, stated plainly because a green test that measures
// the wrong thing is worse than no test. It reads the tokens off the DOM after
// applyTheme, so it sees what theme.js actually computes — including the
// accent-dependent --on-accent, which is the pair most likely to be wrong. It
// does NOT read index.css to discover which ink meets which paper: that
// inventory is written down below, and a control that changes its colours
// without updating its row here will pass while being wrong. That is the same
// bargain the UI glossary makes, and the reason each row cites its rule.
//
// TWO SIZES OF RUN. The default is the sample — one row per KIND of thing, which
// is what runs before a commit. TIPPANI_FULL_A11Y=1 adds every remaining row and
// every state (hover, disabled, pressed). Both measure the same way; the full
// one just costs more to read when it fails.

import { describe, expect, it } from 'vitest'
import { ACCENTS, MAT_SETS, applyTheme } from '../../src/theme.js'

const FULL = !!process.env.TIPPANI_FULL_A11Y

// ---- colour ----------------------------------------------------------------

const srgb = (v) => {
  v /= 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const relLum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
const wcag = (a, b) => {
  const [x, y] = [relLum(a), relLum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// A token as the browser would have resolved it. Handles the three shapes the
// palettes and theme.js actually produce — #rrggbb, rgba(), and the nested
// color-mix() theme.js writes for the dark accent — and throws on anything else
// rather than guessing, because a silently mis-parsed colour is a wrong number
// with a green tick beside it.
function parse(value, tokens) {
  const v = String(value).trim()
  if (v.startsWith('var(')) return parse(tokens[v.slice(4, -1).replace(/^--/, '')], tokens)
  if (v.startsWith('#')) {
    const h = v.length === 4 ? v.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : v
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  }
  const rgba = v.match(/^rgba?\(([^)]+)\)$/)
  if (rgba) {
    const p = rgba[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    return p.slice(0, 3)
  }
  const mix = v.match(/^color-mix\(in [a-z]+,\s*(.+)\)$/)
  if (mix) {
    // "A, B p%" or "A p%, B" — split on the top-level comma.
    let depth = 0
    let cut = -1
    for (let i = 0; i < mix[1].length; i++) {
      if (mix[1][i] === '(') depth++
      else if (mix[1][i] === ')') depth--
      else if (mix[1][i] === ',' && depth === 0) { cut = i; break }
    }
    const parts = [mix[1].slice(0, cut).trim(), mix[1].slice(cut + 1).trim()]
    const pct = parts.map((p) => p.match(/\s(\d+(?:\.\d+)?)%$/)).map((m) => (m ? Number(m[1]) : null))
    const cols = parts.map((p) => parse(p.replace(/\s\d+(?:\.\d+)?%$/, ''), tokens))
    // A percentage on either side names that side's share.
    const share = pct[0] != null ? pct[0] / 100 : pct[1] != null ? 1 - pct[1] / 100 : 0.5
    return cols[0].map((c, i) => c * share + cols[1][i] * (1 - share))
  }
  if (v === 'white') return [255, 255, 255]
  if (v === 'black') return [0, 0, 0]
  throw new Error(`cannot parse colour ${JSON.stringify(v)}`)
}

// Ink laid over paper at an alpha — how a disabled control, a tint fill or a
// translucent border actually lands.
const over = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a))

// ---- the inventory ---------------------------------------------------------
//
// One row per ink-on-paper pair the interface actually draws. `where` cites the
// rule in index.css, so a row can be checked against the stylesheet by reading
// rather than by trusting this file. `min` is the WCAG floor the pair has to
// clear: 4.5 for body-sized type, 3.0 for large or bold type and for the
// non-text parts of a control (WCAG 1.4.3 / 1.4.11).
const T = (tok) => (k) => parse(k[tok], k)

// An rgba token laid on its paper, optionally thinned further by a color-mix
// against transparent (which is what `color-mix(in srgb, X 70%, transparent)`
// does: it scales the alpha).
function alpha(token, k, share, paper) {
  const m = String(token).match(/rgba?\(([^)]+)\)/)
  if (!m) return over(parse(token, k), paper, share)
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
  return over(p.slice(0, 3), paper, (p[3] ?? 1) * share)
}

// A field's own background: --card on light, and a darker mix on dark, both
// from the rule rather than from the base declaration.
const inputPaper = (k) => (k.dark ? parse('color-mix(in oklab, var(--bg) 55%, var(--card))', k) : parse(k.card, k))

const INVENTORY = [
  // --- the type scale, on every paper it lands on ---
  { id: 'body ink on a card', kind: 'text', sample: true, min: 4.5, where: '.tp-input / body — index.css',
    ink: T('ink'), paper: T('card') },
  { id: 'body ink on the page', kind: 'text', min: 4.5, where: '--bg',
    ink: T('ink'), paper: T('bg') },
  { id: 'soft text on a card', kind: 'text', sample: true, min: 4.5, where: '.cast-actor, .tp-link — index.css',
    ink: T('soft'), paper: T('card') },
  { id: 'faint text on a card', kind: 'small', sample: true, min: 3.0, where: '.microcopy, .mono-label — index.css:1157,1179',
    ink: T('faint'), paper: T('card') },
  { id: 'faint text on a raised panel', kind: 'small', min: 3.0, where: '.microcopy on --raised',
    ink: T('faint'), paper: T('raised') },
  { id: 'faint text on the page', kind: 'small', min: 3.0, where: '.microcopy on --bg',
    ink: T('faint'), paper: T('bg') },
  { id: 'soft text on the page', kind: 'text', min: 4.5, where: '--soft on --bg, between cards',
    ink: T('soft'), paper: T('bg') },
  { id: 'body ink on a raised panel', kind: 'text', min: 4.5, where: '--ink on --raised',
    ink: T('ink'), paper: T('raised') },
  { id: 'input placeholder', kind: 'small', min: 3.0, where: '.tp-input::placeholder — index.css:1137',
    ink: T('faint'), paper: T('card') },
  { id: 'accent kicker on a card', kind: 'small', sample: true, min: 3.0, where: '.kicker — index.css',
    ink: T('accent-ui'), paper: T('card') },

  // --- status inks, which are read as words and not only as colour ---
  { id: 'error text on a card', kind: 'text', sample: true, min: 4.5, where: '.tp-btn-danger, ErrorText — index.css:907',
    ink: T('error'), paper: T('card') },
  { id: 'ok text on a card', kind: 'text', min: 4.5, where: '.tp-btn-ok — index.css:919',
    ink: T('ok'), paper: T('card') },
  { id: 'amber text on a card', kind: 'text', min: 4.5, where: '--amber',
    ink: T('amber'), paper: T('card') },

  // --- buttons: the label on the fill it sits on ---
  { id: 'primary button label', kind: 'text', sample: true, min: 4.5, where: 'html[data-theme] .tp-btn-primary — index.css:896,900',
    ink: (k) => parse(k.dark ? k['on-accent-dark'] : k['on-accent'], k),
    // The gradient's LIGHT end is the harder half for a light label.
    paper: (k) => parse(k.dark
      ? 'color-mix(in oklab, var(--accent-dark), white 12%)'
      : 'color-mix(in oklab, var(--accent), white 14%)', k) },
  { id: 'primary button label, low end', kind: 'text', min: 4.5, where: 'ditto, the gradient bottom',
    ink: (k) => parse(k.dark ? k['on-accent-dark'] : k['on-accent'], k),
    paper: (k) => parse(k.dark ? k['accent-dark'] : k.accent, k) },
  { id: 'ghost button label', kind: 'text', sample: true, min: 4.5, where: '.tp-btn-ghost — index.css:876',
    ink: T('ink'),
    paper: (k) => parse('color-mix(in oklab, var(--card-top), white 2%)', k) },
  { id: 'ghost button label, disabled', kind: 'text', min: 3.0, where: '.tp-btn:disabled { opacity: .55 } — index.css:815',
    // opacity fades the whole control, ink and border alike, toward its paper.
    ink: (k) => over(parse(k.ink, k), parse(k.card, k), 0.55),
    paper: T('card') },
  { id: 'danger button label', kind: 'text', min: 4.5, where: '.tp-btn-danger — index.css:907',
    ink: T('error'), paper: T('card') },
  { id: 'danger button label, hovered', kind: 'text', min: 4.5, where: '.tp-btn-danger:hover — index.css:908',
    ink: T('error'),
    paper: (k) => over(parse(k.error, k), parse(k.card, k), 0.09) },
  { id: 'ok button label, hovered', kind: 'text', min: 4.5, where: '.tp-btn-ok:hover — index.css:920',
    ink: T('ok'), paper: (k) => over(parse(k.ok, k), parse(k.card, k), 0.09) },
  { id: 'top bar Add label', kind: 'text', sample: true, min: 4.5, where: '.topbar-add-btn — index.css',
    ink: T('on-accent'),
    paper: (k) => parse(k.dark
      ? 'color-mix(in oklab, var(--accent-dark), white 12%)'
      : 'color-mix(in oklab, var(--accent), white 14%)', k) },
  { id: 'primary button label, disabled', kind: 'text', min: 3.0, where: '.tp-btn:disabled { opacity: .55 } over .tp-btn-primary — index.css:815',
    // The fill fades toward the card with the label, so BOTH sides move; the
    // gradient's light end is still the harder half.
    ink: (k) => over(parse(k.dark ? k['on-accent-dark'] : k['on-accent'], k), parse(k.card, k), 0.55),
    paper: (k) => over(parse(k.dark
      ? 'color-mix(in oklab, var(--accent-dark), white 12%)'
      : 'color-mix(in oklab, var(--accent), white 14%)', k), parse(k.card, k), 0.55) },
  { id: 'danger button label, disabled', kind: 'text', min: 3.0, where: '.tp-btn-danger:disabled — index.css:815,907',
    ink: (k) => over(parse(k.error, k), parse(k.card, k), 0.55),
    paper: T('card') },

  // --- chips: a label pill, and the same pill made clickable ---
  { id: 'chip label', kind: 'small', sample: true, min: 3.0, where: '.tp-chip — index.css:3449',
    ink: T('soft'), paper: T('raised') },
  { id: 'chip button', kind: 'text', min: 4.5, where: '.tp-chip-btn — index.css:3468',
    ink: T('accent-ui'), paper: T('raised') },
  { id: 'chip button, hovered', kind: 'text', min: 4.5, where: '.tp-chip-btn:hover — index.css:3469',
    ink: T('ink'), paper: T('card') },
  { id: 'chip border', kind: 'edge', min: 3.0, where: '.tp-chip border — index.css:3449',
    ink: T('line'), paper: T('raised') },

  // --- the segmented toggle, at rest ---
  //
  // ONLY THE UNSELECTED HALF IS HERE. The selected one rides the textured accent
  // thumb, which is not a colour — surface-readability.test.jsx composites that
  // fill against its tile and measures the label on it, in every set, accent and
  // mode. Measuring --on-accent against a flat accent here would report a number
  // the screen never shows.
  { id: 'toggle option at rest', kind: 'text', sample: true, min: 4.5, where: '.tp-toggle-opt on .tp-toggle — index.css:504,469',
    ink: T('soft'), paper: T('card') },

  { id: 'link on a card', kind: 'text', sample: true, min: 4.5, where: '.tp-link — index.css:3435',
    ink: T('soft'), paper: T('card') },
  { id: 'link, hovered', kind: 'text', min: 4.5, where: '.tp-link:hover — index.css',
    ink: T('ink'), paper: T('card') },
  { id: 'menu row, hovered', kind: 'text', min: 4.5, where: '.menu-item:hover — index.css:3115',
    ink: T('ink'), paper: (k) => over(parse(k.ink, k), parse(k.card, k), 0.07) },
  { id: 'menu row, current', kind: 'text', min: 4.5, where: '.menu-item.active — index.css:3116',
    ink: T('accent-ui'), paper: (k) => over(parse(k.accent, k), parse(k.card, k), 0.13) },

  // --- non-text contrast (1.4.11): a control's edge against what it sits on ---
  //
  // THE BORDER TOKEN IS NOT THE ONE THE BASE RULE NAMES. `.tp-input` sets
  // `border: 1.4px solid var(--line)` and then `html .tp-input` — one rule
  // down, unconditional — replaces it with the ink border at 70%. Measuring
  // --line here would have been measuring a value nothing paints, which is the
  // exact failure this family of tests exists to avoid, so the row carries the
  // override and cites both lines.
  { id: 'input border', kind: 'edge', sample: true, min: 3.0, where: 'html .tp-input — index.css:1129 (overrides :1123)',
    ink: (k) => alpha(k['ink-border'], k, 0.7, inputPaper(k)),
    paper: inputPaper },
  { id: 'button border', kind: 'edge', min: 3.0, where: '.tp-btn-ghost border-color — index.css:877',
    ink: (k) => alpha(k['ink-border'], k, 1, parse(k.card, k)),
    paper: T('card') },
  { id: 'card divider', kind: 'edge', min: 3.0, where: '--line, the hairline between rows',
    ink: T('line'), paper: T('card') },
]

// ---- the skins -------------------------------------------------------------

// MEMOISED, because the sweep asks for the same sixty-four skins once per row and
// applyTheme + getComputedStyle is the expensive half. The value is a plain
// snapshot and nothing downstream reads the DOM again, so handing back the same
// object is handing back the same answer — 64 theme applications for the whole
// file instead of 64 per row, which is the difference between this finishing and
// this timing out as rows are added.
const tokenCache = new Map()
function tokensFor(set, accent, dark) {
  const key = `${set}/${accent}/${dark}`
  if (!tokenCache.has(key)) tokenCache.set(key, readTokens(set, accent, dark))
  return tokenCache.get(key)
}

function readTokens(set, accent, dark) {
  applyTheme({ materialSet: set, accent, theme: dark ? 'dark' : 'light' })
  const s = getComputedStyle(document.documentElement)
  const read = (n) => (s.getPropertyValue('--' + n) || '').trim()
  return {
    dark,
    bg: read('bg'), raised: read('raised'), card: read('card'), 'card-top': read('card-top'),
    ink: read('ink'), soft: read('soft'), faint: read('faint'), line: read('line'),
    'ink-border': read('ink-border'), amber: read('amber'), error: read('error'), ok: read('ok'),
    accent: read('accent'), 'accent-dark': read('accent-dark'), 'accent-ui': read('accent-ui'),
    // Written by theme.js from the accent's luminance, and NOT the value
    // index.css declares — which is the whole reason these are read off the DOM.
    'on-accent': read('on-accent'),
    // Declared in index.css only; jsdom does not load it, so the literal stands
    // in. It is a constant by design (see the token's own comment).
    'on-accent-dark': '#15100C',
  }
}

const SKINS = []
for (const set of Object.keys(MAT_SETS)) {
  for (const accent of Object.keys(ACCENTS)) {
    for (const dark of [false, true]) SKINS.push([set, accent, dark])
  }
}

// KNOWN SHORTFALLS, with the number each one currently measures. A row listed
// here is allowed to be below its floor and NOT allowed to get worse — so the
// list is a debt register rather than a suppression: deleting an entry is how a
// fix is recorded, and a regression past the recorded value fails.
const KNOWN = {
  // Measured 2026-08-29, on the first full run of this file. Every one of these
  // is a token pair chosen before the accents multiplied out, and each names the
  // skin that is worst — so the fix is a palette decision rather than a bug in
  // a control, which is why they are recorded rather than patched here.
  'accent kicker on a card': 2.58, // floor 3.0 — ochre on light paper
  'error text on a card': 3.97, // floor 4.5 — the dark theme's --error
  'ok text on a card': 3.98, // floor 4.5 — likewise --ok
  'amber text on a card': 3.0, // floor 4.5 — likewise --amber
  'primary button label': 3.47, // floor 4.5 — cream on the olive fill's light end
  'danger button label': 3.97, // floor 4.5 — same --error as above
  'danger button label, hovered': 3.55, // floor 4.5 — and its 9% tint under it
  'ok button label, hovered': 3.59, // floor 4.5
  // THE WORST ONE, and the only one that is an inconsistency rather than a
  // palette choice: .tp-btn-primary switches its ink to --on-accent-dark in the
  // dark theme, and .topbar-add-btn — the same accent fill, one bar up — does
  // not. So the Add button wears cream ink on the LIGHTENED dark-theme accent.
  'top bar Add label': 2.62, // floor 4.5
  'menu row, current': 2.31, // floor 4.5 — accent ink on a 13% accent tint
  'input border': 2.27, // floor 3.0 (1.4.11)
  'card divider': 1.33, // floor 3.0 — a hairline between rows, not a control edge
  'chip button': 2.42, // floor 4.5 — the same ochre --accent-ui, one paper up
  'chip border': 1.29, // floor 3.0 — the same hairline as the divider, on --raised

  // PINNED, NOT DEBT. WCAG 1.4.3 exempts inactive user interface components, so
  // these two are not shortfalls and deleting the entry is not how they get
  // fixed — the row exists so a disabled control cannot quietly fade further
  // than it already does. `opacity: .55` moves the ink AND the fill toward the
  // paper, which is why a disabled primary reads worse than a disabled ghost.
  'primary button label, disabled': 1.85,
  'danger button label, disabled': 2.15,
}

function measure(row, skin) {
  const k = tokensFor(...skin)
  return wcag(row.ink(k), row.paper(k))
}

// ---- the grain veil --------------------------------------------------------
//
// .grain-overlay used to blend with its BACKDROP — multiply on light, screen on
// dark — which is what made a fixed full-viewport layer cost a full recomposite
// on every scroll frame. It is a flat veil under a noise MASK now. The claim the
// stylesheet makes for that swap is not that the grain is free (it is not: at
// its darkest texel it costs real contrast, and it always did) but that
// retiring the blend does not CHANGE what it costs.
//
// The two are algebraically each other's mirror. With a noise texel n in 0..1
// and the layer at alpha a, the old multiply gives base·(1 − a(1 − n)) and the
// new mask gives base·(1 − a·n): the same range of darkening, reached at
// opposite ends of the noise. For isotropic noise that is the same grain with
// its sign flipped, which is why the worst case — the thing a contrast floor
// cares about — is identical.
describe('retiring the backdrop blend on the page grain', () => {
  const A = { light: 0.055, dark: 0.05 }

  // n = 0..1 across the noise; the extremes are what a floor is measured at.
  const oldWay = (c, n, dark) =>
    dark
      ? c.map((v) => 255 - (255 - v) * (1 - A.dark * (1 - n)))
      : c.map((v) => v * (1 - A.light * (1 - n)))
  const newWay = (c, n, dark) =>
    dark ? c.map((v) => v + (255 - v) * A.dark * n) : c.map((v) => v * (1 - A.light * n))

  it('leaves every pair measuring what it measured before', () => {
    let worst = { delta: 0 }
    for (const row of INVENTORY) {
      for (const skin of SKINS) {
        const k = tokensFor(...skin)
        const dark = skin[2]
        // The worst the grain can make each pair, under each scheme.
        const floorOf = (f) => Math.min(
          ...[0, 1].map((n) => wcag(f(row.ink(k), n, dark), f(row.paper(k), n, dark))),
        )
        const delta = Math.abs(floorOf(oldWay) - floorOf(newWay))
        if (delta > worst.delta) worst = { delta, id: row.id, skin }
      }
    }
    expect(
      worst.delta,
      `${worst.id} moves ${worst.delta.toFixed(3)} of a point (${(worst.skin || []).join('/')})`,
    ).toBeLessThan(0.01)
  })
})

describe(FULL ? 'every ink on every paper (full)' : 'every ink on every paper (sample)', () => {
  const rows = FULL ? INVENTORY : INVENTORY.filter((r) => r.sample)

  it(`covers ${rows.length} pairs across ${SKINS.length} skins`, () => {
    expect(rows.length).toBeGreaterThan(0)
    // The sample has to reach every KIND, or "one per type" is a claim rather
    // than a property — and the kind that quietly loses its sample is the one
    // nobody notices going unmeasured.
    const kinds = new Set(INVENTORY.map((r) => r.kind))
    const sampled = new Set(rows.map((r) => r.kind))
    expect([...kinds].filter((k) => !sampled.has(k)), 'a kind with no sampled row').toEqual([])
  })

  for (const row of rows) {
    it(`${row.id} — ${row.where}`, () => {
      const failures = []
      let worst = Infinity
      for (const skin of SKINS) {
        const cr = measure(row, skin)
        worst = Math.min(worst, cr)
        const floor = KNOWN[row.id] ?? row.min
        if (cr + 0.005 < floor) {
          failures.push(`${skin[0]}/${skin[1]}/${skin[2] ? 'dark' : 'light'} = ${cr.toFixed(2)}:1`)
        }
      }
      expect(
        failures,
        `${row.id} needs ${KNOWN[row.id] ?? row.min}:1 (worst measured ${worst.toFixed(2)}): ${failures.join(', ')}`,
      ).toEqual([])
    })
  }
})
