# ADR-0850: Where a line enters is not how hard it is asked

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**TWO ROWS, AND AN AUDIT SAID THEY WERE ONE.** The v3 pack's review section draws "How
hard" (Easy / Medium / Hard / Random) and, separately, "New lines start at". A comparison
of the pack against this app reported the second as a divergence in the FIRST — that the
app's tier control "offers four options where the pack offers three, with different
names". It does not: the app's `srTier` is the pack's "How hard", option for option,
Random included. What the app had no equivalent for was the other row, and pairing the two
hid the real gap behind a false one.

That is the whole argument for checking a finding at the line it cites. Three verifiers
confirmed this one, because all three checked that the cited lines said what was claimed
— and they did. What none of them checked was whether the two lines were about the same
thing.

**TWO RUNGS RATHER THAN THE PACK'S THREE.** The owner's ruling: *"new lines start at
either at not seen or mastered (first tier)"*. Fresh / Known / Mastered becomes Not seen /
Mastered. A reader who wants a line treated as half known can answer it once, and a middle
rung nobody can describe the effect of is a control that gets set by coin toss.

**AND THE DECK RANGE.** Two to ten becomes five to twenty, against the pack's five to
sixty. The server validates what is written and rewrites nothing, so an account already
holding two, three or four keeps it; it cannot get back below five through the slider.

*Unreleased — `internal/httpapi/auth_handlers.go`, `internal/httpapi/review_tier.go`,
`web/frontend/src/Settings.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
