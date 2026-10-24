# ADR-0817: The quote card's last two, and the ruling on each

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Both were left open because both were DECISIONS rather than work, and both had
the reasoning recorded rather than a guess landed. The owner settled them.

### attributionOf is deleted, and the promise it stood for is not

`attributionOf(row, kindOfRow, opts)` answered `attribution(row)` for a standalone
quote and `''` for a book highlight or a screen line, so that a card could ask ONE
question for band 3 whatever it was drawing. Nothing in `src` ever called it —
its only references were three lines of its own test.

**WIRING IT IN WOULD HAVE BEEN A REGRESSION**, which is what made this a decision
rather than a chore. The boards pass `meta={utteranceMeta(...)}`, which composes
the kind's phrase, the fields the phrase did not speak for, AND the language mark;
this returned the phrase alone. A card that switched to it would have dropped the
occasion, the date, the place, the locator and a proverb's mark. The real
consolidation runs the other way — band 3 moves INTO the card so no call site
passes `meta` at all — and that is four files and the meta line on every card in
the app.

Put to the owner as delete / finish / leave-with-an-honest-comment, they chose
**delete**. The cost, which they heard: the seam was the marker for a promise the
app has not kept, so removing it makes that drift invisible rather than fixed. The
promise itself survives where it actually shows — `Quotes.jsx` still records "this
ask has been botched as well" over the card branch its own call site made
unreachable.

### The share composes its credit the way the card does

`quoteShare` built `attribution: [speaker, occasion, when]` out of flat fields and
never called `attribution.js`. So `recipient`, `work_title` and `locator` — three
of the five fields 0047 and 0053 added — reached NO part of a share. A letter went
out as "— Albert Einstein, 1952".

**THE OBVIOUS FIX IS THE ONE THE PLAN FILE WARNS ABOUT BY NAME.** Three more flat
entries break no toggle and reinstate "Letter · Carl Seelig" where the card says
"Letter to Carl Seelig" — and `docs/plans/quote-card-types.md` ends on exactly
that: "if that discipline is not held, B2 and B3 will drift and the share image
will keep drawing a proverb as a speech."

So the share calls `attributionParts`. The phrase rides on the `occasion` entry and
the fields the phrase did not speak for keep their own toggles, gated on `rest`.
The owner chose to **keep the `occasion` id**: a rename resets the stored
preference of every reader who had switched that field off, and the cost is that a
letter's toggle reads "Occasion" over "Letter to Carl Seelig".

### Two things this got wrong first, and what caught each

**A COMMENT CLAIMED A GUARD THAT COULD NOT FAIL.** `attributionParts` was handed
`date: ''` under a note saying it stopped the picture printing the year twice. It
did not: a phrase never speaks for a date, and the share reads `rest` for
MEMBERSHIP rather than rendering it, so the option changes nothing this function
looks at. A mutation run is what showed it — the mutation survived, and a
surviving mutation is usually a missing case and was here a false claim. The
option is gone and the case that asserted it was deleted rather than rewritten.

**AND THE FIRST `unspoken` DROPPED A FIELD IT HAD BEEN HANDED.** With no row — or
a row captured before 0053, which has no `kind` — there is no phrase and `rest` is
empty, so "is this value in rest" answers NO for everything and a place passed in
directly vanished. `share.test.js` caught it on an existing case rather than a new
one. The test is `line && !rest.includes(v)`: nothing spoke for anything, so
everything stands.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
