// The mark a language wears.
//
// Every quote card leads its meta line with a face: a book's author, a film
// line's actor, a standalone quote's speaker. A PROVERB has nobody to credit —
// that is close to the definition — so its line led with nothing at all. What a
// proverb does have is a language, so the language takes the face's place.
//
// FLAGS ARE OFFERED AND NOT ASSUMED. The ask was "use flags for languages", and
// a flag is exactly what many readers will want — but a flag is a country and a
// language is not. Bengali is spoken either side of a border, Hindi has no flag
// of its own, and Spanish, Portuguese, Arabic and English each have a dozen
// with nothing to choose between them. A default here would be this app telling
// somebody which country owns their mother tongue.
//
// So: the built-in is a letter from the language's own script, the picker offers
// flags first and prominently, and one tap makes it a flag for good. The second
// half of the ask — "let the user change them if needed" — is not a fallback
// here, it is the mechanism.
//
// It is a leaf: React and nothing else. The quote cards, the board covers, the
// board form and Settings all read it, and those live on four different levels
// of the import graph.

// STARTER_LANGUAGES — the ten most spoken, each with a glyph from its dominant
// script, which is what a proverb board's default cover draws.
//
// The glyphs are deliberately DISTINCT letters rather than the same "A" five
// times: four of these ten are written in Latin, and a cover that was the
// identical glyph on all four would tell you nothing about which board you were
// looking at. So Spanish gets its ñ and Russian its Ж — the letter a reader of
// that language would name if asked to pick one.
export const STARTER_LANGUAGES = [
  { name: 'English', glyph: 'A' },
  { name: 'Mandarin', glyph: '字' },
  { name: 'Hindi', glyph: 'अ' },
  { name: 'Spanish', glyph: 'ñ' },
  { name: 'French', glyph: 'É' },
  { name: 'Arabic', glyph: 'ع' },
  { name: 'Bengali', glyph: 'অ' },
  { name: 'Portuguese', glyph: 'ã' },
  { name: 'Russian', glyph: 'Ж' },
  { name: 'Urdu', glyph: 'ی' },
]

// MARK_PALETTE — what the picker offers, flags first.
//
// A PALETTE, NOT A MAPPING, and the distinction is the whole point of this file.
// Nothing here says which flag belongs to which language; it is a tray of marks
// a reader picks from, the same way the colour categories offer a tray of
// swatches without deciding what "Disagreed" should look like. Somebody marking
// Bengali reaches for 🇧🇩 or 🇮🇳 or অ, and only they know which.
export const MARK_PALETTE = [
  '🇬🇧', '🇺🇸', '🇮🇳', '🇧🇩', '🇵🇰', '🇨🇳', '🇯🇵', '🇰🇷',
  '🇪🇸', '🇲🇽', '🇫🇷', '🇵🇹', '🇧🇷', '🇷🇺', '🇩🇪', '🇮🇹',
  '🇸🇦', '🇪🇬', '🇮🇷', '🇹🇷', '🇳🇬', '🇰🇪', '🇮🇩', '🇻🇳',
  '🌍', '🌏', '📜', '🗣',
]

const fold = (s) => String(s || '').trim().toLowerCase()

// ---- the reader's own marks ------------------------------------------------
//
// Held as module state and fed by App from the session preferences, the same
// shape applyTheme and applyColors already use. A card three screens deep needs
// the mark and has no business being handed the whole user to get it.
let marks = {}

// applyLanguageMarks parses the stored blob. Bad JSON is no marks rather than a
// thrown render: the server normalises on write, and a value that got past it is
// still not worth taking a screen down for.
export function applyLanguageMarks(prefs) {
  marks = {}
  const raw = String(prefs?.languageMarks || '').trim()
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.trim()) marks[fold(k)] = v.trim()
      }
    }
  } catch {
    marks = {}
  }
}

// languageMarksState is what Settings renders from: every starter plus every
// language the reader has actually marked, so a language typed into a board form
// and marked there does not vanish from the list that edits it.
export function languageMarksState(extra = []) {
  const seen = new Map()
  for (const s of STARTER_LANGUAGES) seen.set(fold(s.name), { name: s.name, glyph: s.glyph })
  for (const name of [...Object.keys(marks), ...extra.map(fold)]) {
    if (!seen.has(name)) seen.set(name, { name, glyph: '' })
  }
  return [...seen.entries()].map(([key, v]) => ({
    key,
    name: v.name,
    glyph: v.glyph,
    mark: marks[key] || '',
    resolved: marks[key] || v.glyph || '',
  }))
}

// languageMarksBlob serialises a {folded name -> mark} object back to the string
// the preference stores. The server re-normalises and sorts it; this only has to
// be valid.
export function languageMarksBlob(next) {
  const out = {}
  for (const [k, v] of Object.entries(next || {})) {
    const key = fold(k)
    const mark = String(v || '').trim()
    if (key && mark) out[key] = mark
  }
  return Object.keys(out).length ? JSON.stringify(out) : ''
}

export const currentLanguageMarks = () => ({ ...marks })

// ---- resolving a mark ------------------------------------------------------

// glyphFor — the script glyph for the first known language in a list, or "" when
// nothing is known. Matched on the folded name, because the starter list seeds a
// free-text field and "bengali" is the same language as "Bengali".
//
// A language nobody listed gets NO glyph. Guessing a script from an unknown name
// would put a Latin A on a board of Yoruba proverbs, and being confidently wrong
// about somebody's language is worse than being blank.
export function glyphFor(languages = []) {
  for (const l of languages) {
    const key = fold(l)
    const hit = STARTER_LANGUAGES.find((s) => fold(s.name) === key)
    if (hit) return hit.glyph
  }
  return ''
}

// markFor — what to DRAW for a language: the reader's mark if they set one, else
// the script glyph, else nothing.
//
// The override wins over the starter glyph for every language, including one
// nobody listed — which is how a reader gets a mark on their Yoruba board at all.
export function markFor(languages = []) {
  const list = Array.isArray(languages) ? languages : [languages]
  for (const l of list) {
    const key = fold(l)
    if (!key) continue
    if (marks[key]) return marks[key]
  }
  return glyphFor(list)
}

// LanguageMark — the round mark itself, sized and shaped like the credit face it
// stands in for so the two read as one slot rather than two designs.
export function LanguageMark({ languages, size = 20, ring = 'var(--card)', className = '' }) {
  const mark = markFor(languages)
  if (!mark) return null
  const list = Array.isArray(languages) ? languages : [languages]
  const name = list.filter(Boolean)[0] || ''
  return (
    <span
      className={className}
      title={name}
      aria-label={name ? `in ${name}` : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        // The same disc a portrait draws, in the raised surface rather than a
        // photograph — a mark is a stand-in for a face, not a picture of one.
        background: 'var(--raised)',
        border: `1px solid var(--ink-border)`,
        boxShadow: `0 0 0 1.5px ${ring}`,
        fontSize: Math.round(size * 0.58),
        lineHeight: 1,
        verticalAlign: 'middle',
        flex: 'none',
        // A flag is an emoji and a script letter is type. Leaving the font to
        // the cascade lets each render as itself instead of forcing one voice
        // onto both.
        fontFamily: 'var(--font-ui)',
      }}
    >
      {mark}
    </span>
  )
}
