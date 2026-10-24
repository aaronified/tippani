# ADR-0075: A known whitespace flaw was recorded and deliberately not fixed in the same commit

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** Recorded at 1.5.0's groundwork, fixed in 1.5.0

**Decided.** Commit `06e75c3` shipped `UtteranceDedupeHash` and recorded, under a heading reading "FOUND WHILE HERE, NOT FIXED", that `DialogueDedupeHash` carried the same trailing-whitespace flaw and that it was reachable — the import paths hash the parsed text directly while the API trims, so one line arriving from a file with a trailing space and from the capture form becomes two rows. It was fixed in 1.5.0 instead.

**Why.** The repair moves the hash in the *less* discriminating direction for the first time. `BackfillDialogueHashes` justified itself on the new hash being strictly more discriminating than the one it replaced; normalising first breaks that, two rows differing only in trailing whitespace converge, the UPDATE hits `UNIQUE (movie_id, dedupe_hash)`, `Migrate` fails and the app does not start. Fixing it needed a backfill that resolves collisions by deleting rather than updating, which is its own change with its own risk, and it should not ride along inside a feature.

**Approved.** Mine — I approved shipping a known defect with the reasoning written down, which I would rather do than fix two things in one commit.

<sub>Recorded at 1.5.0's groundwork, fixed in 1.5.0 — `internal/store/hash.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
