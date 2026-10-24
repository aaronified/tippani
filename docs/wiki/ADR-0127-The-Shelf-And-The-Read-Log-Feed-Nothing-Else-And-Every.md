# ADR-0127: The shelf and the read log feed nothing else, and every temptation to wire them into stats is named

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** post-1.3.0

**Decided.** The shelf gives a status per work, a progress figure, a position and a read log with dates. All of it is your input, shown back to you, and nothing else consumes it. The specific temptations are listed: no read-log series in the Stats activity calendar; no "books finished this year" in the year in review; no reading-pace or completion charts; no progress- or completion-based achievements; no shelf status feeding the review deck's scheduling.

**Why.** These are all plausible and all cheap-looking, which is why naming them individually is the only version of this boundary that survives. The roadmap's [serendipity](Roadmap.md#serendipity) section carries a back-reference at the exact spot someone would first reach for it, because that is the first place anyone would.

**Approved.** My call, recorded under "Considered and set aside" so the boundary stays a decision instead of being rediscovered later as an opportunity.

<sub>post-1.3.0 — `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
