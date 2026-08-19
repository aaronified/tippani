# Entry helpers — the library remembers what you already typed

**Status:** designed, not built. One endpoint, two UI primitives, four surfaces, and a
keyboard route retrofitted onto two existing chip sets.

No roadmap section owns this. It is not a feature so much as the removal of a recurring
cost: **every locator in this app is free text, and free text typed twice is typed
differently.** "The Fall" and "the fall", chapter 3 and chapter 03, Rosencrantz and
Rosencrantz. The library already knows what you called things. It has never offered to
remind you.

The shape is one already accepted twice: a pool of your own prior values, fetched once,
narrowed in the browser as you type — the rule
[`vocabulary_handler.go:19-24`](../../internal/httpapi/vocabulary_handler.go) states for
the search box and `WorkPicker` implements for the add menu. What is new is that some of
these values come **in pairs**, and picking one half should fill the other.

**The episode half lives in [`episodes.md`](episodes.md).** It began here and outgrew
it: a name, three orderings, a provider fetch and a reordering dialog are a feature of
their own, and much the larger one. They ship in either order and neither blocks the
other — this plan simply offers no episode pairing until that one lands.

---

## What already exists

Verified against `7f0b067`, by reading the tree.

| Piece | Where | State |
| :-- | :-- | :-- |
| Chapter as number + name, two columns | `annotations.chapter_no` REAL, `annotations.chapter` TEXT — `0044_chapter_number.sql:46`, `0001_init.sql:58` | **Built.** The pairing this plan needs is already storable, so the book half is pure UI. |
| A per-work pool of prior values | — | **Missing.** `/search/vocabulary` is library-wide and held for the session. |
| Character suggestions on a dialogue form | `Movies.jsx:2105`, via `TokenInput` at `2214-2221` | **Built — but not from your prior values.** The finding that reshaped this plan. |
| A single-value filter-as-you-type input | — | **Missing.** `TokenInput` (`ui.jsx:1811`) is the nearest and is multi-value with pills. |
| Filter-as-you-type over a fetched pool | `WorkPicker` — `AddSurface.jsx:518` | **Built**, and the pattern to copy: rank, cap at 8, portalled `role="listbox"`, arrow/Enter/Escape. |
| A shortcut registry with per-context bindings | `keys.js` — `SHORTCUTS`, `ctx`, `shortcutFor` | **Built**, and it already binds bare `1`–`4`. |
| Name-casing on entry | `useNameCasing`, `Field nameCase` — `ui.jsx:515` | **Built**, and the add form uses it nowhere. |
| A game's characters | `dialogues` rows under a `movies` row with `media_type='game'` — `0040_games.sql:31` | **Built storage.** Nothing new is needed to hold them. |

### What the verification pass changed

**"Movie characters come up when editing" is true, and not for the reason it looks
like.** The suggestions are the **TMDB cast list**, not a memory of what you typed:
`charSuggestions` is derived from `cast.map(c => c.character)` (`Movies.jsx:2105`), and
`cast` comes from `movies.cast_json` (`0003_movies.sql:15`). Three consequences the
original framing missed:

1. **A character you invented by hand is never offered again** — not even on the edit
   form. If the name is not in the cast, it is not in the pool. So this is not "port the
   edit form's autocomplete to the add form"; the pool the request asks for does not
   exist anywhere yet.
2. **It is not add-vs-edit, it is on-the-film's-page-vs-not.** The favourites editor
   (`Home.jsx:491`) and the search editor (`SearchPage.jsx:1107`) both render
   `DialogueForm` with no `cast` prop, so it defaults to `[]` and characters do not
   autocomplete there either. Two live gaps, fixed incidentally by this work.
3. **Games already benefit.** `0040` maps voice cast into the same `cast_json`, and a
   game's quotes are `dialogues` rows, so the pool query needs nothing media-specific.
   The one gap is that `AddSurface.jsx:737` sets `isShow` from `media_type === 'show'`
   only — which is correct, a game has no season, and is worth not "fixing".

**So the cast list is not replaced — it is joined.** The pool becomes *cast ∪ what you
have actually typed on this work*, strictly better than either alone: the cast covers the
first line you ever record, your own history covers everyone the cast never named.

**The add form cannot see a cast even if it wanted to.** `CaptureQuote` reduces every
work to `{kind, id, title, sub, media_type, tag}` (`AddSurface.jsx:718-732`,
`workFromMovie` at `:84-91`) and never re-fetches `/movies/:id` when a target is picked.
That is why the character control there is a bare `<input>` (`:943`) with no suggestions
and not even `nameCase`. It is also why the pool must arrive by its own request rather
than being read off a record already in hand.

**A fourth surface exists that the request did not mention.** `StagedQuoteForm`
(`StagingPage.jsx:718`) is the only place `actor` is hand-editable, and its fields are
plain inputs with **hardcoded English labels** (`:780-787`). Import review is where
inconsistent chapter names arrive in bulk, so it has the most to gain.

**`keys.js` had already written the argument against the obvious keyboard route.** Its
comment at `:57-72` says binding `1` globally "would mean pressing 1 on a four-option
question graded it instead of picking the first answer — a keystroke that silently marks
a card wrong", which is why `ctx` exists. The same argument lands harder here, because
the fields these chips sit beside are **numeric inputs**.

---

## The decisions

Asked and answered before drafting, because each changes the work rather than the
wording.

| | Decision |
| :-- | :-- |
| **Overwrites** | Fill blanks silently; when the counterpart disagrees, **offer and never clobber**. |
| **Pool source** | A small **per-work endpoint**, fetched when the form opens, refreshed after a save. |
| **Surfaces** | **All four** — add, edit, import review, bulk edit. |
| **Keyboard** | **Alt+1–9**, uniformly, on every offer chip in the app. |
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

1. **Counterpart empty, pairing unambiguous** → fill it, silently. The common case, and
   the whole point of the feature.
2. **Counterpart empty, pairing ambiguous** → fill nothing. Show the candidates as
   chips: `3 · 4`. One tap or one Alt+digit picks. The app does not guess which of your
   own two records you meant, because it cannot, and a wrong locator written
   confidently is worse than a blank one.
3. **Counterpart non-empty and disagrees** → **write nothing.** Show one inline chip —
   `Chapter 3?` — that fills on tap and vanishes on dismiss or on the next keystroke in
   that field.

Nothing you typed is ever replaced without a tap. That is the rule in one sentence, and
it is the rule because of the failure it prevents: you type `7`, then pick a chapter
name to save typing, and the `7` silently becomes `3`. You would not notice until the
quote was already filed under the wrong chapter, and nothing would record that the app
had done it.

Counterpart non-empty and **agreeing** → nothing to do and no chip. Silence is the
correct feedback for "already right".

### Why not track typed-vs-autofilled

The alternative was to remember provenance: replace a value the app filled in, confirm a
value you typed. It is more precise and genuinely tempting, and it is **deferred rather
than rejected**, for one reason — **it makes the same gesture do two different things
depending on invisible state.** Selecting a chapter name would sometimes overwrite the
number and sometimes not, with nothing on screen saying which regime you were in. The
offer chip is one behaviour, always, and the cost is one keystroke in the case where the
app was going to be right anyway.

Worth revisiting if that keystroke turns out to be constant in practice. The rule above
is a strict subset of the provenance rule, so adopting it later changes when the chip
appears and nothing else.

### The reverse direction, and the two-key case

Chapter is symmetric: name → number, and number → name, same three states.

Series is not, and this is the part that waits on [`episodes.md`](episodes.md). The
pairing is `episode name ↔ (season, episode)` — one key on one side, **two on the
other**:

- **Pick a name** → fill both season and episode. States 1–3 apply to the pair **as a
  unit**: if either is non-empty and disagrees, offer, do not write. Filling one and
  offering the other leaves a half-applied pairing on screen, which is the one outcome
  worse than both options.
- **Type both numbers** → fill the name, on *completion* rather than per keystroke,
  since season alone is a legal state (`0025_dialogue_episode.sql:20-22`) and an episode
  number alone is rejected.

**Season 0 is a real season** (specials — `0025_dialogue_episode.sql:14`) while
`chapter_no` uses `0` to mean absent (`0044_chapter_number.sql:18`). Two adjacent
fields, two opposite conventions for zero. The lookup must not share a "truthy" helper
between them, and a test pins the specials case specifically, because it is exactly the
bug that passes every review.

---

## The keyboard route

Every offer chip gets **Alt+1** … **Alt+9**, drawn on the chip itself, per the owner's
rule that a shortcut must be spelled out on the control that shares its job.

**Bare digits cannot work here, and `keys.js` had already written the argument.** The
fields these chips appear beside are numeric inputs — chapter #, season, episode — and
the chip appears *because* you are typing in one. `1` with the caret in Season has to
type `1`. The cloze precedent (`keys.js:82-85`: space "only fires while the field is NOT
focused, so it can never eat a space you meant to type") does not rescue it, because on
an entry form a field is focused essentially always: the route would be printed on the
chip and dead exactly where the feature lives.

Alt is free of every existing binding, survives a focused input, and is one rule for the
whole app rather than one per surface.

- **Bindings live in `keys.js` with a `ctx`**, as `pick-1`…`pick-4` already do. Nine ids,
  `ctx: 'offer'`, so the shortcuts sheet lists them once and `Tooltip`'s `shortcut` prop
  resolves them without any control hard-coding a key.
- **`prettyKey` needs an `alt` word** — `⌥` on a Mac, `Alt` elsewhere — the same
  one-binding-two-labels case `mod` already handles (`keys.js:104-108`).
- **Review's MCQ keeps bare `1`–`4`.** It has the route natively via `ctx: 'mcq'`, no
  text field competes with it, and its grading keys are trained muscle memory.
- Nine is the cap because Alt+0 is not a tenth. This binds only the **chips**, which are
  ambiguity candidates and rarely reach nine; the long pools are `SuggestInput`'s
  filtered list, which has arrow keys and is unaffected. A chip set that did exceed nine
  shows nine with a route and the rest by pointer, and **says so** rather than
  truncating silently.

### Retrofitted onto the two existing offers

| | Where |
| :-- | :-- |
| Search facet suggestion chips | `SearchPage.jsx:825` — tap to add a `character:` or tag facet, with the search box focused, so Alt is doing real work here too. |
| Cover and poster candidates | `CoverPicker.jsx:534, 634` — pick one of several fetched images; pointer-only today. |

Two things that are **not** offers and are therefore out of scope: the fuzzy "did you
mean" line (`SearchPage.jsx:681`) is a `<p>` stating what the server did, and `GapChips`
(`MetadataPage.jsx:352`) are `<span>`s listing what is missing. Neither is clickable.
Making them actionable is new behaviour rather than a retrofit, and it is not planned
here.

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
- **`count` sorts the list and detects ambiguity.** Most-used first is right for entry —
  unlike the search vocabulary's alphabetical order, which is right for hunting a word
  you already know. And two rows sharing a name *is* the ambiguous case, so the client
  needs no separate signal.
- **`characters` carries its `actor`**, since `dialogues` stores both and the edit form
  already derives one from the other (`Movies.jsx:2134-2143`). Picking a character can
  fill the actor by the same three states.
- **`episodes` is empty until [`episodes.md`](episodes.md) ships**, and then it comes
  from the `episodes` table through the displayed order rather than from distinct
  dialogue rows — so an episode you have never quoted is still offered, which is the
  main dividend of fetching a season list.
- **No `locations`.** Deliberate: a page number is different every time, so the pool
  would be long, unique-per-row and useless.
- **`kind` in the path, not a `media_type` branch** — a game and a show are both
  `movies` rows (`0040_games.sql`), so one query serves films, shows and games, the same
  reason `vocabulary_handler.go:64-69` gives for its single join.
- **Empty arrays, never `null`.** Ownership filtered in the same statement as the read;
  a foreign work is **404, not 403**, with its own cross-user test. **Read-only
  transaction, marked as such** — `_txlock=immediate` makes an unmarked one take the
  write lock for nothing.

**Fetched when the form opens and re-fetched after a save.** The one place this differs
from the session-long search vocabulary: the value you just typed must be offered on the
very next entry, and that is most of the point. A pool held for the session would be
stale exactly when it matters — the second quote from a book you have just started.

**Why not extend `/search/vocabulary`:** it is documented as library-wide and held for
the session (`vocabulary_handler.go:16-24`), and both are wrong here. Bolting a work
parameter onto it would make one endpoint mean two things and quietly break the caching
its own comment justifies.

---

## The UI primitives

**`SuggestInput`** — the single-value sibling `TokenInput` never had, deliberately
assembled from parts that already exist rather than written fresh:

- filter, rank and cap-at-8 from `WorkPicker` (`AddSurface.jsx:503-549`)
- the portalled `role="listbox"` menu, `useAnchoredPosition`, `useDismiss`
- arrow/Enter/Escape, with `Enter` calling `preventDefault()` so it cannot submit the
  enclosing form — the bug `WorkPicker.onKeyDown` already guards
  (`AddSurface.jsx:562-579`)
- the **blur-commit that checks both the box and the popover** (`ui.jsx:1908-1922`),
  without which clicking a suggestion reads as "focus left the field" and commits the
  half-typed text instead

It is **free text with suggestions, not a picker.** Every one of these fields is
optional free text today and must stay that way: a chapter you have never recorded has
to be typeable, or the helper becomes a cage. Nothing is ever *restricted* to the pool.
`nameCase` comes along for character, actor and speaker, which the add form lacks
entirely.

**`OfferChip`** — one component for all three states, owning the Alt+digit binding and
drawing it, so a fifth caller cannot invent a fourth behaviour.

**One pairing rule, in one place.** The three states are a pure function —
`(picked, counterpart, pool) → fill | offer | nothing` — living in exactly one module and
tested directly. The precedent is `anthologies.jsx`'s `shown`/`stored` pair: a rule
duplicated across four surfaces is four places to get zero wrong.

---

## The surfaces

| Surface | File | What changes |
| :-- | :-- | :-- |
| Add | `AddSurface.jsx:939-991` | Character, chapter name, chapter #, timestamp become `SuggestInput`, and get `nameCase` where it applies. Season/episode/name pairing arrives with `episodes.md`. The pool is fetched when a target is picked. |
| Edit | `Library.jsx:1961`, `Movies.jsx:2098`, `Quotes.jsx:261` | Same fields. The `cast`-only pool becomes cast ∪ prior values, **fixing the two hosts that pass no cast at all**. Speaker and occasion get pools. |
| Import review | `StagingPage.jsx:718-787` | Same fields, including the hand-editable `actor`. Its hardcoded English labels get keys on the way past. |
| Bulk edit | `bulkOps.jsx:221` | Suggestions **yes**, pairing autofill **no**. |

**Bulk edit takes the pool and not the pairing.** Setting a chapter across forty selected
quotes is one value landing on forty rows, and the three states have no meaning there:
"the counterpart is non-empty and disagrees" is a question about forty different
counterparts with forty different answers. Offering the pool is unambiguously useful and
costs nothing. Autofilling a paired field across a selection is a separate feature with
its own confirmation design, and it is out of scope rather than half-done.

---

## Tests

- **The pairing rule directly** — a pure function, so all three states, both directions,
  the ambiguous pool and the two-key series case are unit tests with no DOM.
- **Season 0**, specifically, as its own case. Two conventions for zero in adjacent
  fields is the bug that survives review.
- **The endpoint**: happy path, empty work, **cross-user 404**, and a work whose pool is
  self-contradictory. Assert on **values, not counts** — "got 3 chapters" passes happily
  while they are the wrong three, which is the entire failure mode of a pool query.
- **Re-fetch after save**: record a quote with a new chapter name, and assert the next
  form offers it. The behaviour the whole feature exists for, and the one a session cache
  would break.
- **A hand-typed character is offered on the next line**, and on all four surfaces —
  including the two that pass no cast, which is the regression test for the gap the
  verification pass found.
- **The blur-commit case**: click a suggestion, assert the half-typed text did not win.
- **Alt+digit does not reach a focused numeric field**, and bare `1` still types `1`
  with an offer pending. This is the whole reason for the modifier and it deserves the
  test that pins it.
- **No pool is ever a restriction** — a chapter name that appears nowhere in the pool
  still saves.
- Every one of these gets **broken on purpose** before it is trusted. A test written
  from a spec and passing on the first run has proved nothing yet — which is how two
  tests in the 2.1.x work came to assert the opposite of correct behaviour.

---

## What this deliberately does not do

- **No restriction to the pool.** Every field stays free text.
- **No pooled `location`.** Settled: a page number is different every time, so the pool
  would be unique-per-row and useless.
- **No canonical chapters table.** Chapter stays denormalised on `annotations` as `0044`
  left it. That is an inconsistency with `episodes` and it is accepted: a chapter name
  is genuinely a property of the passage's location as recorded, an episode name is a
  fact about a thing that exists independently — and, bluntly, `0044` has shipped.
- **No fuzzy matching.** Substring, like every other pool in the app.
- **No cross-work pool.** "The same book" is the request; `/search/vocabulary` already
  serves the library-wide case for search.
- **No merge tool.** Discovering that you have "The Fall" and "the fall" is a real
  outcome of this feature, and cleaning it up is a separate one.
- **No new migration.** This plan adds no column; `0044` already did the only schema
  work the book half needed, and the series half is `episodes.md`'s.

## Open questions

None outstanding. The three the first draft opened are settled and recorded above: the
keyboard route is Alt+1–9, `location` is not pooled, and where an episode name gets
edited is [`episodes.md`](episodes.md)'s dialog. The nine-key cap turned out not to bind
the long pools at all, only the chips.
