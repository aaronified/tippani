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
// IT READS `readLanguages` FOR NOW, THROUGH THE MIGRATION. The per-language table
// that will store these directly is the next step; until it lands, the setting
// people already have is the input, and textOrderFromReadLanguages turns it into
// exactly the behaviour it had. So this step changes no card in any library — it
// replaces an inference with an instruction and leaves the instruction saying what
// the inference said.
export function textOrderFrom(preferences) {
  return textOrderFromReadLanguages(preferences?.readLanguages)
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
