# ADR-0881: A tag vocabulary that can be tidied: the duplicates, and the verb that was missing

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The pack draws a tag that looks like a duplicate saying so under its own name, its count in
the error colour, and a merge beside it — and marks the section `twoUp`, tags and stickers in
two columns, because *"they are both things you make and then have to keep tidy, which is why
this console leads with the tags that look like each other."* The repo had a table of
name/style/uses with no duplicate signal, no merge, and the stickers stacked under an `<hr>`.

**A VOCABULARY GROWS DUPLICATES BY BEING TYPED.** "Solitude" and "Solitide", the same word
with a stray plural, the same idea under two phrasings. The list sorted them adjacent and said
nothing, leaving a reader to notice — and **the only verb for the one they did not want was
DELETE**, which throws away which quotes carried it. So tidying up meant choosing between two
names for one idea and losing the tagging underneath the loser. That is why the merge is the
substance of this change and the red sub-line is only its signpost.

**THE DETECTOR IS THE PEOPLE CONSOLE'S, MOVED RATHER THAN COPIED.** "Are these two the same
thing spelled twice" is one question, and the repo's directive is that a thing two screens do
lives in one function both call. `nearDupGroups` was private to `MetadataPage.jsx`; it is
`nearDupes.js` now. **Clusters, not pairs**, and that is the part a second copy would get
wrong: "translation", "on translation" and "translations" are ONE duplicate, but no single
comparison sees all three, so a pairwise list would offer three overlapping merges of the same
three tags and let a reader do two of them.

**THE READER PICKS THE SURVIVOR**, because neither "the one with more quotes" nor "the shorter
name" is right often enough to decide for them — the rarer spelling is sometimes the better
word. Each name is a button carrying its own count.

**THE JOIN ROWS ARE COPIED, NOT UPDATED, AND THAT IS THE WHOLE OF THE DIFFICULTY.** Both
`annotation_tags` and `dialogue_tags` are `PRIMARY KEY (quote, tag)`, so a quote carrying BOTH
tags — which is exactly what a near-duplicate pair produces, because the reader used them
interchangeably — makes `UPDATE … SET tag_id` collide and abort the transaction. The merge
does `INSERT OR IGNORE … SELECT` and lets the loser's rows go by cascade. **The Go case makes
that quote deliberately**, and the mutation confirms it: swapping the insert for the obvious
`UPDATE` turns the test red. Without that one row in the fixture, the naive version passes
everything.

**IT IS NOT UNDOABLE, AND THAT IS A DECISION RATHER THAN AN OMISSION.** Every other merge in
this app parks a reversal in the bin, and the case for doing the same here is real. What
decided it the other way is the neighbour: **deleting a tag is already outright** — its confirm
says so in as many words — and a merge destroys strictly LESS than that delete, since every
quote keeps a tag and what goes is one of two names. Making the gentler act reversible while
the harsher one is not would be the inconsistency, and it would cost a migration rebuilding
`trash`'s CHECK over its kinds. The confirm carries the weight instead, and names the quotes
that will move. If tag DELETE ever becomes undoable, this should follow it.

**THE FIXTURE CARRIES THE DEFECT ON PURPOSE.** `test/journeys/fixture/library.json` gained the
pair and an annotation tagged with both of them. This is the same argument CLAUDE.md makes for
running probes against a real backup rather than the seeded shelf: a fixture with no duplicates
cannot tell a console that finds them from one that does not, and a fixture with no colliding
quote cannot tell a correct merge from a lucky one.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
