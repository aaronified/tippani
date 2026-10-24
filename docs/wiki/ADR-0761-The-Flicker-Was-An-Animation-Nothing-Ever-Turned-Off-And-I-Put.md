# ADR-0761: The flicker was an animation nothing ever turned off, and I put it there

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**THE OWNER, ACROSS FIVE MESSAGES, DID THE DIAGNOSIS.** "i am getting a lot of flicker when
using the character actor screens (the drag is fixed now, but there are still a lot of
flicker and frame tears)", then "those flickers happen very rarely in details popups", then
"i keep on getting flickers even long after the popup is openened", then "and i never saw
anything pending to load". Each sentence killed one of my hypotheses, and the last two
between them named the fault: an animation that never ends, describing a wait that was not
happening.

**`.img-wait` IS `animation: img-wait-sweep 1.1s linear infinite`** and it is gated on the
picture not having arrived. `Face` learned arrival from the `load` event alone — and **a
cached image fires no `load`**. So from the second visit onward the hero portrait swept
continuously for as long as the panel stayed open.

**WHY THOSE TWO SCREENS AND ALMOST NEVER A DETAILS POPUP**, which is the part that made the
report diagnostic rather than vague: the mark is deliberately armed only for
`loading="eager"`, and `PortraitBlock` is the sole eager caller. It is the hero on
`char-*` and `people-global` and nowhere else. A details popup draws its art through
`Cover`, lazily, so the sweep was never armed there at all.

**AND THE FACT WAS ALREADY WRITTEN DOWN, TWENTY LINES AWAY.** `PortraitBlock`'s own comment
says it: "AND A CACHED PICTURE NEVER FIRES `load`. The measurement rode on that event alone,
so the size appeared on a first visit and the caption fell back to 'the record's own
picture' on every visit after — which is the screen the owner sent." I hit that fact, fixed
the MEASUREMENT for it, and did not carry it to the arrival flag one component over — which
is the same shape as `.src-mark` earlier in this session: know the fact, fix one consumer,
leave the other. Both were shipped in the same week by the same hand.

**`complete` MEANS FINISHED, NOT SUCCEEDED**, so the width decides which. A cached FAILURE is
complete with `naturalWidth === 0` and fires no `error` either, which left a broken portrait
animated as though it were on its way — and left the zoom button live over it, undoing part
of the repair made earlier this session for exactly that.

**WHAT I RULED OUT FIRST, recorded so the next reader does not re-walk it:** late data (these
panels fire two requests after mount, not the eight a commit message of mine had implied —
that number was `people.jsx`, a different screen); a fetch loop (the owner saw no pending
state); `useEdgeScroll` (it writes an ATTRIBUTE, not state, so it cannot re-render); the
`requestAnimationFrame` at `ui.jsx:1399` (one-shot, guarded by `if (!frame)`); and `refit`
running after every render, which is real but needs something to be rendering.

**AND A COMPOSITE READ MODEL WAS PROPOSED AND IS NOT THE ANSWER HERE.** The owner asked
whether the requests could be collapsed into "a composite view table" and whether that is
industry practice. It is — a read model, a materialised view, endpoint aggregation — but
`/characters/{id}` is already that composite, and two requests cannot produce a flicker that
recurs while idle. Recorded because the instinct was sound and the measurement said
otherwise.

<sub>Unreleased — `web/frontend/src/characterRows.jsx` · `test/dom/image-wait.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
