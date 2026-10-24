# ADR-0269: Adaptive intervals became the default, and the ladder became the opt-in

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** A reader who chooses nothing is on the multiplicative rule: a correct recall multiplies the half-life by 2.5, a lapse **halves** it rather than resetting to the first rung. The fixed ladder is one switch away and stays fully supported. The stored preference is `srLadder` — it names the ladder, not adaptive.

**Why.** This entry's own predecessor already named the reason and then shipped the opposite: *"a lapse currently drops you to 7 from any rung, and that is the one place the loop is harsher than the science asks."* A reader who has expressed no opinion should not be on the harsher of two rules. Anki's move to FSRS settled the argument; keeping the harsher rule as the default was deference to legibility, and legibility is what the *option* is for.

**And the flag had to invert, which is a data fact rather than a preference.** `srAdaptive` was a flat `bool` in a JSON blob with no `omitempty`, so every stored preference already carried `"srAdaptive": false` whether the reader chose the ladder or never opened the panel. The two are indistinguishable in the data and always were, so a default like that cannot be flipped — the only honest move is to make the stored flag name the NON-default choice, which is the convention `srPracticeCounts` and `srSubmit` already follow. **Every existing reader therefore moves to adaptive once**, and the release notes say so rather than letting it be discovered. The sense is inverted in exactly one place, `prefs.adaptive()`, because a negation spelled correctly at three call sites and wrongly at a fourth is a reader on the wrong schedule with nothing on screen to say so.

**Instead of.** A one-time upgrade writing `srAdaptive: true` into every account and a `*bool` for new ones — rejected: it is a data rewrite and a nullable field to buy back a distinction the app never recorded, and it would leave two spellings of "the default" in the code. Also rejected: leaving the default alone and arguing the point in the help text, which is what the 1.15.0 entry effectively did.

**Approved.** Mine, with the "everyone moves" consequence named out loud as the thing to be sure about.

<sub>3.1.0 — `internal/httpapi/auth_handlers.go` · `internal/httpapi/review_tuning.go` · `internal/httpapi/review_handlers.go` · `web/frontend/src/Settings.jsx` · `web/frontend/src/Home.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
