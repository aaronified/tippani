# ADR-0825: Category and board name two different things, and the owner said which

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The ruling, 13 September, verbatim:

> Category - colour categories
> Board - the work equivalent for the quotes screen (like Bengali Proverbs in the backup)

**THE SCHEMA WAS ALREADY RIGHT AND HAD BEEN SINCE 0036.** `boards` is a table,
`utterances.board_id` references it, and that is exactly the relation the ruling
describes: a board stands to a standalone quote as a WORK stands to a highlight.
Nothing in the database had drifted, which is worth saying because it means this
was never a data question — it was a prose question, and prose has no compiler.

**WHERE IT HAD DRIFTED: "board" had become a loose word for "a screen with a grid
on it".** Seven reader-visible strings in each locale used it for the Library or
the Catalogue, and the worst of them was not a help string but a LABEL — the
phone dock's menu holding Library, Catalogue, Quotes and Anthologies was called
**Boards**, and three of those four are not boards at all. The honest word was
sitting in the code the whole time: `SECTIONS` in `routes.js` is the list, and
`nav.section.*.what` already describes each one. So `shell.dock.boards.label`
became `shell.dock.sections.label`, with `boardRows`/`boardsKey`/`IconBoards`
renamed to match rather than left as a name outliving its word.

**CATEGORY NEEDED NOTHING.** Every string carrying the word was already
about colour — `vocab.category.*` names the six slots, `settings.colours.*`
renames them, `stats.colours.*` counts them. The ruling confirmed the existing
use rather than correcting it, and the guard now pins that so the word cannot
spread later.

**TWO COUNTS CAME OUT OF THIS SECTION AND THE CHANGELOG, AND THE REASON IS THE
REPO'S OWN RULE.** The first draft said "thirty-six" category strings here and
"eighteen fields" in the changelog. A rater could reproduce NEITHER — it measured
the category set at 6, 24, 15 and 25 under four defensible definitions, and the
bulk field list at 24, 11, 13, 26 and 34 under five. Both numbers were real counts
of something; neither said WHICH something, so neither could be checked, which is
the whole of what "counting goes stale; naming does not" means. They are replaced
by what the set IS. A number in prose needs the definition beside it or it is
decoration that looks like evidence.

**AND `7a4a0f1c`'S COMMIT MESSAGE STILL SAYS "all thirty-six of its strings". It
stays wrong**, deliberately: it is pushed, and rewriting a published commit to
correct a sentence invalidates every checkout below it. A repository's history is
what happened, including what was believed at the time. THIS paragraph is the
correction, and it is here rather than there because `docs/wiki/Design-decisions.md` is where a
reader who followed that commit goes next — which is the only property that makes
a correction worth writing.

**THE GUARD, AND THE FALSE POSITIVE THAT IMPROVED IT.**
`board-means-one-thing.test.js` reads both locale files, because a vocabulary
ruling decays the moment somebody writes one more sentence and nothing about a
wrong word fails. Its first draft treated "cover" as evidence that a nearby
"board" meant a work — and it flagged `settings.languages.card.info.body`, which
says a language's mark "stands in for that language on a board's cover". That
string is CORRECT: it is about a proverb, a proverb lives on a board, and a board
has a cover exactly as a book does. **A noun shared by both things cannot tell
them apart**, so only the work-only nouns are evidence. Four mutations — the
label reverted, the key reverted, the call site reverted, a fresh string calling
the Catalogue a board — all fail the guard.

**WHAT IS DELIBERATELY NOT DONE: `BoardHead` keeps its name.** It is the scaffold
Library, Catalogue and Quotes all render through (#172–#175 made it one), so by
the ruling it is a component named for one of the three things it serves. Renaming
it is a refactor across `boardHead.jsx` and every caller, and the ruling asked for
a vocabulary decision rather than a rename; an internal component name is also not
a word the reader meets. **Recorded here rather than left to be discovered** — and
the glossary's remaining uses of "the board" for that scaffold are describing the
component under its real name, which is why they stay while the four sentences
about the Library and the Catalogue specifically were corrected.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
