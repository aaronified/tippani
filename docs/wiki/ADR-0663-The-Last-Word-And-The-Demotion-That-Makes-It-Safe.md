# ADR-0663: The last word, and the demotion that makes it safe

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.5

**Decided.** `capitalizeTitle` capitalises the last word however small it is.

**Why it was left out, and why that was wrong.** English title case always capitalises the last word. The first version skipped it because of the as-you-type problem: promote the last word and "of" is promoted while it is briefly the last word, then frozen by the already-has-a-capital hatch. That reasoning was sound about the mechanism and wrong about the consequence — because the rule runs on every keystroke, leaving the last word alone did not merely under-capitalise new titles, it REWROTE correct ones. A title imported correctly from a provider became "Bring It on" the moment somebody fixed a typo elsewhere in the field, saved on the keystroke, with no diff.

**What makes it work now is the demotion added for the middle of the string.** The word is lowered again the instant another word appears after it, so the freeze cannot happen. There is exactly one keystroke — between the space and the next letter — where the screen shows "The Wheel Of "; the next character corrects it.

**The general shape.** A rule that runs on every keystroke has to be judged on every PREFIX, not on the finished string. Both faults in this rule came from testing it on the answer.

<sub>2.2.5 — `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
