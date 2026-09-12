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
// It is near the bottom of the graph: React and `iso639.js`, which is itself a leaf
// with no imports at all. The quote cards, the board covers, the board form and
// Settings all read THIS file, and those live on four different levels of the import
// graph — which is why the language list sits one level below rather than beside any
// of them.
//
// A LANGUAGE'S STORED NAME IS NEVER TRANSLATED. What a board form writes into a
// quote's `languages` and the folded form the languageMarks preference is keyed
// under are the same string — translate either and every mark and every proverb
// board stops matching. The app's own answer to a reader who wants to see বাংলা is
// per-reader rather than per-language: the rename in Settings → Languages, which
// changes the display name and never the stored one.
//
// THE TEN HAND-PICKED STARTERS ARE GONE (the owner's ruling), and `iso639.js` is
// what replaced them. Where this file used to hold ten names with four glyphs each,
// typed by hand, it now asks that module — which knows ninety-one languages and takes
// each one's letters from its own name for itself.
//
// THE MARK IS A LETTER NO OTHER LANGUAGE OF THAT SCRIPT WRITES where one exists —
// ৰ for Assamese, where Bengali writes র — and otherwise the first letter of the
// language's own name that no earlier language of the script has claimed. Both
// clauses are the hand-picked rows' reasons for existing, kept: four of the ten were
// written in Latin and a naive first-rune rule draws one letter on all four covers,
// and a letter both languages of a script share identifies neither. Answered in that
// module rather than accepted here.
//
// A TRAY CAN BE SHORTER THAN FOUR NOW, which it never was. Four was a floor while
// somebody was typing them in; it is a ceiling when they come off the autonym, and
// 中文 has two letters in it. Padding it out would be the app choosing a letter again.

import { t } from './i18n.js'
import { glyphsFor, languageFor, markFor as scriptMark } from './iso639.js'

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

// languageMarksState is what Settings renders from: every language the reader has
// touched, plus whatever the caller says their library actually holds.
//
// NO FIXED SEED ANY MORE. It used to open with the ten starters whether or not the
// reader had a word in any of them, which was a list the app chose; with the
// starters gone the list is the reader's own — their marks, and the languages their
// quotes are actually in. A new account sees an empty table and an add box, which is
// the honest picture of a library with no languages recorded in it.
//
// `extra` NAMES ROWS AND NOTHING ELSE. The old shape carried a second meaning —
// `added` said "not a starter", which was the same question as "may this be
// removed" only while the ten were unremovable. There is no remove control on this
// panel, so the flag had no reader; it is gone rather than left to go stale under a
// changed meaning, and the row-refuses-removal rule will bring back what it needs
// beside the button that needs it.
//
// AND THE CANONICAL NAME HAS TO BE RECOVERED, which the ten starters used to do by
// being written down: `seen.set(fold(s.name), s.name)` put "Bengali" beside the key
// "bengali". Nothing else carries that capitalisation — the entries map is keyed on
// the fold — so without this the row would head itself "bengali". `iso639.js` knows
// the name for a language it has heard of; for one it has not, the caller's own
// spelling is what the quote is stored under and is better than the fold.
export function languageMarksState(extra = []) {
  const seen = new Map()
  for (const name of [...Object.keys(entries), ...extra]) {
    const key = fold(name)
    if (!key) continue
    const known = languageFor(key)?.name
    // A later, better spelling may replace a fold — a marked language the library
    // also holds is seen twice, first as its key and then as the reader typed it.
    if (known) seen.set(key, known)
    else if (!seen.has(key) || seen.get(key) === key) seen.set(key, name)
  }
  return [...seen.entries()].map(([key, canonical]) => {
    const e = entries[key] || { mark: '', customs: [], name: '' }
    return {
      key,
      // The canonical name is what quotes are matched on and never changes; the
      // display name is what this reader calls it. Both travel, because the row
      // has to be able to say "Bengali" while showing "বাংলা".
      canonical,
      name: e.name || canonical,
      // RENAMED IS A COMPARISON, NOT THE PRESENCE OF A FIELD. A stored name is now
      // also how a language with no mark keeps its row (see languageMarksBlob), so
      // "there is a name" and "this reader calls it something else" have come
      // apart — and only the second may draw the canonical name beside the row.
      renamed: !!e.name && fold(e.name) !== key,
      glyph: scriptMark(canonical),
      glyphs: glyphsFor(canonical),
      mark: e.mark,
      customs: e.customs,
      resolved: e.mark || scriptMark(canonical),
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
    // THE NAME IS ALWAYS KEPT, because an entry with nothing in it is dropped
    // whole and the entry is now the ONLY record that this language is on the
    // reader's list. It used to be dropped when it matched a known language's own
    // name, on the reasoning that a row saying nothing is not a setting — true
    // while ten starters were rows whether or not anything was stored for them,
    // and false the moment the starters went: a reader who typed "Bengali" and
    // gave it no mark would have watched the row appear and be gone on the next
    // reload, which is "add a language" failing its own test.
    //
    // Keeping it does not resurrect the redundant-rename badge. That question is
    // asked at display time now — languageMarksState compares the stored name with
    // the key — so storage keeps the row and the row still knows it was not
    // renamed.
    if (e.name) row.n = e.name
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

// glyphFor — the script glyph for the first language in a list that `iso639.js`
// knows, or "" when it knows none. Matched on the folded name, code or autonym,
// because this seeds a free-text field and "bengali", "bn" and "বাংলা" are one
// language.
//
// A LANGUAGE THE MODULE HAS NEVER HEARD OF STILL GETS NO GLYPH, and that has not
// changed with the list growing from ten to ninety-one. Deriving a mark from an
// unknown name would take its first letter — which for a language written in a
// script the name is not written in puts a Latin S on a board of Sylheti proverbs.
// Being confidently wrong about somebody's language is worse than being blank, and
// the reader's own mark is how they fix it.
export function glyphFor(languages = []) {
  const list = Array.isArray(languages) ? languages : [languages]
  for (const l of list) {
    const g = scriptMark(l)
    if (g) return g
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
      aria-label={name ? t('common.language-mark.aria', { name }) : undefined}
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
