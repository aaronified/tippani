// HOW MUCH OF THE ORIGINAL A CARD SHOWS, and who decides.
//
// THE OWNER'S SPEC: "There will be per work control over whether the cards are to
// show 1) translations above quotations, 2) quotations above translation, 3) no
// translation, 4) no quotations. same control will be there in metadata section on
// per language basis. the work controls will supercede the metadata controls."
//
// IT REPLACES A GUESS WITH AN INSTRUCTION. What shipped this morning inferred the
// answer from a `readLanguages` list — name the languages you read, and a quote in
// any other one led with its translation. That was one bit where the reader wanted
// four, and it could not say "never show me the Bengali" or "never show me the
// English" at all. The owner's own ruling on being shown the overlap: the four
// states absorb the declaration, because "I read German" IS "for German, the
// quotation goes above the translation" and the other two states have no spelling
// in a boolean.
//
// THE FOUR ARE ONE AXIS, WHICH IS WHY A SLIDER IS THE RIGHT CONTROL — the owner
// asked for one ("I can slide across the 4 options beside it"), and the reason it
// works is that they are ordered: each stop shows strictly more of the original
// than the last. That is the order they are declared in, and the order the row
// draws them in.
export const TEXT_ORDERS = ['trans-only', 'trans-first', 'quote-first', 'quote-only']

// WHAT EACH ONE MEANS, in the owner's words, so the table's labels and this
// module cannot drift apart:
//
//   trans-only   "no quotations"              — the translation, alone
//   trans-first  "translations above quotations"
//   quote-first  "quotations above translation"
//   quote-only   "no translation"             — the quotation, alone
//
// AND `quote-first` IS THE DEFAULT, because it is what the app did before any of
// this existed: every quote reads as written, with its translation underneath. A
// default that reordered a library on upgrade would be the app changing somebody's
// cards for a preference they never expressed.
export const TEXT_ORDER_DEFAULT = 'quote-first'

// INHERIT IS THE ABSENCE OF A VALUE, not a fifth stop. A work with no opinion
// stores nothing, so the language decides; a language with no opinion stores
// nothing, so the master does. Storing an explicit "inherit" would mean two
// spellings of the same state and a migration the first time one of them changed.
const known = (v) => (TEXT_ORDERS.includes(v) ? v : null)

// resolveTextOrder — the precedence, in one place, top wins:
//
//   1. the WORK (a book, a film, a show, a game) or, for a standalone quote, its
//      BOARD. The owner's ruling: a quote has no work row — `work_title` is a
//      plain string on the quote, so two quotes can spell one work differently —
//      and a board is the nearest thing it has to a container.
//   2. the LANGUAGE the line is in.
//   3. the MASTER, which is the slider above the column.
//
// `scope` is whichever of work-or-board applies; the caller knows which it has and
// this does not need to. One argument rather than two, because a card belongs to
// exactly one of them and a function taking both would have to decide which wins —
// a decision neither the owner nor the schema has any use for.
export function resolveTextOrder({ scope, language, byLanguage, master } = {}) {
  const own = known(scope)
  if (own) return own
  const lang = foldLanguage(language)
  const byLang = lang && byLanguage ? known(byLanguage[lang]) : null
  if (byLang) return byLang
  return known(master) || TEXT_ORDER_DEFAULT
}

// The same fold the rest of the app matches language names with — a language is a
// name the reader typed, so "ENG", "eng" and " Eng " are one language.
export function foldLanguage(v) {
  return String(v || '').trim().toLowerCase()
}

// textOrderFromReadLanguages — the retirement of `readLanguages`, and it has to be
// EXACTLY today's behaviour or it is a change nobody asked for.
//
// What that preference meant: an empty list read everything, so every quote read as
// written; a non-empty list read those languages as written and led with the
// translation for every other. So:
//
//   empty  -> master quote-first, nothing per language. Every card as before.
//   listed -> master trans-first (what an undeclared language did), and each
//             declared language quote-first (what a declared one did).
//
// A LANGUAGE WITH NO NAME CANNOT BE DECLARED, so a blank entry is dropped rather
// than folded to "" and given a row that would then out-rank the master for every
// untagged quote in the library.
export function textOrderFromReadLanguages(readLanguages) {
  let list = []
  try {
    const parsed = typeof readLanguages === 'string' ? JSON.parse(readLanguages) : readLanguages
    if (Array.isArray(parsed)) list = parsed
  } catch {
    list = []
  }
  const names = list.map(foldLanguage).filter(Boolean)
  if (!names.length) return { master: 'quote-first', byLanguage: {} }
  const byLanguage = {}
  for (const n of names) byLanguage[n] = 'quote-first'
  return { master: 'trans-first', byLanguage }
}

// masterIsCustom — whether the slider above the column should draw dimmed.
//
// THE OWNER'S: "when other knobs are adjusted (custom), it will lose contrast,
// which will indicate custom state." So the master is three things at once — a
// stored default a new language inherits, a bulk setter that pushes every row to
// itself, and an indicator of whether the rows still agree with it. This answers
// the third. A row that agrees with the master is not custom, however it got there.
export function masterIsCustom(master, byLanguage) {
  const m = known(master) || TEXT_ORDER_DEFAULT
  return Object.values(byLanguage || {}).some((v) => known(v) && v !== m)
}
