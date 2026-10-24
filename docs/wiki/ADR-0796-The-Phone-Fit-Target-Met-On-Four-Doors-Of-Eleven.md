# ADR-0796: The phone-fit target, met on four doors of eleven

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

A rater pass on the add-surface rebuild scored it 8/10 and the largest finding was
this one: the owner's *"there is not that much, and if we redesign right, all can
be fitted in one screen without scroll on phone. that's the target"* was cited in
`addFields.js` as met, and it was met on **one** door — the book highlight the
comment happened to sit above.

### What the counts actually are

First-screen **rows** per door, a pair counting as one:

| Door | Rows | Fits a phone |
| :-- | --: | :-- |
| `annotation` (book highlight) | 6 | yes |
| `dialogue` / film | 6 | yes |
| `proverb` | 6 | yes |
| `other` | 7 | yes |
| `dialogue` / game | 7 | borderline |
| `dialogue` / show | 8 | no |
| `poem`, `song` | 8 | no |
| `letter` | 9 | no |
| `essay` | 9 | no |
| `speech` | 11 → **9** | no, and see the ruling below |

Three of those rows are **textareas** on every standalone kind — quote,
translation, note — which is why a row count understates the problem on exactly
the doors that are worst.

### Three pairings, on the owner's own rule

They set it themselves for the book form: *"location and chapter no. will share one
line."* Two short boxes answering one question read as one control and cost one
row. Three more rows qualified and now pair:

- **`when` + `place`** on a letter and a speech. A letter's dateline IS both —
  "Berlin, 1952" — and this document's own letter section already wrote it that
  way while the form drew two rows.
- **`locator` + `when`** on an essay. The citation is `"{title}", p. 42` and the
  year finishes it.
- **`act` + `quest`** on a game. Two short locators, one question: where in this
  game.

That is 14 rows saved across four doors (speech 12→11, letter 10→9, essay 10→9,
game 8→7).

### A speech was eleven, and the owner's ruling took it to nine

Its two remaining pairing candidates were `work_title` and `source_author` — a
source's title and the name of the person the words reach us through. **Both are
long, and "never truncate a name" outranks a row count**: halving the width of the
box that holds *Plato* to save one row breaks a standing rule this repo enforces
with a baseline file. So the pair could not be paired, and the only way to spend
those two rows was to move them.

Three options went to the owner with that measurement. They picked the first:
**"finding 3: move source pair behind the 'show more fields'".**

That is the right one for a reason worth recording, because it is not only the
cheapest. **A letter already kept the same pair behind the same disclosure**, on
the owner's own earlier instruction — "letter: source title · source author :
behind show all" — so a speech keeping it on the first screen was two forms
treating one pair two ways. This repo has a directive about exactly that
("similar things should act similarly"), and the row count is what surfaced the
inconsistency rather than causing it.

**The field is not demoted in importance.** The owner promoted `source_author` into
existence — *"i may not read plato, but i want to add his quotes"* — and one press
is where something that matters on some speeches and not most belongs. Nothing is
hard-dropped: `showsField('speech', 'source_author')` is still true, so the value
still round-trips.

The two options not taken, recorded because the target is still not met on five
doors:

1. **Make the disclosure the default state on the long doors**, so every form opens
   at six rows with the rest one press away. Consistent with the ratchet, and it
   costs the "one screen, everything visible" reading of the target.
2. **Accept the scroll.** Which is what still ships for `speech`, `letter`, `essay`
   (9 rows each), `dialogue`/show and verse (8) — three of those rows being
   textareas on the standalone kinds.

### What measures it, and what still does not

`add-fields.test.js` now carries a **row ratchet**: every door's first-screen row
count is recorded and may fall and never rise. Adding `region` to the proverb form
fails it by name.

**A row count is not a height, and this is not pretending otherwise.** Rows drive
the height and are the half a pure test can measure on every run with no browser;
how tall a textarea grows and where 844 pixels run out needs a probe against a
rendered form. **There is no such probe, because no harness reaches the Add surface
at all** — `scripts/screenshots/controls.mjs`'s `SURFACES` list does not include it
or the Import door, which `docs/plans/import-one-drop-target.md` also noted for its
own reasons. Building one is the same piece of work for both, and until it exists
the table above is a proxy and is labelled as one.

### The other five findings from the same pass

- **`CHANGELOG.md` said the translation is behind *Show all fields* on every form.**
  It is on the first screen of all seven standalone kinds and behind the disclosure
  on a book highlight and a screen line, which is what the owner's sentence actually
  says ("except for quotes, language & translation also stays hidden everywhere").
  The code was right and the user-facing prose was wrong on seven forms of eleven.
- **Eleven bulk fields the endpoint accepted and no screen offered.** The changelog
  promised "forty highlights out of one Bengali book is one value on forty rows" and
  `BULK_QUOTE_FIELDS` had no `language` entry — nor `dlc`, `timestamp_end`,
  `source_author`, `act`, `quest`, `episode_name`, `region`, `recipient`,
  `work_title` or `locator`, four of which had been missing since 0047. A missing
  field is silent in both directions: the endpoint answers a request nobody makes
  and the panel merely draws a shorter list. `bulk_fields_test.go` now walks
  `quoteFieldKinds` against the JSX and names the one deliberate absence.
- **The bulk editor capitalised things that are not names.** `nameCase={!spec?.number}`
  meant every non-numeric field, so a page reference, a clock reading and an
  occasion took per-word capitals in the one place the single-record forms are
  careful not to. `prose: true` on five table entries is the fix, and it lives in
  the table because the input's label is a variable — which is also why the
  source-reading name-casing guard cannot see that box, and now says so.
- **`name-casing.test.js` counted `nameCase={false}` as a hint.** It tested whether
  the prop was *mentioned*, so mutating a name box to `nameCase={false}` left every
  case green — the mutation that should have failed loudest. It reads the value now,
  and `common.field.editor` and `common.field.translator` joined the name list: the
  owner said "editor" meaning the source author, and a book has an editor of its
  own who is equally a person.
- **`AddSurface.jsx`'s header comment still described the three tabs.** The exact
  sentence this document quotes as "the sentence that condemned it" was still at the
  top of the file that replaced them.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
