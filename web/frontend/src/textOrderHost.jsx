// THE RESOLVED STATE, PROVIDED ONCE RATHER THAN THREADED.
//
// This repo's fourth entry on the same lesson, and the third one about this exact
// feature. `tview` reached a card through two components that only passed it
// along; the readable-languages predicate was added beside it and the table view
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

// useTextOrder — one of the four states, for this card.
//
// `scope` is the work's or the board's stored opinion and `language` is the line's
// own. Both are the CALLER's to supply because both are properties of the row
// being drawn; the master and the per-language table come from the context, which
// is the part every card shares.
export function useTextOrder({ scope, language } = {}) {
  const { master, byLanguage } = useContext(TextOrderContext)
  return resolveTextOrder({ scope, language, byLanguage, master })
}
