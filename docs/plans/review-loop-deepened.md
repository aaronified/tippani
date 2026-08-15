# The review loop, deepened

The build of roadmap §2 (`docs/roadmap.html#review-loop`, tracked as
[#16](https://github.com/aaronified/tippani/issues/16)). Eight items were on the
roadmap; **five are being built as written, one is replaced, and two are cut** —
and the cuts are recorded here with their reasons, because a plan that quietly
drops a quarter of its section is how a roadmap stops being a promise. A sixth
feature, the traditional flip card, is an addition to the section rather than an
item from it.

(The count in this paragraph was wrong in the first draft — it said six built and
then listed eight — and stayed wrong until the specs were written against it.)

## What already exists

Verified against the tree at `e9fe0cf`, not from memory. Three claims moved as a
result and are marked **(corrected)**.

| Thing | Where | State |
| :-- | :-- | :-- |
| `item_reviews` | `0015_review_rework.sql` | `(kind, item_id)` PK; `stability`, `review_count`, `lapse_count`, `last_result`, `last_reviewed_at`, `last_touched_at`. **Aggregates only — no per-answer history** (corrected) |
| The ladder | `review_handlers.go` `reviewLadder` | Fixed `7 → 30 → 100`; `nextRung` climbs, any lapse resets to 7 |
| Due-ness | `dueSQL` | Evaluated in SQL at query time, floored at `MAX(stability, 7)`. No stored due date, no sweep |
| `review_excluded` | `0033_review_exclusion.sql` | On `books`, `movies`, `annotations`, `dialogues`, `utterances`. A column on the row, deliberately *not* a flag on `item_reviews` |
| Card kinds | `validReviewKind` | `book` (annotations), `screen` (dialogues), `utterance` (standalone) |
| Directions | `dirSource`, `dirQuote` | Two. Both are multiple-choice; there is no free-text or self-graded path (corrected) |
| MCQ | `attachMCQ`, `quizPools` | 4 options (`quizOptions`), distractors ranked by shared author/genre/actor, seeded per (day, card) |
| Screen actor | `dialogues.actor` (`0003_movies.sql`) | Already stored per line, auto-filled from `movies.cast_json` by `autofillActor`. **No API call needed** |
| Edit distance | `internal/search/levenshtein.go` | Bounded Wagner–Fischer, early-abandon. **`editDistance` is unexported** (corrected) |
| Stopwords | — | **Do not exist anywhere in the repo** (corrected — the roadmap's cloze design assumes a list) |
| Endpoints | `server.go:236-241` | `GET /review/daily`, `GET /review/practice`, `POST /review/answer`, `POST /review/seen`, `GET /review/scores`, `DELETE /review/practice` |
| Prefs | `auth_handlers.go` | `srDaily`, `srReviewScope`, `srSeen`, `srPracticeCounts`. Partial-merge PUT; bools keyed on pointer presence |
| Runner | `Home.jsx` `QuizRunner` | One shot per card (`picked != null` returns early), grade posts immediately on tap |

### What the verification changed

1. **The sparkline was cut.** The roadmap says it is "drawn from `item_reviews`".
   It cannot be: that table holds one row per item with running totals, not a
   series. A real sparkline needs a per-answer history table, which is a schema
   decision the section explicitly claims not to need ("no new tables"). Cutting
   it is the honest resolution; adding a table under a heading that promises none
   is not.
2. **Undo was cut, and replaced.** Same root cause — an exact undo needs the
   previous half-life, which nothing stores. Rather than add the state, the
   *misclick* that undo exists to protect against is prevented instead: an
   opt-in **submit step**, so an answer can be changed before it is committed.
   This is strictly better than undo for the stated problem (a misplaced tap
   costs a rung) and needs no schema at all. It is worse than undo for a
   *considered* answer you regret, which is a case the roadmap did not claim.
3. **Cloze needs a stopword list**, which does not exist. It is new code, not a
   wiring-up of something already present, and is scoped accordingly below.

## What is being built

Six features, one commit each, in this order. Each is independently revertible.

### 1. Adaptive intervals — `srAdaptive`, off by default

The ladder stays the default and stays exactly as it is. Adaptive is one boolean
preference that swaps the update rule:

| | Ladder (default) | Adaptive |
| :-- | :-- | :-- |
| First success | first rung (7) | first rung (7) — *identical by design* |
| Later success | next rung up | `max(cur × 2.5, elapsed × 1.2)` |
| Lapse | **→ 7 from any rung** | **× 0.5** |

Both rules are one function, `nextStability`, clamped once on exit to
`[7, 100]`. The bounds are unchanged, so every due-ness query, the status
derivation and migration 0019's ceiling all keep working untouched.

The lapse column is the entire reason this exists. Growth is the part people
notice; the reset is the part that is harsh, and Anki's move to FSRS made that
argument mainstream. The late-recall term (`elapsed × 1.2`) is there so a card
recalled 90 days late is credited with the half-life it demonstrated rather than
the one its old value implies.

The Home-screen explainer is switched on the same preference. Describing the
ladder to somebody who has turned it off would make the one piece of copy that
explains the schedule the one piece that lies about it.

### 2. Leech handling — at five lapses, offer a way out

`lapse_count` is already stored, so this is a read and a control, not a schema
change. At `lapse_count >= 5` the card carries a `leech: true` flag and the
reviewer is offered two exits:

- **Set it aside** — sets the existing `review_excluded` column. Not a new
  concept, not a new column, and it already survives delete/restore, backup and
  export for free (0033's whole argument).
- **Keep going** — dismissed for the session.

No auto-suspend. A card silently vanishing from the deck because a counter hit
five is the app deciding something the reader did not ask it to decide.

### 3. The submit step — `srSubmit`, off by default

Replaces undo. When on, tapping an option *selects* it; a **Submit** button
commits. Until then the choice can be changed freely and nothing is posted. When
off, behaviour is byte-for-byte what it is today (tap grades immediately).

This is client-only. `POST /review/answer` does not change, which is what makes
it cheap and what makes it safe: no half-answered state ever reaches the server.

### 4. Cloze — fill in the blank

The most natural way to test a *quote* as opposed to a fact.

- **Span choice** is at request time, seeded by quote id so the same card blanks
  the same words on every device and every reload. Pick the longest run of
  non-stopwords, preferring 1–3 words, never the whole quote, never a span that
  leaves under ~15 characters of context.
- **A stopword list is new code** — a small, explicit English list in
  `internal/httpapi`, not a dependency. Scoped to English deliberately; a quote
  in another script simply will not produce a good span, and the card falls back
  to another direction rather than blanking something arbitrary.
- **Grading is fuzzy**, via the edit distance already in
  `internal/search/levenshtein.go`. That function is unexported, so this adds a
  thin exported wrapper (`search.Distance`) rather than a second copy — one
  algorithm, one place. Case- and punctuation-insensitive, with a budget that
  scales with the answer's length.
- **No schema.** Nothing about a cloze card is stored; it is recomputed from the
  quote and the seed every time, exactly as the forgetting curve is.
- Cards that cannot produce a decent span fall back to an existing direction,
  the same way `buildQuestion` already falls back when MCQ has no material.

### 5. Traditional flip card — `dirFlip`

The classic memory card, which the app does not currently have: prompt on the
front, the answer revealed on tap, and **you** grade yourself *Got it* /
*Forgot*. No options, no auto-grading.

This is the honest-self-grading mode the MCQ rework removed in 0.5.0 and never
put back in this form. It is also the only card type that works for every quote
regardless of pool size — MCQ needs distractors, cloze needs a maskable span, a
flip card needs nothing.

### 6. "Who said this?" — actor cards, screen quotes only

For `screen` cards only, a direction whose options are **actors, not
characters** — the reviewer picks a face. `dialogues.actor` is already stored per
line and `movies.cast_json` already holds the film's whole cast, so distractors
come from the same film first (the hard, interesting case) and the wider actor
pool second. No API call, as the roadmap promised.

Rendered with the existing `PersonChip` so options carry portraits, matching how
`option_meta` already works on source cards.

### 7. Themed review — quiz me on *this*

`GET /review/practice` gains optional scope parameters — book, film/show, tag,
colour, person — and each of those surfaces gains a way in. The deck query
already filters by scope and already joins each child quote to its parent work
for ownership, so this is one more `WHERE` clause per source plus the entry
points.

Daily is deliberately **not** themeable. The daily deck is the schedule; letting
it be filtered would mean the cards that are actually due go unasked while the
streak still counts, which quietly turns the one authoritative surface into
another practice mode.

### 8. In-card actions — edit, ♥, re-tag

Review is exactly when you notice the typo, the missing tag, or that you love
the line, and it is currently the one screen from which you can do nothing about
any of it. All three endpoints already exist; this is the way to reach them from
a card. Favouriting already counts as "seeing" (`applySeen`), which keeps
working unchanged.

## What is not being built, and why

| | |
| :-- | :-- |
| **Undo the last answer** | Needs stored previous state. Replaced by the submit step (§3), which prevents the misclick rather than reversing it |
| **Recall-history sparkline** | Needs a per-answer history table the section promises not to add |
| **"Which chapter / act?"** | Cut on request — the answer is a locator, not a memory, and getting it wrong says nothing about whether you know the quote |
| **"Who wrote it?" / "type the next line"** | Not asked for. "Type the next line" also needs two annotations adjacent by `location` in one book, which is a much narrower pool than it sounds |

## What the specification pass found

Seven implementation specs were written against the tree, one per feature, each
blind to the others, then reconciled. The reconciliation is the reason this
section exists: six of the seven rewrite the same two functions.

### Three defects that are live in the shipped app today

1. **`Home.jsx` renders the attribution side for every direction that is not
   `source`.** The line is `{isSource ? <QuoteBlock/> : <SourceLines/>}`, and
   `SourceLines` prints the actor as a face chip and the character in its meta
   line. The moment a `speaker` card exists, that path shows the correct actor
   above the four options you are meant to choose between. **This must be fixed
   before any new direction is served, not alongside one.**
2. **`attachMCQ` falls through to the quote branch for any unrecognised
   direction.** It tests `if card.Direction == dirSource` and everything else
   takes the other branch — so a card labelled `cloze` or `speaker` would come
   back carrying quote options with the correct quote among them, while the
   client rendered it as something else. It needs an explicit switch whose
   default refuses.
3. **`buildQuestion` drops a card when it cannot build a question, and
   `dailyRemaining` counts it anyway.** The badge and the deck disagree for any
   library with one work in it. The flip card fixes this by making the signature
   unable to fail.

### Corrections to this plan

- **§3 "This is CLIENT ONLY" is wrong.** The submit step needs `srSubmit` in the
  prefs struct and in the update handler's merge, or the PUT is accepted and
  silently discarded by `loadPrefs`' typed unmarshal — the toggle would revert at
  the next login. What is client-only is the *answer endpoint*, which genuinely
  does not change.
- **Cloze needs a script gate, and the stated reason it does not is false.** The
  plan says a quote in another script "simply will not produce a good span". It
  will: an English stopword list matches zero Devanagari or Cyrillic tokens, so
  every token reads as a content word and the selector confidently blanks a
  phrase out of text it understands nothing about.
- **The three new directions must land as ONE change to the direction
  vocabulary**, not three. Each spec independently rewrote `dailyDirection`'s
  two-way toggle into a differently-shaped three-way, and the three rewrites are
  mutually exclusive. One ordered table, `directionsFor(kind)`, replaces all of
  them — and makes per-kind applicability (speaker is screen-only, a book has no
  cast) a property of the table rather than a special case.
- **`QuizRunner` has no test coverage at all**, and six of the seven features
  rewrite it. The submit-off path — the one every current reader is on — has
  never been asserted by anything. Tests land *before* the state machine is
  split, not after.

### A product decision this plan owes an answer to

Under one direction table, "which book is this quote from?" drops from half of a
book's cards to a quarter, and "which film?" from half to a fifth. That is a
large, immediate change to every existing account, and it would otherwise arrive
as an emergent property of how long a list happens to be. It is decided
explicitly in the vocabulary commit and said out loud in the release note.

## The build order

Eight commits, each shippable with a green suite, reconciled from the seven specs:

| | | |
| :-- | :-- | :-- |
| 1 | Deterministic pools | Sorted keys, so a seeded deck is reproducible before anything depends on it |
| 2 | **The direction vocabulary** | The keystone: `directionsFor`, the explicit `attachDirection` switch, `buildQuestion` that cannot fail, the `Home.jsx` render fix, one API revision bump, and the first `QuizRunner` tests |
| 3 | Leech handling | Independent of the vocabulary; needs `lapse_count` on the card *and* on the answer response |
| 4 | The submit step | After the vocabulary, so it can exempt cloze and flip — typing an answer and pressing Check is already a submit step, and a second confirmation on it is two |
| 5 | Cloze | Now a body rather than a restructure |
| 6 | "Who said this?" | Last of the directions; the only one that touches the pool builder |
| 7 | Themed practice | Its clause must NOT go in `reviewSource.where()` — five queries splice that string and two are Daily-only, so a theme there would narrow the Daily badge in the same commit that promises Daily is not themeable |
| 8 | In-card actions | Last, because it is the only commit that needs the final shape of every card type |

### Two bugs that live between features

Neither is visible from inside any single feature, and both are answer leaks:

- Folding an edited row back onto a **cloze** card rewrites `card.quote` with the
  unmasked text — saving an edit would print the answer.
- The same fold writes a **title** into the answer slot of a **speaker** card,
  whose options are actor names.

## The shape of the whole thing

No new tables. No new columns. Nothing that ticks. Every card type is computed
at request time from data already stored, which is the same discipline the
forgetting curve itself follows — and the reason this section was described as
the cheapest place to get distinctly better rather than merely broader.

Two new preferences (`srAdaptive`, `srSubmit`), both booleans, both off, both
merging through the existing partial-merge PUT.

Three new directions join `source` and `quote`: `cloze`, `flip`, `speaker`. The
client must treat an unknown direction as a flip card rather than rendering
nothing, so that an older client meeting a newer server degrades to the card
type that always works instead of to a blank.
