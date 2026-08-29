// Theme system — one palette per mode, seven material sets, one accent, applied as
// data attributes + CSS custom properties on <html>.
//
// WHAT 3.0.0 CHANGED, AND WHY IT IS TWO CONTROLS RATHER THAN ONE. There used to be
// two "aesthetics", paper and film, and each carried its own palette — so choosing a
// look also chose its colours, and light film had to be a different cream from light
// paper. Four palettes for two looks, and no way to ask for film's materials on
// paper's page.
//
// A MATERIAL SET SAYS WHAT SURFACES ARE MADE OF AND NOTHING ELSE. Seven of them, four
// slots each — the desk, the furniture, the page, the binding — and light/dark is its
// own control beside it. So there is one palette per mode, every set works in both,
// and the two palettes that survive are paper's, unchanged hex for hex, because the
// v3 design library's own palette turned out to be exactly this one.
//
// THE WORD TABLES BELOW HOLD KEYS, not words: this module is evaluated at import,
// before the reader's language is known, so anything spelled out here would be the
// one label in the app that never translated. Every table is read through t() at
// the moment it is drawn.

import { t } from './i18n.js'

export const ACCENTS = {
  terracotta: '#B4482D',
  ochre: '#C8992B',
  olive: '#3F7D5A',
  slate: '#2F6D8F',
}

// The two palettes, verbatim; tokens the spec leaves out are derived in-key.
//
// THE FILM PALETTES ARE GONE, NOT MERGED. There is nothing of film-light or film-dark
// in here — no averaging, no third cream. The v3 design library states one palette
// per mode and its values are paper's to the hex, so keeping paper's and deleting the
// other two is the whole change. Film's *materials* survive as the Film assembly set.
//
// The film-only chrome tokens (strip, holes, frame-border, amber) stay defined,
// sourced from paper: a token that stops being written is a token whose consumers
// silently fall back to nothing, and the surfaces that read them are retired by the
// port rather than by an undefined variable.
//
// `sh` is the shadow's own colour as an RGB triple, and it is what lets ONE lift
// recipe live in index.css instead of one per look. Four hardcoded box-shadow blocks
// keyed on the aesthetic collapse into two alphas over rgba(var(--sh), a).
const PALETTES = {
  light: {
    bg: '#F4EDDE', raised: '#FBF6EA', card: '#FFFEF9',
    'card-top': '#FFFFFC', 'card-bottom': '#FCF8ED',
    'topbar-top': '#F3EBDB', 'topbar-bottom': '#EDE3D1',
    ink: '#221C16', soft: '#6A5F50', faint: '#8A7C68', line: '#E4DAC7',
    'ink-border': 'rgba(41,38,29,.6)', 'frame-border': 'rgba(41,38,29,.35)',
    amber: '#BE8A4E', note: '#221C16', error: '#A93B26', ok: '#3E8E5A',
    strip: '#E9E1CC', holes: '#F7F2E6', 'holes-border': '#D3C7AB', 'holes-glow': 'none',
    sh: '41,38,29', 'bevel-hi': 'rgba(255,255,255,.75)', 'bevel-mid': 'rgba(255,255,255,.35)',
  },
  dark: {
    bg: '#262019', raised: '#2A231C', card: '#2F2820',
    'card-top': '#352D23', 'card-bottom': '#2C251E',
    'topbar-top': '#2B241C', 'topbar-bottom': '#241E17',
    ink: '#EFE6D4', soft: '#B3A48C', faint: '#9A8C74', line: '#453B2D',
    'ink-border': 'rgba(239,230,212,.4)', 'frame-border': 'rgba(214,162,92,.3)',
    amber: '#D6A25C', note: '#E8DCC2', error: '#C96B5B', ok: '#5FB47E',
    strip: '#1C1710', holes: 'rgba(239,230,212,.4)', 'holes-border': 'transparent', 'holes-glow': 'none',
    sh: '0,0,0', 'bevel-hi': 'rgba(255,255,255,.07)', 'bevel-mid': 'rgba(255,255,255,.05)',
  },
}

// ---- the material sets ------------------------------------------------------
//
// [tile, coarse px, fine px, strength] — verbatim from the v3 design library. The
// tile name is a KEY INTO index.css, not a filename: the stylesheet declares
// --tile-paper: url("./textures/paper.webp") and this module only ever writes
// var(--tile-paper). That keeps every file path in the one place the build rewrites
// them, so nothing here can name a tile the bundler does not know about, and no tile
// gets pulled into the bundle just for being in the folder.
//
// STRENGTH IS NOT AMPLITUDE. What a reader sees is strength x the tile's own standard
// deviation, in levels out of 255, so the photographic tiles carry the SMALLER
// strengths and still read louder. The measurements are in src/textures/README.md and
// they are load-bearing: replace a tile and the number has to be re-measured, not
// inherited.
const TEXTILES = {
  paper: ['paper', 220, 71, 0.10], linen: ['linen', 340, 109, 0.11],
  cotton: ['cotton', 300, 97, 0.12], canvas: ['canvas', 400, 129, 0.10],
  denim: ['denim', 320, 103, 0.12], wool: ['wool', 360, 113, 0.12],
  wood: ['wood', 300, 97, 0.12], metal: ['metal', 260, 84, 0.09],
  brushed: ['brushed', 240, 78, 0.08], matte: ['matte', 200, 65, 0.07],
  satin: ['satin', 210, 68, 0.07], glass: ['glass', 280, 90, 0.06],
  // GLASS WITH THE CREASES TAKEN OUT, and it cannot be made to read as loud as
  // glass.webp does. Its sd is 6.32 against glass's 42.61, so matching that tile's
  // 2.56 levels would need a strength of .40 — three times the pack's own .12
  // ceiling. Capped, it lands at 0.76 levels: a pane that has been cleaned.
  'glass-soft': ['glass-soft', 280, 90, 0.12],
  rubber: ['rubber-flat', 230, 74, 0.10], fabric: ['fabric', 260, 84, 0.11],
  walnut: ['walnut', 300, 97, 0.09], pine: ['pine', 340, 109, 0.09],
  marble: ['marble', 360, 116, 0.08], granite: ['granite', 280, 90, 0.08],
  sandstone: ['sandstone', 300, 97, 0.09], concrete: ['concrete', 320, 103, 0.08],
  cardboard: ['cardboard', 280, 90, 0.10], 'paper-photo': ['paper-photo', 300, 97, 0.07],
  leather: ['leather-004', 260, 84, 0.10], 'leather-suede': ['leather-021', 240, 78, 0.11],
  'leather-pebbled': ['leather-034d', 280, 90, 0.09],
  'leather-tooled': ['leather-037', 320, 103, 0.06],
}

// The four slots, in order: the desk, the furniture, what you write on, what the book
// is bound in. Read each set as somewhere you could stand — assembled slot by slot
// they drift, and an earlier Office had glass on the book, the one object in the room
// glass makes no sense on.
export const MAT_SETS = {
  manuscript: ['linen', 'paper', 'paper', 'wood'],
  'film-assembly': ['metal', 'brushed', 'matte', 'glass'],
  office: ['glass', 'rubber', 'satin', 'metal'],
  school: ['wood', 'rubber', 'paper', 'cotton'],
  atelier: ['canvas', 'denim', 'cotton', 'wool'],
  bindery: ['concrete', 'leather-suede', 'paper-photo', 'leather-pebbled'],
  quarry: ['sandstone', 'granite', 'satin', 'marble'],
}
export const MAT_SET_DEFAULT = 'manuscript'
// Keys, not words — see the note at the top of the file.
export const MAT_SET_LABELS = {
  manuscript: 'settings.material.manuscript.label',
  'film-assembly': 'settings.material.film-assembly.label',
  office: 'settings.material.office.label',
  school: 'settings.material.school.label',
  atelier: 'settings.material.atelier.label',
  bindery: 'settings.material.bindery.label',
  quarry: 'settings.material.quarry.label',
}

// ---- the operator -----------------------------------------------------------
//
//   result = (1 − s)·colour + s·overlay(fine, coarse)
//
// A veil of the surface's own colour at 1 − s, a fine pass composited `overlay`, a
// coarse pass composited `normal`, each at its own background-size. ONE FILE SERVES
// LIGHT AND DARK: the tile carries no tone of its own, only deviation from the middle
// grey, so the mode supplies the colour and the file supplies the grain. That is what
// the mean-128 invariant in src/textures/README.md buys — `overlay` pivots at 128, so
// a tile whose mean IS 128 neither darkens nor lightens what it lands on.
//
// Written as custom properties rather than as classes because the arithmetic needs
// the set, the mode and the accent at once, and all three live here. index.css spends
// them: background-image: var(--surf-card-image).
const GLASSY = new Set(['glass', 'glass-soft'])
const METALLIC = new Set(['metal', 'brushed'])

function veil(hex, s) {
  return `color-mix(in srgb, ${hex} ${((1 - s) * 100).toFixed(1)}%, transparent)`
}

// A pane does not hide what is behind it, it softens it — so glass takes a backdrop
// blur and a specular sweep instead of an opaque veil. The grain still goes through
// the same veil maths (s is .06, so the pane stays clear); skipping it left the raw
// grayscale tile fully opaque over the blur, which read as a scuffed window.
function glassProps(hex, tile, a, b, s, dark) {
  const v = veil(hex, s)
  const hi1 = dark ? 0.16 : 0.55
  const hi2 = dark ? 0.04 : 0.12
  return {
    color: `color-mix(in srgb, ${hex} ${dark ? 34 : 24}%, transparent)`,
    image: `linear-gradient(124deg, rgba(255,255,255,${hi1}) 0%, rgba(255,255,255,0) 34%,` +
      ` rgba(255,255,255,0) 64%, rgba(255,255,255,${hi2}) 100%),` +
      ` linear-gradient(${v}, ${v}), var(--tile-${tile}), var(--tile-${tile})`,
    size: `auto, auto, ${a}px ${a}px, ${b}px ${b}px`,
    blend: 'normal, normal, overlay, normal',
    blur: 'blur(18px) saturate(1.5)',
    border: dark ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.6)',
    inset: `inset 0 1px 0 ${dark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.7)'},` +
      ` inset 0 -10px 16px -12px rgba(255,255,255,${dark ? 0.06 : 0.3})`,
  }
}

// Metal and brushed steel stay opaque but bleed a whisper of whatever accent is
// nearby: a mirror-ish surface reflects its surroundings rather than holding a colour
// of its own.
function surfaceProps(hex, name, dark, accentUI) {
  const [tile, a, b, s] = TEXTILES[name] || TEXTILES.paper
  if (GLASSY.has(tile)) return glassProps(hex, tile, a, b, s, dark)
  const v = veil(hex, s)
  const img = []
  const size = []
  const blend = []
  if (METALLIC.has(tile)) {
    img.push(`linear-gradient(126deg, color-mix(in oklab, ${accentUI}, transparent 84%) 0%,` +
      ' transparent 40%, transparent 60%,' +
      ` color-mix(in oklab, ${accentUI}, transparent 90%) 100%)`)
    size.push('auto')
    blend.push('soft-light')
  }
  img.push(`linear-gradient(${v}, ${v})`, `var(--tile-${tile})`, `var(--tile-${tile})`)
  size.push('auto', `${a}px ${a}px`, `${b}px ${b}px`)
  blend.push('normal', 'overlay', 'normal')
  return {
    color: hex,
    image: img.join(', '),
    size: size.join(', '),
    blend: blend.join(', '),
    // Identity values, so index.css can declare these unconditionally on every slot
    // and a non-glass surface simply gets nothing. A property left unwritten would
    // keep the PREVIOUS set's value after a switch, which is the bug this avoids.
    blur: 'none',
    border: 'transparent',
    inset: 'none',
  }
}

// The four slots, and which palette colour each one's veil is tinted with: the desk
// takes the page background, the furniture the top bar, the page the card, the binding
// the raised surface.
const SLOT_COLOUR = { ground: 'bg', shell: 'topbar-top', card: 'card', cover: 'raised' }
export const SLOTS = ['ground', 'shell', 'card', 'cover']
// Every tile the app can put on a surface, in the order the picker offers them:
// the set's own inventory first, then the two the seven sets never name. A reader
// wanting Manuscript with a stone floor has nowhere else to say so.
export const TILE_NAMES = Object.keys(TEXTILES)

// surfaceStyle returns one slot of one set as a React style object, for a set that is
// NOT applied — the material picker in Settings shows seven specimens at once, and
// each has to be made of what it is offering. A picker whose swatches are drawn by
// hand is a picker that goes on being right after the recipe stops being.
// tileURL reads back what the BUILD did with a texture path, rather than importing
// one. index.css is the single place a texture file is named — that is what lets a
// stylesheet rule say var(--tile-card) and never learn a filename — and a canvas
// cannot resolve var(), so the one consumer that needs a real URL asks the document
// what the custom property resolved to and unwraps it. An import here would put a
// second copy of every filename in a second language.
function tileURL(file) {
  if (typeof getComputedStyle !== 'function' || typeof document === 'undefined') return ''
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--tile-${file}`).trim()
  return /url\((['"]?)([^)'"]+)\1\)/.exec(raw)?.[2] || ''
}

// tileFor answers, for one slot of one set: which material, which file the build
// emitted, and the two scales and the strength the operator composites it at. The
// share picture is the caller — it paints on a canvas, so it cannot spend the
// --surf-* properties and has to rebuild the same recipe with a pattern.
export function tileFor(setName, slot, override) {
  const names = MAT_SETS[setName] || MAT_SETS[MAT_SET_DEFAULT]
  const i = SLOTS.indexOf(slot)
  const name = TEXTILES[override] ? override : names[i < 0 ? 2 : i]
  const [file, coarse, fine, strength] = TEXTILES[name]
  return { name, file, coarse, fine, strength, url: tileURL(file) }
}

export function surfaceStyle(setName, slot, dark, accentHex, tile) {
  const names = MAT_SETS[setName] || MAT_SETS[MAT_SET_DEFAULT]
  const palette = PALETTES[dark ? 'dark' : 'light']
  const accent = accentHex || ACCENTS.terracotta
  const light = luminance(accent) > 0.32
  const accentUI = dark && !light ? `color-mix(in oklab, ${accent}, white 20%)` : accent
  const idx = SLOTS.indexOf(slot)
  const p = surfaceProps(palette[SLOT_COLOUR[slot] || 'card'], tile || names[idx < 0 ? 2 : idx], dark, accentUI)
  return {
    backgroundColor: p.color,
    backgroundImage: p.image,
    backgroundSize: p.size,
    backgroundBlendMode: p.blend,
    backdropFilter: p.blur === 'none' ? undefined : p.blur,
    boxShadow: p.inset === 'none' ? undefined : p.inset,
  }
}

// AN ACCENT IS NOT ALWAYS DARK, SO IT CANNOT ALWAYS BE LIGHTENED. The old rule lifted
// every accent 20% toward white in dark mode, which is right for the default red and
// wrong for ochre: #C8992B lifted lands near a pale gold, and the paper-coloured text
// this app has always put on an accent fill measures about 1.8:1 against it — Save and
// Import were legible only because you already knew what they said. So the lift is
// conditional on the accent's own luminance, and the ink on it is chosen the same way
// rather than assumed to be paper. Both computed from the hex, so a fifth accent needs
// no new rule.
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return 0.3
  const n = parseInt(m[1], 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

let current = { materialSet: undefined, theme: 'system', accent: 'terracotta' }
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

// TWO ATTRIBUTES, because the resolved answer cannot express the difference
// that matters. `data-labels` is the concrete on/off every clip rule reads.
// `data-labels-mode` is the RAW preference, and it exists so an explicit choice
// can outrank the app's own exceptions: a handful of buttons opt out of the
// collapse with keepLabel — primary submits, destructive confirms, the doors to
// a settings panel — and those exceptions are defaults, not rules. Under 'auto'
// they stand, which is what makes auto the recommended setting. Under an
// explicit 'off' they do not: a reader who has said "glyphs only" has answered
// the question the exception was guessing at, and an app that keeps overriding
// them has a preference in name only.
function applyLabelsNow() {
  const on = labelPref === 'auto' ? !narrow.matches : labelPref === 'on'
  document.documentElement.dataset.labels = on ? 'on' : 'off'
  document.documentElement.dataset.labelsMode = labelPref
}

// labelsPref returns the stored preference ('auto' by default) — Settings
// initialises its control from this rather than from a prop, so the control
// always mirrors what is actually applied.
export function labelsPref() {
  return labelPref
}

// applyTheme({materialSet, theme, accent}) — all optional; defaults are theme
// "system", set "manuscript", accent terracotta.
//
// THE SET NO LONGER DEPENDS ON THE THEME. The old default chose film for dark and
// paper for light, because the aesthetics carried their own palettes and a light film
// looked wrong. One palette per mode means every set works in both, so the default is
// a single answer instead of a branch.
export function applyTheme(prefs = {}) {
  const { materialSet, theme, accent } = prefs
  current = {
    materialSet,
    theme: theme || 'system',
    accent: accent || 'terracotta',
    // Per-slot overrides, read straight off the preference object so a caller never
    // has to know the four names. Anything unrecognised is dropped here rather than
    // guarded at every use: an override naming a tile this build does not have puts
    // the slot back on the set's own material, which is the only fallback that
    // leaves a surface with a texture on it.
    tiles: SLOTS.map((slot) => {
      const v = prefs['tile' + slot[0].toUpperCase() + slot.slice(1)]
      return TEXTILES[v] ? v : ''
    }),
  }
  apply()
}

// getResolvedTheme returns the appearance currently applied: the concrete material
// set read off the DOM — so it reflects the resolved value even when the stored pref
// was unset — plus the theme *preference* (light|dark|system) and accent. Settings
// inits its controls from this so they always mirror what's on screen rather than a
// stale prop.
export function getResolvedTheme() {
  const root = document.documentElement
  const s = root.dataset.matSet
  return {
    materialSet: MAT_SETS[s] ? s : MAT_SET_DEFAULT,
    theme: current.theme || 'system',
    accent: current.accent || 'terracotta',
    tiles: (current.tiles || ['', '', '', '']).slice(),
  }
}

// paletteTheme returns the canvas theme object (the shape quoteImage's readTheme
// produces) for an explicit mode, independent of what's applied to the DOM. Used by
// the share-image picker to render either skin without touching the live app theme.
// `accentHex` keeps the app's accent.
//
// TWO SKINS, NOT FOUR. The picker offered paper/film × light/dark; with one palette
// per mode, two of those four rendered identically to the other two. What it offers
// now is the mode, which is the only thing that was ever different in the drawing.
export function paletteTheme(dark, accentHex) {
  const p = PALETTES[dark ? 'dark' : 'light']
  return {
    dark: !!dark,
    bg: p.bg,
    cardTop: p['card-top'],
    cardBottom: p['card-bottom'],
    ink: p.ink,
    soft: p.soft,
    faint: p.faint,
    line: p.line,
    accent: accentHex || ACCENTS.terracotta,
    inkBorder: p['ink-border'],
  }
}

function apply() {
  const dark = current.theme === 'dark' || (current.theme !== 'light' && media.matches)
  const matSet = MAT_SETS[current.materialSet] ? current.materialSet : MAT_SET_DEFAULT
  const root = document.documentElement
  // Kept as an attribute even though every value it drives is a custom property:
  // a test, a screenshot run and a person with dev tools open all need to see WHICH
  // set is applied, and reading it back out of four composed background stacks is
  // not seeing it.
  root.dataset.matSet = matSet
  root.dataset.theme = dark ? 'dark' : 'light'
  const palette = PALETTES[dark ? 'dark' : 'light']
  for (const [k, v] of Object.entries(palette)) root.style.setProperty('--' + k, v)
  const accent = ACCENTS[current.accent] || ACCENTS.terracotta
  const light = luminance(accent) > 0.32
  const accentUI = dark && !light ? `color-mix(in oklab, ${accent}, white 20%)` : accent
  root.style.setProperty('--accent', accent)
  // dark-surface accent variant is derived (§4)
  root.style.setProperty('--accent-dark', `color-mix(in oklab, ${accent}, white 20%)`)
  root.style.setProperty('--accent-ui', accentUI)
  root.style.setProperty('--on-accent', light ? '#221C16' : '#FBF6EA')
  // The set proposes and an override disposes, slot by slot.
  const names = MAT_SETS[matSet].map((n, i) => (current.tiles || [])[i] || n)
  for (const [i, slot] of SLOTS.entries()) {
    const p = surfaceProps(palette[SLOT_COLOUR[slot]], names[i], dark, accentUI)
    for (const [k, v] of Object.entries(p)) root.style.setProperty(`--surf-${slot}-${k}`, v)
    // The slot's bare tile, aliased to the one index.css declares. Every texture
    // rule in the stylesheet reads --tile-card rather than a filename, so a set
    // changes what the app is made of without a single selector knowing a
    // material's name. --surf-* above is the full composite for the same slot and
    // the surfaces move onto it one at a time.
    root.style.setProperty(`--tile-${slot}`, `var(--tile-${TEXTILES[names[i]][0]})`)
  }
  // THE SELECTION FILLS GET THE SHELL SLOT'S STRENGTH, NOT ITS TILE ALONE.
  // They composite --tile-shell directly and used to do it at full weight, which
  // is the one place in the app the operator above was skipped: a photographic
  // tile carries three times a generated one's standard deviation, so Bindery's
  // concrete and Quarry's sandstone put a light label on a fill whose bright
  // patches reached 1.4:1 while Manuscript's linen sat at 2.8:1 and hid it. The
  // veil is 1 − s, spent by index.css as a colour stop, so the fill lands at the
  // same amplitude every other surface in the set already uses. Read out of
  // `names` rather than out of MAT_SETS, so a per-slot override is calibrated too.
  const shell = names[SLOTS.indexOf('shell')]
  root.style.setProperty('--sel-veil', `${((1 - TEXTILES[shell][3]) * 100).toFixed(1)}%`)
  window.dispatchEvent(new CustomEvent('tippani:theme', { detail: { materialSet: matSet, dark } }))
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
// SIX SLOTS. The tokens are append-only and their order never changes: slot N
// is --hl-N and always has been, so reordering them would silently recolour
// every quote in the library. 'green' and 'purple' arrived in 0029, which had to
// rebuild four tables to widen a CHECK SQLite cannot alter.
export const CATEGORY_SLOTS = ['yellow', 'blue', 'pink', 'orange', 'green', 'purple']
export const CATEGORY_DEFAULT_HEX = ['#E5C355', '#7FA6C9', '#D98CA6', '#DF9A5B', '#7CB342', '#8A7BC8']

// The built-in names. A colour word describes a highlighter; these describe what
// you meant by reaching for it, which is the point of the whole feature — so the
// app arrives with an opinion rather than with "Blue" and an empty box.
//
// All of them are editable, and none of them is stored: a name here is what a
// slot is CALLED when the reader has not said otherwise, so an untouched account
// stores nothing at all and a renamed one stores only what it renamed.
//
// Slot 1 has no name for the reason it has no name field — it is the absence of
// a choice, not one of six.
// SEEDED-LOOKING BUT NOT SEEDED: nothing here is written to the database. An
// untouched account stores no category name at all, so translating these changes
// what an unnamed slot is CALLED and never what is stored.
export const CATEGORY_DEFAULT_NAME = ['', 'vocab.category.blue.label', 'vocab.category.pink.label', 'vocab.category.orange.label', 'vocab.category.green.label', 'vocab.category.purple.label']

// What slot 1 is called. "DEFAULT" RATHER THAN "UNCATEGORISED", which is what it
// said for eight releases and which was a small, constant reproach: a word built
// from a negative prefix names what the quote is MISSING, so a library where most
// quotes are slot 1 — which is every library, since it is the column default and
// what an import with no colour writes — reads as thousands of rows waiting to be
// filed. Nothing is waiting. Reaching for no highlighter is a legitimate answer and
// the commonest one, and the label now says which answer it is instead of implying
// a chore. The reader's words: *"the name uncategorised makes you feel incomplete
// unless you assign it to a category."*
//
// Presentation only, like everything else here: the stored token is still 'yellow'.
export const UNSET_LABEL = 'vocab.category.unset.label'

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
  ['#E5C355', 'vocab.swatch.sun.label'],
  ['#DF9A5B', 'vocab.swatch.amber.label'],
  ['#D98CA6', 'vocab.swatch.rose.label'],
  ['#E8A0C0', 'vocab.swatch.blush.label'],
  ['#C2555F', 'vocab.swatch.crimson.label'],
  ['#A8739E', 'vocab.swatch.mauve.label'],
  ['#8A7BC8', 'vocab.swatch.violet.label'],
  ['#6E8FD0', 'vocab.swatch.periwinkle.label'],
  ['#7FA6C9', 'vocab.swatch.sky.label'],
  ['#5AA8B5', 'vocab.swatch.teal.label'],
  ['#6FBF9F', 'vocab.swatch.mint.label'],
  ['#4FA98A', 'vocab.swatch.jade.label'],
  ['#7CB342', 'vocab.swatch.leaf.label'],
  ['#B5C05A', 'vocab.swatch.moss.label'],
  ['#B0806B', 'vocab.swatch.clay.label'],
  ['#8C7F6E', 'vocab.swatch.stone.label'],
]

// CAT_NAME_MAX bounds a category name, counted in CODE POINTS. It mirrors
// catNameMax in auth_handlers.go, which counts runes and REFUSES a longer name
// rather than storing a cut-off one.
//
// FIFTEEN, down from twenty-four. These are labels: they ride a swatch tooltip, a
// filter chip, a group heading and the Stats breakdown's label column, and none
// of those has room for a sentence. Twenty-four was a number nothing was built
// for — the breakdown's column could not hold one and ellipsised instead, which
// is a chart truncating the very categories it is breaking down. Fifteen is what
// that column can hold outright, so the cap and the layout now agree and neither
// has to apologise for the other. Every built-in name fits with room to spare
// ("Inspirational", the longest, is 13).
//
// It lives here rather than in Settings.jsx because Settings is not its only
// reader any more: StatsPage sizes its label column from it, and a cap the
// layout is cut for has to be a cap the layout can see.
export const CAT_NAME_MAX = 15

// capCategoryName trims a name to the cap by CODE POINT, not by UTF-16 unit.
// The server counts runes, and a plain .slice() can cut an astral character in
// half and leave a lone surrogate — one unit to JS, one rune to Go, and a name
// that fails validation for a reason nothing on screen explains.
export function capCategoryName(name) {
  const s = String(name || '')
  const cp = [...s]
  return cp.length <= CAT_NAME_MAX ? s : cp.slice(0, CAT_NAME_MAX).join('')
}

// The live state, read by anything that has to draw a colour rather than name a
// CSS variable — the share image most of all, because a canvas cannot resolve
// var() or color-mix() and the picture is the artefact that leaves the app.
let catNames = CATEGORY_SLOTS.map(() => '')
let catHex = [...CATEGORY_DEFAULT_HEX]
let catHidden = CATEGORY_SLOTS.map(() => false)

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
    //
    // The cap is applied HERE, on the way in, and so exactly once. A name stored
    // under the old 24 survives in the database until something writes over it,
    // and every reader — the pickers, the group headings, the Stats column and
    // the Settings field — has to agree about what it says or the field would
    // show one thing and the chart another. Capping on read also means Settings
    // sends back the capped value on the first save it makes, so the row heals
    // itself rather than sitting permanently over a limit its own input will not
    // let you type back down to.
    catNames[i] = n === 1 ? '' : capCategoryName(name)
    catHidden[i] = n === 1 ? false : !!prefs['catHidden' + n]
    catHex[i] = /^#[0-9a-f]{6}$/i.test(hex) ? hex : CATEGORY_DEFAULT_HEX[i]
    document.documentElement.style.setProperty('--hl-' + n, catHex[i])
  }
}

// categoryName returns what to CALL a slot: the reader's name if they gave one,
// else the colour word the token already is. Slot 1 says it is the DEFAULT rather
// than a colour, because that is the honest answer and because "Yellow" invites you
// to read it as one category among six.
export function categoryName(token) {
  const i = CATEGORY_SLOTS.indexOf(token)
  if (i < 0) return token
  if (catNames[i]) return catNames[i]
  if (i === 0) return t(UNSET_LABEL)
  // The built-in name, not the colour word. "Blue" is what the token is; "Fact"
  // is what it is for.
  return CATEGORY_DEFAULT_NAME[i] ? t(CATEGORY_DEFAULT_NAME[i]) : token[0].toUpperCase() + token.slice(1)
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
  return CATEGORY_SLOTS.filter((tok) => !categoryHidden(tok))
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
    defaultName: CATEGORY_DEFAULT_NAME[i] ? t(CATEGORY_DEFAULT_NAME[i]) : token[0].toUpperCase() + token.slice(1),
    hex: catHex[i],
    custom: catHex[i].toLowerCase() !== CATEGORY_DEFAULT_HEX[i].toLowerCase(),
    hidden: catHidden[i],
    fixed: i === 0,
  }))
}
