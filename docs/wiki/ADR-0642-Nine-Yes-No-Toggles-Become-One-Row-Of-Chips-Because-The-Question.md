# ADR-0642: Nine Yes/No toggles become one row of chips, because the question was a set all along

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.1

**Decided.** The in-depth quiz panel's question types (four for the daily deck, five for Practice) and the Features card's four sections are rows of pressed/unpressed chips now, through one shared `ChipSwitches` in `ui.jsx`. The hand-rolled review-scope chips in the same card went through it too.

**Why.** A segmented Yes/No answers one question with two mutually exclusive answers. "Which of these five does the deck ask?" is one question with five independent answers, and drawing it as five two-state controls spends a labelled row plus a switch on each — a pop-up you scroll to reach the third of five options, where the answer you want is "the ones that are lit". Nine of them was the whole panel.

**The precedent was already in the same card.** Three chips (books / films / quotes) had done exactly this since the review scope was written, hand-rolled from `filterChipClass` and a `Tooltip` — and had already shipped a bug the sharing would have prevented (`t()` around the hint and not around the label). So the mechanism is now one component with three call sites rather than three copies of one widget.

**A locked chip refuses and is not `disabled`.** Both callers have a last-one-standing rule — the deck that must keep one question it can ask, the app that must keep one content section — and `disabled` on a button eats the pointer events a tooltip opens on. So the chip stays live, says `aria-disabled`, swallows its own click, and **the caller draws the reason in words beside the row**: a reader who cannot turn something off is owed the reason on the screen they are looking at, not in a bubble they have to know to ask for.

**What was given up.** The Features card's four blurbs were standing microcopy and are now each chip's tooltip — reachable by hover and by long press, which is the same bargain the review-scope chips have always made. The test that asserted them on screen now asserts that the card resolves the key before handing it over, which is the failure that case actually existed for.

<sub>2.2.1 — `web/frontend/src/ui.jsx` · `web/frontend/src/Settings.jsx` · `web/frontend/test/dom/features-card.test.jsx`</sub>
<sub>1.17.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/Settings.jsx` · `web/frontend/test/dom/features-card.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
