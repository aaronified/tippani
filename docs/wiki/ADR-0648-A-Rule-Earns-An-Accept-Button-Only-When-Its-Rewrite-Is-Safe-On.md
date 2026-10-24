# ADR-0648: A rule earns an accept button only when its rewrite is safe on the text it fires on wrongly

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.2

**Decided, one release after the feature.** `pronunciation` and `reference-mark` are reported and cannot be accepted; the other six keep their rewrites; `space-before-punctuation` will not act across a line break. The mechanism was already there — a rule absent from `cleanupFix` is listed, ignorable and has no accept button — and `cleanupUnfixable` now records why each absence is a decision.

**What I got wrong.** Giving all eight rules a fix, on the assumption that a detector implies a safe rewrite. It does not, and `cleanup.go` said so in its own header before I touched it: every rule has a false positive that is somebody's real writing. Measured on prose a reader keeps:

    pronunciation   "the ratio was 1/2 and then 3/4 of it" → "the ratio was 14 of it"
                    "see https://example.com/path"          → "see https:/path"
                    "on 12/05/1998 he wrote"                → "on 121998 he wrote"
    reference-mark  "Apollo11 lifted off"                   → "Apollo lifted off"
                    "COVID19 changed it"                    → "COVID changed it"

**Why "the reader sees the diff" was not enough of an answer.** It is the right answer for a rule whose wrong case is *visible in one glance at a short span* — a doubled space that was deliberate, a hyphen that belonged. It is the wrong answer for a rule that reads a name as an index: `Apollo11 → Apollo` looks tidy in a diff. A control is not made safe by being reviewable if the review is the same guess the rule made.

**The test that keeps it true** asserts the corruption cases directly — each one still FOUND, and none of them offered — rather than asserting a property of the fix table. A future rule that is added with a fix and without thought fails the "either fixable or recorded as unfixable, with a reason" case beside it.

**Two smaller corrections in the same pass.** The preview marked the find in the before-text and printed the whole rewritten field, unmarked, as the after — so in a four-hundred-word quote the change was unlocatable. Both sides are snippets now, marked the same way, from the same function that does the writing; the whole-field strings left the payload with them. And the accept-all-per-rule button is gone: up to five hundred fields in one press, with the diffs scrolled past rather than read, is the control the page's own note argues against, and nobody asked for it.

<sub>2.2.2 — `internal/httpapi/cleanup_fix.go` · `internal/httpapi/cleanup.go` · `web/frontend/src/CleanupPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
