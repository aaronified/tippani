// The mark a language wears.
//
// Every quote card leads its meta line with a face: a book's author, a film
// line's actor, a standalone quote's speaker. A PROVERB has nobody to credit —
// that is close to the definition — so its line led with nothing at all. What a
// proverb does have is a language, so the language takes the face's place.
//
// NO FLAGS (1.16.0). The original ask was "use flags for languages" and the
// answer was to offer twenty-four of them without ever mapping one to a
// language, on the grounds that a flag is a country and a language is not.
// That reasoning was right and the tray was still wrong: a flag OFFERED first,
// in a grid, is a recommendation whatever the code says it is, and the reader
// picking 🇧🇩 for Bengali has still been handed a country by this app. It also
// made the picker a geography quiz — twenty-four flags, one of which might suit,
// none of which is about the language.
//
// So what a language offers now is ITS OWN SCRIPT: four letters, from the script
// that language is written in, and nothing else. A flag is still reachable, by
// typing one — which is the difference between a tool the reader can use for
// anything and a tray that suggests. Anything typable works: a script the app
// has never heard of, a symbol, an emoji nobody thought of.
//
// It is a leaf: React and nothing else. The quote cards, the board covers, the
// board form and Settings all read it, and those live on four different levels
// of the import graph.

// STARTER_LANGUAGES — the ten most spoken, each with FOUR glyphs from its own
// script, and the first is the default the board cover draws.
//
// FOUR, and all four in the same script, because the choice being offered is
// "which letter stands for my language" and not "which country". Four is enough
// to have a preference between and few enough to read as a row rather than a
// grid — and the fourth is doing real work: the letter a Bengali reader would
// pick is not necessarily the first letter of the alphabet.
//
// The glyphs are deliberately DISTINCT between languages that share a script:
// four of these ten are written in Latin, and a cover that was the identical
// glyph on all four would tell you nothing about which board you were looking
// at. So Spanish leads with ñ and Portuguese with ã. Urdu and Arabic share a
// script and do NOT share a row: Urdu offers the four letters Arabic does not
// have, which is exactly how a reader tells the two apart on a shelf.
export const STARTER_LANGUAGES = [
  { name: 'English', glyphs: ['A', 'a', 'E', 'W'] },
  { name: 'Mandarin', glyphs: ['字', '文', '中', '話'] },
  { name: 'Hindi', glyphs: ['अ', 'क', 'ह', 'न'] },
  { name: 'Spanish', glyphs: ['ñ', 'Ñ', 'á', '¡'] },
  { name: 'French', glyphs: ['É', 'é', 'à', 'ç'] },
  { name: 'Arabic', glyphs: ['ع', 'ض', 'ا', 'ق'] },
  { name: 'Bengali', glyphs: ['অ', 'আ', 'ক', 'ব'] },
  { name: 'Portuguese', glyphs: ['ã', 'Ã', 'ç', 'õ'] },
  { name: 'Russian', glyphs: ['Ж', 'Я', 'Д', 'Б'] },
  { name: 'Urdu', glyphs: ['ی', 'ے', 'ں', 'ھ'] },
].map((l) => ({ ...l, glyph: l.glyphs[0] }))

// How many of the reader's own glyphs one language may keep. A bound rather than
// a limit for its own sake: the custom bar sits under a row of four and reads as
// its second line, and an unbounded one turns the tray into a scrolling list of
// symbols somebody pasted once. Beyond four, one has to go — which is a decision
// about which mark you actually use, and the whole feature is that decision.
export const MAX_CUSTOM_MARKS = 4

// The longest a mark may be, mirroring languageMarkMaxRunes on the server. Two
// regional-indicator code points make a flag and a subdivision flag is seven, so
// eight admits every single mark and no sentence.
export const MARK_MAX_RUNES = 8
// And the name side, mirroring languageNameMaxRunes.
export const LANGUAGE_NAME_MAX_RUNES = 40

const fold = (s) => String(s || '').trim().toLowerCase()
const runes = (s) => [...String(s || '')].length
// Control characters out, then trim. A mark made only of them draws as an empty
// circle the reader cannot tell from a bug, and the server refuses them outright
// — so stripping here means the client never offers to save a value that would
// come straight back rejected.
const clean = (s) => String(s || '').replace(/[\u0000-\u001F\u007F]/g, '').trim()

// ---- the reader's own marks ------------------------------------------------
//
// Held as module state and fed by App from the session preferences, the same
// shape applyTheme and applyColors already use. A card three screens deep needs
// the mark and has no business being handed the whole user to get it.
//
// An entry is { mark, customs[], name } keyed by the FOLDED language name.
let entries = {}

// normEntry accepts both shapes the preference has ever held.
//
// THE OLD ONE IS A BARE STRING — `{"bengali":"🇧🇩"}` — which is what every
// account that set a mark before 1.16.0 has stored, and it must keep working
// without a migration: this is a per-user preference string, there is no
// migration step for one, and an account that opened Settings once would
// otherwise find its mark gone with nothing to say why.
function normEntry(v) {
  if (typeof v === 'string') {
    const mark = clean(v)
    return mark ? { mark, customs: [], name: '' } : null
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const mark = clean(v.m)
  const name = clean(v.n)
  const customs = []
  for (const c of Array.isArray(v.c) ? v.c : []) {
    const g = clean(c)
    // Deduped on the way in: two identical customs are one swatch drawn twice
    // and a remove button that appears to do nothing.
    if (g && runes(g) <= MARK_MAX_RUNES && !customs.includes(g)) customs.push(g)
    if (customs.length >= MAX_CUSTOM_MARKS) break
  }
  if (!mark && !name && customs.length === 0) return null
  return { mark: runes(mark) <= MARK_MAX_RUNES ? mark : '', customs, name: runes(name) <= LANGUAGE_NAME_MAX_RUNES ? name : '' }
}

// applyLanguageMarks parses the stored blob. Bad JSON is no marks rather than a
// thrown render: the server normalises on write, and a value that got past it is
// still not worth taking a screen down for.
export function applyLanguageMarks(prefs) {
  entries = {}
  const raw = String(prefs?.languageMarks || '').trim()
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed)) {
        const key = fold(k)
        const e = normEntry(v)
        if (key && e) entries[key] = e
      }
    }
  } catch {
    entries = {}
  }
}

const starterFor = (key) => STARTER_LANGUAGES.find((s) => fold(s.name) === key)

// languageMarksState is what Settings renders from: every starter plus every
// language the reader has touched, so a language typed into a board form and
// marked there does not vanish from the list that edits it.
//
// `added` says whether a row is one of the reader's own rather than a starter,
// which is the only thing that may be removed — a starter with no mark is not
// clutter, it is the list.
export function languageMarksState(extra = []) {
  const seen = new Map()
  for (const s of STARTER_LANGUAGES) seen.set(fold(s.name), s.name)
  for (const name of [...Object.keys(entries), ...extra.map(fold)]) {
    if (name && !seen.has(name)) seen.set(name, name)
  }
  return [...seen.entries()].map(([key, canonical]) => {
    const e = entries[key] || { mark: '', customs: [], name: '' }
    const starter = starterFor(key)
    return {
      key,
      // The canonical name is what quotes are matched on and never changes; the
      // display name is what this reader calls it. Both travel, because the row
      // has to be able to say "Bengali" while showing "বাংলা".
      canonical,
      name: e.name || canonical,
      renamed: !!e.name,
      glyph: starter?.glyph || '',
      glyphs: starter?.glyphs || [],
      mark: e.mark,
      customs: e.customs,
      added: !starter,
      resolved: e.mark || starter?.glyph || '',
    }
  })
}

// languageMarksBlob serialises the rows back to the string the preference
// stores. Short keys (m/c/n) because this is one column of one row and the long
// ones would be most of it; the server re-normalises and sorts, so this only has
// to be valid.
export function languageMarksBlob(next) {
  const out = {}
  for (const [k, v] of Object.entries(next || {})) {
    const key = fold(k)
    if (!key || runes(key) > LANGUAGE_NAME_MAX_RUNES) continue
    const e = normEntry(typeof v === 'string' ? v : { m: v?.mark, c: v?.customs, n: v?.name })
    if (!e) continue
    const row = {}
    if (e.mark) row.m = e.mark
    if (e.customs.length) row.c = e.customs
    // A rename that matches a STARTER's own name is not a rename, and storing it
    // would keep a row alive for saying nothing.
    //
    // For a language the reader added, the same name is not redundant — it is
    // the only record that exists. The key is folded ("yoruba") and the name is
    // what they typed ("Yoruba"), so dropping it would lose the capitalisation
    // AND, because an entry with nothing in it is dropped whole, the language
    // itself: added, then gone on the next reload, which is how "add a language"
    // failed its own test before this line said so.
    if (e.name && (!starterFor(key) || fold(e.name) !== key)) row.n = e.name
    if (Object.keys(row).length) out[key] = row
  }
  return Object.keys(out).length ? JSON.stringify(out) : ''
}

// currentLanguageEntries — the live map, for a caller about to change one entry
// and re-serialise the rest.
export const currentLanguageEntries = () => {
  const out = {}
  for (const [k, v] of Object.entries(entries)) out[k] = { mark: v.mark, customs: [...v.customs], name: v.name }
  return out
}

// ---- resolving a mark ------------------------------------------------------

// glyphFor — the script glyph for the first known language in a list, or "" when
// nothing is known. Matched on the folded name, because the starter list seeds a
// free-text field and "bengali" is the same language as "Bengali".
//
// A language nobody listed gets NO glyph. Guessing a script from an unknown name
// would put a Latin A on a board of Yoruba proverbs, and being confidently wrong
// about somebody's language is worse than being blank.
export function glyphFor(languages = []) {
  const list = Array.isArray(languages) ? languages : [languages]
  for (const l of list) {
    const hit = starterFor(fold(l))
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
    if (entries[key]?.mark) return entries[key].mark
  }
  return glyphFor(list)
}

// nameFor — what to CALL a language: the reader's own name for it if they gave
// one, else the name the quote was stored with.
//
// The rename is a display name and nothing else. The stored language on a quote
// is never rewritten, so calling Bengali "বাংলা" cannot orphan a single quote,
// cannot break the board form's matching, and survives an export and re-import
// untouched — the same rule the colour categories have followed since they were
// renameable.
export function nameFor(languages = []) {
  const list = Array.isArray(languages) ? languages : [languages]
  for (const l of list) {
    const key = fold(l)
    if (!key) continue
    if (entries[key]?.name) return entries[key].name
    return String(l).trim()
  }
  return ''
}

// LanguageMark — the round mark itself, sized and shaped like the credit face it
// stands in for so the two read as one slot rather than two designs.
export function LanguageMark({ languages, size = 20, ring = 'var(--card)', className = '' }) {
  const mark = markFor(languages)
  if (!mark) return null
  const name = nameFor(languages)
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
        // A typed emoji is an emoji and a script letter is type. Leaving the
        // font to the cascade lets each render as itself instead of forcing one
        // voice onto both.
        fontFamily: 'var(--font-ui)', fontWeight: 'var(--font-ui-weight)', fontStyle: 'var(--font-ui-style)', fontVariantCaps: 'var(--font-ui-caps)', textTransform: 'var(--font-ui-case)', fontVariantNumeric: 'var(--font-ui-figures)',
      }}
    >
      {mark}
    </span>
  )
}
