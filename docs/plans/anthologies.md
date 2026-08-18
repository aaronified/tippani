# Anthologies — roadmap §4

**Status:** backend built (2.0.0, migration 0043). Frontend built, minus reordering
by drag and the review theme — see [What shipped](#what-shipped).

Roadmap section [`#anthologies`](../roadmap.html#anthologies), issue #18. A named,
ordered list of quotes drawn from anywhere in the library, carrying prose of its
own: an introduction, and commentary between the entries.

Its framing is right and worth keeping: **it is not a tag with a nicer hat.** The
two things a tag cannot do are hold an ORDER and hold YOUR WRITING, and those are
the whole point. Everything in Tippani today points inward — you file a passage,
you find it again, you get asked about it. An anthology is what you make *from*
the collection.

---

## What already exists

Verified against `fb0271f`, by reading the tree.

| Piece | Where | State |
| :-- | :-- | :-- |
| Selecting quotes across screens | `selection.jsx`, `SelectionBar.jsx` | **Built** — and on more surfaces than the roadmap credits. |
| Bulk actions over a selection | `actions.jsx` `bulkActionsFor`, `bulkOps.jsx` | **Built**, with a registry that already knows the three quote kinds apart. |
| Themed practice over a subset | `internal/httpapi/review_theme.go` | **Built** — for tag, colour, person, book, movie. **Not** for an arbitrary list. |
| Markdown export of a set | `export_handlers.go`, `export_quotes.go` | **Built** for a work and for the library; a multi-item set already round-trips. |
| Ordering a set of quotes | — | **Missing.** Nothing in the schema holds a position. |
| Prose attached to a set, or between its entries | — | **Missing**, and it is the harder half. |

### What the verification pass changed

**"The bulk-select bar already exists on three screens" undercounts it.** It is on
Library, the Catalogue, Quotes and Search, plus staging and the Metadata console —
six. That matters for scoping: *Compose* does not need a new selection mechanism
anywhere, and the plan below drops the "add a selection surface" work the roadmap
implies.

**"Reviewable as a themed deck — the engine already takes a theme" is true and
not free.** `reviewTheme` holds `tag`, `colour`, `person`, `book`, `movie`, and its
`clause()` returns `(sql, args, excluded)` per row kind. An anthology is a
different shape from all five: those are all *predicates on a column*, and an
anthology is *an explicit list of row ids across three tables*. It needs a sixth
field and a clause that joins the entries table — perhaps twenty lines, but the
header of that file is emphatic about where a theme clause may and may not go
(never in `dailyRemaining` or `reviewStates`, or opening a themed round would
change the number of cards the app says are due today).

---

## The shape

### The schema

Two tables, and the second is the whole feature.

```sql
CREATE TABLE anthologies (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',        -- the prose before the first entry
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE anthology_entries (
  anthology_id INTEGER NOT NULL REFERENCES anthologies(id) ON DELETE CASCADE,
  position     REAL NOT NULL,            -- see below
  kind         TEXT NOT NULL,            -- annotation | dialogue | utterance
  item_id      INTEGER NOT NULL,
  note         TEXT NOT NULL DEFAULT '', -- your commentary, before this entry
  PRIMARY KEY (anthology_id, kind, item_id)
);
```

**`position` is a REAL, not an INTEGER**, and that is the one decision here worth
arguing about. Dragging one entry between two others with integer positions
rewrites every row after it; with a float it writes one row, at the midpoint. A
personal anthology is thirty entries, so neither is slow — the reason is failure
mode rather than speed: the renumbering version has to succeed for *all* rows or
the order is corrupt, and it runs on every drag.

**The entry is polymorphic and carries no foreign key**, exactly as `item_reviews`
does, because a table cannot hold a real FK to three parents. That has a cost the
schema has already paid once and must pay again: **a deleted quote leaves an
orphan, and SQLite reuses rowids.** 0026's header spells out what that means —
the next quote created inherits the deleted one's row. So this needs the same
`AFTER DELETE` trigger per parent that `item_reviews` has, three of them, and
0018's warning about hand-recreating them after a table rebuild now covers a
fourth join.

**A quote may appear once per anthology** (the primary key says so) **and in any
number of anthologies**. Filing is not moving.

### Compose

No new selection surface. Anywhere `useSelection` already works, the bulk bar
gains one action — *Add to anthology* — which is one entry in `bulkActionsFor`
with `single: false`, beside the ones that already exist.

The **writing** happens on the anthology's own screen: a list of entries, each
with a text area above it for the commentary that introduces it, and the intro at
the top. Reordering is drag, or the keyboard equivalent §6 asks for.

### What an anthology is NOT

- **Not a board.** Boards (0036) file standalone quotes and hold one kind. An
  anthology holds all three and is ordered.
- **Not a tag.** Stated at the top and repeated here because the first review of
  this design will ask again.
- **Not a folder.** Adding a quote to one does not remove it from anything.

### Export

One Markdown file: the title, the intro, then each entry as its commentary
followed by the quote and its attribution. This reuses `export_quotes.go`'s
existing per-quote rendering — the anthology supplies order and prose and nothing
else, which is the point of the shape.

EPUB is listed under §15 (Interop) and stays there. It is a different piece of
work with a container format in it, and it should not hold this up.

### Review

A sixth theme field, `anthology`, whose `clause()` is an `IN (SELECT item_id FROM
anthology_entries WHERE anthology_id = ? AND kind = ?)` per row kind — the first
theme that is a join rather than a predicate. It goes through `deckCandidates`
like the rest, and **Daily stays unthemeable**, which that file already enforces
by making `handleDailyQuiz` pass `reviewTheme{}` by name.

---

## What shipped

The screen is `web/frontend/src/anthologies.jsx`, two levels like Quotes:
`/anthologies` lists them, `/anthologies/{id}` is the one being read. It creates,
edits, deletes (with a confirm that says the introduction and every entry's note go
and the quotes do not, because this one skips the bin), exports, removes an entry,
and writes the per-entry commentary. `Add to anthology` is the one entry in
`bulkActionsFor` this design asked for, on the selection bar.

**A FOURTH SWITCH IN SETTINGS → FEATURES, OFF BY DEFAULT.** Not in the design above,
and the one decision here that was not. Most libraries will never hold an anthology,
and a permanent fifth tab for a screen nobody has opened is precisely the complaint
the Features card exists to answer. It is the first section whose stored preference
is spelled `show*` rather than `hide*` — the rule was always "`false` is the
default", and for this one the default is off. It does **not** count towards "one
section has to stay visible": an anthology holds quotes that live in the other three.

**Reordering is Move up / Move down**, one step at a time, in each entry's `⋯` menu —
not drag. The design says "drag, or the keyboard equivalent §6 asks for", and a drag
shipped without that equivalent would be a control half the app cannot reach. Both
directions post to the same `POST /anthologies/{id}/order` the drag would have used,
so the server side of reordering is finished and drag is presentation when somebody
wants it.

**Still missing:** the review theme in the section below, and drag.

---

## Deliberately not built

**Sharing or publishing an anthology.** The moment one has a public URL this stops
being a personal library feature and acquires an access-control model, a
rate-limit and a moderation question. §18 (Out in the world) is where that
belongs if it ever does.

**Nested anthologies, or an anthology of anthologies.** Two levels of ordering
with prose at each is a document editor.

---

## Verification

| Test | Asserts |
| :-- | :-- |
| store migration | Deleting a quote of each of the three kinds removes its entries, and a reused rowid inherits nothing. This is the trigger-per-parent hazard 0026 documents. |
| `internal/httpapi` | Reorder writes ONE row; the resulting order is stable across a reload; two anthologies can hold the same quote. |
| same | Adding the same quote twice is a no-op, not a duplicate entry. |
| same | Ownership: every route refuses another account's anthology with 404, and an entry cannot point at a quote the caller does not own. |
| review | A themed round over an anthology draws only its entries, across all three kinds; the daily deck is unaffected — assert `dailyRemaining` is unchanged while a themed round is open, which is the specific failure `review_theme.go` warns about. |
| export | The round trip: an anthology with commentary exports and re-imports with its order and prose intact. |
