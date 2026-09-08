// Which languages the reader can read, and the one thing it decides.
//
// THE OWNER'S ASK, with their own scope on it: "there will be a settings where
// user can declare what languages they can read (only for this feature, as of
// now)." The feature is which text a quote card puts in the big type. A quote in a
// language they have not declared leads with its TRANSLATION and prints the
// original underneath — "a poem in a foreign language will need the translation to
// be on top, and the original in the bottom".
//
// ONLY FOR THIS FEATURE. It is not the interface language (`locale` answers that
// and answers it alone), not a filter, and not a general claim about what this
// reader can read. The parenthesis in the request is guarding against exactly the
// creep, and the module's narrow name is the other half of that guard.
//
// ITS OWN MODULE because three screens need it and none should import another to
// get it: the annotation card, the film frame, and Settings. It imports React and
// nothing else, so it cannot be the far end of a cycle.
//
// AND IT IS PROVIDED ONCE RATHER THAN THREADED, which is this repo's third entry
// on the same lesson. `tview` reaches a card through two intermediate components
// that only pass it along, and a second prop down that chain would be a capability
// absent wherever somebody forgot it — WorkDoor and SearchDoor in personOpen.jsx
// both exist because that happened, and their note says it best: "absent-by-
// omission looks exactly like absent-on-purpose from the outside." So the shell
// provides the predicate and anything under it reads it. An explicit prop still
// wins where one is given, which is how a test hands in its own answer.

import { createContext, useContext } from 'react'

// The one fold, matching internal/httpapi/read_languages.go's foldLanguageName —
// "Bengali" and "bengali" are one language, because the language box is free text
// and both spellings arrive.
export function foldLanguageName(s) {
  return String(s || '').trim().toLowerCase()
}

// parseReadLanguages turns the stored blob into a Set. A blob it cannot read is
// an EMPTY set, which means "every language as written": a corrupt preference
// must not be able to reorder every card in the library.
export function parseReadLanguages(blob) {
  try {
    const list = JSON.parse(blob || '[]')
    if (!Array.isArray(list)) return new Set()
    return new Set(list.map(foldLanguageName).filter(Boolean))
  } catch {
    return new Set()
  }
}

// canReadLanguage — may this reader read a quote in this language as written?
//
// AN EMPTY SET SAYS YES TO EVERYTHING, and an empty LANGUAGE does too. The first
// is the default and has to change nothing for a reader who never opens the
// setting. The second is the commoner case: a quote nobody has assigned a language
// to cannot be one the reader is unable to read, and treating it as foreign would
// put the translation first on every untagged row in the library.
export function canReadLanguage(set, language) {
  if (!set || set.size === 0) return true
  const key = foldLanguageName(language)
  return key === '' || set.has(key)
}

// readerFrom is the whole of what the shell needs: hand it the user's
// preferences, get back the predicate a card asks. One call site, so nothing else
// keeps its own copy of "parse the blob then test the language".
export function readerFrom(preferences) {
  const set = parseReadLanguages(preferences?.readLanguages)
  return (language) => canReadLanguage(set, language)
}

// ---- provided once ---------------------------------------------------------

const ReadableContext = createContext(null)

// ReadableLanguages — wrap the app once with `readerFrom(user?.preferences)`.
export function ReadableLanguages({ value, children }) {
  return <ReadableContext.Provider value={value || null}>{children}</ReadableContext.Provider>
}

// useReadableLanguages — the predicate a card should use: its own prop where one
// was given, else the shell's, else a function that says yes to everything.
//
// THE LAST LEG IS THE DEFAULT AND IT IS DELIBERATE. A card rendered bare in a test
// or outside the provider reads every quote as written, which is what the app did
// before this existed — so a missing provider degrades to the old behaviour rather
// than to translations leading everywhere.
export function useReadableLanguages(explicit = null) {
  const provided = useContext(ReadableContext)
  return explicit || provided || alwaysReadable
}

const alwaysReadable = () => true
