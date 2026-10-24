# ADR-0883: Spelling in the quote field: the browser's own, and only while you are typing

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner: *"in the quote entry field (in various add surfaces), can we add client side
grammar/spelling check? this will be very helpful as well. only when the user is editing the
field."*

**THE BROWSER IS THE CLIENT-SIDE CHECK, AND IT IS ALREADY INSTALLED.** `spellcheck` on a
textarea uses the READER'S OWN dictionaries — the ones their system has, in the languages they
actually read — with no package, no dictionary download and no first-run delay. The repo's
dependency budget is three runtime npm packages and its standing rule is built-ins over
dependencies, native controls first; a JS spellchecker would spend one of those three on a
worse answer, in fewer languages, on a box built for a NAS.

**"ONLY WHEN EDITING" IS WHAT MAKES IT SAFE ON A QUOTE**, and it is the half that would have
been dropped as a nicety. A quote is somebody else's words: an archaic spelling, a dialect
form, a proper name and a transliteration are all correct and all unknown to a dictionary. Red
underlines under a faithful transcription tell the reader they made a mistake they did not
make — on the one field in this app whose whole promise is that it holds the text as written.
So the check is advice while a finger is in the box and silent the moment it is not.

**THE LANGUAGE DECIDES THE DICTIONARY, AND THIS WOULD HAVE BEEN SILENTLY WRONG.** A browser
picks its dictionary from the element's `lang`, and the quote field carried none — only a CSS
class for the FACE. Without it a Bengali quote is checked against the interface's language and
every word comes back misspelled: the app telling a Bengali reader their Bengali is wrong, in
red, word by word, which is worse than no checking at all. `languageFor` has carried the
BCP-47 code all along. A language the app does not know gets NO `lang` rather than a guess.

**A COMPONENT, NOT A HOOK, AND THE REASON IS A CONSTRAINT.** The first cut was a hook returning
props to spread — but `AddSurface` builds its fields inside `field(key)`, a function called
during render with a `switch` in it, so a hook there would be called conditionally and in a
different order per surface, which React forbids. `ProseArea` owns its own state, one per
field, and passes everything else through with `{...rest}` so no caller has to enumerate props.
It composes the handlers a caller already has: several of these boxes blur to SAVE, and a
wrapper that overwrote `onBlur` would stop them committing with nothing failing.

**GRAMMAR IS NOT HERE, AND SAYING SO IS THE POINT.** There is no browser primitive —
`spellcheck` is words against a dictionary. Chrome can do grammar, but only via "enhanced spell
check", which sends what you type to Google: an outbound call carrying a reader's own quotes,
in an app where nothing leaves the box unless a person or a screen they opened asked for it,
and where a call the browser made by itself would not even reach the log. A local engine is a
real option and a real cost, so it stays the owner's call.

**AND THE SWEEP FOUND THE THIRTEENTH FIELD.** Twelve were wired by hand across four add
surfaces; `prose-fields-are-checked.test.js` derives the list from the BINDING — a box bound to
`quote`, `note` or `translation` is one of these fields by definition — and named a fourteenth
site nobody had listed: the anthology entry's note, which is not an "add surface" and so was
not in the ask by name. That is the whole argument for deriving a sweep from the code rather
than writing out a list.

**TWO OF THIS PASS'S OWN GUARDS WERE WRONG FIRST**, both caught by running rather than reading.
A dom case asserted `box().spellcheck` — jsdom does not implement that IDL property, so it read
`undefined` against a correct component; the attribute is what React writes and what a browser
reads. And the sweep's language check tested the matched `value={quote}` substring for
`language=` rather than the whole tag, so it failed every row. A guard that fails wrongly is
cheaper than one that passes wrongly, but only because somebody looked.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
