# Entry helpers — the library remembers what you already typed

**Status:** designed, not built. One migration (`0046`), two endpoints, two new metadata
calls, three UI primitives, one dialog, a twelfth gesture clip, and a keyboard route
retrofitted onto two existing chip sets.

It is worth saying plainly that this is **two features in one plan**. The entry helper
is small and self-contained; episodes — a name, three orders, a provider fetch and a
reordering dialog — are most of the work and could ship separately, in either order.
They are written together because the entry helper is what discovered the gap.

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

Episodes turned out to be a feature of their own inside this one, and they are the
larger half. See [Episodes](#episodes-the-larger-half).

---

## What already exists

Verified against `4ba3c66`, by reading the tree.

| Piece | Where | State |
| :-- | :-- | :-- |
| Chapter as number + name, two columns | `annotations.chapter_no` REAL, `annotations.chapter` TEXT — `0044_chapter_number.sql:46`, `0001_init.sql:58` | **Built.** The pairing this plan needs is already storable. |
| Season + episode as numbers | `dialogues.season`, `dialogues.episode` INTEGER — `0025_dialogue_episode.sql:31-32` | **Built.** |
| Episode **name** | — | **Missing entirely.** No column, field, or JSON key in the repo. An episode is only ever numbers. |
| Episode lists from a provider | — | **Missing.** `internal/metadata` has no season or episode call at all. |
| Alternate episode orderings | — | **Missing**, and nothing in the schema could hold one. |
| A per-work pool of prior values | — | **Missing.** `/search/vocabulary` is library-wide and held for the session. |
| Character suggestions on a dialogue form | `Movies.jsx:2105`, via `TokenInput` at `2214-2221` | **Built — but not from your prior values.** See below; this is the finding that reshaped the plan. |
| A single-value filter-as-you-type input | — | **Missing.** `TokenInput` (`ui.jsx:1811`) is the nearest, and it is multi-value with pills. |
| Filter-as-you-type over a fetched pool | `WorkPicker` — `AddSurface.jsx:518` | **Built**, and the pattern to copy. |
| Drag to reorder a list | — | **Missing.** The only drags in the tree are the sticker seal's free positioning (`flow.jsx:192-224`) and a file drop zone (`ImportPage.jsx:340`). |
| A home for an animated gesture clip | `gestures.jsx` — eleven inline-SVG clips, `IMPLEMENTED` at `:44` | **Built, and built for this.** No drag clip among the eleven, but the file exists so that binding a new gesture is "a one-line reference and not a new asset pipeline". |
| A shortcut registry with per-context bindings | `keys.js` — `SHORTCUTS`, `ctx`, `shortcutFor` | **Built**, and it already binds bare `1`–`4`. |
| A per-work action menu | `actionsFor(kind, item, ctx)` — `actions.jsx:76` | **Built.** The episodes dialog is one entry in it. |
| Provider ids on a series | `movies.tmdb_id` (`0003_movies.sql:11`), `movies.tvdb_id` (`0006_enrich_books_movies.sql:29`) | **Built.** Nothing new is needed to know what to fetch. |
| A game's characters | `dialogues` rows under a `movies` row with `media_type='game'` — `0040_games.sql:31` | **Built storage.** |

### What the verification pass changed

**"Movie characters come up when editing" is true, and not for the reason it looks
like.** The suggestions are the **TMDB cast list**, not a memory of what you typed:
`charSuggestions` is derived from `cast.map(c => c.character)` (`Movies.jsx:2105`),
and `cast` comes from `movies.cast_json` (`0003_movies.sql:15`). Three consequences:

1. **A character you invented by hand is never offered again** — not even on the edit
   form. If the name is not in the cast, it is not in the pool. So this is not
   "port the edit form's autocomplete to the add form"; the pool the request asks
   for does not exist anywhere yet.
2. **It is not add-vs-edit, it is on-the-film's-page-vs-not.** The favourites editor
   (`Home.jsx:491`) and the search editor (`SearchPage.jsx:1107`) both render
   `DialogueForm` with no `cast` prop, so it defaults to `[]` and characters do not
   autocomplete there either. Two live gaps, fixed incidentally.
3. **Games already benefit.** `0040` maps voice cast into the same `cast_json`, and a
   game's quotes are `dialogues` rows, so the pool query needs nothing
   media-specific. The one gap is that `AddSurface.jsx:737` sets `isShow` from
   `media_type === 'show'` only, which is correct — a game has no season — and worth
   not "fixing".

**So the cast list is not replaced — it is joined.** The pool becomes *cast ∪ what you
have actually typed on this work*, strictly better than either alone: the cast covers
the first line you ever record, your own history covers everyone the cast never named.

**The add form cannot see a cast even if it wanted to.** `CaptureQuote` reduces every
work to `{kind, id, title, sub, media_type, tag}` (`AddSurface.jsx:718-732`) and never
re-fetches `/movies/:id` when a target is picked. That is why the character control
there is a bare `<input>` (`:943`) with no suggestions and not even `nameCase`. It is
also why the pool must arrive by its own request rather than being read off a record
already in hand.

**Chapter needs no schema work at all.** `0044` shipped the two columns, both optional
and independent, with `0` meaning absent. The book half is pure UI.

**A fourth surface exists that the request did not mention.** `StagedQuoteForm`
(`StagingPage.jsx:718`) is the only place `actor` is hand-editable, and its fields are
plain inputs with **hardcoded English labels** (`:780-787`). Import review is where
inconsistent chapter names arrive in bulk.

**`keys.js` has already argued against the obvious keyboard route, in writing.** Its
comment at `:57-72` says binding `1` globally "would mean pressing 1 on a four-option
question graded it instead of picking the first answer — a keystroke that silently
marks a card wrong", which is why `ctx` exists. The same argument lands harder here:
the fields these chips sit beside are **numeric inputs**. See
[The keyboard route](#the-keyboard-route).

---

## The decisions

Asked and answered before drafting, because each changes the work rather than the
wording.

| | Decision |
| :-- | :-- |
| **Overwrites** | Fill blanks silently; when the counterpart disagrees, **offer and never clobber**. |
| **Episode name** | A **canonical `episodes` table**, plus a per-order numbering table. |
| **Episode orders** | **Three at most** — `tv`, `dvd`, `custom`. The first two fetched; the third yours. |
| **Reordering** | **Drag and renumber both**, and seasons are alterable too. |
| **Pool source** | A small **per-work endpoint**, fetched when the form opens. |
| **Surfaces** | **All four** — add, edit, import review, bulk edit. |
| **Keyboard** | **Alt+1–9**, uniformly, on every offer chip in the app. |
| **Help** | A twelfth `gestures.jsx` clip for drag-to-reorder, inline SVG like the eleven. |
| **Retrofit** | Search facet suggestion chips and cover/poster candidates. Review's MCQ untouched. |
| **`location`** | **Not pooled.** A page number is different every time. |

---

## The overwrite rule

This was the open question, and it has a wrinkle that decides the rest.

**The pool can contradict itself.** If you once recorded chapter 3 as "The Fall" and
later chapter 4 as "The Fall" — a typo, or a genuinely repeated title — then selecting
the name has *two* answers. Any rule that always autofills has to invent one. So:

### Three states, and only one of them writes

Let *picked* be the value you selected, *counterpart* the paired field.

1. **Counterpart empty, pairing unambiguous** → fill it, silently. The common case and
   the whole point.
2. **Counterpart empty, pairing ambiguous** → fill nothing. Show the candidates as
   chips: `3 · 4`. One tap or one Alt+digit picks. The app does not guess which of
   your own two records you meant, because it cannot, and a wrong locator written
   confidently is worse than a blank one.
3. **Counterpart non-empty and disagrees** → **write nothing.** Show one inline chip —
   `Chapter 3?` — that fills on tap and vanishes on dismiss or on the next keystroke
   in that field.

Nothing you typed is ever replaced without a tap. That is the rule, and it is the rule
because of the failure it prevents: you type `7`, then pick a chapter name to save
typing, and the `7` silently becomes `3`. You would not notice until the quote was
filed under the wrong chapter, and nothing would record that the app had done it.

Counterpart non-empty and **agreeing** → nothing to do, no chip. Silence is the right
feedback for "already right".

### Why not track typed-vs-autofilled

The alternative was to remember provenance: replace what the app filled, confirm what
you typed. Deferred rather than rejected, for one reason — **it makes the same gesture
do two different things depending on invisible state.** Selecting a chapter name would
sometimes overwrite the number and sometimes not, with nothing on screen saying which
regime you were in. The offer chip is one behaviour, always, and the cost is one
keystroke in the case where the app was going to be right anyway.

Worth revisiting if that keystroke turns out to be constant in practice. The rule
above is a strict subset of the provenance rule, so adopting it later changes when the
chip appears and nothing else.

### The reverse direction, and the two-key case

Chapter is symmetric: name → number, number → name, same three states.

Series is not. The pairing is `episode name ↔ (season, episode)` — one key on one
side, **two on the other**:

- **Pick a name** → fill both season and episode. States 1–3 apply to the pair **as a
  unit**: if either is non-empty and disagrees, offer, do not write. Filling one and
  offering the other leaves a half-applied pairing on screen, which is worse than
  either whole outcome.
- **Type both numbers** → fill the name, on *completion* rather than per keystroke,
  since season alone is a legal state (`0025_dialogue_episode.sql:20-22`) and an
  episode number alone is rejected.

**Season 0 is a real season** (specials — `0025_dialogue_episode.sql:14`) while
`chapter_no` uses `0` to mean absent (`0044_chapter_number.sql:18`). Two adjacent
fields, two opposite conventions for zero. The lookup must not share a "truthy" helper
between them, and a test pins the specials case, because it is exactly the bug that
passes every review.

---

## Episodes: the larger half

An episode has a name, and possibly three different numbers.

### Why three orders and not one position

Firefly aired out of order; its DVD release is the intended sequence; most providers
only carry the broadcast one. That is the general case, not a quirk — and it means an
alternate order is **not** a sort key layered over canonical numbers. In a genuine
reordering an episode's *season* can move too, so an order maps an episode to a
`(season, episode)` pair rather than to a position.

So identity and numbering separate:

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
  UNIQUE (episode_id, kind),
  UNIQUE (kind, episode_id, season, episode)
);

ALTER TABLE movies ADD COLUMN episode_order TEXT NOT NULL DEFAULT '';
```

`episodes.id` is the stable identity: an episode is the same episode in all three
orders, which is what lets you switch views without a quote moving. `episode_order` on
the movie is **which order to display**, `''` meaning `tv` — the zero-value-is-the-
default rule `0045` states at length.

**No CHECK on `kind`**, consistent with `media_type` and `status`, and for the same
reason: a fourth order (absolute, for anime) becomes a row rather than a schema change.

### The constraint that shapes all of this

**`DialogueDedupeHash` folds season and episode into the hash** (`hash.go:67`), and
`UNIQUE (movie_id, dedupe_hash)` enforces it. Episode numbers are therefore not free
to float per view — if the number a dialogue stores changed when you switched to DVD
order, every hash on that series would churn and some would collide.

So: **`tv` is the anchor, permanently.** `dialogues.season` / `dialogues.episode`
always mean the `tv` order, whatever you are looking at. Labels, sorting and grouping
render through `episode_order`; storage does not move. Switching the displayed order
is free, instant, and rehashes nothing.

The honest cost, stated rather than discovered:

- **Renumbering within the `tv` order is a different act from renumbering the others.**
  It rewrites `dialogues.season`/`episode` for every affected line and rehashes them.
  That needs its own confirmation, in its own transaction, and it must **refuse on
  collision rather than skip** — `BackfillDialogueHashes` skips UNIQUE failures to
  avoid failing boot (`hash.go:244-251`), which is right for boot and wrong for a
  deliberate edit, where a skipped row is two quotes silently left disagreeing.
- **Editing `dvd` or `custom` touches no dialogue and cannot collide.** Most
  reordering is this, and it should feel that cheap.
- A reader who only ever thinks in DVD order still has quotes numbered in broadcast
  order underneath. That is invisible — every label renders through the chosen order —
  and it is the price of a stable hash.

### Fetching them

`internal/metadata` has no episode call today. Two additions on clients that already
carry the SSRF guard, host allowlist, User-Agent and timeouts, so nothing new is
allowed to make an outbound request:

- **TMDB** — `/tv/{id}/season/{n}` for names, overviews and air dates via the existing
  generic `t.get(ctx, path, q)` (`tmdb.go:208`).
- **TMDB episode groups** — `/tv/{id}/episode_groups`, which is precisely the
  alternate-ordering API and is where a DVD order comes from when one is published.
  A series with no published group simply has no `dvd` rows, and the dialog says so
  rather than fabricating one.
- **TVDB** as the second supplier, mirroring how `tvdb.go` already backs up TMDB.

**Nothing is fetched automatically.** Import is explicit here, as the metadata console
already is: a season list arriving unasked would silently create rows the reader never
approved, and `0042`/`0044` both refused to guess on exactly that principle. A refetch
**never overwrites a name you edited** — same three states as everywhere else in this
plan.

### The dialog

`actionsFor` (`actions.jsx:76`) gains one entry, on `media_type === 'show'` only:
**Episodes…**, opening a `FormModal` per the house rule that edits and adds both open
in a modal.

- A season-grouped list of episodes, one row each: number, name, and a count of how
  many quotes you have from it.
- A three-way switch for the order being viewed and edited. `custom` starts as a copy
  of whichever order was showing when you first choose it, so nobody begins from an
  empty list.
- **Drag to reorder, and renumber by typing** — both, because they suit different
  jobs: dragging is right for moving one episode, typing is right for "everything from
  here on is one lower". Seasons are editable the same way, and moving an episode
  between seasons is a drag onto another season's group.
- **Fetch from provider**, per order, disabled when the series carries no `tmdb_id` or
  `tvdb_id`.
- Renumbering the anchor order shows the confirmation described above, naming how many
  quotes will be renumbered.

**Drag-to-reorder does not exist anywhere in this app yet**, and `anthologies.md` wants
the same thing for anthology entries. It should be **one primitive built once**, with
a keyboard equivalent from the outset — Alt+↑/↓ to move a row — because a reorder that
only a pointer can perform is one of the two access gaps `access.md` is open about.

---

## The keyboard route

Every offer chip gets **Alt+1** … **Alt+9**, drawn on the chip itself.

**Bare digits cannot work here, and `keys.js` had already written the argument.** The
fields these chips appear beside are numeric inputs — chapter #, season, episode — and
the chip appears *because* you are typing in one. `1` with the caret in Season has to
type `1`. The cloze precedent (`keys.js:82-85`: space "only fires while the field is
NOT focused, so it can never eat a space you meant to type") does not rescue it,
because on an entry form a field is focused essentially always: the route would be
printed on the chip and dead exactly where the feature lives.

Alt is free of every existing binding, survives a focused input, and is one rule for
the whole app rather than one per surface.

- **Bindings live in `keys.js` with a `ctx`**, as `pick-1`…`pick-4` already do. Nine
  ids, `ctx: 'offer'`, so the shortcuts sheet lists them once and `Tooltip`'s
  `shortcut` prop resolves them without any control hard-coding a key.
- **`prettyKey` needs an `alt` word** — `⌥` on a Mac, `Alt` elsewhere — the same
  one-binding-two-labels case `mod` already handles (`keys.js:104-108`).
- **Review's MCQ keeps bare `1`–`4`.** It has the route natively via `ctx: 'mcq'`, no
  text field competes with it, and its grading keys are trained muscle memory.
- Nine is the cap because Alt+0 is not a tenth. A pool longer than nine shows nine
  with a route and the rest by pointer, and **says so** rather than truncating
  silently.

### Retrofitted onto the two existing offers

| | Where |
| :-- | :-- |
| Search facet suggestion chips | `SearchPage.jsx:825` — tap to add a `character:` or tag facet, with the search box focused, so Alt is doing real work here too. |
| Cover and poster candidates | `CoverPicker.jsx:534, 634` — pick one of several fetched images; pointer-only today. |

Two things I found that are **not** offers and are therefore out of scope: the fuzzy
"did you mean" line (`SearchPage.jsx:681`) is a `<p>` stating what the server did, and
`GapChips` (`MetadataPage.jsx:352`) are `<span>`s listing what is missing. Neither is
clickable. Making them actionable is new behaviour rather than a retrofit, and it is
not planned here.

---

## The pool endpoint

```
GET /works/{kind}/{id}/entry-vocabulary     kind ∈ book | movie
```

```json
{
  "chapters":   [ { "no": 3, "name": "The Fall", "count": 12 } ],
  "episodes":   [ { "id": 41, "season": 1, "episode": 4, "name": "Fly", "count": 6 } ],
  "characters": [ { "name": "Walter White", "actor": "Bryan Cranston", "count": 41 } ],
  "timestamps": []
}
```

Decisions, not formatting:

- **Pairings come back paired.** Two flat lists cannot express "chapter 3 is called The
  Fall", and reassembling them in the browser means guessing. A row holding both halves
  is the whole reason this is not a `<datalist>`.
- **`count` sorts the list and detects ambiguity.** Most-used first is right for entry,
  unlike the search vocabulary's alphabetical order, which is right for hunting a known
  word. Two rows sharing a name *is* the ambiguous case — no separate signal needed.
- **`episodes` comes from the `episodes` table through the displayed order**, not from
  distinct dialogue rows, so an episode you have never quoted is still offered. That is
  the main dividend of fetching a season list.
- **`characters` carries its `actor`**, since `dialogues` stores both and the edit form
  already derives one from the other (`Movies.jsx:2134-2143`). Picking a character can
  fill the actor by the same three states.
- **No `locations`.** Deliberate: a page number is different every time, so the pool
  would be unique-per-row and useless.
- **`kind` in the path, not a `media_type` branch** — a game and a show are both
  `movies` rows, so one query serves films, shows and games, the same reason
  `vocabulary_handler.go:64-69` gives for its single join. `episodes` comes back empty
  for a film or a game.
- **Empty arrays, never `null`.** Ownership filtered in the same statement as the read;
  a foreign work is **404, not 403**, with its own cross-user test. **Read-only
  transaction, marked as such** — `_txlock=immediate` makes an unmarked one take the
  write lock for nothing.

**Fetched when the form opens and re-fetched after a save.** This is the one place it
differs from the session-long search vocabulary: the value you just typed must be
offered on the very next entry, and that is most of the point. A pool held for the
session would be stale exactly when it matters — the second quote from a book you have
just started.

**Why not extend `/search/vocabulary`:** it is documented as library-wide and held for
the session (`vocabulary_handler.go:16-24`), and both are wrong here. Bolting a work
parameter onto it would make one endpoint mean two things and quietly break the caching
its own comment justifies.

---

## The UI primitives

**`SuggestInput`** — the single-value sibling `TokenInput` never had, assembled from
parts that already exist rather than written fresh: filter/rank/cap-at-8 from
`WorkPicker` (`AddSurface.jsx:503-549`); the portalled `role="listbox"`,
`useAnchoredPosition`, `useDismiss`; arrow/Enter/Escape with `Enter` calling
`preventDefault()` so it cannot submit the enclosing form (`AddSurface.jsx:562-579`);
and the **blur-commit that checks both the box and the popover** (`ui.jsx:1908-1922`),
without which clicking a suggestion reads as "focus left the field" and commits the
half-typed text instead.

It is **free text with suggestions, not a picker.** Every one of these fields is
optional free text today and stays that way: a chapter you have never recorded must be
typeable, or the helper becomes a cage. Nothing is ever restricted to the pool.
`nameCase` comes along for character, actor and speaker, which the add form lacks
entirely.

**`OfferChip`** — one component for all three states, owning the Alt+digit binding and
drawing it, so a fifth caller cannot invent a fourth behaviour.

**`ReorderList`** — drag plus Alt+↑/↓, shared with `anthologies.md`. It needs a
**twelfth gesture clip**, and `gestures.jsx` is already built to take it:

- The existing eleven are all press, swipe or pinch (`gestures.jsx:48-58`). Drag to
  reorder is none of those — it is hold, *travel*, then release onto a target, and the
  held pose at the end is the part that distinguishes it from a swipe's flick. So
  `'drag-reorder'` is a new entry in `CLIPS`, not a reuse of `swipe-up`.
- It follows that file's rules rather than inventing any: **inline SVG, not a GIF**
  (1–2 KB, lives in a diff, `currentColor` so one file is correct in both themes), and
  **`prefers-reduced-motion` handled inside the component**, leaving the held pose
  behind — which works here because the *destination* carries the meaning, not the
  travel. The art stays abstract — a disc for the fingertip, a trail for the travel,
  a gap opening where the row will land — so it cannot go stale in a restyle.
- **It enters `IMPLEMENTED` in the same commit that binds it, and not before.**
  `gestures.test.jsx` fails if the interface references a clip the app does not bind —
  the rule that caught five shortcuts with no handler behind them — so the test is what
  keeps the help page honest here, and it will fail loudly if the clip ships ahead of
  the feature or the feature ships without the clip.
- **A label key in every compiled-in language.** `vocab.gesture.drag-reorder.label`
  joins `en.txt` and `bn.txt` alike, which is part of this work rather than a follow-up:
  a key added to one file only is the one string in the help page that never translates.

**One pairing rule, in one place.** The three states are a pure function —
`(picked, counterpart, pool) → fill | offer | nothing` — living in exactly one module
and tested directly. The precedent is `anthologies.jsx`'s `shown`/`stored` pair: a rule
duplicated across four surfaces is four places to get zero wrong.

---

## The surfaces

| Surface | File | What changes |
| :-- | :-- | :-- |
| Add | `AddSurface.jsx:939-991` | Character, chapter name, chapter #, timestamp become `SuggestInput`. New: season/episode/**episode name** pairing for shows. The pool arrives on target pick. |
| Edit | `Library.jsx:1961`, `Movies.jsx:2098`, `Quotes.jsx:261` | Same fields. The `cast`-only pool becomes cast ∪ prior values, **fixing the two hosts that pass no cast at all**. Speaker and occasion get pools. |
| Import review | `StagingPage.jsx:718-787` | Same fields, including hand-editable `actor`. Its hardcoded English labels get keys on the way past. |
| Bulk edit | `bulkOps.jsx:221` | Suggestions **yes**, pairing autofill **no**. |

**Bulk edit takes the pool and not the pairing.** Setting a chapter across forty
selected quotes is one value landing on forty rows, and "the counterpart is non-empty
and disagrees" is a question about forty different counterparts with forty different
answers. Offering the pool is unambiguously useful and free. Autofilling a paired field
across a selection is a separate feature with its own confirmation design, and it is out
of scope rather than half-done.

---

## Migration 0046

The two tables above, plus `movies.episode_order`, plus **`staged_quotes.episode_name`**
— `0044`'s reasoning unchanged: a value present on the live shape and absent from the
staging mirror is a loss at the last step, invisible because the source file is already
gone. Staging holds a name string and resolves it to an `episodes` row on approval.

**Nothing is backfilled**, for `0044`'s reason exactly: no existing row records an
episode name, so there is nothing to derive and nothing to guess. A series gets its
episodes when you fetch or type them.

**Dedupe is untouched** — the name is a property of a pair `DialogueDedupeHash` already
folds in, so no rehash on upgrade and no `BackfillDialogueHashes` change.

### What a new noun costs, enumerated rather than discovered

- **`collectWork` (`trash.go:212`) is a declared subtree list, not a foreign-key walk.**
  This is the load-bearing one. Bin a series, restore it, and every episode name and
  every custom order is gone unless `episodes` and `episode_orders` are added there —
  silently, with the quotes intact, which is the failure nobody reports because nothing
  looks broken. `0024`'s `work_reads` and the polymorphic `item_reviews` are the
  precedent the migration skill already warns about.
- **Restore must recreate both tables** with new ids and remap `episode_orders.episode_id`,
  since SQLite reuses rowids after a delete.
- **Export and import need bindings** for round-trip — `export_handlers.go` and
  `importer/movie_markdown.go` handle season/episode today. An export that drops the
  name or the custom order does not round-trip, which every other export here does.
- **The account backup** carries whole tables and needs no per-table work, but a
  restore-from-another-server test should assert a custom order survives.

---

## Tests

- **The pairing rule directly** — a pure function, so all three states, both directions,
  the ambiguous pool and the two-key series case are unit tests with no DOM.
- **Season 0**, specifically. Two conventions for zero in adjacent fields is the bug
  that survives review.
- **The endpoint**: happy path, empty work, **cross-user 404**, and a self-contradictory
  pool. Assert on **values, not counts** — "got 3 chapters" passes happily while they are
  the wrong three, which is the entire failure mode of a pool query.
- **Re-fetch after save**: record a quote with a new chapter name, assert the next form
  offers it. The behaviour the whole feature exists for, and the one a session cache
  would break.
- **An episode never quoted is still offered** — the dividend of fetching a season list.
- **Switching the displayed order rehashes nothing.** Read every `dedupe_hash` on the
  series, switch to DVD order, read them again, assert byte-identical.
- **Renumbering the anchor order** renumbers the dialogues and **refuses on collision**,
  leaving the transaction untouched.
- **Bin and restore a series**, asserting episode names *and* a custom order come back.
  Written against `collectWork`'s declared list, because that is where it will break.
- **Export → import round-trip** preserving names and orders.
- **A provider refetch does not overwrite an edited name.**
- **The blur-commit case**: click a suggestion, assert the half-typed text did not win.
- **`gestures.test.jsx` on the twelfth clip** — that `drag-reorder` is in `IMPLEMENTED`
  exactly when the interface references it, and that its label key resolves in every
  compiled-in language rather than only in English.
- **Alt+digit does not reach a focused numeric field**, and bare `1` still types `1`
  with an offer pending. This is the whole reason for the modifier and it deserves the
  test that pins it.
- Every one of these gets **broken on purpose** before it is trusted. A test written
  from a spec and passing on the first run has proved nothing — which is how two tests
  in the 2.1.x work came to assert the opposite of correct behaviour.

---

## What this deliberately does not do

- **No restriction to the pool.** Every field stays free text.
- **No pooled `location`.** Settled: a page number is different every time.
- **No canonical chapters table.** Chapter stays denormalised on `annotations` as `0044`
  left it. That is an inconsistency with `episodes`, and it is accepted: a chapter name
  is a property of the passage's location as recorded, an episode name is a fact about
  a thing that exists independently — and, bluntly, `0044` has shipped.
- **No fourth episode order**, though the absent CHECK means one is a row rather than a
  migration.
- **No automatic provider fetch.** Explicit, per series, per order.
- **No fuzzy matching.** Substring, like every other pool here.
- **No cross-work pool.** "The same book" is the request.
- **No merge tool.** Discovering you have "The Fall" and "the fall" is a real outcome of
  this feature; cleaning it up is a separate one.

## Open questions

1. **Should the episodes dialog be reachable for a film or a game?** It is show-only as
   specified. A film has no episodes, but a game arguably has chapters, and nothing in
   the app holds those either.
2. **What happens to a `custom` order when a provider refetch adds episodes?** New rows
   have no custom position. Appending them at the end is the obvious answer and it is
   obviously sometimes wrong.
3. **Nine is a cap, and a long-running series has more than nine episodes per season.**
   The offer chips are fine — an ambiguous pairing rarely has nine candidates — but the
   episode *pool* in `SuggestInput` is a filtered list, not chips, so it is unaffected.
   Worth confirming that reading is right before building.
