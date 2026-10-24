# ADR-0189: A character's aliases are the slashes in its own name, computed rather than stored

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** "V / William Rookwood" is one character with two names. The alias set is produced by splitting the stored character string on `/`, at read time, from `cast_json`. Both halves resolve to the same actor; **the quote keeps whatever name it used** — a line credited to "V" still reads "V", and is never rewritten to the full slashed form.

**Why no table.** The aliasing is a pure function of a string the supplier already gives us, so storing it would be caching a derivation — the same objection §8 makes to a stored `due_at` and §3 makes generally. It also cannot drift out of step with a re-sync, because it is recomputed from whatever the re-sync wrote.

**Preserving the quote's own naming is the load-bearing half.** The character string is a supplier's label; what the reader typed when they saved the line is the name that line uses, and replacing it with the canonical form would edit their quote to match a metadata provider. Resolution goes one way: from the name on the line, to the actor.

**Splitting on `/` only, not on the credit separators.** `metadata.SplitCredits` exists and is wrong here: it splits a list of *people*, and "V / William Rookwood" is one person under two names. A comma in a character field is far more likely to be part of a title ("Bob, the Baker") than a second character.

**Approved.** The reader's, in the form "sometimes the names of the characters are retrieved as \"V / William Rookwood\", in that case, both \"V\" and \"William Rookwood\" should resolve to that actor and preserve the quote's way of naming the character."

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
