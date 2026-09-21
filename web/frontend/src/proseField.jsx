// SPELLCHECK ON A FIELD, WHILE IT IS BEING EDITED — AND NOT BEFORE.
//
// THE OWNER'S ASK: "in the quote entry field (in various add surfaces), can we
// add client side grammar/spelling check? this will be very helpful as well. only
// when the user is editing the field."
//
// THE BROWSER IS THE CLIENT-SIDE CHECK, and it is already installed. `spellcheck`
// on a textarea uses the READER'S OWN dictionaries — the ones their system has,
// in the languages they actually read — with no package, no dictionary download
// and no first-run delay. The repo's dependency budget is three runtime npm
// packages and its standing rule is built-ins over dependencies, native controls
// first; a JS spellchecker would spend one of those three on a worse answer, in a
// narrower set of languages, on a box built for a NAS.
//
// "ONLY WHEN EDITING" IS A REAL REQUIREMENT, NOT A NICETY, and it is the half that
// makes this safe on a QUOTE. A quote is somebody else's words: an archaic
// spelling, a dialect form, a proper name and a transliteration are all CORRECT
// and all unknown to a dictionary. Red underlines under a faithful transcription
// say the reader has made a mistake they have not made — on the one field in this
// app whose whole promise is that it holds the text as written. So the check is on
// while a finger is in the box, when it is advice about something being typed, and
// off the moment it is not, when it would be a verdict on something already
// written down.
//
// THE LANGUAGE DECIDES THE DICTIONARY, and this is the part that would have been
// silently wrong. A browser picks its dictionary from the element's `lang`, and a
// quote field carried none — only a CSS class for the FACE. Without it a Bengali
// quote is checked against the interface's own language and every word comes back
// misspelled, which is worse than no checking at all: it is the app telling a
// Bengali reader their Bengali is wrong, in red, word by word. `languageFor` has
// carried the BCP-47 code all along.
//
// AND `dir` COMES WITH IT, because the repo's rule is that direction belongs to
// the text and goes in MARKUP. `auto` lets the Unicode algorithm decide from the
// first strong character, which is the honest answer for a box that is empty until
// somebody types in it.
//
// GRAMMAR IS NOT HERE, AND SAYING SO IS THE POINT. There is no browser primitive
// for it — `spellcheck` is words against a dictionary and nothing more. Chrome can
// do grammar, but only with "enhanced spell check", which sends what you type to
// Google; that is an outbound call from a reader's own quotes, in an app whose
// first invariant is that it never contacts the network on its own. A local engine
// (harper-wasm and the like) is a real option and a real cost — a megabyte-plus of
// WebAssembly, English only — so it is the owner's call, not a detail of this
// helper. See the note in the task queue.
import { useState } from 'react'

import { languageFor } from './iso639.js'

// ProseArea — a textarea that is spell-checked while somebody is typing in it.
//
// A COMPONENT AND NOT A HOOK, and the reason is a constraint rather than a
// preference. The first cut was `useProseFieldProps`, which a caller would spread
// — but `AddSurface` builds its fields inside `field(key)`, a function called
// during render with a `switch` in it, so a hook there would be called
// conditionally and in a different order per surface. React forbids exactly that.
// So the state lives in a component of its own, one per field, which is also the
// only way each box gets its own "am I being edited".
//
// EVERYTHING ELSE PASSES STRAIGHT THROUGH. `{...rest}` rather than a dozen named
// props: these boxes differ in rows, placeholder, className and — for the quote —
// a whole type override, and a component that enumerated them would grow a
// thirteenth the first time a field needed one. The caller keeps writing the
// textarea it was writing.
//
// IT COMPOSES THE HANDLERS A CALLER ALREADY HAS. Several of these boxes blur to
// save; a wrapper that overwrote `onBlur` would stop them committing and nothing
// would fail — the field would simply stop working.
export function ProseArea({ language = '', onFocus, onBlur, ...rest }) {
  const [editing, setEditing] = useState(false)
  // A LANGUAGE THIS APP DOES NOT KNOW GETS NO `lang` AT ALL, rather than a guess.
  // An unknown tag is worse than none: the browser either ignores it, or picks a
  // dictionary for a language the text is not in.
  const tag = languageFor(language)?.code || ''
  return (
    <textarea
      {...rest}
      // EXPLICITLY FALSE AT REST, never undefined. Left off, the element inherits
      // from the document and each engine decides for itself, so "off while not
      // editing" would hold in one browser and not another.
      spellCheck={editing}
      {...(tag ? { lang: tag } : {})}
      dir="auto"
      onFocus={(e) => { setEditing(true); onFocus?.(e) }}
      onBlur={(e) => { setEditing(false); onBlur?.(e) }}
    />
  )
}
