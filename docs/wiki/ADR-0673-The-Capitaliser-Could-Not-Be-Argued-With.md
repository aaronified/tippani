# ADR-0673: The capitaliser could not be argued with

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.8

**Decided.** Nothing in the page rewrites a name. `autocapitalize="words"` on every name
or title field; the browser default everywhere else.

**Four releases on one title.** "The Wheel of Time" was the example the small-word rule
was written for and the example it kept failing. The rule ran on every keystroke, so "of"
arrived as "o" — not on the list — was promoted to "O", and the promote-only rule's own
escape hatch (a word carrying a capital is somebody's decision) froze it. Each fix added a
clause: demote a completed small word, exempt the last word, find the last LETTERED word,
skip a word carrying a terminator, a different set for the word before. Five interacting
clauses, and the owner still could not type the title.

**THE SHAPE OF THE MISTAKE IS NOT THE CLAUSES, IT IS THE GUESSING.** A rule that infers
intent from characters needs an escape hatch; a hatch needs to be discovered; and a reader
who has not read the source has no way to know either exists. Meanwhile it rewrote what a
provider had spelled correctly, it fought the phone's keyboard underneath it, and on a
laptop it was the only thing capitalising at all — so the same field behaved three ways on
three devices.

**What the attribute buys that the rule could not.** It is a HINT, and the reader
overrules it with shift — a control they already know, on the field they are looking at,
with no hatch to find. `titleCase` went with the rule: a flag whose only job was picking
between two rules has nothing to say when there are none.

**The one transform that survives** is `titleCaseGenre`, and the distinction is worth
keeping: a genre is a closed vocabulary normalised on COMMIT, not an open-ended name
rewritten per keystroke. It never fights the person typing because it runs after they
stop.

<sub>2.2.8 — `web/frontend/src/ui.jsx` · `web/frontend/src/suggest.jsx` · `web/frontend/test/dom/name-casing-field.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
