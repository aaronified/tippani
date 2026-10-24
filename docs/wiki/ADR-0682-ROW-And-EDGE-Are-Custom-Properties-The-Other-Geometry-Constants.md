# ADR-0682: ROW and EDGE are custom properties; the other geometry constants are not

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

- **Decided** — `--edge` and `--row` are declared in `:root` and overridden per screen.
  The rest of `tokens.js` — 44px, 999px, 9px — stays as literals with a proof.
- **Why** — the split is the decision rather than an inconsistency. The page body and the
  top bar are not in the same subtree and must not be able to disagree about the gutter,
  and a variable is the only way for two such elements to share one number. Nothing
  equivalent is true of 44px: declaring `--touch-min` while fifteen rules go on saying
  `min-height: 44px` would add a third name for the same number.
- **Instead of** — per-screen constants with no shared default, as the pack states them.
  Rejected because the top bar is not inside a screen, so there would be nothing for it
  to read.
- **Approved** — mine, chosen from a list; the honest note is that `--row` has almost no
  consumers yet. The app still types its vertical step in by hand 177 times across seven
  Tailwind values, and `spacing-debt.test.js` holds that count as a ratchet so the
  screen-by-screen pass can spend it and nothing can quietly add to it.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
