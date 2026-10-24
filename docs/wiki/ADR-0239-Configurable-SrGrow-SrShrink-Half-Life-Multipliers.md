# ADR-0239: Configurable srGrow / srShrink half-life multipliers

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.4.3

**Decided.** 0.4.3 exposed the growth factor (1.5–4×) and the lapse-keep factor (0.1–0.6×) as two Settings sliders, alongside a 365-day cap and a late-recall bonus.

**Why.** The update rule was a multiplication either way, so making the two constants adjustable looked free, and I did not want to assert one schedule over everyone's memory.

**Reversal.** Retired eleven releases later. What I got wrong is that two sliders over a rule nobody can evaluate is not a choice, it is homework — a reader has no way to tell whether 2.5× is better than 3× for them, and the app could not tell them either.

**Approved.** Mine at the time, and mine when I took it away.

<sub>0.4.3 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
