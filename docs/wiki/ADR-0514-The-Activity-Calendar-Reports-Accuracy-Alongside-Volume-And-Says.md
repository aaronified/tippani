# ADR-0514: The activity calendar reports accuracy alongside volume, and says "no answers"

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** `dayTitle` reports `N answers · M% correct` for the Quiz and Practice streams, `N saved` for Saves, and `no answers` for a day with a zero count.

**Why.** The Saves stream counts things you kept and the count *is* the fact. The two review streams count answers, where the count alone is the less interesting half: a day of twelve answers all wrong shades exactly like a day of twelve all right, because the fill is volume. So the ratio has to travel with the tally. "No answers" rather than "0% correct" is the sharper decision: `got` is absent on any day the server sent no row for — a quiet day, or a practice history that has been reset — and "0% correct" is a claim about a session that did not happen. A chart that invents a score for a day you did not use it is a chart that is lying quietly. My call.

<sub>`web/frontend/src/StatsPage.jsx` · `web/frontend/test/pure/calendar-day-title.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
