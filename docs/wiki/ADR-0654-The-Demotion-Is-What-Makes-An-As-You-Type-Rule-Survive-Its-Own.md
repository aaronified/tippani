# ADR-0654: The demotion is what makes an as-you-type rule survive its own prefixes

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.3

**Decided.** `capitalizeNames` keeps an English title's small words small, and DEMOTES one that arrives capitalised rather than merely declining to promote it.

**Why declining is not enough, which is the non-obvious half.** The rule runs on every keystroke, so "of" arrives as "o" first — and "o" is not on any small-word list, so it is promoted to "O". By the time the "f" lands the word carries a capital, which is the promote-only rule's own escape hatch, and it is frozen for the rest of the edit. Every reader who typed "The Wheel of Time" got "The Wheel Of Time" and could not see why. Only an active demotion of the completed word beats the prefix it was typed through.

**The escape hatch has to be the CASE hatch, not the capital.** Re-typing the letter as a capital changes the string in case alone, which sends the field `free` and stops every transform for the rest of the edit. That is how "Don't Look Up" is typed, and it costs one keypress.

**Name particles are deliberately absent from the list.** `van`, `de`, `del`, `la`, `le` are lower-case by one convention and upper by another — "Vincent van Gogh" and "Robert De Niro" are both correct — and any list that settled it would quietly rename "Ursula Le Guin". The list stays to the words where English title case has one answer.

**An all-caps token is exempt**: lowering the first letter of "IN" gives "iN", which is nobody's title.

<sub>2.2.3 — `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
