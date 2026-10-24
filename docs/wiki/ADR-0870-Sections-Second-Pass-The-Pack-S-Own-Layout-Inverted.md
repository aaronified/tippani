# ADR-0870: Sections, second pass: the pack's own layout, inverted

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE FIRST CUT HAD THE PACK'S WIDE RULE EXACTLY BACKWARDS, AND IT LEFT A HOLE.** The pack
special-cases this one screen — `(g.wide || (s.id === 'sections' && i === 0))` at
`settings-restructured.dc.html:3311` — spanning the ORDER list across both columns and
letting the two tuners pair beneath it. Its reason is written beside it: *"The list of
sections is a list of rows with controls at their ends: it reads across the whole measure,
and the tuners pair beneath it."* The first cut marked the two slider groups `wide` and left
the order list narrow, which is the same rule applied to the wrong groups.

**MEASURED, BEFORE AND AFTER, AT 1280.** Before: the order group drew 457px at x=281 with the
two specimen groups 954px stacked under it — roughly 480×344 of the card's right half empty
beside the list, the page 1273px tall. After: the order group spans 954px, the two tuners sit
side by side at 457px each, and the page is **952px** — 321px shorter, with nothing empty. At
390 nothing changed, which is the point of the rule only applying to the first group.

**AND THE SPECIMEN'S COUNT FOLLOWS THE COLUMN, WHICH IS THE ARGUMENT FOR MEASURING RATHER
THAN COUNTING TO THREE.** In a 457px column a 165px cover fits twice, not three times
(two cost 344 and three would need 523), so the desk now draws two. The phone draws two as
well, and for a different reason — its cells start at 100px, so three would cost 328 against
a 316px column. A hard-coded three would have been wrong at BOTH widths after this layout
change, not just on the phone the owner reported it from.

**THE CORRECTION THIS OWES THE ENTRY ABOVE.** That entry records "at 1280 the specimen column
is 954px and draws three covers at 165 and three posters at 150". That was true of the
inverted layout and is not true now: the column is 457px and draws two of each. The numbers
there are superseded by the ones here.

**THE GAP IS ASKED FOR NOW, NOT REMEMBERED.** It was the literal `14` with a comment pointing
at `.cover-specimen` in `index.css` — two copies of one number joined by nothing a tool can
check, so a stylesheet edit would have left every count quietly one cover out. The element
knows its own `column-gap` and a computed style resolves it to pixels, so the component asks.

**THE WIRING HAS A TEST NOW. IT IS A DOM TEST, AND THE REASON FIRST GIVEN FOR THAT WAS
WRONG.** What this paragraph said was: the specimen is `aria-hidden`, a journey sees the
accessibility tree, so there is nothing in it to assert. The first half is true and the
second is not. `see` and `gone` poll `document.body.innerText` (`test/journeys/harness/
screen.mjs`), and `aria-hidden` hides an element from assistive technology without taking
its text out of the rendering — so the sample's book titles were reachable from a journey
the whole time. The claim was wrong, it was written here as settled, and a rating caught it.
There is a journey now: `sizing-a-cover-on-a-phone.journey.mjs` at 390 and a second case in
`putting-a-section-first.journey.mjs` at 1280, both asserting that the third book is not
drawn, both failing when the fixed three comes back.

**AND WRITING IT HERE MADE IT WORSE THAN GETTING IT WRONG IN A COMMIT.** A commit body is
read once, at review; this file is where the next person comes to find out whether something
was already decided. A wrong reason recorded as settled is a reason nobody re-examines.

**THE DOM TEST STAYS, FOR THE PART A JOURNEY STILL CANNOT REACH.** The pure test owns the arithmetic and PASSED for the
version that drew one cover on a 954px desk, because the defect was in the wiring rather than
the sum. `test/dom/cover-specimen-fits.test.jsx` holds that half: the component measures
AFTER the shelf arrives, measures again when its box changes, and reads its gap from the
element. Putting the old ref-plus-mount-effect back fails two of its three cases.

**THE PACK'S `step: 5` IS CARRIED, ON A FLOOR OF 95 RATHER THAN ITS 96.** Its slider rows say
`min: 96, max: 240, step: 5` (`:2731`, `:2736`) and, three lines later, compare against
defaults of 165 and 150. HTML steps from the MINIMUM, and 165 − 96 = 69 and 150 − 96 = 54 are
not multiples of 5, so on the pack's own ladder NEITHER OF THE PACK'S OWN DEFAULTS can be
selected; a browser snaps an out-of-step value, so copying it exactly would have moved every
stored size and made the default unreachable.

The first answer to that was to drop the step and record why. That was the wrong trade and a
rating said so: a floor of 95 puts 95, 100 … 150, 165 … 240 all on the ladder, the phone's own
default of 100 included, at the cost of one pixel on a minimum no reader can perceive. Losing
the coarse drag the pack asked for is a bigger departure than moving its floor by one. The
same 95 is now `useCoverSize`'s own minimum, since the hook validates what the slider writes.

**AND THE CHANGED MARK, RECORDED RATHER THAN LEFT IMPLICIT.** The pack marks these sliders
`changed: v.coverBooks !== 165`; the app draws no mark on either. They are device-local — held
in this browser's storage, never on the account — and the section's changed count is of
preferences the SERVER holds, so a mark here would put a number on the tab that the account
cannot account for. The aside "this device" is what says it instead.

*Unreleased — `web/frontend/src/Settings.jsx`,
`web/frontend/test/dom/cover-specimen-fits.test.jsx`.*

**AND THE LAYOUT ITSELF HAS A GUARD, AFTER A FALSE ONE WAS CLAIMED FOR IT.** The desktop
journey's comment first said that a third book appearing would also catch the spanning coming
off the order group. Mutation-checked, it does not: with the two size groups no longer marked
`wide`, the sample's column is half the card whether the order list spans or not, so removing
the spanning leaves that journey green. Nothing observable to a reader changes in a way any
tier can see — jsdom has no width and the accessibility tree has none either — so
`test/dom/features-card.test.jsx` reads the class, with the exception declared in the case
itself. A test that reads a class is worse than one that reads the screen and better than the
silence that let the inversion ship in the first place.

**THE GAP READ WAS UNTESTED BY THE SUITE WRITTEN FOR IT**, which is the small lesson of this
pass. Replacing the component's `getComputedStyle(el).columnGap` with a flat `0` left every
case in both files green: none of them sat in the band where a 14px gap changes the answer.
`test/pure/cover-fit.test.js` now varies the gap as a parameter instead of holding the
stylesheet's number as a constant of its own, and both files carry a case in the band — two
165px cells cost 344 with the gap and 330 without, so a 335px column holds one or two
depending on whether the gap was read at all.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/ui.jsx`,
`web/frontend/test/journeys/sizing-a-cover-on-a-phone.journey.mjs`,
`web/frontend/test/journeys/putting-a-section-first.journey.mjs`,
`web/frontend/test/dom/features-card.test.jsx`,
`web/frontend/test/dom/cover-specimen-fits.test.jsx`,
`web/frontend/test/pure/cover-fit.test.js`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
