# ADR-0299: The debt of a write-not-a-filter is that every create path owes it

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 2.0.1

**Decided.** Every path that puts a quote under a work seeds the quote's `review_excluded` from the work's. Three of them: `POST /annotations` and `POST /dialogues` do it with a correlated subquery, the importer does it with one read per batch through `workExclusion`, and a merge does it as a one-way write onto the source rows before they move.

**Why this is the entry above's bill, not a new rule.** Making the quote's own column the only gate was right — it stopped the deck refusing a card whose visible mark said it was in play. But the moment the parent's flag stopped being read at query time, "exclude this book" stopped covering anything by itself and became a fact that has to be *written* onto every quote that ever joins the book. That is a debt paid at each create site, and a debt paid at each site is a debt one site forgets. The importer forgot it: one column missing from one `INSERT`, and the same absence in the film importer beside it.

**The failure is the one this feature exists to prevent.** You exclude a reference manual *because* highlights keep arriving from it — so the single book most likely to be imported into again is the book whose exclusion silently stopped holding. The reader's report was *"skip quiz is not helping. i can see questions from skipped books in my daily quiz"*, which is what a filter that holds on one write path and not the other looks like from outside.

**Merging travels one way.** Excluding propagates into an excluded target; including never propagates out of an included one. A quote carries its own answer — somebody may have put one line back in the quiz inside a manual they otherwise skip — and a merge is not the moment to erase it. Written onto the source rows *before* the re-point, because that is exactly the set that is moving; the target's own quotes are none of the operation's business.

**Instead of.** Restoring the parent term in `where()`, which is what the deck used to do and what the entry above removed for a reason that has not changed. And instead of a trigger: an `AFTER INSERT` on annotations would cover every path forever, at the cost of making a column's value depend on a rule that is invisible at all three call sites — the repo already carries five hand-written cascade triggers and every one of them is a documented hazard.

**Approved.** Mine for the sweep, the reader's for the report. The two merge cases are asserted in both directions, and each new test was watched failing first.

<sub>2.0.1 — `internal/httpapi/import_handlers.go` · `internal/httpapi/import_movies.go` · `internal/httpapi/metadata_bulk.go`</sub>

<sub>1.15.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/bulk_handlers.go` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
