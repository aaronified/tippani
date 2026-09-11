// THE RESOLVED STATE, PROVIDED ONCE RATHER THAN THREADED.
//
// This repo's fourth entry on the same lesson, and the third one about this exact
// feature. The board's own text menu reached a card through two components that
// only passed it along; the readable-languages predicate was added beside it and
// the table view
// spent a day not reading it, so cards led with the translation and the same rows
// in the table led with the original. WorkDoor and SearchDoor in personOpen.jsx
// exist for the same reason and their note says it best: "absent-by-omission looks
// exactly like absent-on-purpose from the outside."
//
// So the shell provides the reader's settings and anything under it resolves its
// own answer. A card passes in only what it alone knows — the language of its line
// and the opinion of the work or board it belongs to — and gets one of four
// states back. There is nothing to forget to pass down.
//
// THE PURE HALF IS textOrder.js, which imports nothing: the precedence, the four
// states and the readLanguages migration are all testable without a renderer, and
// test/pure holds them.

import { createContext, useContext } from 'react'
import { resolveTextOrder, textOrderFromReadLanguages } from './textOrder.js'

// The shape is { master, byLanguage } — the slider above the column, and the rows
// under it. An empty object is the app's default behaviour, which is what a
// context with no provider above it has to mean: a card rendered in a test or in
// a surface nobody has wrapped yet must draw, and draw as the app always did.
const TextOrderContext = createContext({})

// textOrderFrom — the reader's settings, out of the session preferences.
//
// TWO SOURCES, AND THE NEW ONE WINS. `textOrder` is the blob the per-language
// table writes (see internal/httpapi/text_order.go for its shape and what it
// refuses to store); `readLanguages` is the preference it replaces, and an account
// that has one but has never touched the table is migrated from it.
//
// THE MIGRATION IS NOT A ONE-OFF WRITE, deliberately. Nothing rewrites the old
// preference on login: it is read, mapped, and left alone. A one-time upgrade
// would be the wrong instrument twice over — it belongs to internal/store by this
// repo's own invariant, and it would have to guess whether an empty `textOrder`
// means "never set it" or "set it back to the default", which are the same bytes.
// Reading through costs nothing and answers correctly for both.
export function textOrderFrom(preferences) {
  const stored = parseTextOrder(preferences?.textOrder)
  // PRESENT-BUT-BROKEN IS NOT ABSENT, and the first version of this could not tell
  // them apart: `parseTextOrder` returned null for both, null fell through, and a
  // blob that failed to parse resurrected the old declaration — which is the exact
  // opposite of what the comment beside it claimed. The test for it caught the
  // code and the comment together.
  if (stored.present) return stored.value || { master: '', byLanguage: {} }
  return textOrderFromReadLanguages(preferences?.readLanguages)
}

// parseTextOrder — THREE ANSWERS, not two, and the third is why this is a shape
// rather than a value:
//
//   { present: false }              nothing stored. Fall through to the old
//                                   declaration, which is the migration.
//   { present: true, value: {...} } settings. Use them.
//   { present: true, value: null }  something stored that cannot be read. Use the
//                                   app's default and DO NOT fall through.
//
// THAT LAST CASE IS THE WHOLE POINT. Falling back on a parse error would reorder a
// library's cards on the strength of a syntax mistake, and the reader whose
// settings failed to load is exactly the one who should see the app's default
// rather than somebody's stale declaration. The server fails in the same
// direction — see normalizeTextOrder, which reads an unparseable stored blob as no
// settings and never as the preference it replaced.
//
// AN EMPTY OBJECT IS `present: false`, deliberately. The server stores nothing for
// a master at the default with no custom rows, so "" and "{}" are both "never
// opened the table" AND "put everything back" — the same bytes for both, so both
// have to behave the same, and falling through is the answer that leaves a
// long-standing declaration working.
function parseTextOrder(blob) {
  if (!blob || !String(blob).trim()) return { present: false }
  try {
    const o = JSON.parse(blob)
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { present: true, value: null }
    const master = typeof o.master === 'string' ? o.master : ''
    const byLanguage = o.byLanguage && typeof o.byLanguage === 'object' && !Array.isArray(o.byLanguage)
      ? o.byLanguage
      : {}
    if (!master && !Object.keys(byLanguage).length) return { present: false }
    return { present: true, value: { master, byLanguage } }
  } catch {
    return { present: true, value: null }
  }
}

export function TextOrderHost({ value, children }) {
  return <TextOrderContext.Provider value={value || {}}>{children}</TextOrderContext.Provider>
}

// ---- the scope rung: whose screen this is (0073) ----------------------------

// THE WORK'S OR THE BOARD'S OWN OPINION, PROVIDED BY THE SCREEN THAT HAS ONE.
//
// THE OWNER'S SPEC, the sentence that had no column until 0073: "the work
// controls will supercede the metadata controls." `resolveTextOrder` has taken a
// `scope` since it was written and NO CALLER EVER SUPPLIED ONE, because there was
// nothing to read.
//
// A SECOND PROVIDER RATHER THAN A FIELD ON THE FIRST, and the two facts have
// genuinely different lifetimes. `TextOrderHost` carries the READER's settings,
// mounted once at the shell and true everywhere. This carries THE CONTAINER's,
// which changes with the screen — so nesting a second TextOrderHost to add it
// would replace the reader's settings with an object holding only a scope, and
// every card under it would fall back to the app default for the master. Two
// contexts is not duplication; it is two facts with two lifetimes.
//
// AND NOT A PROP THREADED DOWN, which is the whole argument this file opens
// with: the board's old text menu reached a card through two components that only
// passed it along, and the table view spent a day not reading it. A screen states
// the fact once, at the top, and every card under it resolves its own answer.
const TextOrderScopeContext = createContext('')

export function TextOrderScope({ value, children }) {
  return (
    <TextOrderScopeContext.Provider value={value || ''}>{children}</TextOrderScopeContext.Provider>
  )
}

// useTextOrder — one of the four states, for this card.
//
// `language` is the line's own and stays the CALLER's to supply, because it is a
// property of the ROW being drawn and no two rows on a screen need agree about it.
//
// `scope` IS THE SCREEN'S AND COMES FROM CONTEXT, because it is a property of the
// container and every card under one shares it — a caller passing it would be
// three call sites each remembering the same fact, which is the shape this file's
// own header opens by describing as the reason it exists.
//
// THE PROP STILL WINS WHERE IT IS GIVEN, and one surface needs that: the search
// modal draws a card for a row from any work in the library, so the container is
// a property of the HIT rather than of the screen it is on. Passing it there is
// the screen "passing the fact in" rather than keeping its own copy of the verb.
export function useTextOrder({ scope, language } = {}) {
  const { master, byLanguage } = useContext(TextOrderContext)
  const fromScreen = useContext(TextOrderScopeContext)
  return resolveTextOrder({ scope: scope || fromScreen, language, byLanguage, master })
}
