# ADR-0535: Fill the gaps writes only what is empty, which is what lets it skip the preview

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.11.1

**Decided.** Fill gaps — a `fill` job since 3.1.0, and `POST /metadata/fill` for an API caller — runs the re-verify fetch, keeps only the diffs whose STORED side is empty, and applies them through the re-verify writer. The predicate decides by TYPE — empty string, zero, empty slice, nil — not by field name.

**Why.** Re-verify asks "what changed?", shows every difference and waits for a human to tick the ones they believe. That is right, because a provider disagreeing with your library is not automatically the provider being correct — and it is completely unusable over forty books, where nobody will adjudicate two hundred diffs to recover a missing publication year.

Writing only into emptiness is what makes the operation safe without a preview: a description you wrote is never touched, and a title is `NOT NULL` and therefore never missing, so it can never be rewritten. That safety is the whole reason this can be one button in a selection bar rather than a console with a diff table in it.

Deciding by type rather than by field name means a field added to re-verify tomorrow gets the right treatment here without anybody remembering this file exists — and an unrecognised type answers "not missing", so the failure direction is "declined to fill" rather than "overwrote something".

**Instead of.** A "fetch metadata for all" that applies everything (would silently overwrite hand-corrections, which is the one thing this app must never do). Extending re-verify with an "apply all" button (same overwrite, one click further away).

**Approved.** Mine, and I approved the empty-only rule as the load-bearing part rather than the batching.

<sub>1.11.1 — `internal/httpapi/metadata_fill.go` · `internal/httpapi/bulk_works_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
