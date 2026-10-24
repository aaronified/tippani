# ADR-0259: Review scope became three independent choices in one comma-separated string

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.7.0

**Decided.** `srReviewScope` holds a comma-separated list; `scopeFlags` parses `books`, `movies`/`screen` and `quotes`, with `both`/`all` short- circuiting to everything. The single-word values keep working because they are what every existing account has stored, and legacy `movies` is honoured as the screen scope. The last one on will not turn off.

**Why.** Eight combinations, one column, no migration. `both` predates the third medium and means everything, because the alternative was leaving standalone quotes out of every existing reader's deck until they found a setting — which reads as the feature being broken. An empty scope is a deck with nothing in it, which looks exactly like a deck you have finished, so the UI refuses to let you get there.

**Instead of.** A boolean column per medium — rejected; a migration for a preference.

**Approved.** My call, and I approved honouring the legacy values in place rather than rewriting stored preferences.

<sub>1.7.0 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
