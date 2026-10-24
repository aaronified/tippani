# ADR-0646: The cleanup page answers its own findings, and a refusal is remembered

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.1

**Decided, reversing a decision from the release before it.** `cleanup.go` shipped in 2.2.0 saying "THIS FINDS AND NEVER FIXES, and that is the whole design rather than a first step". Each finding now carries the rewrite it would make (`cleanup_fix.go`), and three endpoints answer it: `POST /cleanup/accept` rewrites one field by one rule, `POST /cleanup/ignore` records a refusal (migration 0052), `POST /cleanup/unignore` undoes one. `GET /cleanup?bucket=ignored` is the other half of the list.

**What the original argument got right, and what it over-corrected.** It was arguing against a fix-all button behind one confirmation, over five hundred finds, with no diff — and it was right: every one of the eight rules has a false positive that is somebody's real writing. What it treated as the only alternative was fixing nothing. The missing control was smaller, not bigger:

    "an automatic pass"          nothing is automatic; one press is one field, one rule
    "on the strength of a        the before and the after are both on screen, with the
     guess, silently"            matched span marked, before anything is written
    "the one find that was       a false positive is IGNORED, and the ignore is STORED, so
     real writing is gone"       the same words are never offered again

**Every fix is a function of the matched text alone.** `fix` maps the substring a rule matched to what it should become, and applying a rule replaces each of that rule's own reported ranges. That is what makes the rewrite provably confined to the spans the reader was shown — a fix taking the whole field could touch anything. The one that earns its comment is `reference-mark`, whose third form matches a LETTER followed by digits (`conscience12`): deleting the match would delete the letter, so the fix keeps it.

**A rule may not empty a field, and the guard is central rather than per rule.** Two of the eight can otherwise do it — a quote that is nothing but padding, one that is nothing but a bracketed number — and it holds for the rule somebody adds next year without reading the file.

**The ignore is keyed on a fold of the matched spans**, and both obvious alternatives are wrong. Keyed on (quote, field, rule) it would bury a second, real finding of the same rule in the same field. Keyed on a hash of the whole field, accepting any one finding would revive every ignored one beside it, because the text changed and so did every hash over it.

**The dedupe hash is recomputed when the words change.** The bulk find-and-replace path does not, which leaves a row whose stored hash describes words it no longer holds — so a later import of the corrected text is not recognised as the duplicate it is. A correction that collides with an existing row is counted and reported rather than rolling the batch back: two copies of one passage, one of them with a footnote index in it, is exactly what an import run twice produces.

**One scan serves both buckets**, so the two counts cannot disagree, and the ignored bucket lists only ignores that still match something — an ignore whose text was later changed by hand is a row about nothing.

**What this pass got wrong first, recorded because it cost the most.** I built the whole feature — rules, endpoints, page, migration — against a tree fourteen commits stale, without fetching, and so wrote a second cleanup page beside the one that had already shipped, with a migration number that collided. An independent review of the work is what caught it. The lesson is not "read the log", it is that a feature request phrased as an addition to an existing screen ("in the review page, the user should be able to…") is a claim about the tree that has to be verified against the remote before any of it is designed.

<sub>2.2.1 — `internal/httpapi/cleanup_fix.go` · `internal/httpapi/cleanup_apply_handlers.go` · `internal/store/migrations/0052_cleanup_ignores.sql` · `web/frontend/src/CleanupPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
