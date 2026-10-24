# ADR-0241: The ladder's ceiling is a year, and the fourth rung is where capacity comes from

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `reviewMaxStability` is **365 days** and the ladder is **7 → 30 → 100 → 365**. `reviewTuning` gains `Ladder4`, every rung slider runs to 365, and the whole ladder falls back to the defaults together when the ascent breaks rather than having the offending rung patched. `nextRung`'s fallback is the **ladder's own** top rung, not the package ceiling, so a reader who shortened their ladder is not stepped past it. No migration: 0019 already clamped every stored half-life to 100, so nothing sits above the old ceiling. **And the capacity is now reported.** `reviewCapacity(quota, ceiling)` is `quota × ceiling` — the READER's ceiling (`reviewCeilingFor`), which is `reviewMaxStability` under adaptive, `reviewMaxStability` again on a fixed ladder whose `srSeen` knob is above 1 — because a card lengthened by being SEEN can pass its top rung, so that reader's reach is the package ceiling and not their ladder — and their own top rung otherwise — sent beside `states` on every review response, and Home says so under *where you stand* once the library is past it — a note about reach, not a warning about breakage, so it is microcopy on the row rather than anything behind the help fold, where a reader who never opens it would never learn it. The comparison is one function (`overCapacity`) because two screens will want it; the capacity itself is the server's, since a client multiplying by its own idea of the ceiling would go quietly wrong on the next release that moved it.

**Why.** The ceiling was silently a capacity limit. At equilibrium a card is asked once per half-life, so a library of `N` owes `N / ceiling` reviews a day and the largest library a quota can keep current is `quota × ceiling` — 8 × 100, about **800 quotes**. Above that the deck runs permanently behind. Nothing breaks, because most-overdue-first means the reader still gets the stalest thing, but the tail of a growing library stops being reached and **no screen said so**. A year makes it about 2,900. It buys that at the cost of one more climb per admission — a new card now returns at +7, +37 and +137 before reaching the top — while steady-state maintenance falls by 3.65×, which is the trade in one line.

Why 365 and not more: one year is the longest retention interval Cepeda, Vul, Rohrer, Wixted & Pashler (2008) measured, across 1,354 people. The best gap is about a fifth of the delay at a few weeks and a twentieth at a year, and performance rises then falls *gradually*, so erring long is cheaper than erring short. Their designs are study → gap → restudy → one test, so applying the ratios to a repeating schedule is already an extrapolation — which is the reason to stop at the edge of their data rather than to invent a number past it.

**Instead of.** Tapering the adaptive multiplier as it approaches the ceiling — rejected. Growth crosses the year from 146 upwards (146 × 2.5 = 365) and the clamp already handles it, so a card in the last stretch lands exactly on the ceiling rather than near it; a taper is a parameter nobody can evaluate, which is the argument that retired the sliders in the first place. Also rejected: raising the daily quota instead, which buys the same capacity by asking more of the reader every day rather than less of them over a year.

**Approved.** Mine, with the ceiling named as the thing to argue about rather than the rungs.

<sub>3.1.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/review_tuning.go` · `web/frontend/src/quiz.js` · `web/frontend/src/Home.jsx` · `internal/i18n/en.txt` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
