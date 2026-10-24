# ADR-0301: One ordered table of question types, and a flip card that cannot fail

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `directionsFor(kind)` is the single per-kind list of question types — source, quote, flip, cloze, and speaker for screen quotes — and `buildQuestion` returns a card unconditionally rather than a `(card, ok)` pair. When no direction can be built, the card falls back to the **flip card**: show the quote, reveal the source, grade yourself.

**Why one table.** Seven implementation specs were written against the tree, one per feature, each blind to the others. Every one of them independently rewrote `dailyDirection`'s two-way toggle into a differently-shaped three-way, and the three rewrites were mutually exclusive. A table makes per-kind applicability — speaker is screen-only, a book has no cast — a property of data rather than a special case in a branch.

**Why the signature cannot fail.** `buildQuestion` used to drop a card it could not build a question for, and `dailyRemaining` counted it anyway. The badge and the deck disagreed for any library with one work in it: "3 due", nothing served. **Its test asserted the empty deck as correct.** The flip card fixes this at the root, because it is the one type that works for every quote — there is nothing to fail at.

**Instead of** adding a fifth reason for a card to vanish. A quiz that silently serves fewer cards than it counts is a quiz nobody can trust the count of.

**Approved.** Mine, on the reconciler's finding.

<sub>1.15.0 — `internal/httpapi/review_handlers.go` · `web/frontend/src/review.jsx` · `web/frontend/test/dom/quiz-runner.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
