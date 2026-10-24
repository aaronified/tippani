# ADR-0426: Serendipity is not the review loop, and must not touch its schedule

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.16.0

**Decided.** Shuffle and On this day live on Home and write nothing. `GET /shuffle` picks the KIND at random first and then a row within it; On this day matches on month-day, prefers `noted_at` over `created_at`, and excludes the current year.

**Why the kind comes first.** Drawing uniformly across every quote is honest about the proportions and useless as a way of rediscovering the smaller shelves: a library of four thousand highlights and forty film lines shows a film line once in a hundred shuffles. Kinds with nothing in them are dropped before the draw, so a library with no films is not a third of the way to showing nothing.

**Why nothing is written.** These draw the same quote card the deck does, and the `srSeen` multiplier exists precisely to lengthen a half-life when a quote is *seen*. Wiring that here would inflate a schedule through a surface meant for enjoying the library rather than working at it, in favour of whatever the random number generator liked, with nothing anywhere to report it. The test shuffles eleven times and counts the review rows either side.

**`noted_at` over `created_at`**, which the roadmap named both of without deciding. On an imported row `created_at` is the day of the *import* — the same day for thousands of quotes — and means nothing to a reader.

**Instead of.** Their own routes, which the plan specified and which is recorded there as a departure: a route bookmarks, and a card you press buys the same pleasure for none of the routing surface.

<sub>1.16.0 — `internal/httpapi/serendipity_handlers.go` · `web/frontend/src/Home.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
