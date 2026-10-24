# ADR-0667: The third and fourth shapes of one casing rule

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.6

**Decided.** The small-word rule promotes the last LETTERED word, and any small word that carries a terminator; a comma ends a phrase but does not open one.

**Three releases, four faults, one rule.** "The Wheel Of Time" (no list), "Bring It on" (no last-word rule), then "Set It off (1996)" and "Bring It on: A Sequel". Each of the last two is the same oversight as the second, seen from a different angle — the last TOKEN is not the last WORD when a title ends in a parenthetical, and a small word can END a clause as well as follow one.

**All four are corruptions rather than omissions**, and that is what makes the rule expensive to get wrong: it runs on every keystroke and saves what you see, so a title that arrived correct from a provider is rewritten the moment somebody fixes a typo elsewhere in the same field. No diff, no warning, nothing to notice.

**The comma is the shape of the general lesson.** It has to promote the word CARRYING it ("Get Up, Stand Up") and must not promote the word after it ("The Lion, the Witch and the Wardrobe"). One set could not do both, so there are two — and the test that keeps them apart asserts both strings, because either alone passes with the wrong set.

**And the test that matters is idempotence over titles that are already right.** Every version of this rule passed its own examples. What none of them had was a list of correct titles asserted to come back unchanged.

<sub>2.2.6 — `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
