# ADR-0704: The wide rail is not a px box, and make typescale is still red

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — `--rail` at 1180px+ is `max(236px, calc(var(--type-ui-15, 15px) * 15.7))`.
  The multiplier lands just UNDER the floor at the ordinary setting (15.7 × 15px = 235.5px)
  so nothing moves until the reader turns the type up.
  The floor is the width the layout was drawn at; above it the rail tracks the dial.
- **It multiplies `--type-ui-15` and not `em`,** which is the trap How-this-was-written.md already records:
  `em` at `:root` resolves against the BROWSER root, and the type dial does not move the
  browser root — `applyTypeScale` writes finished pixels into `--type-*`. An `em` here
  would track a number nothing in this app ever changes.
- **It was a real regression from the rail's own landing.** At 200% the rail cut
  *Catalogue* by 53px and *Metadata* by 75px, on all thirteen screens — the standing rule's
  exact failure, in the largest permanent surface in the app. Nobody ran `make typescale`
  after 4a. Newly-clipped elements fell 98 → 76, home and checks came back clean, and
  **library spent two entries** (11 → 9) — the ratchet moving the only direction it is
  allowed to.
- **STILL RED, and knowingly so.** Five screens are over their recorded numbers —
  metadata 14 (recorded 0), stats 35 (24), quotes 3 (0), movies 14 (12), bin 1 (0). Every one is the same defect the baseline already names: a work title or a
  person's name wearing Tailwind's `truncate`. **They are the rail's cost landing
  elsewhere** — the rail took 236px off every screen's width, so rows that used to fit at
  200% no longer do. The repair the rule allows is per-site (it scrolls under the fade, or
  it wraps) and belongs to each screen's own pass; the baseline was NOT raised to absorb
  it, because raising it is the same mistake as freezing the text.

<sub>Unreleased — `web/frontend/src/index.css` · `scripts/screenshots/typescale-baseline.json`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
