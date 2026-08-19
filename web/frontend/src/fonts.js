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

// EVERY LABEL, NOTE AND SPECIMEN BELOW IS A KEY. This module is evaluated at
// import, before the reader's language is known, and it renders nothing itself —
// Settings' Type card resolves each one through t() as it draws the row. A face's
// `name` is keyed too, so a transliteration into the reader's script is possible
// where one is wanted; `family` is the CSS family and never moves.
//
// ROLES — in the order the picker shows them, which is the order they matter.
// `sample` is the role doing its actual job, because a type list that sets the
// same specimen sentence in every face tells you nothing about the only question
// worth asking, which is how it looks doing THIS.
export const FONT_ROLES = [
  {
    key: 'display',
    prop: '--font-display',
    label: 'vocab.font-role.display.label',
    what: 'vocab.font-role.display.what',
    sample: 'vocab.font-role.display.sample',
    italic: true,
  },
  {
    key: 'ui',
    prop: '--font-ui',
    label: 'vocab.font-role.ui.label',
    what: 'vocab.font-role.ui.what',
    sample: 'vocab.font-role.ui.sample',
  },
  {
    key: 'mono',
    prop: '--font-mono',
    label: 'vocab.font-role.mono.label',
    what: 'vocab.font-role.mono.what',
    sample: 'vocab.font-role.mono.sample',
  },
  {
    key: 'hand',
    prop: '--font-hand',
    label: 'vocab.font-role.hand.label',
    what: 'vocab.font-role.hand.what',
    sample: 'vocab.font-role.hand.sample',
  },
  {
    key: 'bengali',
    prop: '--font-bengali',
    label: 'vocab.font-role.bengali.label',
    what: 'vocab.font-role.bengali.what',
    sample: 'vocab.font-role.bengali.sample',
    script: 'bengali',
  },
  {
    key: 'devanagari',
    prop: '--font-devanagari',
    label: 'vocab.font-role.devanagari.label',
    what: 'vocab.font-role.devanagari.what',
    sample: 'vocab.font-role.devanagari.sample',
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
    { id: 'newsreader', name: 'vocab.face.newsreader.name', family: 'Newsreader', note: 'vocab.face.newsreader.note' },
    { id: 'source-serif-4', name: 'vocab.face.source-serif-4.name', family: 'Source Serif 4', note: 'vocab.face.source-serif-4.note' },
    { id: 'literata', name: 'vocab.face.literata.name', family: 'Literata', note: 'vocab.face.literata.note' },
  ],
  ui: [
    { id: 'hanken-grotesk', name: 'vocab.face.hanken-grotesk.name', family: 'Hanken Grotesk', note: 'vocab.face.hanken-grotesk.note' },
    { id: 'inter', name: 'vocab.face.inter.name', family: 'Inter', note: 'vocab.face.inter.note' },
    { id: 'public-sans', name: 'vocab.face.public-sans.name', family: 'Public Sans', note: 'vocab.face.public-sans.note' },
  ],
  mono: [
    { id: 'ibm-plex-mono', name: 'vocab.face.ibm-plex-mono.name', family: 'IBM Plex Mono', note: 'vocab.face.ibm-plex-mono.note' },
    { id: 'jetbrains-mono', name: 'vocab.face.jetbrains-mono.name', family: 'JetBrains Mono', note: 'vocab.face.jetbrains-mono.note' },
    { id: 'source-code-pro', name: 'vocab.face.source-code-pro.name', family: 'Source Code Pro', note: 'vocab.face.source-code-pro.note' },
  ],
  hand: [
    { id: 'caveat', name: 'vocab.face.caveat.name', family: 'Caveat', note: 'vocab.face.caveat.note' },
    { id: 'kalam', name: 'vocab.face.kalam.name', family: 'Kalam', note: 'vocab.face.kalam.note' },
    { id: 'gloria-hallelujah', name: 'vocab.face.gloria-hallelujah.name', family: 'Gloria Hallelujah', note: 'vocab.face.gloria-hallelujah.note' },
  ],
  bengali: [
    { id: 'noto-serif-bengali', name: 'vocab.face.noto-serif-bengali.name', family: 'Noto Serif Bengali', note: 'vocab.face.noto-serif-bengali.note' },
    { id: 'hind-siliguri', name: 'vocab.face.hind-siliguri.name', family: 'Hind Siliguri', note: 'vocab.face.hind-siliguri.note' },
    { id: 'tiro-bangla', name: 'vocab.face.tiro-bangla.name', family: 'Tiro Bangla', note: 'vocab.face.tiro-bangla.note' },
  ],
  devanagari: [
    { id: 'noto-serif-devanagari', name: 'vocab.face.noto-serif-devanagari.name', family: 'Noto Serif Devanagari', note: 'vocab.face.noto-serif-devanagari.note' },
    { id: 'hind', name: 'vocab.face.hind.name', family: 'Hind', note: 'vocab.face.hind.note' },
    { id: 'tiro-devanagari-hindi', name: 'vocab.face.tiro-devanagari-hindi.name', family: 'Tiro Devanagari Hindi', note: 'vocab.face.tiro-devanagari-hindi.note' },
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
  { id: 'bold', label: 'vocab.font-style.bold.label', css: { fontWeight: '700' } },
  { id: 'italic', label: 'vocab.font-style.italic.label', css: { fontStyle: 'italic' } },
  // Meaningless in Bengali and Devanagari, which have no case at all — the row
  // offers what its script can do, and `caseless` is how it knows.
  { id: 'smallcaps', label: 'vocab.font-style.smallcaps.label', css: { fontVariantCaps: 'small-caps' }, needsCase: true },
  { id: 'allcaps', label: 'vocab.font-style.allcaps.label', css: { textTransform: 'uppercase' }, needsCase: true },
  { id: 'figures', label: 'vocab.font-style.figures.label', css: { fontVariantNumeric: 'tabular-nums' } },
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
  // An uploaded face is offered for every role, because only the reader knows
  // what they uploaded it for — and the script check is what tells them whether
  // it suits the one they picked.
  return list.find((f) => f.id === token) || uploadFace(token) || list[0]
}


// ---- fonts a reader uploaded ----------------------------------------------
//
// A preference can name one as `upload:12`. The face itself is registered as a
// FontFace at load, under a family name derived from the id, so the rest of this
// file resolves it exactly like a bundled one and nothing downstream — the
// stacks, the share image, the picker — has to know the difference.

let uploads = [] // [{ id, name, token, format }]

const uploadFamily = (id) => `TippaniUpload${id}`

export const uploadedFonts = () => uploads.slice()

// registerUploads loads each uploaded face into the document and remembers them.
// BEST EFFORT, NEVER THROWING: a font that fails to load leaves its token
// unresolvable, and an unresolvable token falls back to the built-in — which is
// exactly what should happen to a file that turned out not to work.
export async function registerUploads(list) {
  uploads = (list || []).map((f) => ({ ...f, family: uploadFamily(f.id) }))
  if (typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined') return
  await Promise.all(
    uploads.map(async (f) => {
      try {
        const face = new FontFace(f.family, `url(/api/fonts/${f.id}/file)`)
        await face.load()
        document.fonts.add(face)
      } catch {
        // Leave it in the list — the picker should still show what was uploaded,
        // and the fallback covers the rendering.
      }
    }),
  )
}

// uploadFace resolves an `upload:N` token to a face shaped like a bundled one.
function uploadFace(token) {
  const m = /^upload:(\d+)$/.exec(String(token || ''))
  if (!m) return null
  const hit = uploads.find((f) => String(f.id) === m[1])
  return hit ? { id: token, name: hit.name, family: hit.family, note: 'vocab.face.upload.note' } : null
}

// ---- the script check ------------------------------------------------------
//
// "A verifier will verify if the language / script is the same." Replace the
// Bengali face with something that has no Bengali in it and every Bengali quote
// turns into boxes, silently, with nothing on the screen that did it to say why.
//
// IT RUNS BY MEASUREMENT, NOT BY PARSING, and the reason is worth stating.
// Reading the cmap table would mean a font parser; woff2 is Brotli-compressed,
// so in the browser it would mean shipping a decompressor as well — for a check
// whose answer is advisory either way. Instead: set a string of the target
// script in the candidate face and in a control that certainly lacks it, and
// compare widths. A font without the script substitutes the same fallback the
// control does and measures identically; one with it does not.
//
// IT IS A WARNING AND NOT A REFUSAL. It can be fooled both ways — a font with
// three Bengali glyphs passes — and refusing somebody's own font on the strength
// of a metrics heuristic is worse than telling them what looks wrong.
const SCRIPT_PROBES = {
  bengali: 'অআইঈউকখগঘঙ',
  devanagari: 'अआइईउकखगघङ',
  latin: 'Hamburgefonstiv',
}

export function scriptProbe(script) {
  return SCRIPT_PROBES[script] || SCRIPT_PROBES.latin
}

// hasScript measures whether `family` draws `script` itself.
//
// Returns null when it cannot tell — no canvas, no text metrics — because "I did
// not check" and "it failed" must not be the same answer on a screen that is
// about to say something discouraging.
export function hasScript(family, script) {
  if (typeof document === 'undefined') return null
  const ctx = document.createElement('canvas').getContext?.('2d')
  if (!ctx || typeof ctx.measureText !== 'function') return null
  const probe = scriptProbe(script)
  const width = (f) => {
    ctx.font = `40px ${f}`
    return ctx.measureText(probe).width
  }
  // monospace is the control: a face that lacks the script falls through to the
  // same generic the control resolves to, so the two measure the same.
  const control = width('monospace')
  const candidate = width(`"${family}", monospace`)
  if (!control || !candidate) return null
  return Math.abs(candidate - control) > 0.5
}

// verifyUpload is what the upload screen calls: does this face draw the script
// the role it is being assigned to needs? `null` means undecidable.
export function verifyUpload(family, roleKey) {
  const role = FONT_ROLES.find((r) => r.key === roleKey)
  return hasScript(family, role?.script || 'latin')
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
