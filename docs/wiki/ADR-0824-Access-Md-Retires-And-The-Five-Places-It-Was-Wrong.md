# ADR-0824: access.md retires, and the five places it was wrong

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted, then changed or withdrawn: the entry says how

Roadmap §6, six rows, all shipped. The plan turned out to be wrong about FOUR of
them and right about one — and the one it got right it got right completely, which
is worth as much as the corrections.

| The plan said | What was true |
|---|---|
| Contrast: **not built** | Correct. Five text colours measured below 4.5:1 and were raised; the switch resolves to one state with the media query. |
| Reading comfort: **partly built**, three controls | TWO controls. Size already shipped — four per-role dials, ten steps, with `typescale.test.js` failing on a hardcoded size anywhere. |
| A `--quote-size` token | There is none and none is needed: size travels as `--type-display-*`. |
| Dyslexia face: **reachable, not offered** | **Exactly right**, including the diagnosis — uploading has worked since 0039, so the gap was the OFFER. |
| Gesture equivalents: **not built** | SEVEN OF EIGHT already had one. One did not. |
| i18n scaffolding: **not built** | Built before the plan was written — `en.txt`, `bn.txt`, `t()` throughout, `data/Locales`. |

**THE GESTURE ROW IS THE ONE WORTH READING TWICE.** "Not built" implied a sweep;
an inventory of every pointer gesture in `src/` found the drawer's swipe-close has
a real `<button>` scrim, the Toggle's thumb drag has `<button role="tab">` options,
the Select's drag-to-pick answers Arrow and Enter, and the touch tooltip answers
focus. Exactly one interaction in the whole app could be done only by dragging:
positioning the seal on a quote — and it PERSISTS (`sticker_x`/`sticker_y`), so it
was a stored property of somebody's own quote that a keyboard could not set.

**A RESIDUE I RECORDED, AND THEN DISPROVED AT THE LINE.** The first draft of this
section said two interactions answer a KEY but have no named focusable control —
the card's context menu and the phone sheet's step — and offered `keys.js` as the
place to register them. Both halves were wrong, and checking took two greps. The
sheet's step handler hangs off `<button className="tp-sheet-grip"
aria-label={t('shell.sheet.grip.aria')}>` (`ui.jsx`), whose own comment says it is
"a button, not a painted bar" for precisely this reason; the card's menu renders
"the SAME list the row and the ⋯ render" (`Library.jsx`), so the ⋯ IS the named
control. The claim came out of the inventory fan-out and I wrote it down without
opening either file — which is the repo's own rule about a subagent's finding
failing on the one paragraph that was about verification. **So the row has no
residue: every gesture in the app reaches its outcome through a named, focusable
control.**

**AND ONE ARIA FAULT SHIPPED KNOWINGLY.** The seal button sits inside the quote
block's own `role="button"` when the quote is clampable — nested interactive
content. It ships because the alternative is the status quo, which is a stored
setting a keyboard cannot reach, and a warning is a smaller harm than a barrier.
The proper fix is to give the clamp toggle a control of its own so the block stops
being a button; `ClampMore` is `aria-hidden` decoration today, which is why it
cannot take that job yet.

**THREE COPIES OF ONE CLAMP BECAME ONE.** `clampSealCentre` — where a seal may sit
— existed twice before the keyboard (the relayout and the drag) and had already
drifted: the drag floors its vertical ceiling at `r` and the relayout did not, so
on a block shorter than the seal is wide they disagreed by up to `OVERFLOW`. The
keyboard would have been a third. The drag's version won, because it is the one
that cannot produce a ceiling below its own floor.

**AND A TEST THAT COULD NOT SEE ITS OWN POINT.** The step is 2% of the block width,
not a pixel count, so a press covers the same share of the line on a phone as on a
desk. The first guard asserted the resulting fraction at one width — 600px — where
a 12px step and a 2% step are the same number, and a mutation swapping one for the
other passed. It asserts at three widths now. The lesson is the repo's own: a test
that fixes the one variable the rule is about is a test of nothing.

**AND THE PUBLIC PAGE HAS TWO HALVES, ONLY ONE OF WHICH IS GENERATED.** Marking the
§6 card `shipped_in` drops the CARD and leaves the SECTION BODY untouched —
`roadmap-data.mjs` says so in as many words ("Everything outside the markers is left
byte-for-byte alone"), and §6's body is hand-written prose. So a section whose every
row had shipped went on promising all four in public: the contrast work, the two
reading dials, the dyslexia face, and — with its own closing sentence — that "the
quote box still offers only serifs", which `FONT_FACES.display` had stopped being
true of in the previous commit. That is the same defect #199 fixed for the size
claim, one layer out, and it will recur on the next section that ships: **a card's
`shipped_in` is not a docs pass.** The body now carries one paragraph of what
shipped and the one bullet that is genuinely still ahead — holding each gesture §2
adds to the rule as it lands, which is the only part of the row that was ever about
future work.

**AND FOUR CLAIMS ABOUT THE *OTHER* CONTROLS, TWO OF WHICH WERE FALSE.** The seal's
own behaviour was checked at every step; the sentences describing its NEIGHBOURS were
taken from the inventory fan-out and written into five places — both CHANGELOG copies,
the roadmap bullet, the features card and `flow.jsx`'s own header — before anybody
opened the files. Two survived a grep and two did not:

| Claim | Line | Verdict |
|---|---|---|
| the sheet closes from a button | `ui.jsx` `mobile-sheet-close`, labelled `common.sheet.close.tip` | true |
| the pickers answer arrow keys | `ColorSwatches`' `onKey`, and `Select`'s listbox | true |
| **the toggles answer arrow keys** | `Toggle` has no `onKeyDown` at all | **false** |
| **a scroller wears a button at its fade** | `Scroller` renders the fade attribute and drag-to-scroll, no button | **false** |

Neither false one weakens the row: a toggle's options are each a `<button role="tab">`,
so the equivalent exists and only the mechanism was misnamed; and scrolling needs no
app-provided equivalent at all, being the platform's own and keyboard-reachable
already. But a public page and a changelog said them, which is the harm — and the
pattern is now four-for-four this change: **every defect found here was in prose about
code, never in the code.** The rule that catches it is the repo's own and it was
applied to the change and not to its own description.

THE TOGGLE GAP IS REAL AND IS NOT THIS CHANGE'S. An ARIA `tablist` whose tabs do not
answer arrows gives a keyboard reader N tab stops where the pattern promises one, and a
screen reader announces a gesture the widget does not honour. `ColorSwatches` next door
implements it correctly — one tab stop at the chosen item, arrows moving focus with a
wrap — so there is a pattern to copy rather than invent. It has its own task; widening
this commit to reach it would be the thing the plan queue exists to stop.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
