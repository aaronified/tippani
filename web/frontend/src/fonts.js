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

// scriptOf is the FALLBACK half of languageClass below: a language with no face
// of its own still gets its script's. iso639.js imports nothing, so nothing
// follows it in here.
import { scriptOf } from './iso639.js'

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

// scriptFace — the class a text in `script` is drawn in, or '' where this app has
// no face for it.
//
// THE GUARD BETWEEN "WHICH SCRIPT IS THIS" AND "CAN WE DRAW IT". `scriptOf` in
// iso639.js answers the first for all ninety-one languages, so most of them come
// back 'latin' — which is not a role here and not a rule in the stylesheet. A
// caller that passed that straight through would put `class="latin"` on a card and
// see nothing happen, which is the worst shape of bug: correct-looking code, no
// error, no effect. The roles that carry a `script` ARE the answer, so the list
// cannot drift from the faces it describes.
export const scriptFace = (script) =>
  script && FONT_ROLES.some((r) => r.script === script) ? script : ''

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
let activeLocale = ''

const roleKeys = FONT_ROLES.map((r) => r.key)

// EVERY BUNDLED FACE, ONCE, for the two pickers that are not asking about a role.
// A language row asks "what is my German set in", and the answer is any face this
// app ships — a serif, a sans, a hand, or one you uploaded. Deduped by id because
// nothing stops two roles offering the same family later.
export const ALL_FACES = Object.values(FONT_FACES)
  .flat()
  .filter((f, i, all) => all.findIndex((x) => x.id === f.id) === i)

// foldLanguage — the key both tables use, and it is the SERVER's fold
// (foldLanguageName in read_languages.go: lower-case, trimmed, nothing else).
// Keeping the two spellings identical is what makes a row written by the browser
// findable by the browser after the server has round-tripped it.
export const foldLanguage = (s) => String(s || '').trim().toLowerCase()

// localeFonts reads the per-UI-language overlay out of the preference blob.
//
// A PARTIAL, NEVER A FULL SET — see font_scopes.go. A locale stores only the roles
// it answers differently, so the rows a reader never touched under `bn` go on
// following their English answers, and an upgrade that changes a built-in face
// still reaches every locale with no opinion about it.
//
// PARSED, NEVER THROWN: a blob that will not parse reads as no overlay, which is
// the app's own faces. A preference about type must not be able to stop the app
// from having any.
export function localeFonts(prefs, locale) {
  if (!locale) return {}
  return parseBlob(prefs?.fontsByLocale)[locale] || {}
}

// quoteFonts reads the per-QUOTE-LANGUAGE table: folded name -> face token.
export function quoteFonts(prefs) {
  const raw = parseBlob(prefs?.fontsByLanguage)
  const out = {}
  for (const [name, token] of Object.entries(raw)) {
    const key = foldLanguage(name)
    if (key && typeof token === 'string' && token) out[key] = token
  }
  return out
}

function parseBlob(raw) {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

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
// `pick` is HOW A SCOPE THAT IS NOT RENDERING GETS DRAWN. Settings' Type card can
// edit the faces for a UI language the reader is not currently in — that is the
// whole point of a per-language picker — and its specimens have to show what they
// are editing rather than what the app happens to be set to. Everything else calls
// it with one argument and gets the reader's live choice, as before.
export function stackFor(roleKey, pick = fontChoice) {
  const q = (f) => `'${f.family}'`
  const latin = q(pick(roleKey))
  const bn = q(pick('bengali'))
  const dv = q(pick('devanagari'))
  switch (roleKey) {
    case 'display':
      return `${latin}, ${bn}, ${dv}, Georgia, 'Times New Roman', serif`
    case 'ui':
      return `${latin}, ${bn}, ${dv}, system-ui, sans-serif`
    case 'mono':
      // THE MONO STACK CARRIES THE INDIC FACES TOO, and it did not until the
      // interface itself started speaking Bengali.
      //
      // The old stack was `latin, ui-monospace, monospace` on the reasoning that
      // this role is for CODE and code has no Bengali. That reasoning was sound
      // about half of what the role actually does. `--font-mono` is also what
      // MonoLabel draws with, and MonoLabel is a UI LABEL — the keep-for row on
      // the bin, the column heads on a diff, every small-caps chip, the shortcut
      // sheet's headings. Those are words, and after the migration they are words
      // in whichever language the reader chose. With no Indic face in the stack
      // every one of them fell through to whatever the operating system reached
      // for, so a Bengali reader met one arbitrary face in the middle of a
      // typography system they had otherwise chosen every part of.
      //
      // locale.jsx named this gap rather than quietly fixing it, and said the fix
      // was one line here; this is that line. The faces go AFTER the Latin one for
      // the same reason they do in the display and ui stacks — ahead of it their
      // own Latin subsets would win and the mono face would stop being monospaced
      // — and BEFORE the generic fallbacks, or `monospace` would catch Bengali
      // first and we would be back to an OS guess.
      //
      // Bengali in a mono slot is proportional and takes no small caps. That is
      // expected rather than a bug (bengali-style.md §0.5 and §6.3 both say so,
      // and §6.3 treats every mono label as a hard one-word budget because of it).
      return `${latin}, ${bn}, ${dv}, ui-monospace, 'Cascadia Mono', monospace`
    case 'hand':
      // The hand face carries the Indic ones too: a margin note on a Bengali
      // quote is as likely to be in Bengali as the quote is.
      return `${latin}, ${bn}, ${dv}, 'Segoe Script', cursive`
    default:
      return `${latin}, serif`
  }
}

// ---- a quote's own language, not its script --------------------------------
//
// THE OWNER'S SENTENCE: "every language that the user adds via adding them in
// metadata or via adding them in quotes (via the language field) should also get a
// font picker for their quotes. Even when they use same script. I may want my
// german to have serifs, but not english."
//
// WHY THE SCRIPT ROLES CANNOT ANSWER THAT. `.bengali` and `.devanagari` are the
// only two type keys a card has ever carried, and they are SCRIPTS: German and
// English are one script, so no arrangement of them can set one in a serif and
// leave the other alone. This table is keyed by the language the reader typed.
//
// A GENERATED STYLESHEET, AND NOT AN INLINE STYLE, and the choice is worth
// stating because the other one is the obvious one. Every site that draws a quote
// takes a CLASS from quoteTexts and passes it on — seven of them, in two files,
// through three components: FlowQuote, ExpandableText and TranslationLine. A
// family that arrived as a style would mean a new prop on all three of those and
// a merge at all seven sites, and one of the seven quietly not doing it is exactly
// the drift the repo's "one function both call" rule exists to stop. A rule per
// configured language keeps the contract at one word.
//
// AND THE RULE SETS A VARIABLE, NOT font-family, WHICH IS THE HALF THAT WAS
// MISSING AND MADE THE WHOLE THING INERT FOR ONE COMMIT. Every quote slot in this
// app carries an INLINE font-family — `QUOTE_STYLE` (Library.jsx), `quoteStyle`
// (Movies.jsx, flow.jsx), the Home tiles, the search hit windows — and a style
// attribute beats a normal author rule, whatever its specificity. So a class that
// declared `font-family` lost at every site it was attached to, silently: the
// reader's German went on drawing in Newsreader, the picker went on showing
// Literata, and 4,191 tests stayed green because they asserted the CLASS NAME and
// never the computed face.
//
// A custom property inherits and is read BY the inline declaration instead of
// competing with it: the rule sets `--font-quote`, every quote slot asks for
// `QUOTE_FACE` below, and the language wins by being the value rather than by
// out-ranking anything. The same indirection is why `.bengali` keeps its own
// `font-family` — the Bengali WORDMARK has no inline face and still needs one.
//
// (The count reads "three components" and not "three files" on purpose — a rater
// read it the other way, which is a fair reading of a sentence that named
// neither. The two files are Library.jsx and Movies.jsx; the three prop
// signatures are what a style would have had to change.
//
// AND THE LINE NUMBERS THAT USED TO BE HERE ARE GONE, because they were wrong
// within two commits of being written — a later rater checked them and found
// every one off by seven. A line number in a comment is a fact with no guard on
// it: nothing recompiles when it rots, and this file has now been the subject of
// that lesson twice. The class is `tp-lang-*`, so `grep` finds the sites and is
// never stale.)

// QUOTE_FACE is what a quote slot puts in its inline `fontFamily`, and it is the
// ONLY spelling of it: the language's face when one is set, the app's display
// face when it is not. Written once here so a new quote surface cannot invent a
// version of it that answers to nothing.
export const QUOTE_FACE = 'var(--font-quote, var(--font-display))'
//
// THE CLASS IS HASHED AND NOT THE NAME. A language is free text — "বাংলা",
// "Français", "Ancient Greek (Attic)" — and none of those is a CSS identifier.
// Hashing is what makes the class stable across renders and safe to write into a
// stylesheet; the name lives in the preference, which is where a reader looks.
const SHEET_ID = 'tp-language-type'

let langClasses = new Map() // folded language -> { cls, family }

// langClass hashes a folded language name to a stable, CSS-safe class. FNV-1a,
// 32-bit, base36 — not for cryptography, for a short token that is the same on
// every render and cannot collide with the app's own class names.
function langClass(key) {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return 'tp-lang-' + h.toString(36)
}

// applyQuoteFonts rewrites the generated sheet from the preference blob.
//
// REPLACED WHOLE, NEVER APPENDED TO: a language whose face was just cleared has to
// stop being styled, and a sheet that only grows would go on setting it until a
// reload. Same reason applyFonts writes every role's property rather than the one
// that changed.
function applyQuoteFonts(prefs) {
  const table = quoteFonts(prefs)
  langClasses = new Map()
  const rules = []
  for (const [key, token] of Object.entries(table)) {
    const face = anyFace(token)
    // A token nothing resolves — a face this build dropped, an upload that is
    // gone — leaves the script rung to answer, which is what the absence of a
    // setting means. Not faceFor, which falls back to the display built-in and
    // would silently override the card with a face the reader never chose.
    if (!face) continue
    const cls = langClass(key)
    // The FAMILY as well as the class, because the share image is a canvas and
    // has no stylesheet to read. One map rather than two: the picture and the
    // card must never be able to disagree about what a language is set in.
    langClasses.set(key, { cls, family: face.family })
    rules.push(`.${cls}{--font-quote:${quoteStack(face)}}`)
  }
  writeSheet(rules.join('\n'))
}

// quoteStack puts the chosen face first and the two Indic faces after it, which is
// the same trick stackFor explains: a Latin face chosen for German has no Bengali
// in it, and a card is not always only one language.
function quoteStack(face) {
  const q = (f) => `'${f.family}'`
  return `${q(face)}, ${q(fontChoice('bengali'))}, ${q(fontChoice('devanagari'))}, serif`
}

function writeSheet(css) {
  if (typeof document === 'undefined') return
  let el = document.getElementById(SHEET_ID)
  if (!css) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('style')
    el.id = SHEET_ID
    document.head.appendChild(el)
  }
  el.textContent = css
}

// languageClass is the one answer to "what face is this text in", and it is a
// LADDER rather than a lookup: the reader's own choice for this language, then the
// script's role if this app has a face for it, then nothing — which leaves the
// text in the card's own face, and is right for the ninety or so languages nobody
// has set anything for.
export function languageClass(language) {
  const key = foldLanguage(language)
  if (key && langClasses.has(key)) return langClasses.get(key).cls
  return scriptFace(scriptOf(language))
}

// languageFamily is the same answer as a CSS family name, for the one surface
// that cannot use a class: the share image draws on a canvas. '' where the reader
// has set nothing, so the caller keeps its own face — the picture's quote is a
// designed composition and only the FAMILY follows the preference (see
// quoteImage.js, which has said so since it was written).
export function languageFamily(language) {
  const key = foldLanguage(language)
  return (key && langClasses.get(key)?.family) || ''
}

// quoteFaceFor resolves what a language row in Settings should show as chosen:
// the face if one is set, and null for "follows the card". NOT faceFor, which
// falls back to the built-in — here the absence of a setting is the setting, and
// showing a face name for it would read as a choice nobody made.
export function quoteFaceFor(prefs, language) {
  return anyFace(quoteFonts(prefs)[foldLanguage(language)])
}

// anyFace resolves a token against EVERY face the app has, rather than one role's
// three, and returns null for one it cannot place.
//
// A ROLE IS NOT A SHELF. faceFor takes a role because a ROLE always has an answer
// — an unrecognised preference falls back to its built-in, which is the right
// failure for "what is the display face". A quote language is the other case: it
// may legitimately have no answer, and the app ships twelve faces that are only
// grouped by role on the picker. Resolving "tiro-bangla" through the display
// role's list would find nothing and hand back Newsreader — a face nobody chose,
// on every quote in that language, with the picker still showing the choice that
// was made. That is the bug this function exists to make impossible, and a test
// caught it exactly once.
export function anyFace(token) {
  if (!token) return null
  return ALL_FACES.find((f) => f.id === token) || uploadFace(token) || null
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
export function applyFonts(prefs, locale = activeLocale) {
  chosen = {}
  chosenStyles = {}
  activeLocale = locale || ''
  // THE UI LANGUAGE'S OWN ANSWER FIRST, THE ACCOUNT'S SECOND. The overlay is keyed
  // by ROLE (`display`) and by role plus "Style", which is the flat preference's
  // own naming minus the `font` prefix — so composing the two is a lookup and not
  // a translation table.
  const over = localeFonts(prefs, activeLocale)
  const pick = (field, flat) => (over[field] !== undefined ? over[field] : flat)
  for (const key of roleKeys) {
    chosen[key] = String(pick(key, prefs?.[prefKey(key)]) || '').trim()
    chosenStyles[key] = parseFontStyles(pick(key + 'Style', prefs?.[stylePrefKey(key)]))
  }
  applyQuoteFonts(prefs)
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

// fontState is the LIVE choice — what the app is actually drawing — and its one
// caller is the upload verifier, which is asking about the face it just assigned.
export function fontState() {
  return FONT_ROLES.map((role) => ({
    ...role,
    faces: faceList(role.key),
    chosen: fontChoice(role.key),
    styles: fontStylesOn(role.key),
  }))
}

// fontStateFor is what the Type card renders from, and it is PURE OVER prefs
// rather than over module state — because the card can now edit a scope the app is
// not in. `locale` is '' for the answer every UI language inherits, or a code for
// that language's own.
//
// `own` is the whole of the difference between the two scopes, and it is the same
// distinction TextOrderField draws: a row with nothing of its own SHOWS what it
// would inherit, so the reader sees what German looks like today rather than a
// blank, and the revert glyph is what says whether the scope has an opinion at all.
export function fontStateFor(prefs, locale) {
  const over = localeFonts(prefs, locale)
  const rows = FONT_ROLES.map((role) => {
    const has = over[role.key] !== undefined
    const hasStyle = over[role.key + 'Style'] !== undefined
    return {
      ...role,
      faces: faceList(role.key),
      chosen: faceFor(role.key, has ? over[role.key] : prefs?.[prefKey(role.key)]),
      styles: parseFontStyles(hasStyle ? over[role.key + 'Style'] : prefs?.[stylePrefKey(role.key)]),
      own: has || hasStyle,
    }
  })
  const by = Object.fromEntries(rows.map((r) => [r.key, r.chosen]))
  // The stack this scope would draw with, so the specimen is the scope's own
  // answer and not the app's. The Indic faces ride inside it exactly as they do
  // live — see stackFor.
  return rows.map((r) => ({ ...r, family: stackFor(r.key, (k) => by[k]) }))
}

// fontPatch turns a set of changes on the Type card into the preference fields
// to PUT. `changes` is keyed by role (`display`) or role plus "Style".
//
// TWO SHAPES, ONE FUNCTION, because the card is one card: the scope that every UI
// language inherits writes the flat fields the app has always had, and a named
// locale writes its overlay inside the blob. A caller says WHAT changed and never
// which of the two it is — which is what stops the "every language" scope and a
// locale scope from drifting into two code paths that look alike on screen.
//
// A SET AND NOT ONE FIELD, because one gesture is not always one field: the
// revert glyph clears a role's face AND its modifiers, and two calls would each
// compute their blob from the same unchanged preferences — so the second would
// write a table that never heard about the first, and the face would come back.
//
// `null` CLEARS, and clearing is not the same as setting "". An empty face token
// is a real value on the flat fields — it means "back to the built-in" — while a
// locale that has nothing of its own must have no entry at all, or it would stop
// following the answer it is supposed to inherit.
export function fontPatch(prefs, locale, changes) {
  if (!locale) {
    const out = {}
    for (const [field, value] of Object.entries(changes)) {
      const style = field.endsWith('Style')
      const role = style ? field.slice(0, -'Style'.length) : field
      out[style ? stylePrefKey(role) : prefKey(role)] = value === null ? '' : value
    }
    return out
  }
  const all = parseBlob(prefs?.fontsByLocale)
  const row = { ...(all[locale] || {}) }
  for (const [field, value] of Object.entries(changes)) {
    if (value === null) delete row[field]
    else row[field] = value
  }
  const next = { ...all }
  if (Object.keys(row).length) next[locale] = row
  else delete next[locale]
  return { fontsByLocale: Object.keys(next).length ? JSON.stringify(next) : '' }
}

// quoteFontPatch is the same idea for the QUOTE table: one language's face, or
// null to take the row out so it follows the card again.
export function quoteFontPatch(prefs, language, token) {
  const key = foldLanguage(language)
  const next = { ...quoteFonts(prefs) }
  if (!token) delete next[key]
  else next[key] = token
  return { fontsByLanguage: Object.keys(next).length ? JSON.stringify(next) : '' }
}
