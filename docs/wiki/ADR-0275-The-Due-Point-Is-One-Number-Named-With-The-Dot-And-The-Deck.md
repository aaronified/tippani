# ADR-0275: The due point is one number, named, with the dot and the deck derived from it

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `reviewDuePoint` (0.5) and `reviewHeldPoint` (0.9) are constants. `dueSQL` splices `dueMultiplier(reviewDuePoint)` — `log2(1/target)`, which is exactly 1 at 0.5, so the rule and every stored half-life are untouched — and `recallStatus` switches on the same two constants. Behaviour is identical; the duplication is gone.

**Why.** They were one number written twice in two languages: `elapsed >= stability` in SQL, which on `p = 2^(-elapsed/stability)` is exactly `p <= 0.5`, and `case p >= 0.5` in Go. Neither mentioned the other, and `dueSQL`'s own comment made their agreement a promise — *"a card is due exactly when its dot reads probably-forgotten"* — that nothing checked. Either could have moved alone, and the result would have been a deck full of cards the app calls remembered, or a dot reading "forgotten" about a card the quiz will not ask for a month. `TestTheDotAndTheDeckAgreeOnDue` places cards either side of the boundary by 2% and asserts both halves.

**And 0.5 was a choice nobody made out loud.** The loop waits for a coin flip before asking. That is defensible — a retrieval that is harder and still SUCCEEDS is worth more (Bjork) — and it is far below the ~0.90 FSRS and Anki take as the usual aim. Naming it is what makes it arguable.

**Instead of.** Binding the multiplier as a SQL parameter rather than splicing it — rejected: `dueSQL` is a string five queries concatenate, so a parameter puts its position in five argument lists, which is five chances to get an offset wrong for a value derived from a constant and never from user text.

**This is the prerequisite for `srTargetRetention`, which is NOT built.** The plan's step 4 makes the due point a preference. It was deferred, and the reason is recorded in `docs/wiki/Spaced-repetition.md` rather than left to be rediscovered: the dial's only consumer is the retention figure of step 10, which does not exist, and raising the target makes nearly everything due at once — a poor thing to land days before a launch. With the duplication gone the dial becomes a small change: the constant becomes the preference in one place.

**Approved.** Mine, as a refactor that had to happen whether or not the dial ships.

<sub>3.1.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/review_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
