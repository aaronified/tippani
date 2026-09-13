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

**Eleven files sit here, and only some of them are plans** — the table at the foot of this
file names the five that are not, leaving six features.

THAT COUNT HAS NOW BEEN WRONG FIVE TIMES. It said "Seven"; a change that added a file
incremented it to "Eight" without counting the directory; a change that fixed THAT wrote
"Fifteen" while citing the command answering sixteen, and said "seven" of a table with
eight rows; the change that moved three files OUT of this directory corrected the prose
around them and left both numbers behind — so the sentence claimed sixteen files and eight
non-plans over a directory holding fifteen and six.

**AND A SIXTH WOULD HAVE BEEN A DELETION RATHER THAN AN ARRIVAL.** `quote-card-types.md`
leaving took the count from thirteen to twelve and the plans from eight to seven, and both
numbers moved in the same change that removed the file — which is the whole of the lesson two
paragraphs down, applied for once in the direction it is usually needed least. A directory
shrinking behind its own index is as wrong as one growing behind it.
`bulk-editors-one-field-table.md` left the same way, twelve to eleven and seven to six, in
the change that folded it into `PLAN.md`.

**AND THE FIFTH IS THE ONE THE LESSON BELOW DOES NOT COVER**, which is why it is worth its
own sentence. `work-source-files.md` arrived and NOBODY EDITED THIS PARAGRAPH — the four
before it were all miscounts made while writing here, and this one is a count that went
stale while the file sat untouched. "Run the command rather than adjusting the number"
only reaches a reader who is already editing the sentence; a directory that grows behind
its own index needs somebody whose job is to look, and that is the periodic sweep. It
found the fourth and it found this one.

**The lesson is not "be careful", it is that a hand-maintained count of a directory is a
fact with no owner.** Both numbers are what the tree gives — `ls docs/plans/*.md | wc -l`
and the row count below — so if you are editing this sentence, RUN them rather than
adjusting them by the size of your own change. And if you have ADDED a file, this sentence
is part of your change whether you meant to come here or not.

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

**`anthologies.md` was a fourth of that kind and this paragraph used to call it a live
plan**, which contradicted the table below listing it as a non-plan — `anthology-update.md`
took over its one remaining item and said so. One file describing two ways in one document
is the shape that makes a reader trust neither, and the sweep is what caught it. **Both
have since left by the front door**: the update shipped, the pair is folded into `PLAN.md`
under one heading with a pass on the four places they turned out to be wrong, and neither
file is here any more.

So the plans proper are the six the table does not name: `access.md` for roadmap §6,
`entry-helpers.md` and `episodes.md`, which no roadmap section owns, and
`atrium-liquid-glass.md`, `locators-from-files.md` and `work-source-files.md` — the
storage, mount and prune spine that `locators-from-files.md` already calls "the reader of
these files" and cites by name.

**`import-one-drop-target.md` was the tenth and left by the front door**, which is the
exit this file is about: it shipped, it is folded into `PLAN.md` with a pass on the one
guard it asked for that cannot exist, and the file is gone. Its roadmap card is retired
with it. The count above moved with the deletion rather than after it, which is the whole
of the lesson three paragraphs up.

**`bulk-editors-one-field-table.md` WENT OUT THE SAME DOOR**, and its exit is worth a line
because what it retired on was a decision rather than a build. Its headline — one
field-panel component read by both screens — was NOT built: the two panels do different
jobs (many fields at once over a mixed selection, against one field with the control that
field needs and a warning), and merging them loses one or the other. The drift it was
written about is closed by the shared field table and by a guard per panel instead, which
is what its own opening asked for. It is folded into `PLAN.md` with a pass on the seven
places it turned out to be wrong, and **its roadmap card was rewritten to say what shipped
rather than marked shipped over a promise that was not kept** — which is the failure this
directory's exit rule exists to prevent, met in the one form the rule does not name.

**`quote-card-types.md` HAS NOW LEFT BY THE FRONT DOOR**, and this paragraph used to
explain why it was here: it had no roadmap card and was not on the skip table, which looked
like an omission and was the file's own instruction — "Not queued … The roadmap sweep should
leave it alone until the owner picks a shape." The owner then ruled that it retires into
`PLAN.md` once the card work lands. The card work has landed: the composed attribution, the
settled six-band order on both cards, the precedence rule, and a proverb's language on the
first screen. It is folded into `PLAN.md` with a pass on the five places it turned out to be
wrong — including one the directory's own rule is meant to prevent, a feature it proposed as
new that had shipped a fortnight before it was written — and the two questions it left open
are carried there rather than lost. **It never had a roadmap card, so there is none to
retire.**

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
| `prefetch-and-loaders.md` | A discussion with a build order, not a committed feature. Its first two steps need no ruling and its last two wait on measurements nobody has taken, so a public card reading "prefetch and loaders" would promise the whole of it. It earns a card when the boundary sentence it proposes is in `PLAN.md` — then the sentence is the promise and the card can name it |

A file that belongs on this list is added to it in the same change that adds the
file. **The sweep reports; it does not decide** — anything not listed here and not
obviously a plan is left alone and raised, rather than carded.
