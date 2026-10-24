# ADR-0845: The preference row, and the control it refuses to draw

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Decided.** `prefRow.jsx` draws a settings row: a label, an optional sub-line, an
optional info dot, a changed mark, and a control passed in by the caller. `PrefGroup`
draws a heading with an aside. Settings' Appearance rows are the first callers.

**Why.** Every card wrote its own version of the same row, and they drifted — some put
the label in a `MonoLabel` and some in a `span`, some let the control wrap and some did
not, and the gap between the two halves was written four different ways. None of that was
a decision anybody made; it is what happens when a shape is retyped.

**IT DRAWS NO CONTROL, and that is the load-bearing choice.** The pack's own row takes a
`kind` — `seg`, `select`, `slider`, `chips`, `toggle`, `buttons`, `font`, `colours`,
`log` — and branches fourteen ways to draw them. That makes the row a registry of every
input the app has, so every new control is an edit to the row and every existing one is
reachable only through a string. Passing the control as a child means a `Toggle`, a
`Select`, a `Slider`, a row of chips and a button all sit in it the same way, and the
repo's own components stay the only things that draw anything — which is also what keeps
the "use the existing UI elements" instruction true by construction rather than by
discipline.

**THE CHANGED MARK IS A MARK.** A row that said "changed" would say it in the space its
own explanation needs, and on a section where half the rows have been touched it would be
a column of the same word. It is `aria-hidden`, because the meaning belongs to the
section's count rather than to a stray bullet read out mid-row.

**A ROW SAYS A THING ONCE**, which is the standing rule and is asserted from the awkward
side: a row with nothing more to say draws NO paragraph, not an empty one. An empty
paragraph is a gap a reader reads as a missing word, and it is invisible in a screenshot.

**A DECLARED EXCEPTION TO THE TESTING RULE.** `pref-row.test.jsx` knows the component.
What it guards are promises to callers that do not exist yet — that the sub-line and the
info dot appear only where earned, that the mark is hidden from a screen reader. The
browser tier sees one section's rendering; it cannot see a contract whose other callers
have not been written.

*Unreleased — `web/frontend/src/prefRow.jsx`, `web/frontend/src/Settings.jsx`,
`web/frontend/test/dom/pref-row.test.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
