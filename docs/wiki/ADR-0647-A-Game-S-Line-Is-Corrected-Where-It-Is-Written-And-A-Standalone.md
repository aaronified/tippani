# ADR-0647: A game's line is corrected where it is written, and a standalone quote stops losing its own fields

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.1

**Decided.** `DialogueForm` takes a `game` flag beside `show` and swaps the timestamp box for act and quest. `UtteranceForm` and `utteranceState` carry 0047's five standalone-quote fields — region, recipient, work title, locator, and the approximate-date flag.

**The game half is a fix, not an addition.** `normalizeLocator` clears a timestamp on a game's line, so the box was asking a question whose answer the server threw away. And act and quest are in the dedupe hash: a bark reused in two quests is two quotes, so a form that could not say which quest could only ever store the first of them.

**The standalone half was destructive, which is why it is in this release rather than a later one.** Every save from that screen is full-state. Five fields absent from the form's payload — and from `utteranceState`, which the ♥, the colour dots and the selection bar all save through — were not left alone, they were emptied. An imported letter's recipient survived until somebody hearted the quote. `Quotes.jsx` already carried two comments describing exactly this trap, about the two earlier sets of fields that had fallen into it; this is the third, and it now has a test rather than a third comment.

**They are grouped under one heading rather than shown per kind.** The kind lives on the BOARD, not on the quote, and this form is used from a board, from Home's inline edit and from the search modal — only the first of those knows which kind is being edited. Four optional boxes under "What this kind carries" is honest about that; boxes appearing and disappearing under a select would hide a field somebody has filled.

<sub>2.2.1 — `web/frontend/src/Movies.jsx` · `web/frontend/src/Quotes.jsx` · `web/frontend/test/dom/utterance-fields.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
