# ADR-0546: A timeline label is a year, and a year has to be readable and honest about its scale

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.13.2

**Decided.** The column ticks move off `--font-mono` to `--font-ui` at 10.5/500, the tick row grows 46 → 58px with `.tl-row` growing by the same 12 so the plot keeps its 110px, `slashed-zero` is removed from the gap markers, and `bucketLabel(start, size)` replaces `decadeLabel` everywhere the scale is not a decade. `test/rules/timeline-metrics.test.js` holds the stylesheet against `StatsPage.jsx`.

**Why.** 1.13.0 was asked to fix "8 and 0 look exactly the same" on this chart. It changed the year markers *inside* a folded gap, wrote a long comment about why the mono face was wrong for them, and left the ticks under every column — the labels anyone actually reads, one per bucket — at mono 9px. The report came back unchanged, correctly. Fixing an instance of a problem and describing it as the class is the failure worth naming here: the comment I wrote made the remaining case harder to find, because it read as though the work was done.

**The ticks were the worse of the two cases all along.** `writing-mode: vertical-rl` turns every glyph on its side, so a digit is read by outline alone, which is what survives least at 9px. Plex Mono also draws its own 0 with a slash. That slash is the typeface's zero rather than a setting, so no `font-variant-numeric` can lift it — changing the face is the only fix that exists.

**And the release made the gap markers worse.** It set `font-variant-numeric: slashed-zero` there as a free enhancement: inert if the `@fontsource` subset had dropped the `zero` feature, clearer if it kept it. It kept it, so a face chosen *because* its 0 and 8 differ by outline had a stroke put back through the 0. The general lesson, since it cost a release: a typographic setting whose effect you cannot see is not free. It is an untested change carrying a comment about why it needs no test.

**The height was a clip nobody had reported.** 46px never fitted "480s BCE" at any readable size, so the oldest label in a library was the one being cut off. `.tl-row` grows in step because the plot's height is the remainder — 172 − 58 − 4 = 110px, which is what `TIMELINE_MAX_DOTS` = 12 at a 9px pitch means. Raise one number alone and the twelfth dot is clipped, which looks exactly like a column that had eleven.

**Four numbers now agree by test rather than by comment.** The column pitch a folded gap is measured in (`TL_COL_PX` against `.tl-col`'s min-width — a gap drawn at the wrong width still draws, and the chart starts lying about time with nothing looking broken), the room the dots need, the two tick heights that are one row, and the year labels' face and size. Every one of them fails silently.

**Approved.** The reader's, in the form "the timeline font is not fixed. 8 and 0 are still identical. i think that is because you are using a font that uses a slanted slash for 0" — which named the slash I had added.

<sub>1.13.2 — `web/frontend/src/index.css` · `web/frontend/src/StatsPage.jsx` · `web/frontend/test/rules/timeline-metrics.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
