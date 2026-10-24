# ADR-0683: The 24px-root test is run at the type dial's 200%, because the literal version proves nothing here

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

- **Decided** — `make typescale` doubles every `--type-*` token the app has written AND
  sets the root font size to 24px, then fails on anything a screen clips that it did not
  clip at rest.
- **Why** — this is a departure from the pack's wording and it is the honest translation
  rather than a weakening of it. Tippani has no root font size to set: `applyTypeScale`
  writes finished pixels into `--type-<role>-<step>` on `<html>`, and `body` reads
  `var(--type-ui-15)`. The literal test would therefore have moved almost nothing and
  returned a clean bill of health for a stylesheet full of px boxes. The app's own dial
  goes to 200%, where a 15px label is 30px — harsher than the 24px asked for. Both are
  applied, so the handful of `rem` values are covered too.
- **Instead of** — a jsdom test, which cannot work: jsdom performs no layout, so every
  box fits forever.
- **Reversal** — none, but a claim of mine is corrected: I reported the app's ellipsis
  sites as "11, two of them on names". That was `index.css` alone. Tailwind's `truncate`
  utility adds 38 more in JSX, and the harness found that several of THOSE are on work
  titles and people's names — the failure the rule exists to prevent. 47 remain, recorded
  in `scripts/screenshots/typescale-baseline.json`, to be spent by the screen that owns
  each one.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
