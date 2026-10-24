# ADR-0318: The numbers behind the schedule are bounded, not free

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.16.0

**Decided.** The multipliers, the difficulty weighting, the multi-word cloze threshold and the ladder's three rungs are per-user preferences. Every one is clamped, and out-of-range falls back to the **default** rather than to the nearest bound.

**Why the clamps rather than free numbers.** These multiply a half-life on every answer, so a bad one does not produce a wrong screen — it produces a schedule that is quietly useless and stays that way. A grow of 0.5 shortens a card on every *correct* answer, so a quote you know perfectly is asked more and more often for ever. A shrink of 1.5 lengthens it on every failure. Neither errors, neither looks broken, and both would take weeks to notice. So grow is `> 1` and shrink is `< 1` by construction, each range closing exactly where the number would start meaning its opposite.

Falling back to the default rather than the nearest bound is the smaller of two wrongs: somebody who typed 0.5 into "correct answer multiplier" meant something, and silently handing them 1.1 answers a question they did not ask. The default is at least a number whose behaviour is written down.

**The ladder is the one the interface refuses rather than corrects.** It has to ascend and has to stay inside the bounds the due-ness SQL floors and caps against — a rung outside them is a card that is due for ever or never. The server reverts one that does not, silently, because there is nowhere to report it from; so the panel says why and does not send the PUT. A test asserts the sliders' own bounds against the Go clamps, because a slider offering a value the server throws away is a control that moves and does nothing.

**Instead of.** Leaving them constants — which made the review loop the one part of this app whose behaviour was an opinion the reader could not disagree with.

<sub>1.16.0 — `internal/httpapi/review_tuning.go` · `web/frontend/src/quiz.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
