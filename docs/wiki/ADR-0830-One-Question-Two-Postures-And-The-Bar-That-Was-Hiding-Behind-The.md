# ADR-0830: One question, two postures, and the bar that was hiding behind the header

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

A rating of the anthology and per-screen-tour work came back at 7/10 with six
findings. Two of them were the same kind of defect said twice — a claim nothing
held — and one was a design departure nobody had written down. What follows is what
each turned out to be, because three of the six were only half of what they looked
like.

### The bulk bar was never unreachable "in the harness"

The finding: a selection of books offers *Add to anthology* and nothing asserts what
pressing it does — mutate `SelectionBar`'s rule to `''` and the whole suite stays
green over a feature that makes an empty anthology and reports success.

The reason it had no journey was written into the jsdom test that stood in for one:
"a work selection's ⋯ does not open in the harness". That had been believed for two
releases, and it was **a stylesheet bug in the app**:

```css
.selection-bar { position: sticky; top: 0;  z-index: 30 }   /* the bulk bar */
.topbar        { position: sticky; top: 0;  z-index: 40 }   /* 56px tall     */
```

Two things pinned to the same line, and the one that wins is the one drawn on top.
Measured rather than argued: the ⋯ reported a 44×44 box at `y = 9`, and
`document.elementFromPoint` at the button's own centre returned the top bar's search
input. Every control on that bar was dead once the page had scrolled far enough for
the bar to stick — the ⋯, the shelf menu, **Set fields**, all of it, since 1.16.0.

**THE PHONE HALF WAS ALREADY RIGHT**, which is the part worth keeping in mind. A
`@media` rule set `top: 54px` there, with a sibling comment explaining that a sticky
bar has to clear `.mobile-topbar`. The desktop bar was simply never given the same
offset, and a `--topbar-h` token now states the height once so the two rules cannot
disagree about it again.

**NO TIER BELOW A BROWSER COULD HAVE SEEN THIS.** jsdom has no layout: it opened the
menu happily, which is exactly why the jsdom stand-in passed while the feature was
unusable. The test that replaces it presses through a real browser, and the mutation
the rating named now kills it.

### A guard that went out with the thing it grew up beside

`test/pure/tour-sections.test.js` held one claim: a step marked `admin` drops out for
everyone else. It was deleted along with the Settings onboarding picker, because it
sat in the same file — and nothing replaced it. Strike `!s.admin || isAdmin` out of
`tourSteps` and vitest stays green, the new per-screen tour journey stays green, and
a reader who is not an admin gets walked through the API-keys card and the Backup
card: two panels their account does not draw.

**THE HARNESS IS AN ADMIN, WHICH IS WHY THE JOURNEY COULD NOT SEE IT EITHER.** So the
replacement makes a second account the way `per-user-isolation` does — from the
Profile screen, which is how a person makes one — and reads the same button on the
same screen: three steps for the admin, one for the reader. Then it walks that one
and checks the two are not behind it.

### A journey that asserted its own title

`an-anthology-of-a-tag` ended on `see('Everything hopeful')`, which is the anthology's
TITLE — printed by the list whether the fill took anything or not — while the header
above it claimed the mutation would be caught by "the final `see` of a tagged quote".
The rating proved the gap by disabling the form's fill outright and watching the file
pass. It reads a Hope-tagged line out of the opened anthology now.

**THE GENERAL LESSON, AND IT IS NOT "MUTATE MORE".** Every journey here is
mutation-verified, and this one was too — against the mutations its header names,
which were about the FORM. What nobody checked was whether the last line asserted the
thing the paragraph above it said it asserted. A header that describes a stronger test
than the file contains is worse than no header: it is the reason nobody looks again.

### The departure: one question asked in two postures

Making an anthology asked **What goes in it** and offered named sources — a book, a
tag, an author, a colour, a shelf, favourites, a stretch of time. Changing an existing
anthology's rule opened **the search screen's own box** and asked for a query. One
question, two postures, and the owner has made the general case a repo directive:
"similar things should act similarly… A control drawn by one component on two screens
has ONE behaviour, and it lives in one function that both screens call."

So the ⋯ opens the same chooser, under the same words, and `useRuleBox`, `RuleFields`,
`ruleChips` and `ruleQuery` are gone with the box. What the edit surface genuinely
needs beyond the create form — a line saying what the rule takes today, and a count
before committing — is passed IN as `lead` and `extra` rather than drawn by a second
copy of the question.

**AND THERE IS A REAL ASYMMETRY UNDERNEATH THE DRIFT, WHICH IS WHY THIS IS WORTH
WRITING DOWN RATHER THAN JUST FIXING.** The chooser expresses exactly one facet with
one value, deliberately, because that is the shape of a question somebody answers
while making a thing. A STORED rule can be anything the search grammar expresses: a
selection of three books writes `book=4&book=9&book=12`, a gathered search writes
`q=thistle&…`. So `fillSpecFromRule` returns null for most real rules, and the dialog
prints the rule as it stands — it is the search's own query string by construction, so
it can be pasted into the search bar — with the chooser below it replacing rather than
editing it.

**REPLACING IS NOT A CONCESSION.** An edit through the chooser replaces the rule in
every case, including the ones it can express; the lead only says so where it is least
obvious. What is lost is the ability to hand-edit one clause of a multi-clause rule,
and that was never something the create path offered either.

### The two smaller ones, which are the same defect in different files

`.help-lead` was in the markup and matched no rule in the stylesheet — the same shape
as the `is-on`/`active` gotcha this repo already documents, and with the same
symptom: it looks fine until somebody renders it, at which point the screen's
walkthrough button is flush against the first row of the glossary and reads as part
of it. `data-tour="search"` is the mirror image: an anchor a tour step still names,
on an element that lost the attribute in the shell rewrite (`046b9831`), so that step
has spotlighted empty space since 31 August.

A class that styles nothing and a hook that anchors nothing are both **a name with no
other end**, and neither the build nor any test notices. The only thing that finds
them is asking, of each name, who answers it.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
