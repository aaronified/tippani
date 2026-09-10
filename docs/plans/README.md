# Plans for things that are not built yet

One file per feature that has been **designed and not yet built**. Nothing in
here describes the app as it stands.

That is the whole rule, and it has a second half that was missing until 1.14.2:

**When a feature ships, its plan is folded into [`../PLAN.md`](../PLAN.md) — with
a pass recording where the plan turned out to be wrong — and the file here is
deleted.** So this directory is always a list of what is coming, never an
archive. Git holds the retired plans.

## Why it has an exit

A plan for a feature that shipped six releases ago is a design document sitting
in a directory whose entire promise is *this is not built yet*, and it goes
stale in the one way nothing can detect: every sentence in it was true when it
was written, some of them still are, and nothing marks which. That is the
failure that turned `PLAN.md` from a design document into a decision log. Three
shipped plans stayed here afterwards and reintroduced it one directory over —
along with twenty-three entries in the log whose grey line still read *planned*
for features that had been running for months.

**Sixteen files sit here, and only some of them are plans** — the table at the foot of this
file names the eight that are not, and the rest are features.

That count has now been wrong three times, and the third time is the instructive one. It
said "Seven"; a change that added a file incremented it to "Eight" without counting the
directory; and the change that fixed THAT wrote "Fifteen" while citing the command that
answers sixteen, and said "seven" of a table with eight rows. Both numbers are now the ones
the tree gives — `ls docs/plans/*.md | wc -l` and the row count below — and if you are
editing this sentence, run them rather than adjusting them.

Two of the non-plans are odd ones of the same kind:
`screen-audit.md` and `codebase-audit.md` are not features but the unfixed halves
of adversarial passes — the first over every screen, the second over the code
itself (duplications, latent defects, and what the tests do not guard). They are
here because the directory's promise — *this is not built yet* — is exactly true of
them, and because a list of found-and-unfixed defects is the one artefact that leaves
no trace in the tree. A fixed defect leaves a commit, a test and a changelog entry;
an unfixed one leaves nothing. They retire the same way everything here does: when
the list is empty, delete it.

`prefetch-and-loaders.md` is a third of that kind and is on the table below for it: a
DISCUSSION rather than a design. The owner asked for prefetch and a loader and ended with
"discuss.", and the first thing that had to be established was what the repo's own written
decisions actually forbid — two of them had been put to the owner as blockers and both were
about something else. It carries a build order whose first two steps need no ruling, so it
retires the same way everything here does: when the boundary sentence it proposes is in
`PLAN.md` and the four steps have shipped or been dropped.

The other four — `anthologies.md` and `access.md` for roadmap §4 and §6, and
`entry-helpers.md` and `episodes.md`, which no roadmap section owns.

## Three files left this directory rather than being deleted

The rule above says a shipped plan is folded into `PLAN.md` and the file here deleted. That
is right for a plan, and wrong for the two kinds of document a finished plan can leave
behind — so on the owner's instruction three moved out instead:

| Now at | Why it is not deleted |
|---|---|
| `docs/bengali-style.md` | **A guideline.** The register it fixes is implemented, so it is no longer a plan for anything — but it goes on binding every new Bengali string, and it is the reason a stranger could write the next language. The owner's: "it is implemented and the guideline needs to be kept recorded." Nine live citations point at it, `fonts.js` among them |
| `docs/spaced-repetition-difficulty.md` | **A research record.** The owner's: "it is built and stays to show the research that has gone into the feature." Which curve, which scheduler, what was measured — a reader who wants to know why the deck behaves as it does needs the evidence, not a promise, and `README.md`'s spaced-repetition line now links straight to it |
| *deleted* — `multilingual.md` | **Neither.** Shipped 2.1.0/2.1.1, and the owner's word was "stale and already completed". It had been kept for a record and a punch-list; the record's real keeper turned out to be `screens-i18n.test.jsx`, which fails on an untranslated screen, and a paragraph a test already holds is a second copy waiting to disagree. Its two real code warts are named in `PLAN.md` |

**The distinguishing question is whether the text still binds or still explains.** A plan
promises; a guideline binds; a research record explains. Only the first belongs here, and
only the first is deleted when it comes true.
`help-density.md` left at 2.0.1 by the front door, folded into PLAN.md §13; §5
itself stays on the roadmap, because what shipped was the panel's shape and what
that section asks for is the consolidation behind it. Their verification passes
moved four claims between
them. That is four for three plans, which is the strongest argument this file
makes for the rule that a plan opens by reading the tree. `entry-helpers.md` made
it again on arrival: its premise was that movie characters already autocomplete on
the edit form and only needed porting to the add form, and reading the tree showed
those suggestions are the TMDB cast list rather than a memory of anything typed —
so the pool the feature is *about* did not exist on any surface, and two edit hosts
were offering no suggestions at all. It then split in two: episodes turned out to need a
name, three orderings, a provider fetch and a dialog of their own, which is a feature and
not a field, and **one file per feature** is the rule at the top of this page. They cite
each other and can ship in either order.

## The two documents

| | |
| :-- | :-- |
| `docs/plans/*.md` | How will one specific **unbuilt** feature work? |
| [`docs/PLAN.md`](../PLAN.md) | Why is the **built** thing shaped this way, what was turned down, and what did I get wrong? |

A plan is written against the tree rather than against memory: open with a
*What already exists* table verified at a named commit, and record what that
verification changed. It has moved real claims every time.

## The six that retired here

`trash-and-undo.md` (shipped 1.8.0), `context-menu-and-multiselect.md`
(1.10.0, works in 1.11.1, finished in 1.14.2) and `search-facets.md` (1.10.0).
Their decisions and their corrections are in `PLAN.md` under sections 3, 7
and 14.

Then `review-loop-deepened.md`, `review-exclusion-per-quote.md` and
`font-settings.md`, all shipped in 1.15.0 and folded into sections 8 and 15.

Then `speaker-discovery.md`, which shipped in 1.16.0 — and `quick-wins.md`,
`review-loop-cards.md` and `search-precision.md`, which retired the OTHER way:
half of what they specified shipped, the rest was dropped, and the roadmap
sections they were written against were removed. That is the second exit and it
is worth naming, because the first version of this rule only had one. **A plan
for something nobody intends to build fails the directory's promise exactly as a
shipped one does** — every sentence still true, none of it coming. Their
verification passes are in `PLAN.md` §12, including the three claims the roadmap
made about the code that the code did not support.

The first of those is the strongest argument this directory has for existing.
Its *What already exists* pass, verified against a named commit, found three
defects live in the shipped app before a line of the feature was written — and
its specification pass caught two more bugs that lived *between* features, which
no single spec owned and no test would have reached. It was also right where the
implementation was wrong: it specified cloze grading token by token, said why in
as many words, and the code that shipped banded the budget across the whole
string until a docs pass three commits later compared the two.


## What is not a plan, and never gets a roadmap card

The periodic sweep (`CLAUDE.md`, "The plan queue") reads every file here and gives
each one an entry in `docs/data/features.json`'s `manual[]` so the roadmap says what
is coming. **Adding a card publishes a promise on a public page**, so the files
below are named here rather than judged again each night — a sweep that re-decides
the same exclusions nightly will eventually decide one of them differently.

| File | Why it is not a plan |
|---|---|
| `README.md` | This file |
| `open-defects.md` | A defect register: the owner's reports and what was done about each. Nothing in it is a promise about the future |
| `screen-audit.md` | The found-and-unfixed half of an adversarial pass over every screen. Its own text: "It is not a feature plan, which is what the rest of this directory holds" |
| `codebase-audit.md` | The same shape, over the code. Its own first line: "**Not a feature.**" |
| `anthologies.md` | Its one remaining item was taken over by `anthology-update.md`, which says so. A card here would either restate shipped work as upcoming or duplicate that one |
| `prefetch-and-loaders.md` | A discussion with a build order, not a committed feature. Its first two steps need no ruling and its last two wait on measurements nobody has taken, so a public card reading "prefetch and loaders" would promise the whole of it. It earns a card when the boundary sentence it proposes is in `PLAN.md` — then the sentence is the promise and the card can name it |

A file that belongs on this list is added to it in the same change that adds the
file. **The sweep reports; it does not decide** — anything not listed here and not
obviously a plan is left alone and raised, rather than carded.
