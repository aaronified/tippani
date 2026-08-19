# Episodes — a name, and up to three orders

**Status:** designed, not built. One migration (`0046`), two metadata calls, one dialog,
one shared primitive, one gesture clip.

Split out of [`entry-helpers.md`](entry-helpers.md), which discovered the gap and is
where the entry-form half lives. The two can ship in either order and neither blocks
the other — this one is much the larger.

An episode of a series has a **name**, and Tippani has never had anywhere to put one:
`dialogues.season` and `dialogues.episode` are integers (`0025_dialogue_episode.sql:31-32`)
and that is the whole of it. A line is "S01E04" and never "Fly".

It also has, sometimes, **more than one number**. Firefly aired out of order; its DVD
release is the intended sequence; most providers carry only the broadcast one. That is
the general case rather than a quirk, and it is what makes this a feature instead of a
column.

---

## What already exists

Verified against `7f0b067`, by reading the tree.

| Piece | Where | State |
| :-- | :-- | :-- |
| Season + episode as numbers | `dialogues.season`, `dialogues.episode` — `0025_dialogue_episode.sql:31-32` | **Built.** Season 0 is a real season (specials); episode without season is rejected; season alone is allowed. |
| Episode **name** | — | **Missing entirely.** No column, field or JSON key in the repo. |
| Alternate orderings | — | **Missing**, and nothing in the schema could hold one. |
| An episode list from a provider | — | **Missing.** `internal/metadata` has no season or episode call at all. |
| Provider ids to fetch with | `movies.tmdb_id` (`0003_movies.sql:11`), `movies.tvdb_id` (`0006_enrich_books_movies.sql:29`) | **Built.** Nothing new is needed to know what to ask for. |
| A guarded outbound fetch | `internal/metadata` — SSRF guard, host allowlist, UA, timeouts | **Built**, and the only place allowed to make one. `tmdb.go:208`'s `get` is generic. |
| A per-work action menu | `actionsFor(kind, item, ctx)` — `actions.jsx:76` | **Built.** The dialog is one entry in it. |
| Edits and adds in a modal | `FormModal` | **Built**, and the house rule. |
| Episode labels | `episodeLabel` in `text.js` | **Built** — one function, which is why rendering through a chosen order is cheap. |
| Drag to reorder a list | — | **Missing.** The only drags in the tree are the sticker seal's free positioning (`flow.jsx:192-224`) and a file drop zone (`ImportPage.jsx:340`). |
| A home for an animated gesture clip | `gestures.jsx` — eleven inline-SVG clips, `IMPLEMENTED` at `:44` | **Built, and built for this**, but no drag among the eleven. |
| Season/episode in export and import | `export_handlers.go`, `importer/movie_markdown.go` | **Built** for the numbers. A name and an order need bindings. |

### What the verification pass changed

**The dedupe hash decides the whole design, and it was not obvious.**
`DialogueDedupeHash` folds season and episode into the hash (`hash.go:67`), enforced by
`UNIQUE (movie_id, dedupe_hash)` (`0003_movies.sql:44`). The first sketch had a
displayed order rewriting the numbers a dialogue stores — which would churn every hash
on the series and collide some of them, on a *view change*. See
[the anchor](#the-anchor-and-why-there-has-to-be-one).

**An alternate order is not a sort position.** In a genuine reordering an episode's
*season* moves too, so an order maps an episode to a `(season, episode)` **pair**. A
single `position` column, which is what the first draft proposed, cannot express the
Firefly case at all.

**A DVD order is fetchable, and I did not expect it to be.** TMDB's
`/tv/{id}/episode_groups` is exactly the alternate-ordering API. So two of the three
orders come from a provider and only `custom` is hand-made.

**Drag-to-reorder is wanted twice.** `anthologies.md` has needed it since 2.0.0 for
anthology entries and it has never been built. It is one primitive, built here, used by
both.

**`gestures.jsx` is already built to absorb the help for this.** Its own comment: the
nine unreachable clips exist so that "the day a swipe is bound the help for it is a
one-line reference and not a new asset pipeline". None of the eleven is a drag, but the
file is the right home and the pattern is fixed.

---

## The schema

```sql
CREATE TABLE episodes (
  id        INTEGER PRIMARY KEY,
  movie_id  INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  name      TEXT NOT NULL DEFAULT '',
  overview  TEXT NOT NULL DEFAULT '',
  air_date  TEXT NOT NULL DEFAULT '',   -- partial date, as occasion_date already is
  source    TEXT NOT NULL DEFAULT ''    -- 'tmdb' | 'tvdb' | '' when hand-made
);

CREATE TABLE episode_orders (
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,             -- 'tv' | 'dvd' | 'custom'
  season     INTEGER NOT NULL,
  episode    INTEGER NOT NULL,
  UNIQUE (episode_id, kind)
);

ALTER TABLE movies       ADD COLUMN episode_order TEXT NOT NULL DEFAULT '';
ALTER TABLE staged_quotes ADD COLUMN episode_name TEXT NOT NULL DEFAULT '';
```

**Identity and numbering separate.** `episodes.id` is what an episode *is*, and it is
the same episode in all three orders — which is what lets you switch views without a
quote moving. `episode_orders` holds what it is *called* in one particular order.

**`episode_order` on the movie is which order to display**, `''` meaning `tv`. Zero
value is the default, which is `0045`'s rule at length: a non-zero default is a
preference that reads as changed the moment it is read.

**No CHECK on `kind`**, consistent with `media_type` (0006), `status` (0024) and
`person_kinds` (0027), and for the stated reason: a fourth order — absolute numbering,
which anime needs — becomes a row rather than a schema change.

**`staged_quotes` gets the name too**, on `0044`'s reasoning unchanged: a value present
on the live shape and absent from the staging mirror is a loss at the last step,
invisible because the source file is already gone. Staging holds a name *string* and
resolves it to an `episodes` row on approval, because a staged row must not depend on
an episode existing yet.

**Nothing is backfilled**, for `0044`'s reason exactly: no existing row records an
episode name, so there is nothing to derive and nothing to guess. A series gets its
episodes when you fetch or type them, and until then the app behaves exactly as it does
today.

**Dedupe is untouched.** The name is a property of a pair the hash already folds in, so
no rehash on upgrade and no `BackfillDialogueHashes` change.

### The anchor, and why there has to be one

`dialogues.season` / `dialogues.episode` **always mean the `tv` order**, whatever you
are looking at. Labels, sorting and grouping render through `episode_order`; storage
never moves.

That is not a preference, it is forced. Episode numbers are inside the dedupe hash, so
numbers that floated per view would rehash the whole series on a view change and
collide wherever two lines met. Rendering is free; storage is not.

The costs, stated rather than discovered:

- **Renumbering `dvd` or `custom` touches no dialogue and cannot collide.** Most
  reordering is this, and it should feel that cheap.
- **Renumbering the `tv` order is a different act.** It rewrites
  `dialogues.season`/`episode` for every affected line and rehashes them. Its own
  confirmation, naming how many quotes will move; its own transaction; and it must
  **refuse on collision rather than skip.** `BackfillDialogueHashes` skips UNIQUE
  failures so a bad row cannot fail boot (`hash.go:244-251`) — right for boot, wrong
  for a deliberate edit, where a skipped row leaves two quotes silently disagreeing.
- **A reader who thinks only in DVD order still has quotes numbered by broadcast
  underneath.** Invisible, because every label renders through the chosen order, and it
  is the price of a stable hash.

---

## Fetching

Two additions to `internal/metadata`, on clients that already carry the SSRF guard,
host allowlist, User-Agent and timeouts — nothing outside that package is allowed to
make an outbound call:

- **`/tv/{id}/season/{n}`** — names, overviews, air dates, via the generic
  `t.get(ctx, path, q)` (`tmdb.go:208`).
- **`/tv/{id}/episode_groups`** — the alternate-ordering API, and where a published DVD
  order comes from. A series with no group gets **no `dvd` rows**, and the dialog says
  so rather than fabricating one from the broadcast order.
- **TVDB as the second supplier**, mirroring how `tvdb.go` already backs TMDB up.

**Nothing is fetched automatically**, and this is a refusal rather than an omission. A
season list arriving unasked creates rows the reader never approved, under a name a
provider chose — the argument `0042` made about a guessed game publisher and `0044` made
about parsing "3. The Fall", both of which turned on the same point: **a wrong value
written by the app carries the authority of having been written by the app.**

**A refetch never overwrites a name you edited.** Same three states the entry helper
uses: fill what is empty, offer what disagrees, touch nothing else. `source` is how a
row remembers whether a provider or a person put it there.

---

## The dialog

`actionsFor` (`actions.jsx:76`) gains one entry, **Episodes…**, opening a `FormModal`.

- **Show-only.** `media_type === 'show'`. See [open questions](#open-questions) — a
  game arguably has chapters, but it does not have episodes and this is not the feature
  that gives it any.
- A **season-grouped list**, one row per episode: number, name, and a count of how many
  quotes you have from it. The count is what makes the screen safe to act on — it is
  the difference between moving an episode and moving eleven of your quotes.
- A **three-way switch** for the order being viewed and edited. `custom` starts as a
  copy of whichever order was showing when you first choose it, so nobody begins from
  an empty list.
- **Drag to reorder and renumber by typing**, both, because they suit different jobs:
  dragging is right for moving one episode, typing is right for "everything from here
  on is one lower". Seasons are editable the same way, and moving an episode between
  seasons is a drag onto another season's group.
- **Fetch from provider**, per order, disabled when the series carries neither
  `tmdb_id` nor `tvdb_id`.
- Renumbering the anchor order shows the confirmation described above.

### ReorderList — one primitive, three callers

Drag-to-reorder does not exist anywhere in this app. It is built once, here, and used
by this dialog, by `anthologies.md`'s entry reordering, and by whatever asks next.

**With a keyboard route from the outset — Alt+↑/↓ to move a row.** Not an
afterthought: a reorder only a pointer can perform is one of the two access gaps
`access.md` is open about, and retrofitting it later means retrofitting it in three
places.

### The twelfth gesture clip

`ReorderList` needs a `gestures.jsx` clip, and that file is already built to take one.

- The existing eleven are all press, swipe or pinch (`gestures.jsx:48-58`). Drag to
  reorder is none of those — it is hold, *travel*, then release onto a target, and the
  held pose at the end is what distinguishes it from a swipe's flick. So
  `'drag-reorder'` is a new entry in `CLIPS`, not a reuse of `swipe-up`.
- It follows that file's rules rather than inventing any: **inline SVG, not a GIF**
  (1–2 KB, lives in a diff rather than git-lfs, `currentColor` so one file is right in
  both themes), and **`prefers-reduced-motion` handled inside the component**, leaving
  the held pose behind — which works here because the *destination* carries the meaning,
  not the travel. The art stays abstract — a disc for the fingertip, a trail for the
  travel, a gap opening where the row will land — so it cannot go stale in a restyle.
- **It enters `IMPLEMENTED` in the same commit that binds it, and not before.**
  `gestures.test.jsx` fails if the interface references a clip the app does not bind —
  the rule that caught five shortcuts with no handler behind them — so that test is
  what keeps this honest in both directions.
- **A label key in every compiled-in language.** `vocab.gesture.drag-reorder.label`
  joins `en.txt` and `bn.txt` together, as part of this work: a key added to one file
  only is the one string in the help page that never translates.

---

## Endpoints

```
GET    /movies/{id}/episodes                  the three orders, plus quote counts
PUT    /movies/{id}/episodes                  full-state save of one order
POST   /movies/{id}/episodes/fetch            {source, kind} — pull from a provider
PATCH  /movies/{id}                           episode_order, via the existing handler
```

- **`PUT` is full-state**, like every other form in this app: the dialog holds the whole
  order and sends the whole order. A per-row PATCH would let a drag and a renumber
  interleave into a state neither asked for.
- **One transaction per save**, and when the anchor is involved the dialogue rewrite and
  the rehash are inside it. A partial reorder is worse than a refused one.
- `maxCRUDBody`, `writeJSON` / `writeErr`, ownership filtered in the same statement as
  the read, a foreign series **404 and never 403**, with its own cross-user test.
- **Read-only transactions marked as such** on the GET — `_txlock=immediate` makes an
  unmarked one take the write lock for nothing.

---

## What a new noun costs

Enumerated rather than discovered, because two tables that travel with a series have no
foreign key anything walks:

- **`collectWork` (`trash.go:212`) is a declared subtree list.** This is the
  load-bearing one. Bin a series, restore it, and every episode name and every custom
  order is gone unless `episodes` and `episode_orders` are added there — silently, with
  the quotes intact, which is the failure nobody reports because nothing looks broken.
  `0024`'s `work_reads` and the polymorphic `item_reviews` are the precedent the
  migration skill already warns about, and this is the third instance of it.
- **Restore must recreate both tables** with new ids and remap
  `episode_orders.episode_id`, since SQLite reuses rowids after a delete.
- **Export and import need bindings.** An export that drops the name or the custom order
  does not round-trip, which every other export here does.
- **The account backup** carries whole tables and needs no per-table work — but a
  restore-from-another-server test should assert a custom order survives, since that is
  the path 0.8.3 added and the one nobody exercises by hand.

---

## Tests

- **Migrating twice is idempotent**, and the tables are correct on a fresh database and
  an upgraded one alike.
- **Switching the displayed order rehashes nothing.** Read every `dedupe_hash` on the
  series, switch to DVD order, read them again, assert byte-identical. This is the
  design's central claim and it deserves the most direct test in the file.
- **Renumbering the anchor** renumbers the dialogues *and* rehashes them, and
  **refuses on collision** leaving the transaction untouched — asserted by reading the
  rows back, not by trusting the error.
- **Season 0 survives everything.** Specials are a real season, and this whole feature
  moves season numbers around.
- **An episode with no quotes is kept**, since a fetched season list is mostly those and
  a cleanup that treated them as orphans would silently undo the fetch.
- **A refetch does not overwrite an edited name**, and `source` records who wrote it.
- **A series with no published episode group** gets no `dvd` rows and no fabricated ones.
- **Bin and restore a series**, asserting episode names *and* a custom order come back.
  Written against `collectWork`'s declared list, because that is where it will break.
- **Export → import round-trip** preserving names and all three orders.
- **Cross-user 404** on every endpoint.
- **`ReorderList` by keyboard alone**, Alt+↑/↓, with no pointer events at all.
- **`gestures.test.jsx` on the twelfth clip** — `drag-reorder` is in `IMPLEMENTED`
  exactly when the interface references it, and its label key resolves in every
  compiled-in language rather than only in English.
- Assert on **values, not counts**: "got 13 episodes" passes happily while they are the
  wrong thirteen, which is the entire failure mode of an ordering.
- Every one of these gets **broken on purpose** before it is trusted. A test written
  from a spec and passing on the first run has proved nothing — which is how two tests
  in the 2.1.x work came to assert the opposite of correct behaviour.

---

## What this deliberately does not do

- **No fourth order.** Three, as asked. The absent CHECK means a fourth is a row.
- **No automatic fetch.** Explicit, per series, per order.
- **No episode artwork.** The providers return stills; nothing here needs one and every
  image is a file to park, restore and clean up.
- **No per-episode read tracking.** `0024` already tracks position by episode
  (`pos_unit = 'episode'`) and that is a different feature with a different table.
- **No episodes for films or games.** See below.
- **No renumbering from the entry form.** The dialog owns it. A form that could
  renumber a series as a side effect of filing one quote is the surprise this plan's
  sibling exists to avoid.

## Open questions

Two of the three the first draft opened are now settled and recorded above — the
reachability question and the nine-item cap. What is left:

1. **What happens to a `custom` order when a refetch adds episodes?** New rows have no
   custom position. Appending them at the end of their season is the obvious answer, it
   is what the plan assumes, and it is obviously sometimes wrong — a mid-season special
   belongs in the middle. The dialog should at least **mark newly appended rows** so the
   reader can see what moved in, rather than leaving them to be found.
2. **Should `dvd` be editable at all, or only fetched?** Editing it makes it a second
   `custom` and the distinction blurs. Leaving it read-only makes it honest — "this is
   what the provider published" — but strands anybody whose provider got it wrong. The
   plan currently allows editing it; the argument for locking it is not weak.
