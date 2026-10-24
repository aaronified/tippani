# ADR-0812: The 8/10 pass, and the four things it found

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Fixed rather than argued with, because the score decides whether another pass runs and
never whether a finding is worth acting on.

**TWO OF THE THREE RENDER SITES HAD NO TEST**, in the file that opens by naming that
exact gap. `quote-text-view.test.jsx` says the resolver "was right for a day while the
table view simply never asked it" — and its three new cases all rendered the CARD view,
so blanking the table cell's class and the film frame's left the whole DOM suite green.
The table is reached the way a returning reader reaches it (`tippani:annview` is a
persisted preference, not a prop); the frame is rendered directly, because it is a leaf
that takes its row as a prop and a test that needed the screen would be testing the
screen. Both now fail when the class is removed.

**A STALE COUNT IN THE COMMIT THAT WROTE THE RULE AGAINST COUNTS.** `suggest.jsx` said
"ONE COMPONENT FOR SEVEN FIELDS" over a list naming a proverb board (which does not use
it) and omitting the bulk dialog (which does) — wrong in both directions at once, two
commits after `boards.jsx` had its own count replaced for the same reason. It names the
rule and the one real exception now.

**`text.js` SAID "the one import is iso639.js" ABOVE TWO IMPORTS** — written before
`fonts.js` was added, in the same commit, three lines away. The purity claim held; the
sentence did not.

**AND A BOOK'S OWN TWO LANGUAGE COLUMNS WERE STILL OUTSIDE THE FACET**, which is the
same defect one layer up from the one this queue had just fixed. 0047 gave `books`
`language` and `orig_language`; the combobox now edits both — so a reader could type
"Bengali" into a book's language, have it stored, and be offered nothing on the box they
had just typed it into. `orig_language` counts as much as `language`: a novel translated
from Russian holds Russian, and a reader who marks Russian must not find the ✕ live
beside it while the book still says so. `movies` has neither column, so there is nothing
to union from it — the language of a FILM line is on the line.

The tooltip moved with the query. "some of your quotes are in it" was true while the
facet was quote-only and became false the moment a book could hold up a row, so it reads
"quotes or books of yours are in it" in both locales. A refusal that names the wrong
reason is a refusal the reader cannot act on.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
