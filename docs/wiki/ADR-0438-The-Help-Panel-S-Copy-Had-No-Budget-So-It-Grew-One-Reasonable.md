# ADR-0438: The help panel's copy had no budget, so it grew one reasonable sentence at a time

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 2.0.1

**Decided.** An entry is `{ term, icon?, what, how?, more?, asset? }`. `what` is one front-loaded sentence and `how` is up to three verb-first lines; both are **visible and capped by a test**. `more` is folded behind a `<details>` and is **deliberately not capped**. The panel gained a rail of screen sections with anchors, opening on the screen you pressed `?` from.

**The measurement, because "too much fluff" needed a number.** 157 entries, 49,738 characters, about 8,000 words. The median entry was 233 characters — perfectly fine — and the tail was not: 40 over 400, 8 over 800, the worst 1,911 characters and fifteen sentences. And the longest entries were the SHELL ones, which every screen's panel appends, so **the copy a reader met most often was the copy that read least.** After: 19,732 visible characters, mean 125, longest 200, with 28,831 characters folded rather than deleted.

**Why nothing noticed.** No test failed, no gate fired, and every individual addition was defensible — the entry on selecting several things is fifteen true sentences. Prose has no compiler, so the only instrument that works is a budget, and the budget has to be on what is VISIBLE rather than on what is written. Capping `more` would have turned "collapse it" into "delete it" by the back door.

**Front-loading is the whole formatting decision.** People scan rather than read, and the F-pattern NN/g documented is a warning about that rather than a layout to design for — so the first phrase of an entry is the answer, and anything that is not the answer is one click away instead of in front of it.

**The reader is not a beginner**, which the register test enforces: *simply*, *just*, *you can*, *in order to* and *press and hold* are refused in the visible half. Four of those are always deletable and the fifth explains how to operate a touch screen to somebody holding one.

**The split was mechanical and the rewrites were not.** 86 entries had their tail folded by a script that moves sentences and never edits one — the copy was already front-loaded, so the first sentence was already the answer. Only 8 needed writing by hand: three whose first sentence was itself over budget, and five carrying a banned word. Doing it the other way round — rewriting 157 entries from scratch — would have lost detail nobody was asking to lose.

**Assets, ranked by how they go stale.** A live-rendered control is first choice because it is not a picture of the app, it IS the app: the swatch row in the colour entries reads `var(--hl-N)`, so a reader who renamed or recoloured their categories sees theirs. A schematic SVG is second, because it states a relationship — the import queue is a gate — and a restyle cannot make a relationship wrong. Gesture clips are third and abstract for the same reason. **A screenshot is last and there are none**, because real pixels are the one class that silently shows last year's interface, which `How-this-was-written.md` names as this repo's worst failure mode.

**Instead of.** A Help screen at its own route (help stops being beside the control), a task rail (the panel loses the one thing it knows for free — what screen you are on), a search box (it answers only when you already know the word for what you cannot find), and cutting the reasoning to the bone.

**Reversal.** Supplements the entry above rather than overturning it. Moving explanation off the page into a dot was right; what it did not come with was a limit on how long the explanation could then get.

**Approved.** The owner's, who asked for formatting and assets rather than only brevity — "the user should be able to easily scan the page to know where he needs to go, gets there with a click or a short scroll, and understands everything at a glance" — and who added, after the first pass, that the reader "is not a complete idiot".

<sub>2.0.1 — `web/frontend/src/help.jsx` · `web/frontend/src/ui.jsx` · `web/frontend/src/gestures.jsx` · `web/frontend/test/rules/help-budget.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
