// The type.
//
// Six ROLES — the jobs type does in this app — and three faces offered for each:
// the built-in and two alternates. A role is not a font; it is what the font is
// FOR, which is why swapping one is a one-line change here and not a search for
// every place a family name was written down.
//
// EVERY FACE IS BUNDLED, NOT FETCHED, and that is not an optimisation. Tippani
// never contacts the network on its own — no telemetry, no CDN, no phone-home —
// and a type picker that loaded Google Fonts would be the first thing in the app
// that did, on a screen about how your own words look. The cost is stated and
// accepted: twelve more families in the build. It is smaller than it sounds,
// because @fontsource splits every face by unicode-range, so a subset is only
// DOWNLOADED when a codepoint in its range is actually drawn. What grows
// unconditionally is the CSS and the image on disk, not what a browser fetches.
//
// Every one is OFL-1.1: free to use, embed, modify and redistribute.
//
// THE INDIC FACES SIT INSIDE THE LATIN STACKS, after the Latin face, and that is
// the trick the original stylesheet comment explains: no Latin codepoint ever
// reaches the Bengali face and no Bengali codepoint stops at the Latin one, so
// one stack serves both and neither pays for the other. It also means changing
// the Bengali face has to rebuild the display and ui stacks too — which is why
// the stacks are composed here, from the whole choice, rather than per role.

// ROLES — in the order the picker shows them, which is the order they matter.
// `sample` is the role doing its actual job, because a type list that sets the
// same specimen sentence in every face tells you nothing about the only question
// worth asking, which is how it looks doing THIS.
export const FONT_ROLES = [
  {
    key: 'display',
    prop: '--font-display',
    label: 'Quotes',
    what: 'The words themselves, and every title.',
    sample: 'It is a truth universally acknowledged',
    italic: true,
  },
  {
    key: 'ui',
    prop: '--font-ui',
    label: 'Interface',
    what: 'Buttons, fields, everything you press.',
    sample: 'Add to quiz · Move to board · Fill gaps',
  },
  {
    key: 'mono',
    prop: '--font-mono',
    label: 'Labels',
    what: 'Locators, dates, counts — the small caps lines.',
    sample: 'CH. 12 · P. 288 · 3 QUOTES',
  },
  {
    key: 'hand',
    prop: '--font-hand',
    label: 'Notes',
    what: 'Your margin notes, and the score on a finished round.',
    sample: 'the bit about the garden',
  },
  {
    key: 'bengali',
    prop: '--font-bengali',
    label: 'Bengali',
    what: 'Every Bengali quote, wherever it appears.',
    sample: 'যে জীবন ফড়িঙের দোয়েলের',
    script: 'bengali',
  },
  {
    key: 'devanagari',
    prop: '--font-devanagari',
    label: 'Devanagari',
    what: 'Hindi, Marathi, Sanskrit — anything in this script.',
    sample: 'जो बीत गई सो बात गई',
    script: 'devanagari',
  },
]

// FACES — what each role offers. The first is the built-in and the one an
// unrecognised preference falls back to.
//
// THE BENGALI DEFAULT CHANGED IN 1.15.0, on the reader's judgement rather than
// on a design argument. Tiro Bangla was chosen in an earlier release for a good
// stated reason — a text face with real Bengali letterforms rather than a
// pan-script fallback — and the person reading Bengali in this app called it
// horrible, which is the only evidence that counts about type you have to read.
// Noto Serif Bengali takes the default; Tiro Bangla stays on the list, because
// reversing somebody's choice is not the same as deleting it. Devanagari moves
// the same way, on the same reader's milder version of the same complaint.
export const FONT_FACES = {
  display: [
    { id: 'newsreader', name: 'Newsreader', family: 'Newsreader', note: 'The built-in' },
    { id: 'source-serif-4', name: 'Source Serif 4', family: 'Source Serif 4', note: 'Cleaner, a little wider' },
    { id: 'literata', name: 'Literata', family: 'Literata', note: 'Made for long reading' },
  ],
  ui: [
    { id: 'hanken-grotesk', name: 'Hanken Grotesk', family: 'Hanken Grotesk', note: 'The built-in' },
    { id: 'inter', name: 'Inter', family: 'Inter', note: 'Neutral, very legible small' },
    { id: 'public-sans', name: 'Public Sans', family: 'Public Sans', note: 'Plainer, squarer' },
  ],
  mono: [
    { id: 'ibm-plex-mono', name: 'IBM Plex Mono', family: 'IBM Plex Mono', note: 'The built-in' },
    { id: 'jetbrains-mono', name: 'JetBrains Mono', family: 'JetBrains Mono', note: 'Taller, more open' },
    { id: 'source-code-pro', name: 'Source Code Pro', family: 'Source Code Pro', note: 'Quieter' },
  ],
  hand: [
    { id: 'caveat', name: 'Caveat', family: 'Caveat', note: 'The built-in' },
    { id: 'kalam', name: 'Kalam', family: 'Kalam', note: 'Rounder — and writes Devanagari too' },
    { id: 'gloria-hallelujah', name: 'Gloria Hallelujah', family: 'Gloria Hallelujah', note: 'Looser, more casual' },
  ],
  bengali: [
    { id: 'noto-serif-bengali', name: 'Noto Serif Bengali', family: 'Noto Serif Bengali', note: 'The built-in' },
    { id: 'hind-siliguri', name: 'Hind Siliguri', family: 'Hind Siliguri', note: 'Sans — plainer and larger on the line' },
    { id: 'tiro-bangla', name: 'Tiro Bangla', family: 'Tiro Bangla', note: 'Traditional; the built-in before 1.15' },
  ],
  devanagari: [
    { id: 'noto-serif-devanagari', name: 'Noto Serif Devanagari', family: 'Noto Serif Devanagari', note: 'The built-in' },
    { id: 'hind', name: 'Hind', family: 'Hind', note: 'Sans — plainer and larger on the line' },
    { id: 'tiro-devanagari-hindi', name: 'Tiro Devanagari Hindi', family: 'Tiro Devanagari Hindi', note: 'Traditional; the built-in before 1.15' },
  ],
}

// STYLE MODIFIERS, per role, default none.
//
// "MONOSPACE" WAS ASKED FOR AND IS NOT HERE, and the reason is worth stating
// rather than quietly dropping. Whether a face is monospaced is a property of
// how it was drawn: no CSS makes a proportional face monospaced. The nearest
// real thing is `font-variant-numeric: tabular-nums`, which lines FIGURES up in
// columns and is genuinely wanted on a locator or a date — so that is what
// shipped, under the name of what it does. A control labelled "monospace" that
// silently swapped the face would be a second, worse copy of the picker above it.
export const FONT_STYLES = [
  { id: 'bold', label: 'Bold', css: { fontWeight: '700' } },
  { id: 'italic', label: 'Italic', css: { fontStyle: 'italic' } },
  // Meaningless in Bengali and Devanagari, which have no case at all — the row
  // offers what its script can do, and `caseless` is how it knows.
  { id: 'smallcaps', label: 'Small caps', css: { fontVariantCaps: 'small-caps' }, needsCase: true },
  { id: 'allcaps', label: 'All caps', css: { textTransform: 'uppercase' }, needsCase: true },
  { id: 'figures', label: 'Lining figures', css: { fontVariantNumeric: 'tabular-nums' } },
]

// stylesFor lists the modifiers a role can actually offer.
export function stylesFor(roleKey) {
  const role = FONT_ROLES.find((r) => r.key === roleKey)
  return FONT_STYLES.filter((s) => !(s.needsCase && role?.script))
}

const faceList = (roleKey) => FONT_FACES[roleKey] || []

// faceFor resolves a stored token to a face, falling back to the built-in.
//
// AN UNRECOGNISED TOKEN FALLS BACK TO THE BUILT-IN, never to nothing. A
// preference that fails to parse must not leave the app with no font: that is
// indistinguishable from a broken stylesheet, and it would be silent.
export function faceFor(roleKey, token) {
  const list = faceList(roleKey)
  return list.find((f) => f.id === token) || list[0]
}

// ---- the reader's choice ---------------------------------------------------

let chosen = {}
let chosenStyles = {}

const roleKeys = FONT_ROLES.map((r) => r.key)

// prefKey — the preference field for a role. Flat and repetitive on purpose:
// prefs is a comparable struct on the server (ui_test.go compares two with
// `!=`), so twelve string fields is the shape, exactly as CatName1..6 is.
export const prefKey = (roleKey) => 'font' + roleKey[0].toUpperCase() + roleKey.slice(1)
export const stylePrefKey = (roleKey) => prefKey(roleKey) + 'Style'

export function fontChoice(roleKey) {
  return faceFor(roleKey, chosen[roleKey])
}

export function fontStylesOn(roleKey) {
  return chosenStyles[roleKey] || []
}

// stackFor composes one role's whole font stack from the WHOLE choice.
//
// The Latin roles carry the two Indic faces after the Latin one, which is what
// makes a Bengali quote render in a face somebody chose rather than in whatever
// the operating system reaches for. Listing them after is the trick: before the
// Latin face, their own Latin subsets would win and the app would change
// typeface. It also means this cannot be a per-role substitution — changing the
// Bengali face rebuilds the display and ui stacks too.
export function stackFor(roleKey) {
  const q = (f) => `'${f.family}'`
  const latin = q(fontChoice(roleKey))
  const bn = q(fontChoice('bengali'))
  const dv = q(fontChoice('devanagari'))
  switch (roleKey) {
    case 'display':
      return `${latin}, ${bn}, ${dv}, Georgia, 'Times New Roman', serif`
    case 'ui':
      return `${latin}, ${bn}, ${dv}, system-ui, sans-serif`
    case 'mono':
      return `${latin}, ui-monospace, 'Cascadia Mono', monospace`
    case 'hand':
      // The hand face carries the Indic ones too: a margin note on a Bengali
      // quote is as likely to be in Bengali as the quote is.
      return `${latin}, ${bn}, ${dv}, 'Segoe Script', cursive`
    default:
      return `${latin}, serif`
  }
}

// applyFonts writes the stacks and the modifiers onto <html> as inline custom
// properties — the same mechanism applyTheme and applyColors already use, and
// the reason a font swap needs no reload.
//
// The MODIFIER properties are companions to the family, one set per role:
// --font-display-weight and so on. index.css consumes them beside every
// `font-family: var(--font-display)`, so a modifier lands exactly where its role
// is used and nowhere else. `inherit` is the off value rather than `normal`,
// because a heading that is already 600 must not be flattened to 400 by a role
// nobody has touched.
export function applyFonts(prefs) {
  chosen = {}
  chosenStyles = {}
  for (const key of roleKeys) {
    chosen[key] = String(prefs?.[prefKey(key)] || '').trim()
    chosenStyles[key] = parseFontStyles(prefs?.[stylePrefKey(key)])
  }
  const root = document.documentElement
  for (const role of FONT_ROLES) {
    root.style.setProperty(role.prop, stackFor(role.key))
    const on = new Set(chosenStyles[role.key])
    const has = (id) => on.has(id)
    root.style.setProperty(`${role.prop}-weight`, has('bold') ? '700' : 'inherit')
    root.style.setProperty(`${role.prop}-style`, has('italic') ? 'italic' : 'inherit')
    root.style.setProperty(`${role.prop}-caps`, has('smallcaps') ? 'small-caps' : 'inherit')
    root.style.setProperty(`${role.prop}-case`, has('allcaps') ? 'uppercase' : 'inherit')
    root.style.setProperty(`${role.prop}-figures`, has('figures') ? 'tabular-nums' : 'inherit')
  }
}

// parseFontStyles reads a stored token list. Unknown tokens are dropped rather
// than refused: a preference written by a newer client must not stop an older
// one from rendering.
export function parseFontStyles(pref) {
  const known = new Set(FONT_STYLES.map((s) => s.id))
  return String(pref || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => known.has(t))
}

// serialiseFontStyles is the inverse, in the list's own order so the stored
// value is stable — "italic,bold" and "bold,italic" are one setting, and two
// spellings of it make every save look like a change.
export function serialiseFontStyles(ids) {
  const on = new Set(ids || [])
  return FONT_STYLES.filter((s) => on.has(s.id)).map((s) => s.id).join(',')
}

// fontState is what Settings renders from.
export function fontState() {
  return FONT_ROLES.map((role) => ({
    ...role,
    faces: faceList(role.key),
    chosen: fontChoice(role.key),
    styles: fontStylesOn(role.key),
  }))
}
