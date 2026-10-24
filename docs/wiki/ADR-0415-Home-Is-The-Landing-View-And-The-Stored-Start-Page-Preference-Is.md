# ADR-0415: Home is the landing view, and the stored start-page preference is ignored

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 0.4.0

**Decided.** Home is `/` on desktop and mobile, reached any time by tapping the logo. The 0.3.x `home` start-page key is retired; stale stored values and older clients still sending one are silently ignored.

**Why.** The Home screen replaced the landing-tab choice outright, so there is nothing left for the preference to select. Ignoring rather than rejecting means an older client does not start failing its preference writes.

**Approved.** Mine, and I approved the silent ignore over a validation error.

<sub>0.4.0 — `CHANGELOG.md` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
