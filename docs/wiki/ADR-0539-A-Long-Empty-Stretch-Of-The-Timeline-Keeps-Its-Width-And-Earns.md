# ADR-0539: A long empty stretch of the timeline keeps its width and earns it

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.12.0

**Decided.** A run of six or more empty buckets folds into ONE element occupying exactly the width the columns it replaces would have had. Inside it: year markers, never closer than ten buckets and never more than five of them, and one unattributed line about the fact that nothing in all of that is on your shelf — chosen as the longest from a length-sorted set that fits the width.

**Why.** Drawing the empty buckets was already the right call: it is what makes 380 BCE and 1600 CE read as two millennia apart rather than as two adjacent bars. What it did not do was make the emptiness worth its width. A library holding *Meditations* and then a shelf of 2020 paperbacks draws about a hundred and eighty identical blank columns, and a hundred and eighty blank columns is not a silence you read — it is a stretch of nothing you scroll past looking for the next dot, and it teaches you to stop reading the axis.

**THE WIDTH IS THE LOAD-BEARING PART.** Folding the run to a fixed band was the obvious alternative and is the one thing that must not happen: two millennia and two centuries would then draw the same, which is precisely the failure the empty buckets were introduced to prevent. So this compresses the DRAWING and never the scale, and `gapWidth(span) === span × 34 − 4` is asserted rather than eyeballed.

**Where the gaps fall is derived, not stored.** `timelineSegments` is a pure function of the bucket list, so switching decades to centuries turns a hundred and eighty empties into eighteen — under the threshold at that scale, drawn as plain columns again, with no rule written for it. Below six the blanks read perfectly well as blanks, and a caption squeezed into four columns is worse than the four columns.

**The lines are unattributed and written for the app.** An app whose entire subject is quoting people accurately must not be the one place in it inventing an attribution, and there is no field in a chart to record a real source in even if one existed. A test refuses any line shaped like a byline. They are chosen by fit and seeded off the gap itself, so a gap keeps its line across re-renders and three wide gaps on one chart do not print the same sentence three times.

**Markers ride inside the emptiness, on the plot area**, not on the tick row. On the tick row they would read as the labels of the columns either side, which is the one thing a marker in here must not do. They stay off both ends for the same reason.

**Instead of.** Collapsing long gaps to a fixed band (breaks the scale). A logarithmic axis (breaks it differently, and silently). Dropping the empties (the 0024 decision, already rejected).

**Approved.** The reader chose "keep the width, fill it" over collapsing, having been shown both.

<sub>1.12.0 — `web/frontend/src/StatsPage.jsx` · `web/frontend/src/index.css` · `web/frontend/test/pure/timeline-gaps.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
