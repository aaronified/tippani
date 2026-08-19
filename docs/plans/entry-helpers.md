# Entry helpers — the library remembers what you already typed

**Status:** designed, not built. One migration (`0046`), one endpoint, one UI primitive,
four surfaces.

No roadmap section owns this yet. It is not a feature so much as the removal of a
recurring cost: **every locator in this app is free text, and free text typed twice is
typed differently.** "The Fall" and "the fall", chapter 3 and chapter 03, Rosencrantz
and Rosencrantz. The library already knows what you called things. It has never
offered to remind you.

The shape is one you have already accepted twice: a pool of your own prior values,
fetched once, narrowed in the browser as you type — the rule
[`vocabulary_handler.go:19-24`](../../internal/httpapi/vocabulary_handler.go) states
for the search box and `WorkPicker` implements for the add menu. What is new is that
some of these values come **in pairs**, and picking one half should fill the other.

---

## What already exists

Verified against `4ba3c66`, by reading the tree.

| Piece | Where | State |
| :-- | :-- | :-- |
| Chapter as number + name, two columns | `annotations.chapter_no` REAL, `annotations.chapter` TEXT — `0044_chapter_number.sql:46`, `0001_init.sql:58` | **Built.** The pairing this plan needs is already storable. |
| Season + episode as numbers | `dialogues.season`, `dialogues.episode` INTEGER — `0025_dialogue_episode.sql:31-32` | **Built.** |
| Episode **name** | — | **Missing entirely.** No column, field, or JSON key in the repo. An episode is only ever numbers. |
| A per-work pool of prior values | — | **Missing.** `/search/vocabulary` is library-wide and held for the session. |
| Character suggestions on a dialogue form | `Movies.jsx:2105`, via `TokenInput` at `2214-2221` | **Built — but not from your prior values.** See below; this is the finding that reshaped the plan. |
| A single-value filter-as-you-type input | — | **Missing.** `TokenInput` (`ui.jsx:1811`) is the nearest, and it is multi-value with pills. |
| Filter-as-you-type over a fetched pool | `WorkPicker` — `AddSurface.jsx:518` | **Built**, and the pattern to copy: rank, cap at 8, portalled `role="listbox"`, arrow/Enter/Escape. |
| A game's characters | `dialogues` rows under a `movies` row with `media_type='game'` — `0040_games.sql:31` | **Built storage.** Nothing new is needed to hold them. |

### What the verification pass changed

**"Movie characters come up when editing" is true, and not for the reason it looks
like.** The suggestions are the **TMDB cast list**, not a memory of what you typed:
`charSuggestions` is derived from `cast.map(c => c.character)`
(`Movies.jsx:2105`), and `cast` comes from `movies.cast_json`
(`0003_movies.sql:15`). Three consequences the original framing missed:

1. **A character you invented by hand is never offered again — not even on the edit
   form.** If the name is not in the cast, it is not in the pool. So this is not
   "port the edit form's autocomplete to the add form"; the pool the request asks
   for does not exist anywhere yet.
2. **It is not add-vs-edit, it is on-the-film's-page-vs-not.** The favourites
   editor (`Home.jsx:491`) and the search editor (`SearchPage.jsx:1107`) both render
   `DialogueForm` with no `cast` prop, so it defaults to `[]` and characters do not
   autocomplete there either. Two live gaps, fixed incidentally by this work.
3. **Games already benefit.** `0040` maps voice cast into the same `cast_json`, so a
   game's characters flow through the identical path — and its quotes are `dialogues`
   rows, so the pool query needs nothing media-specific. The one gap is that
   `AddSurface.jsx:737` sets `isShow` from `media_type === 'show'` only, which is
   correct (a game has no season) and worth not "fixing".

**So the cast list is not replaced — it is joined.** The pool becomes *cast ∪ what you
have actually typed on this work*, which is strictly better than either alone: the cast
covers the first line you ever record, your own history covers everyone the cast list
never named.

**The add form cannot see a cast even if it wanted to.** `CaptureQuote` reduces every
work to `{kind, id, title, sub, media_type, tag}` (`AddSurface.jsx:718-732`,
`workFromMovie` at `:84-91`) and never re-fetches `/movies/:id` when a target is
picked. That is why the character control there is a bare `<input>` (`:943`) with no
suggestions and not even `nameCase`. It is also why the pool must arrive by its own
request rather than being read off a record already in hand.

**Chapter needs no schema work at all.** `0044` shipped the two columns, both
optional and independent, with `0` meaning absent. The book half of this feature is
pure UI.

**A fourth surface exists that the request did not mention.** `StagedQuoteForm`
(`StagingPage.jsx:718`) is the only place `actor` is hand-editable, and its fields
are plain inputs with **hardcoded English labels** (`:780-787`). Import review is
where inconsistent chapter names arrive in bulk, so it is arguably the surface with
the most to gain.

---

## The four decisions

Asked and answered before drafting, because each one changes the work rather than
the wording.

| | Decision |
| :-- | :-- |
| **Overwrites** | Fill blanks silently; when the counterpart disagrees, **offer and never clobber**. |
| **Episode name** | A **canonical `episodes` table** keyed `(movie_id, season, episode)`. |
| **Pool source** | A small **per-work endpoint**, fetched when the form opens. |
| **Surfaces** | **All four** — add, edit, import review, bulk edit. |

---

## The overwrite rule

This was the open question, and it has a wrinkle worth naming first, because it
decides the rest.

**The pool can contradict itself.** If you once recorded chapter 3 as "The Fall" and
later chapter 4 as "The Fall" — a typo, or a genuinely repeated title — then
selecting the name has *two* answers. Any rule that always autofills has to invent
one. So:

### Three states, and only one of them writes

Let *picked* be the value you selected, and *counterpart* the paired field.

1. **Counterpart is empty, and the pairing is unambiguous** → fill it, silently. This
   is the common case and the whole point of the feature.
2. **Counterpart is empty, and the pairing is ambiguous** → fill nothing. Show the
   candidates as chips: `3 · 4`. One tap picks one. The app does not guess which of
   your own two records you meant, because it cannot, and a wrong locator written
   confidently is worse than a blank one.
3. **Counterpart is non-empty and disagrees** → **write nothing.** Show one inline
   chip — `Chapter 3?` — that fills on tap and vanishes on dismiss or on the next
   keystroke in that field.

Nothing you typed is ever replaced without a tap. That is the rule in one sentence,
and it is the rule because of the failure it prevents: you type `7`, then pick a
chapter name to save typing, and the `7` silently becomes `3`. You would not notice
until the quote was already filed under the wrong chapter, and nothing would record
that the app had done it.

If the counterpart is non-empty and **agrees**, there is nothing to do and no chip —
silence is the correct feedback for "already right".

### Why not track typed-vs-autofilled

The third option offered was to remember provenance: replace a value the app filled
in, confirm a value you typed. It is more precise and it is genuinely tempting, and
it is deferred rather than rejected, for one reason — **it makes the same gesture do
two different things depending on invisible state.** Selecting a chapter name would
sometimes overwrite the number and sometimes not, with nothing on screen saying
which regime you were in. The offer-chip is one behaviour, always, and the cost is
one tap in the case where the app was going to be right anyway.

Worth revisiting if that tap turns out to be constant in practice. The rule above is
a strict subset of the provenance rule, so adopting it later changes when the chip
appears and nothing else.

### The reverse direction, and the two-key case

Chapter is symmetric: name → number, and number → name, same three states.

Series is not. The pairing is `episode_name ↔ (season, episode)` — one key on one
side, **two on the other**:

- **Pick a name** → fill both season and episode. States 1–3 apply to the pair as a
  unit: if either is non-empty and disagrees, offer, do not write. Filling one and
  offering the other would leave a half-applied pairing on screen, which is the one
  outcome worse than both options.
- **Type both numbers** → fill the name. This one fires on *completion*, not on each
  keystroke, since season alone is a legal state (`0025_dialogue_episode.sql:20-22`)
  and an episode number alone is rejected.

**Season 0 is a real season** (specials — `0025_dialogue_episode.sql:14`) while
`chapter_no` uses `0` to mean absent (`0044_chapter_number.sql:18`). Two adjacent
fields, two opposite conventions for zero. The lookup must not share a "truthy"
helper between them, and a test should pin the specials case specifically, because it
is exactly the bug that passes every review.

---

## The mechanism

### One endpoint

```
GET /works/{kind}/{id}/entry-vocabulary     kind ∈ book | movie
```

Returns this reader's own prior values **for this work**, pairings included:

```json
{
  "chapters":   [ { "no": 3, "name": "The Fall", "count": 12 } ],
  "episodes":   [ { "season": 1, "episode": 4, "name": "Fly", "count": 6 } ],
  "characters": [ { "name": "Walter White", "actor": "Bryan Cranston", "count": 41 } ],
  "locations":  [],
  "timestamps": []
}
```

Notes that are decisions, not formatting:

- **Pairings come back paired.** Two flat lists could not express "chapter 3 is
  called The Fall", and reassembling them in the browser means guessing. A row with
  both halves in it is the whole reason this is not a `datalist`.
- **`count` is what sorts the list, and what detects ambiguity.** Most-used first is
  right for entry (unlike the search vocabulary, which sorts alphabetically because
  you are hunting a known word). And two rows sharing a name *is* the ambiguous case
  — the client needs no separate signal.
- **`character` carries its `actor`**, because `dialogues` already stores both and
  the edit form already derives one from the other (`Movies.jsx:2134-2143`). Picking
  a character can fill the actor by the same three states.
- **`kind` in the path, not a `media_type` branch.** A game and a show are both
  `movies` rows (`0040_games.sql`), so one query serves films, shows and games —
  the same reason `vocabulary_handler.go:64-69` gives for its single join. The
  `episodes` list simply comes back empty for a film or a game.
- **Empty arrays, never `null`**, per the house rule.
- **Ownership is a filter in the same statement as the read**, and a foreign work is
  **404, not 403**. It gets its own cross-user test.
- **Read-only transaction, marked as such** — `_txlock=immediate` makes an unmarked
  one take the write lock for nothing.

**Fetched when the form opens, not per keystroke**, and **re-fetched after a save**,
which is the one place this differs from the session-long search vocabulary: the
value you just typed must be offered on the very next entry, and that is most of the
point. A pool held for the session would be stale exactly when it matters — the
second quote from a book you have just started.

**Why not extend `/search/vocabulary`:** it is documented as library-wide and held
for the session (`vocabulary_handler.go:16-24`). Both of those are wrong here.
Bolting a work parameter onto it would make one endpoint mean two things and quietly
break the caching its own comment justifies.

### One UI primitive

`SuggestInput` — the single-value sibling `TokenInput` never had. It is deliberately
assembled from parts that already exist rather than written fresh:

- filter, rank and cap-at-8 from `WorkPicker` (`AddSurface.jsx:503-549`)
- the portalled `role="listbox"` menu, `useAnchoredPosition`, `useDismiss`
- the arrow/Enter/Escape keys, with `Enter` calling `preventDefault()` so it cannot
  submit the enclosing form — the bug `WorkPicker.onKeyDown` already guards
  (`AddSurface.jsx:562-579`)
- the **blur-commit that checks both the box and the popover** (`ui.jsx:1908-1922`),
  without which clicking a suggestion reads as "focus left the field" and commits the
  half-typed text instead

It is **free text with suggestions, not a picker.** Every one of these fields is
optional free text today and must stay that way: a chapter you have never recorded
has to be typeable, or the helper becomes a cage. Nothing is ever *restricted* to the
pool.

`nameCase` comes along for character, actor and speaker, which the add form
currently lacks entirely.

### One pairing rule, in one place

The three states above are a pure function — `(picked, counterpart, pool) → fill |
offer | nothing` — and it lives in exactly one module, tested directly. The
inversion-in-one-place discipline that `anthologies.jsx`'s `shown`/`stored` pair
established is the precedent: a rule duplicated across four surfaces is four places
to get zero wrong.

---

## Migration 0046 — the episodes table

```sql
CREATE TABLE episodes (
  id        INTEGER PRIMARY KEY,
  movie_id  INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  season    INTEGER NOT NULL,
  episode   INTEGER NOT NULL,
  name      TEXT NOT NULL DEFAULT '',
  UNIQUE (movie_id, season, episode)
);
```

An episode's name is a fact about the **episode**, not about each line quoted from
it, and one row means renaming it is one edit that cannot disagree with itself. The
denormalised alternative — `episode_name TEXT` on `dialogues`, mirroring how
`chapter` works one table over — was considered and turned down.

**The cost of that choice, stated rather than discovered.** It is a new noun, and
every declared list that travels with a work has to learn it:

- **`collectWork` (`trash.go:212`) is a declared subtree list, not a foreign-key
  walk.** This is the load-bearing one. Bin a series, restore it, and every episode
  name is gone unless `episodes` is added there — silently, with the quotes intact,
  which is the failure mode nobody reports because nothing looks broken. `0024`'s
  `work_reads` and the polymorphic `item_reviews` are the precedent the migration
  skill already warns about.
- **Restore must recreate the rows** with new ids, since SQLite reuses rowids after
  a delete.
- **Export and import need a binding** for round-trip
  (`export_handlers.go`, `importer/movie_markdown.go` handle season/episode today).
  An export that drops the name is an export that does not round-trip, which every
  other export in this app does.
- **`staged_quotes` needs the name too** — `0044`'s reasoning applies unchanged: a
  column present on the live shape and absent from the staging mirror is a loss at
  the last step, invisible because the source file is already gone. Staging holds a
  name string and resolves it to an `episodes` row on approval.

**No CHECK on season or episode**, consistent with `media_type` and `status`, and
because season 0 is legal.

**Dedupe is untouched.** `DialogueDedupeHash` folds in season and episode
(`hash.go:67`) and the name adds nothing — it is a property of the pair already
hashed. No `BackfillDialogueHashes` change, no rehash on upgrade.

**Nothing is backfilled**, for `0044`'s reason exactly: no existing row records an
episode name, so there is nothing to derive and nothing to guess.

---

## The surfaces

| Surface | File | What changes |
| :-- | :-- | :-- |
| Add | `AddSurface.jsx:939-991` | Character, chapter name, chapter #, location, timestamp become `SuggestInput`. New: season/episode/**episode name** pairing for shows. The pool arrives on target pick — the one new fetch. |
| Edit | `Library.jsx:1961`, `Movies.jsx:2098`, `Quotes.jsx:261` | Same fields. The `cast`-only pool becomes cast ∪ prior values, **fixing the two hosts that pass no cast at all**. Speaker and occasion get pools too. |
| Import review | `StagingPage.jsx:718-787` | Same fields, including the hand-editable `actor`. Its hardcoded English labels get keys on the way past. |
| Bulk edit | `bulkOps.jsx:221` | Suggestions **yes**, pairing autofill **no** — see below. |

### Bulk edit takes the pool and not the pairing

Setting a chapter across forty selected quotes is one value landing on forty rows,
and the three states do not have a meaning there: "the counterpart is non-empty and
disagrees" is a question about forty different counterparts with forty different
answers. Offering the pool is unambiguously useful and costs nothing. Autofilling a
paired field across a selection is a separate feature with its own confirmation
design, and it is out of scope rather than half-done.

---

## Tests

- **The pairing rule directly** — a pure function, so all three states, both
  directions, the ambiguous pool, and the two-key series case are unit tests with no
  DOM.
- **Season 0**, specifically, as its own case. Two conventions for zero in adjacent
  fields is the bug that survives review.
- **The endpoint**: happy path, empty work, **cross-user 404**, and a work whose
  pool is self-contradictory. Assert on **values, not counts** — "got 3 chapters"
  passes happily while they are the wrong three, which is the entire failure mode of
  a pool query.
- **Re-fetch after save**: record a quote with a new chapter name, and assert the
  next form offers it. This is the behaviour the whole feature exists for and the
  one a session-long cache would break.
- **Bin and restore a series**, and assert the episode **names** come back. Written
  against `collectWork`'s declared list, because that is where it will break.
- **Export → import round-trip** preserving episode names.
- **The blur-commit case**: click a suggestion, assert the half-typed text did not
  win.
- Every one of these gets **broken on purpose** before it is trusted. A test written
  from a spec and passing on the first run has proved nothing yet — which is how two
  tests in the 2.1.1 work came to assert the opposite of correct behaviour.

---

## What this deliberately does not do

- **No restriction to the pool.** Every field stays free text.
- **No canonical chapters table.** Chapter stays denormalised on `annotations` as
  `0044` left it. That is an inconsistency with `episodes` and it is accepted: a
  chapter name is genuinely a property of the passage's location as recorded, an
  episode name is a fact about a thing that exists independently, and — bluntly —
  `0044` has shipped.
- **No fuzzy matching.** Substring, like every other pool in the app.
- **No cross-work pool.** "The same book" is the request; `/search/vocabulary`
  already serves the library-wide case for search.
- **No merge tool.** Discovering that you have "The Fall" and "the fall" is a real
  outcome of this feature and cleaning it up is a separate one.

## Open questions

1. **Does the chip need a keyboard route?** Every other control here has one. A
   pending offer that only a pointer can accept is a gap on a form that is otherwise
   fully keyboardable.
2. **Is `location` worth pooling at all?** A page number is different every time. The
   pool would be long, unique-per-row and useless — unless the value is a
   percentage or a named section. It may be right to leave `location` alone and say
   so.
3. **Where does an episode name get *edited*?** The pairing writes one on entry, but
   nothing in the UI yet owns "rename episode 4" — which is the main advantage the
   canonical table was chosen for, and it is currently unspent.
