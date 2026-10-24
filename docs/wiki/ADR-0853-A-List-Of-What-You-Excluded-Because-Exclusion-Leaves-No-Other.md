# ADR-0853: A list of what you excluded, because exclusion leaves no other trace

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE FEATURE WAS UNAUDITABLE.** Excluding a quote is a decision made on the quote, one at
a time, months apart, on a card the reader may never open again — and afterwards the only
evidence is a card that stops coming round. A deck that feels thin has either run out of
material or been narrowed by twenty forgotten decisions, and nothing on any screen could
tell those apart. The pack draws it as "Never asked about", grouped under each work.

**IT READS THE FLAG THE DECK READS, THROUGH THE SAME `reviewSource` TABLE** the deck's own
queries are spliced from. A query per quote kind written in the new handler is how a list
comes to disagree with the thing it describes: a fourth kind added later reaches the deck
through `sourcesFor` and would not reach the list at all.

**AND IT UNDOES THROUGH THE ENDPOINT THAT DID IT.** `review.jsx` excludes a card with
POST `/<kind>s/bulk {ids, review:false}`; this sends the same call with `review: true`.
A second writer for one column is precisely the failure 0033's own header records from the
first time this flag had two readers — a control that cleared one flag, toasted success,
and left the deck still refusing the card.

**A WORK'S BUTTON IS NOT THE WORK'S FLAG.** It clears the quotes listed under it, by their
ids, because that is what "put these back" means to somebody reading this list. Clearing
the work's own column as well would change what happens to quotes added to it tomorrow,
which they have not asked for and cannot see here.

**THE LIST IS NOT NARROWED BY THE READER'S CURRENT SCOPE.** `sourcesFor` narrows the deck
to the media they draw from; narrowing this the same way would hide exclusions on a medium
they have switched off, which is exactly where a forgotten exclusion is hardest to find.

**AND THE COMPONENT RENDERED FINE UNTIL SOMETHING WAS IN IT.** `IconButton` was unimported,
so the empty state drew and the populated path threw — the same class the repo's
`icon-imports` scanner exists for, caught here only because the test populated the list.

*Unreleased — `internal/httpapi/review_excluded.go`,
`internal/httpapi/review_excluded_test.go`, `web/frontend/src/Settings.jsx`,
`web/frontend/test/dom/never-asked.test.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
