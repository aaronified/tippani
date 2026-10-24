# ADR-0459: Two icon sizes, two rules: 44px can be named, 34px cannot

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.14.0

**Decided.** `FieldIconButton` is a component in `ui.jsx` and all 46 hand-written `field-icon-btn` sites move onto it. It has **no `label` prop**, deliberately. `IconButton` gains `ok` alongside `danger`. A test asserts exactly one `<button>` in the SPA wears the class, and names the single non-button that does. This closes the "213 raw `<button>` elements" gap 1.13.0 recorded as not done.

**What the audit actually found.** 216 raw `<button>` elements, and they are not 216 decisions:

| | count | what it is |
|---|---:|---|
| already render words | 125 | text buttons — their name is always on screen; the preference has nothing to do |
| the 34px field icon button | 46 | ONE control, hand-written 46 times across 13 files |
| surfaces you click | ~41 | chart cells, colour swatches, covers, chips, the drawer scrim, nav glyphs, a token's ✕ |
| nameless by design | 4 | ✕ and ⋯, settled in 1.13.1 |

The middle row is the whole finding. The other three are correct as they stand and are not deferred work: a text button's words are its name and cannot be hidden; a swatch, a cover and a chart cell are surfaces rather than named controls, and giving them words would be inventing labels for things nobody calls by name.

**And the 46 were not sloppy, which is the part worth recording.** The audit went looking for drift. All 46 carried an `aria-label`, all 46 were wrapped in a `Tooltip`, four variants were spelled consistently, and exactly ONE site had diverged — `Home.jsx` was missing `tactile`, so one button in the app did not press when you pushed it. Copy-paste held for 46 uses across 13 files, which is a better result than the count suggests and is not an argument for leaving it alone.

**A CLASS STRING CANNOT MAKE A DECISION.** That is the reason, and it is not about drift. `IconButton` gained an opt-in `label` in 1.13.0 so the 44px family could honour Button labels. The 34px family could not opt into anything, because there was no place to put the opting. Forty-six controls sat outside a preference that claims to govern the app — not by a decision, but by never having been asked. The question could not even be *raised* against a string.

**Asked, the answer is that this size is nameless.** 34px exists precisely because it sits in a row that has already spent its width: a text input with a ✓ and a ✕ after it, a cover's control cluster, a card action row that already wraps at six colour dots. A word beside the glyph is the one thing there is no room for — it is *why* the second size exists. Adding labels here would collapse the distinction between the two families rather than complete it, and the row would break at the first one.

So: **44px can be named and opts in with `label`; 34px is nameless by construction, and its name lives in the tooltip and the accessible name, both of which the component now guarantees rather than each caller remembering.** The no-label test is the rule rather than a description of the markup, so adding a label to this size later is an argument somebody has to make.

**Two adjacent findings, fixed by arriving.** The drifted `tactile` is supplied by the component. And `IconButton` had a `danger` and no `ok`, so the Add sheet's ✓ wore `.field-icon-btn-ok` — the *other* family's colour class — to go green. One family reaching into another's stylesheet for a colour is exactly how two families stop being distinguishable, which is the complaint that started this work; `.tp-btn-ok` exists now.

**The measure of what the primitive absorbed** is that three files lose their `Tooltip` import outright. The wrapper was being threaded through by hand at every one of those sites, and "threading a wrapper through forty call sites is how half of them end up without one" was already written in `IconButton`'s own comment — about a risk that had not yet materialised here.

**Instead of.** Labelling the 46 (the rows break, and it would answer a question nobody asked with the wrong answer). Adding a `size` prop to `IconButton` (one component with two contradictory rules about naming, which is where the confusion would move to). Leaving it as a string and adding a lint rule (a rule can enforce a spelling; it cannot hold a decision).

**Approved.** The reader's, in the form "named in the commit: 213 raw `<button>` elements — a decision per call site, not a sweep. start at once."

<sub>1.14.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/field-icon-button.test.jsx` · `docs/ui-glossary.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
