# The review loop, deepened — roadmap §2

**Status:** designed, not built.

Roadmap section [`#review-loop`](../roadmap.html#review-loop), tracked as issue
#16. Two items remain after 1.15.0 shipped seven of them and 1.15.3 removed
those seven from the list.

Its opening claim is the one to check first, because everything in the section
is priced against it:

> Almost everything below is query-time work against columns that already exist:
> no new tables, nothing ticking, no background jobs.

That is true of one of the two remaining items and **false of the other**.

---

## What already exists

Verified against `456e5a5`.

| Piece | Where | State |
| :-- | :-- | :-- |
| Five question types | `review_handlers.go` `directionsForMode` — `source`, `quote`, `flip`, `cloze`, `speaker` | **Built** (1.15.0/1.15.3). |
| Scored decks refuse self-scored cards | `buildQuestion(…, scored)` returns `false` rather than falling back to flip | **Built** (1.15.3). |
| Difficulty-weighted rewards | `weighByDifficulty`, `clozeGrowWeight` / `clozeShrinkWeight` | **Built** (1.15.3). |
| Cloze width earned by half-life | `clozeMaxWordsFor`, `clozeMultiWordFrom = 30.0` | **Built** (1.15.3). |
| The locator, stored | `annotations.location` | **Built** since 0001. |
| A locator parser | `locSortVal`, `Library.jsx:1194` | **Built — in the browser only.** |
| Per-item review state | `item_reviews` (0015) | **Built.** |
| **Per-item review _history_** | — | **Missing.** See below. |

### What the verification pass changed

**The sparkline cannot be drawn from `item_reviews`.**

The roadmap says *"A recall-history sparkline on the quote's pop-up, drawn from
`item_reviews`."* `item_reviews` is `PRIMARY KEY (kind, item_id)` — **one row
per quote, holding current state**: `stability`, `review_count`, `lapse_count`,
`last_result`, `last_reviewed_at`, `last_touched_at`. Every one of those is a
scalar. There is no history table anywhere in the migrations.

A sparkline is a series. This one has a single point.

So the item is not query-time work against existing columns. It needs a review
log — a new table, a migration, a growth-rate question, a retention policy, and
a place in backup/restore and in the three deletion triggers that already have
to be hand-maintained per parent (0015, 0026 and the note in 0018 about `tags`
being the FK parent of three join tables and the schema test that pinned two).

That is not an afternoon, and pricing it as one is how it stays unbuilt while
looking cheap. It is written up honestly below instead.

---

## 1. More card types from data already held

Two new questions, both from `annotations.location`:

- **Which chapter or act?** — where the locator carries one.
- **Type the next line** — where two annotations sit adjacent by location in one
  book.

### The one real problem: adjacency needs a Go locator parser

`locSortVal` is named in the roadmap as though it were available. It is not: it
lives in `Library.jsx:1194`, takes the first number out of a string (`p.142` →
142), and runs in the browser over rows already fetched. Deciding that two
annotations are *adjacent* means ordering every annotation in a book, which is
server work.

Two parsers for one format is the drift this repo names in `facets.js`,
`search_facets.go` and the glossary gate, and it is the silent kind: the client
would sort one way, the deck would pair another, and both would look right
alone. So:

**The Go parser is authoritative.** The client keeps `locSortVal` for its own
table sort, and **one shared table of cases tests both** — the same shape the
credit separators already use. A locator format that the two disagree about is
a failing test rather than a mispaired card.

### Rules the card needs

- **"Type the next line" is only offered when the two are genuinely adjacent** —
  consecutive in locator order *and* close enough to be the same passage. Two
  highlights 200 pages apart are adjacent in the ordering and are not the next
  line. A gap threshold, and no card when the locator is missing or unparseable.
- **It is a typed answer, so it is gradeable**, and it joins the fill-in-the-
  blank family for scoring: bigger reward, smaller loss, typo- and
  punctuation-tolerant, per the rule 1.15.3 set in `weighByDifficulty`.
- **"Which chapter or act?" is MCQ**, distractors drawn from other chapters of
  the same work — which is what makes it answerable at all. Drawn from other
  works it is a question about which book you are in, and the deck already asks
  that one.

## 2. A recall-history sparkline

The feature is right; its price is not what the roadmap says.

### What it needs

A **review log**: one row per answer — `(kind, item_id, answered_at, result,
direction, stability_after)`. `stability_after` is the series the sparkline
draws; `direction` is what makes it worth having beyond the picture, because it
is the only way to ever answer *which kinds of question is this quote failing*.

### The decisions to make before writing it

- **Growth.** A row per answer, forever, for an app whose whole point is daily
  review. It is small — six columns, no text — but it is the first table here
  that grows without bound, and it needs an answer *before* it ships rather than
  a truncation later.
- **Deletion.** `item_reviews` is polymorphic with no FK, so 0015 and 0026 hand-
  wrote one `AFTER DELETE` trigger per parent, and 0026's header spells out why
  it matters: SQLite reuses a rowid, so an orphaned schedule row is *adopted by
  the next quote created*, carrying a stranger's history. The log has the same
  hazard and needs the same three triggers.
- **Backup.** It joins the archive, and restore has to carry it.
- **Nothing derived is stored twice.** `item_reviews.review_count` must not
  become a cached `COUNT(*)` over the log; two sources for one number is the
  drift that this repo has been bitten by in the demo shim and the glossary gate.
  The log is the record; `item_reviews` stays the schedule.

### Consequently

**This is not a quick item and should not ship in the same release as item 1.**
Item 1 is genuinely query-time work. This is a schema change with a retention
policy. Shipping them together would price the second as the first, which is
exactly the mistake the roadmap entry makes.

---

## Also still open, from 1.15.3's deferrals

Not roadmap §2, but the same subsystem and the same release train — the owner
deferred these explicitly to 1.16.0 while 1.15.3 was in flight:

- The full eight-type MCQ set: book covers and film posters in *both* question
  and options, author and director questions, *"which character said this?"*
  with **name only, no actor and no chip**.
- Typed variants of each — the name typed rather than picked.
- The cloze question stating **how many words** are missing.
- Practice: toggling scoring mid-session ends the session, behind a warning.
- Splitting the Daily Quiz and Practice settings — advanced controls behind a
  pop-up, leaving only the daily count and review covers on the card.

The character question and [`speaker-discovery.md`](speaker-discovery.md) share
one decision and should be built consistently: **a character is not a person.**
No portrait, no actor beside the name.

---

## Verification

| Test | Asserts |
| :-- | :-- |
| shared locator cases | The Go parser and `locSortVal` agree on every case in one table. This is the drift guard. |
| `review_handlers_test.go` | "Type the next line" is offered only for genuinely adjacent pairs, and never when the locator is missing or unparseable. |
| same | "Which chapter or act?" draws distractors from the same work. |
| same | The typed answer scores in the fill-in-the-blank family — bigger reward, smaller loss — and tolerates typos and punctuation. |
| migration test (sparkline) | A deleted quote takes its log rows with it, for all three parents, and a reused rowid inherits nothing. |
| `backup_test.go` | The log round-trips through backup and restore. |
