// Theme system — UI instructions §4. Two aesthetics × light/dark + accent,
// applied as data attributes + CSS custom properties on <html>.

export const ACCENTS = {
  terracotta: '#B4482D',
  ochre: '#C8992B',
  olive: '#3F7D5A',
  slate: '#2F6D8F',
}

// §4 palettes verbatim; tokens the spec leaves out are derived in-key.
const PALETTES = {
  'paper-light': {
    bg: '#F4EDDE', raised: '#FBF6EA', card: '#FFFEF9',
    'card-top': '#FFFFFC', 'card-bottom': '#FCF8ED',
    'topbar-top': '#F3EBDB', 'topbar-bottom': '#EDE3D1',
    ink: '#221C16', soft: '#6A5F50', faint: '#8A7C68', line: '#E4DAC7',
    'ink-border': 'rgba(41,38,29,.6)', 'frame-border': 'rgba(41,38,29,.35)',
    amber: '#BE8A4E', note: '#221C16', error: '#A93B26', ok: '#3E8E5A',
    strip: '#E9E1CC', holes: '#F7F2E6', 'holes-border': '#D3C7AB', 'holes-glow': 'none',
  },
  'paper-dark': {
    bg: '#262019', raised: '#2A231C', card: '#2F2820',
    'card-top': '#352D23', 'card-bottom': '#2C251E',
    'topbar-top': '#2B241C', 'topbar-bottom': '#241E17',
    ink: '#EFE6D4', soft: '#B3A48C', faint: '#9A8C74', line: '#453B2D',
    'ink-border': 'rgba(239,230,212,.4)', 'frame-border': 'rgba(214,162,92,.3)',
    amber: '#D6A25C', note: '#E8DCC2', error: '#C96B5B', ok: '#5FB47E',
    strip: '#1C1710', holes: 'rgba(239,230,212,.4)', 'holes-border': 'transparent', 'holes-glow': 'none',
  },
  'film-light': {
    bg: '#F1ECE1', raised: '#F7F2E6', card: '#FAF6EC',
    'card-top': '#FDFAF3', 'card-bottom': '#F7F2E4',
    'topbar-top': '#F0EADB', 'topbar-bottom': '#EAE2CF',
    ink: '#2A241C', soft: '#6A5F50', faint: '#8A7C68', line: '#DFD6C4',
    'ink-border': 'rgba(42,36,28,.55)', 'frame-border': 'rgba(185,138,68,.4)',
    amber: '#B98A44', note: '#2A241C', error: '#A93B26', ok: '#3E8E5A',
    strip: '#E9E1CC', holes: '#F7F2E6', 'holes-border': '#D3C7AB', 'holes-glow': 'none',
  },
  'film-dark': {
    bg: '#15100C', raised: '#201A13', card: '#201A13',
    'card-top': '#251E16', 'card-bottom': '#1D1710',
    'topbar-top': '#201913', 'topbar-bottom': '#19130D',
    ink: '#ECE3D1', soft: '#A2937C', faint: '#8E8069', line: '#322A20',
    'ink-border': 'rgba(236,227,209,.35)', 'frame-border': 'rgba(214,162,92,.3)',
    amber: '#D6A25C', note: '#ECE3D1', error: '#C96B5B', ok: '#5FB47E',
    strip: '#0F0B07', holes: 'rgba(236,227,209,.5)', 'holes-border': 'transparent',
    'holes-glow': '0 0 6px rgba(236,227,209,.2)',
  },
}

let current = { aesthetic: undefined, theme: 'system', accent: 'terracotta' }
const media = window.matchMedia('(prefers-color-scheme: dark)')
media.addEventListener('change', () => {
  if (current.theme !== 'light' && current.theme !== 'dark') apply() // live "system" updates
})

// ---- label density (§1 icons) ----
//
// A button built with an `icon` prop renders its words inside a .btn-label
// span, and html[data-labels="off"] clips that span. This module owns the
// attribute for the same reason it owns data-theme: two writers of one
// attribute is how they drift.
//
// The resolution mirrors theme's system→light/dark exactly. The stored
// preference is 'auto' | 'on' | 'off'; what lands on <html> is always the
// concrete 'on' or 'off'. That is not a stylistic choice — resolving here
// means index.css needs ONE clip rule instead of one rule plus a duplicate
// inside a media query, and a duplicated clip recipe is a thing that gets
// edited in one place only.
//
// 'auto' means labels on for desktop and off under the mobile breakpoint,
// which is the width where the words genuinely stop fitting. 768px is the
// app's mobile breakpoint, matching index.css.
export const LABELS_KEY = 'tippani:labels'

let labelPref = 'auto'
const narrow = window.matchMedia('(max-width: 768px)')
// Re-resolve when the window crosses the breakpoint. No `if (labelPref ===
// 'auto')` guard: applyLabelsNow only consults the viewport under 'auto'
// anyway, so a guard here would be unreachable logic that reads as though it
// decides something — the kind of line a later change trusts and shouldn't.
narrow.addEventListener('change', applyLabelsNow)

// applyLabels(pref) — 'auto' | 'on' | 'off'. Called with no argument it reads
// the device-local preference, which is what boot does.
//
// Note this is deliberately NOT folded into applyTheme: Settings' Appearance
// card re-sends every theme field on any change, so a label preference riding
// along in that object would be wiped by an unrelated accent click.
export function applyLabels(pref) {
  let next = pref
  if (next === undefined) {
    try {
      next = JSON.parse(localStorage.getItem(LABELS_KEY))
    } catch {
      next = null // private mode / disabled storage — fall through to auto
    }
  }
  labelPref = next === 'on' || next === 'off' ? next : 'auto'
  applyLabelsNow()
}

function applyLabelsNow() {
  const on = labelPref === 'auto' ? !narrow.matches : labelPref === 'on'
  document.documentElement.dataset.labels = on ? 'on' : 'off'
}

// labelsPref returns the stored preference ('auto' by default) — Settings
// initialises its control from this rather than from a prop, so the control
// always mirrors what is actually applied.
export function labelsPref() {
  return labelPref
}

// applyTheme({aesthetic, theme, accent}) — all optional; defaults per §4:
// theme "system", aesthetic light→paper / dark→film, accent terracotta.
export function applyTheme({ aesthetic, theme, accent } = {}) {
  current = { aesthetic, theme: theme || 'system', accent: accent || 'terracotta' }
  apply()
}

// getResolvedTheme returns the appearance currently applied: the concrete
// aesthetic (paper|film) read off the DOM — so it reflects the resolved value
// even when the stored pref was unset/derived — plus the theme *preference*
// (light|dark|system) and accent. Settings inits its toggles from this so they
// always mirror what's on screen rather than a stale prop.
export function getResolvedTheme() {
  const root = document.documentElement
  return {
    aesthetic: root.dataset.aesthetic === 'film' ? 'film' : 'paper',
    theme: current.theme || 'system',
    accent: current.accent || 'terracotta',
  }
}

// paletteTheme returns the canvas theme object (the shape quoteImage's readTheme
// produces) for an explicit aesthetic + mode, independent of what's applied to
// the DOM. Used by the share-image picker to render any of the four skins
// without touching the live app theme. `accentHex` keeps the app's accent.
export function paletteTheme(aesthetic, dark, accentHex) {
  const aes = aesthetic === 'film' ? 'film' : 'paper'
  const p = PALETTES[aes + '-' + (dark ? 'dark' : 'light')]
  return {
    aesthetic: aes,
    dark: !!dark,
    bg: p.bg,
    cardTop: p['card-top'],
    cardBottom: p['card-bottom'],
    ink: p.ink,
    soft: p.soft,
    faint: p.faint,
    line: p.line,
    amber: p.amber,
    accent: accentHex || ACCENTS.terracotta,
    inkBorder: p['ink-border'],
  }
}

function apply() {
  const dark = current.theme === 'dark' || (current.theme !== 'light' && media.matches)
  const aesthetic =
    current.aesthetic === 'paper' || current.aesthetic === 'film'
      ? current.aesthetic
      : dark ? 'film' : 'paper'
  const root = document.documentElement
  root.dataset.aesthetic = aesthetic
  root.dataset.theme = dark ? 'dark' : 'light'
  const palette = PALETTES[aesthetic + '-' + (dark ? 'dark' : 'light')]
  for (const [k, v] of Object.entries(palette)) root.style.setProperty('--' + k, v)
  const accent = ACCENTS[current.accent] || ACCENTS.terracotta
  root.style.setProperty('--accent', accent)
  // dark-surface accent variant is derived (§4)
  root.style.setProperty('--accent-dark', `color-mix(in oklab, ${accent}, white 20%)`)
  root.style.setProperty('--accent-ui', dark ? `color-mix(in oklab, ${accent}, white 20%)` : accent)
  window.dispatchEvent(new CustomEvent('tippani:theme', { detail: { aesthetic, dark } }))
}


// ---- colour categories (the four highlight slots) --------------------------
//
// A quote's colour is the one thing above tags in the hierarchy: tags say what
// it is ABOUT, the colour says what KIND of note it is. Until now the four were
// called yellow, blue, pink and orange, which describes a highlighter rather
// than a thought.
//
// THE TOKEN NEVER MOVES. `yellow|blue|pink|orange` stays the stored value in
// every table, every Markdown export and the import rule that reads a missing
// colour as yellow. Everything here is presentation: what a slot is CALLED, what
// it LOOKS like, and whether it is offered.
//
// SLOT 1 IS THE DEFAULT, NOT A CATEGORY. The column default is 'yellow' and an
// import with no colour writes 'yellow' too, so a yellow quote may be yellow
// because somebody chose it or because nobody chose anything. It cannot be named
// or hidden — the server refuses both — and its label says which of those it is.
export const CATEGORY_SLOTS = ['yellow', 'blue', 'pink', 'orange']
export const CATEGORY_DEFAULT_HEX = ['#E5C355', '#7FA6C9', '#D98CA6', '#DF9A5B']
export const UNSET_LABEL = 'Uncategorised'

// CATEGORY_PALETTE — the swatches the picker offers.
//
// Curated rather than a free hex field, because free hex produces libraries
// nobody can read at a glance: the point of a category colour is that four of
// them are instantly distinguishable, and that survives about as long as the
// first two near-identical blues.
//
// DISJOINT FROM THE THEME ACCENTS by construction, so a category can never be
// mistaken for the app's own accent — and not merely by avoiding the four exact
// values: the whole ochre / terracotta / olive / slate neighbourhood is left
// alone. palette.test.jsx holds it there, since "these look different enough" is
// the kind of judgement that quietly stops being true when someone adds a
// sixteenth swatch.
export const CATEGORY_PALETTE = [
  ['#E5C355', 'Sun'],
  ['#DF9A5B', 'Amber'],
  ['#D98CA6', 'Rose'],
  ['#E8A0C0', 'Blush'],
  ['#C2555F', 'Crimson'],
  ['#A8739E', 'Mauve'],
  ['#8A7BC8', 'Violet'],
  ['#6E8FD0', 'Periwinkle'],
  ['#7FA6C9', 'Sky'],
  ['#5AA8B5', 'Teal'],
  ['#6FBF9F', 'Mint'],
  ['#4FA98A', 'Jade'],
  ['#7CB342', 'Leaf'],
  ['#B5C05A', 'Moss'],
  ['#B0806B', 'Clay'],
  ['#8C7F6E', 'Stone'],
]

// The live state, read by anything that has to draw a colour rather than name a
// CSS variable — the share image most of all, because a canvas cannot resolve
// var() or color-mix() and the picture is the artefact that leaves the app.
let catNames = ['', '', '', '']
let catHex = [...CATEGORY_DEFAULT_HEX]
let catHidden = [false, false, false, false]

// applyColors writes the four --hl-N custom properties and keeps the JS mirror
// in step.
//
// DELIBERATELY NOT PART OF applyTheme. Settings' Appearance card re-sends every
// theme field on any change, so a category riding in that object would be wiped
// by an unrelated accent click — the same reason the label-density preference
// stands apart. Two writers of one attribute is how they drift; one writer per
// concern is the rule.
export function applyColors(prefs = {}) {
  for (let i = 0; i < CATEGORY_SLOTS.length; i++) {
    const n = i + 1
    const name = String(prefs['catName' + n] || '')
    const hex = String(prefs['catColor' + n] || '')
    // Slot 1 is enforced here as well as on the server. A restored archive or a
    // hand-edited row can carry a name it should not have, and the client is
    // where it would be SEEN.
    catNames[i] = n === 1 ? '' : name
    catHidden[i] = n === 1 ? false : !!prefs['catHidden' + n]
    catHex[i] = /^#[0-9a-f]{6}$/i.test(hex) ? hex : CATEGORY_DEFAULT_HEX[i]
    document.documentElement.style.setProperty('--hl-' + n, catHex[i])
  }
}

// categoryName returns what to CALL a slot: the reader's name if they gave one,
// else the colour word the token already is. Slot 1 says it is the absence of a
// choice rather than a colour, because that is the honest answer and because
// "Yellow" invites you to read it as one category among four.
export function categoryName(token) {
  const i = CATEGORY_SLOTS.indexOf(token)
  if (i < 0) return token
  if (catNames[i]) return catNames[i]
  if (i === 0) return UNSET_LABEL
  return token[0].toUpperCase() + token.slice(1)
}

// categoryVar is the CSS reference for a token — what everything that is NOT a
// canvas should use, because a custom property updates itself when a category is
// recoloured and a copied hex does not. The inline colour bars, the swatch dots
// and the tag chips all resolve through here or through --hl-N directly.
export function categoryVar(token) {
  const i = CATEGORY_SLOTS.indexOf(token)
  return i < 0 ? null : 'var(--hl-' + (i + 1) + ')'
}

// categoryHex is the live hex for a token — what a canvas needs, and the ONE
// place a real value is still required: ctx.fillStyle parses neither var() nor
// color-mix(), so the share image cannot read the custom property that every
// other surface reads.
export function categoryHex(token) {
  const i = CATEGORY_SLOTS.indexOf(token)
  return i < 0 ? null : catHex[i]
}

// categoryHidden says whether a slot should be offered as a CHOICE. It never
// hides a quote: a quote already wearing a hidden colour still shows it, because
// the alternative is a card that silently changes appearance when you tidy up a
// picker you were not thinking about it.
export function categoryHidden(token) {
  const i = CATEGORY_SLOTS.indexOf(token)
  // The bounds check only. Slot 1 is kept visible by applyColors, which is the
  // single place that decides it — a second `i > 0` here would enforce the same
  // rule twice, and a rule enforced twice is a rule where neither guard can be
  // shown to work: break either one and the other covers for it. (Found by
  // mutation: the applyColors guard survived removal until this line went.)
  return i > -1 && !!catHidden[i]
}

// visibleCategories is the token list a picker should draw.
export function visibleCategories() {
  return CATEGORY_SLOTS.filter((t) => !categoryHidden(t))
}

// categoryState is what Settings renders from — the raw per-slot values rather
// than the resolved ones, so an unnamed slot shows an empty box with the
// built-in as its placeholder instead of the built-in as its content.
export function categoryState() {
  return CATEGORY_SLOTS.map((token, i) => ({
    token,
    slot: i + 1,
    name: catNames[i],
    label: categoryName(token),
    hex: catHex[i],
    custom: catHex[i].toLowerCase() !== CATEGORY_DEFAULT_HEX[i].toLowerCase(),
    hidden: catHidden[i],
    fixed: i === 0,
  }))
}
