# Spaced repetition — three difficulties, a longer ceiling, and a number that says where the schedule is set

The review loop works and is better argued than most. What it lacks is a way to
ask harder or easier on purpose, a ceiling that suits a library rather than a
deck, and any record of what was answered — which is why nothing here can be
measured, only asserted.

Four rulings, taken with the research in front of them:

| Question | Ruling |
| :-- | :-- |
| The 100-day ceiling | **Raise it, as far as the evidence goes and no further** |
| What "easy" means | **Deliberately far options** — the tier gives up the better-teaching condition on purpose, to lower the floor |
| Hard, and the sibling problem | **Keep hard as described, and interleave the siblings it borrows from** |
| The scheduler | **Adaptive becomes the default**, plus a review log, an overall retention figure, and a title derived from it |

**Every decision below carries its citation, and every citation has an
infodot string written for it** — the reader should be able to press ⓘ beside a
control and read why it is that way. `INFODOT_MAX` is 240 characters
(`test/pure/infodot-copy.test.js:58`); the strings in *The infodots* are inside it
and are the builder's to use verbatim or trim, in `en.txt` and `bn.txt` both.

---

## What already exists

Verified against `v3` at the commit this file lands on.

| Piece | State |
| :-- | :-- |
| The model | An exponential forgetting curve **evaluated in SQL at query time** — no due-date column, no sweep. `p = 2^(-elapsed/stability)`, due when `elapsed >= stability` |
| Default rule | Fixed ladder **7 → 30 → 100** days. A correct recall climbs one rung; **a lapse falls straight to 7 from any height** |
| Adaptive rule | **Built, opt-in.** `grow 2.5`, `shrink 0.5`, `late 1.2` — and it never awards less than the elapsed gap warrants |
| Bounds | `reviewMinStability` 7, `reviewMaxStability` **100** |
| Grace | `reviewNewItemDays` 7 — a new quote reads "remembered" and is not due |
| Deck | Quota **8**/day; every 3rd slot reserved for unseen; ordered most-overdue-first by `elapsed/stability`; deterministic per day by seed |
| Directions | **Seven** — source, quote, cloze (typed), cloze-mcq, speaker, author, flip. Daily excludes flip. **Chosen by a hash of card and day**, not by difficulty |
| Cloze | Blank is the longest content-word run; **1 word until stability ≥ 30, then up to 3**; ≥ 6 tokens, ≥ 75% Latin script; graded token-by-token with a per-word edit budget |
| Synonyms | **Seven hard-coded pairs** in `cloze.go`, worth 0.5 of an exact recall |
| Distractors | `distractorScore` — same medium **+1,000,000**, same author **+100,000**, shared genres ×100; films score genres ×1,000 and shared actors ×10 |
| Feedback | **Already right.** The answer, the correct option and each option's source are revealed after grading, never before |
| Difficulty today | Only as weights on the move: typed cloze 1.25 up / 0.85 down, synonym 0.5. **No tier, no setting** |
| Per-answer history | **None.** `item_reviews` keeps current state only — stability, review_count, lapse_count, last_result, two timestamps |
| Leeches | Derived at read time at 5 lapses; the card stays in the deck and an exclusion is offered |
| Reserved already | `docs/PLAN.md` — *"the fixed ladder stays the default; adaptive intervals would ship beside it"*, and an approved-but-unshipped entry, *"Measured difficulty feeds the schedule"* |

### What the verification changed

**The schedule has a capacity, and it is about 800 quotes.** At equilibrium a card
is asked once per `stability` days, so a library of `N` cards owes `N / stability`
reviews a day. With the ceiling at 100 and the quota at 8, the largest library the
loop can keep current is `8 × 100 = 800`. Above that the deck runs permanently
behind — it still serves the most-overdue first, so nothing breaks, but a growing
library quietly stops being reviewed and only the staleset end of it is ever seen.
Nothing in the app says so. This is arithmetic, not opinion, and it is the
strongest argument for the first ruling.

**The loop targets 50% recall, and that is invisible.** Due at `elapsed >=
stability` is exactly `p = 0.5` — the app waits until a coin-flip before asking.
That is a legitimate setting and a defensible one (a harder retrieval that
*succeeds* is worth more — Bjork's desirable difficulties), but it is far below the
0.90 that FSRS and Anki take as the usual aim, and it was never chosen out loud. It
matters twice over now: an "overall retention" readout of ~50% would look like a
failing grade when it is in fact the schedule working exactly as built. **The
target makes it a choice rather than a constant**, and the score is read against it
— see *The target, and the score against it*.

**`docs/PLAN.md` already approved most of the difficulty work, unshipped.** The
entry *"Measured difficulty feeds the schedule"* says the deck should count its own
plausible distractors per card and feed that to the grader, so *"a correct answer on
a card the deck knows was easy does not earn the full step"* and *"a lapse on a card
the deck knows was unfair is not decisive"*. It also rules the signal must be
**measured, not self-reported**, and must **not become a column**. Three difficulty
tiers are that entry's other half: it measures what the pool happened to give, and
this chooses what the pool gives.

**Feedback is already correct, which removes the main risk of the tier work.** The
documented hazard of multiple choice is that lures get learned as facts (Roediger &
Marsh, 2005); the documented fix is showing the answer afterwards (Butler &
Roediger, 2008). The app already reveals the answer and every option's source after
grading, and gates the edit pencil so the answer cannot be read early. Nothing to
build; something to not break.

---

## The research, and what each finding decides

| Finding | Source | What it decides here |
| :-- | :-- | :-- |
| The optimal gap grows with the retention interval; ISI and RI act jointly | Cepeda, Pashler, Vul, Wixted & Rohrer (2006), *Psych. Bulletin* 132, 354–380 — 839 assessments across 317 experiments | A fixed ceiling cannot be right for all cards; the ceiling is a budget decision, not a scientific one |
| Optimal gap ≈ **20%** of the delay at a few weeks, falling to ≈ **5%** at one year; performance rises then falls *gradually*, so erring long is cheaper than erring short | Cepeda, Vul, Rohrer, Wixted & Pashler (2008), *Psych. Science* 19, 1095–1102 — 1,354 people, gaps to 3.5 months, tests to 1 year | **The ceiling goes to 365 days** — one year is the longest interval the evidence covers |
| Multiple choice with **competitive** (plausible) alternatives teaches related, untested material better than cued recall, because you retrieve why each wrong option is wrong — and it *avoids* test-induced forgetting | Little, Bjork, Bjork & Angello (2012), *Psych. Science* 23, 1337–1344 | Competitive lures are the **better-teaching** condition. Easy mode gives them up deliberately, and the plan says what that costs |
| More lures read → smaller testing effect and more lure intrusions later; multiple choice can create false knowledge | Roediger & Marsh (2005), *JEP:LMC* 31, 1155–1159 | Feedback is not optional at any tier |
| Immediate **or** delayed feedback raises correct responses and cuts lure intrusions | Butler & Roediger (2008), *Memory & Cognition* 36, 604–616 | The existing reveal-after-grading is load-bearing; hard mode must keep it |
| Retrieving some items from a category impairs later recall of related, unpractised items from it | Anderson, Bjork & Bjork (1994), *JEP:LMC* 20, 1063–1087 | Hard mode's same-series lures need the siblings queued soon after |
| Expanding intervals win at 10 minutes; **equal** intervals win at 2 days | Karpicke & Roediger (2007), *JEP:LMC* 33, 704–719 | The expanding ladder is a compromise, not a law — worth saying in the infodot rather than defending as settled |
| Performance during practice is an unreliable, sometimes misleading index of learning | Bjork — desirable difficulties | The title must not read as a grade |
| Desired retention ≈ 0.90 is the usual aim, 0.80–0.95 reasonable; **true retention** is measured from review history and should sit near the desired figure | FSRS / Anki documentation | The retention readout is a **check on the schedule**, not a score for the reader |
| Gist outlives verbatim | Reyna & Brainerd, fuzzy-trace theory | Noted, not acted on — a commonplace book may not want verbatim recall at all. Out of scope, named below |

**On over-reach, stated once:** Cepeda's designs are study → gap → restudy → one
test. Applying their ratios directly to a repeating schedule is an extrapolation.
That is precisely why the ceiling stops at the edge of their data rather than at
five years.

---

## 1. The ceiling — 365 days

`reviewMaxStability` goes from **100 to 365**. The ladder gains a fourth rung:
**7 → 30 → 100 → 365**.

- **Why 365 and not more.** One year is the longest retention interval Cepeda et
  al. (2008) tested. Beyond it there is no measurement, only extrapolation, and a
  number invented past the evidence is exactly the kind of thing this repo writes
  entries about.
- **Why not less.** Capacity is `quota × ceiling`. At 8 a day, 365 makes about
  **2,900 quotes** sustainable instead of 800 — a real library.
- **A larger library is fine and is said so.** Above capacity, the most-overdue-first
  ordering means the reader always gets the stalest thing. That is the correct
  degradation; what is wrong today is that it is silent. The deck's own screen
  should be able to say "your library is larger than the schedule can keep current",
  which is a fact the status counts can already compute.
- **The ladder stays legible**, which is the reason it beat the tunable rule: four
  numbers, still holdable in the head, still the review intervals themselves.
- The tuning range for `Ladder3` widens to 365, and `Ladder4` joins
  `reviewTuning` with the same clamp shape.

Migration 0019 clamped stored stabilities above 100 down to it. Raising the ceiling
needs **no migration** — nothing is above 100 to rescue, and the off-ladder climb
rule already lets a value join the nearest rung at its next answer.

---

## 2. The three tiers, and Random

A tier is chosen for a round (Daily takes the reader's default; Practice offers the
picker). It changes **which directions are offered**, **how distractors are
chosen**, **how wide the blank is**, and **what is shown beside the quote**. It does
not become a column: like the difficulty signal `PLAN.md` already approved, it is a
property of the round, applied when the pool is built.

### Easy — the floor, bought honestly

- **Distractors deliberately far.** `distractorScore` inverts: candidates are
  ranked *down* the same scale, so same-author and same-series are avoided rather
  than preferred, and cross-medium is acceptable.
- **Two options, not four.**
- **Speaker and character chips visible** beside the quote, with the face.
- **One-word blank**, whatever the stability, with full surrounding context.
- **MCQ only** — cloze-mcq, source, quote, speaker, author. No typed cloze, no flip.
- **The cost, recorded rather than hidden:** non-competitive alternatives teach less
  than competitive ones (Little et al., 2012). Easy is a lower floor, not a better
  question, and its infodot says so.

### Medium — where the app already is, with a cap and closer words

- **Competitive distractors**, which is today's `distractorScore` unchanged.
- **Same author or series appears, but not often.** A per-round quota — at most one
  card in three draws a same-author lure — because "close" loses its meaning when
  every card is close. The quota is the new thing; the scorer is not.
- **Closer cloze options.** Today's seven synonym pairs are for *grading*, not for
  generating lures. Two ways to make options close, and I recommend the first:
  1. **Corpus-derived** — `clozePhraseOf` already lifts same-word-count phrases from
     other quotes; rank those by surface similarity (length, initial letter, shared
     stem) as well as by parent-work similarity. No dependency, and the lures are
     always real language from the reader's own library.
  2. A **synonym/antonym dictionary**. A real one is a dependency, and `go.mod` has
     exactly three direct requirements for reasons `PLAN.md` defends by name. A
     hand-curated list is affordable — the existing seven pairs are the seed — but it
     will always be thin, and thin coverage means the feature works on some cards
     and not others with no way for the reader to tell why.
- **Four options.** Chips shown for the work, not for the speaker.
- **Which language is this proverb?** A new direction, medium only. It shows the
  **English translation alone** and asks which language the proverb is in.
  - Eligible rows are `utterances` with `kind = 'proverb'` (0053's fixed list, with
    its own `CHECK`), a non-empty `translation` and a non-empty `language` — both
    columns landed in 0035.
  - Options are the distinct `language` values across the reader's own proverbs, so
    the lures are always languages they actually keep.
  - **Offered only when at least two languages exist** among them, which is the
    owner's rule and the honest one: a question with one possible answer is not a
    question.
  - **With exactly two languages it is a coin-flip**, and that matters now that a
    retention figure is being reported: a direction with a 50% floor inflates it.
    Prefer three options where the library allows, and where only two exist the
    card should be asked and **not counted** toward the figure — the same
    separation Daily already makes for self-marked flip cards.
  - `region` (0047) is the obvious sibling question and is deliberately not being
    asked for. It stays out until it is.

### Hard — recall, series, and people

- **Typed cloze is the norm**, with the widest blank the quote allows (up to 3
  words, no longer gated on stability ≥ 30 — the tier is the gate).
- **Same-series lures are the norm** wherever options appear: if the card's work
  belongs to a series and the series has other quotes, they are the options.
- **People questions**: who said it, who played them, who wrote it — the existing
  `speaker` and `author` directions, weighted up rather than left to the hash.
- **New directions worth having at this tier** (each cheap, each already has the
  data): *which chapter/act*, *which season and episode*, *who is being addressed*
  (the `recipient` column), *which of these two lines comes first in the work*
  (position is already stored), and *which year* for a film or a book.
- **Names in the line are blanked too.** Every character and actor name that
  appears in the quote's own text is masked, on top of the chosen content-word
  span. Two reasons, and the second is a defect fix:
  1. **A name is often the line.** Blanking the longest content-word run and
     leaving the character's name standing asks the easier half of the question.
  2. **A quote that names its own speaker answers the speaker card before it is
     asked.** That leak exists today at *every* tier, on any line whose text
     contains the character's name — so the masking belongs to the `speaker` and
     `author` directions at all tiers, not only to hard.
- **Matching reuses what the cast already stores.** `work_cast` holds
  `character_key` and `actor_key`, both `store.CastKey(...)` folds (0048); the
  quote's own `character`, `actor`, `speaker` and `recipient` fold the same way.
  Fold the quote's tokens and compare — no second normalisation, which is the rule
  this repo keeps writing entries about.
  - Longest match wins, so a name inside a longer one masks the whole of it.
  - Possessives and inflections come free from the existing stem fold in
    `cloze.go`.
  - **Name masking need not be gated on script.** The cloze *span* selection
    requires ≥75% Latin because the stopword list is English; a name match needs no
    stopword list, so a Devanagari or Bengali line naming its speaker can still have
    the name blanked. That is a small widening of where hard cards can be asked.
  - A line that is **only** a name has nothing left to ask: refuse the card, the way
    `TestClozeRefusesWhatItCannotAsk` already refuses a quote that is all stopwords.
- **Feedback stays** exactly as built. Hard means no options, not no answer.

### Random

Picks a tier per card, not per round, from a seeded hash so a refresh is stable —
the same mechanism `dailyDirection` already uses. Worth having because a fixed tier
over a mixed library is either too easy for the known lines or too hard for the new
ones, and this is the cheapest approximation of per-card difficulty until the
measured signal ships.

### The sibling interleave

When a hard card takes its lures from a series, the quotes used as lures are
**queued to be asked soon** — the antidote to the effect that makes them worth
worrying about (Anderson, Bjork & Bjork, 1994): related items are suppressed when
they are never themselves retrieved.

Mechanism, and it needs the log from §3: the review log records when a quote was
**used as a lure**. The deck's ordering gives a bonus to cards recently used as a
lure, so they surface within the next few rounds. No due-date column, no sweep,
computed at query time — the section's founding constraint holds.

---

## 3. The scheduler — adaptive by default, and a log

### Adaptive becomes the default

`reviewAdaptive` flips: multiplicative growth and a **halved, not reset**, lapse
become what a reader gets without choosing. The ladder stays available as the
opt-in, because it is the version that can be explained in one sentence and some
readers will prefer it.

`PLAN.md` already reserved this shape and named the reason to move: *"a lapse
currently drops you to 7 from any rung, and that is the one place the loop is
harsher than the science asks."* The builder records the switch in `docs/PLAN.md`
as a reversal of the 1.15.0 entry, with the ladder's continued availability as the
part that is *not* reversed.

The adaptive rule needs one addition against the raised ceiling: `grow 2.5` from 100
overshoots 365 in one step. Either the clamp does the work (simplest, and the
existing `clamp()` already would), or growth tapers near the ceiling. **The clamp is
enough** and adding a taper would be a parameter nobody can evaluate — the same
argument that retired the sliders.

### The review log

One append-only table. It is the prerequisite for everything else in this section
and for the measured-difficulty entry already approved.

```sql
CREATE TABLE review_log (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,        -- book | screen | utterance
  item_id     INTEGER NOT NULL,     -- no FK: polymorphic, as item_reviews
  answered_at TEXT NOT NULL,
  mode        TEXT NOT NULL,        -- daily | practice
  tier        TEXT NOT NULL,        -- easy | medium | hard
  direction   TEXT NOT NULL,        -- the seven
  result      TEXT NOT NULL,        -- got | forgot | skip
  elapsed     REAL NOT NULL,        -- days since last review, at answer time
  stability   REAL NOT NULL,        -- stability BEFORE the answer
  next        REAL NOT NULL,        -- stability AFTER
  lure_of     TEXT NOT NULL DEFAULT '' -- kind:id list this card's lures came from
);
```

Three cautions the schema has to answer, all of which this repo has met before:

- **Polymorphic with no FK**, exactly as `item_reviews` and `anthology_entries` —
  so it needs the same `AFTER DELETE` trigger per parent, and 0018's warning about
  hand-recreating them after a table rebuild now covers a fifth join.
- **It grows without bound**, which is the first unbounded table in the app. It
  needs a retention rule decided up front — my recommendation is to keep everything
  (a row is ~80 bytes; ten years of 8/day is under 2.5 MB) and to say so, rather
  than to add a sweep, which the no-background-jobs invariant forbids anyway.
- **It must not slow the answer path.** One `INSERT` inside the transaction that
  already updates `item_reviews`.

### The target, and the score against it

The due point stops being a constant. `srTargetRetention` is a preference — the
share of cards the reader expects to recall *when one comes back* — and the due
rule derives from it:

```
due when  p <= target,  i.e.  elapsed >= stability × log2(1 / target)
```

- **The default is 0.5, which is exactly today's rule.** `log2(1/0.5) = 1`, so the
  multiplier is 1 and `elapsed >= stability` survives untouched. Nothing any reader
  has is rescheduled unless they move the dial themselves — no migration, no
  surprise.
- **Range 0.5 to 0.95.** The upper end is where the usual guidance stops (FSRS/Anki
  call 0.80–0.95 reasonable, ~0.90 the common aim); the lower end is today's
  behaviour, kept rather than deprecated because it is defensible on
  desirable-difficulty grounds.
- **RAISING THE TARGET MAKES ALMOST EVERYTHING DUE AT ONCE**, and this is the hazard
  to write down rather than discover. At 0.9 the multiplier is 0.152, so every card
  past about 15% of its half-life becomes due — which on a settled library is nearly
  all of it. The daily quota is what saves this: the deck drains at 8 a day in
  most-overdue-first order rather than flooding. The control still has to say so
  before it is moved, because the backlog count will jump and nothing else on the
  screen would explain it.

**True retention** = `got / (got + forgot)` over a window, from the log. Skips are
excluded, and same-day repeats — already idempotent in Daily — must be excluded here
too, or a device retry inflates it. So must any direction whose guessing floor is
50%, which today means a two-option proverb-language card.

**The score is the delta.** Both numbers, and the signed difference:

```
target 90%   ·   recalling 86%   ·   4 points under
```

- **Young** (stability below the second rung, 30) and **mature** (at or above it),
  because one figure hides which half is drifting. Anki's convention is 21 days; the
  app's own rung is 30, and using the app's own number keeps one vocabulary.
- **The delta is a reading, not a verdict**, and the wording has to carry that.
  *Above* target means the schedule is asking sooner than it needs to and the gaps
  could lengthen; *below* means it is asking too late. That is the FSRS framing, and
  it makes the number actionable instead of judgmental — which is the same reason
  the title does not come from it.

### The title

**Not from retention.** Retention says where the schedule is set, not how well
someone reads (FSRS/Anki: true retention should sit *near* desired retention, and
lower desired retention is a legitimate choice). A title derived from it would rank
a reader for a setting — and would call a correctly-tuned schedule a failure.

**From mature count** — how many quotes have reached the long rungs. It only ever
grows, every level is an achievement, and it measures the thing the loop is for.
Retention sits beside it as a dial reading with a plain sentence, not as a rank.

Bands and names are the owner's to write; the mechanism is: bands over mature-card
count, **no band named for a deficit**, the first band earned by arriving rather
than by performing, and every name translatable — `bn.txt` needs a twin that is a
name and not a description. A workable seed, offered to be replaced: *Reader ·
Keeper · Annotator · Commonplacer · Anthologist · Archivist*. Nothing in the ladder
may read as "beginner", "novice", "poor" or their Bengali equivalents.

---

## The infodots

Ready to use, all inside the 240-character budget. Placement is the builder's; the
pairing is not.

| Beside | Text |
| :-- | :-- |
| The interval ceiling / schedule settings | The best gap grows with how long you want to keep something — about a fifth of the delay at a few weeks, a twentieth at a year (Cepeda et al., 2008). Past a year the evidence thins, so the longest interval here stops there. |
| The Easy tier | Close wrong answers teach more than obvious ones: you recall why each is wrong, not just why one is right (Little et al., 2012). Easy mode gives that up on purpose, to lower the floor. |
| The answer reveal | Wrong options can be learned as facts. Showing the answer afterwards removes most of that risk (Roediger & Marsh, 2005; Butler & Roediger, 2008), which is why every round ends with the answer. |
| The Hard tier / series lures | Recalling one line from a set can push its neighbours further out of reach (Anderson, Bjork & Bjork, 1994). When a hard card borrows from a series, those neighbours are queued soon after. |
| The ladder | Expanding gaps win a test ten minutes later; equal gaps win two days later (Karpicke & Roediger, 2007). The ladder is a compromise, not a law. |
| The retention figure | How often you recall at review says where the schedule is set, not how well you read. Around nine in ten is the usual aim (FSRS/Anki); lower means longer gaps, not worse memory. |
| The target dial | Your target is the share you expect to recall when a card returns. A higher one means shorter gaps and more reviews; a lower one means longer gaps and more misses, on purpose (Cepeda et al., 2008; Bjork). |
| The proverb-language card | Offered only once your proverbs hold more than one language, because a question with one possible answer is not a question. |
| A wrong answer / the streak | Getting it wrong feels like failure and is not: practice that feels harder often remembers better, and easy practice flatters the moment (Bjork, desirable difficulties). |

`help-budget.test.js` and `infodot-copy.test.js` both measure these; the builder
runs them rather than counting by hand.

---

## Settled

**The 50% due point was the open question, and the target answers it.** Rather than
choosing a number for every reader, the number becomes the reader's, defaults to
what the app already does, and is the thing the score is measured against. That also
dissolves the framing problem the retention figure had on its own: a bare 50% reads
as failure, `target 50% · recalling 51%` does not.

---

## What the build found, and where this plan was wrong

Recorded as it happened rather than tidied away, because two of these change what
the remaining steps have to do.

### Step 1 was already built, and better than specified

`item_recalls` (0064/0065/0066) is the log. It carries `mode` and `counted`, which
this plan did not ask for and which are the two facts that stop the panel reporting
thirty-seven practice answers beside an unmoved half-life. What it does NOT carry is
`direction`, `tier` or `lure_of`.

**And `direction` cannot simply be added, because `review_handlers.go` already ruled
against it.** The comment at the scheduling block is explicit: *"THE DIFFICULTY IS
DERIVED, NOT DECLARED. A client-sent 'direction' would be the client telling the
server what its own answer was worth, and the obvious abuse — claim every answer was
the hardest kind — would inflate a schedule invisibly."* The answer request carries
`{kind, id, result, mode, offset, attempt}` and nothing else; the server infers
`dirCloze` from `attempt != nil` and treats every other direction as weight 1.

So the log's `direction` would be a client claim. That is acceptable **for the log**,
which decides nothing — but §3's retention figure is computed FROM the log and §7
requires a two-option proverb card to be excluded **by direction**, which makes a
client claim load-bearing for a number on screen. Either the figure is the reader's
own number about their own answers (defensible, per-user isolation means nobody else
is affected) or the direction has to be derived. Only `daily` could be: `dailyDirection`
is a hash of card and day and the server can recompute it; Practice picks at random,
server-side, and is not recoverable. **Not decided here.** The three columns are
deferred to one migration alongside the tiers rather than three separate ones.

### Step 4 has a blocker this plan does not mention

The due point is stated **twice**, and the two statements are in different languages:

- `dueSQL` — `julianday('now') - julianday(r.last_reviewed_at) >= MAX(r.stability, 7)`
- `recallStatus` — `case p >= 0.9: remembered; case p >= 0.5: forgetting; default: probably-forgotten`

`elapsed >= stability` is exactly `p <= 0.5`, so the deck's due point and the dot's
bottom threshold are one number written down twice — and `dueSQL`'s own comment makes
that a promise: *"a card is due exactly when its dot reads probably-forgotten."*

`srTargetRetention` moves one of them. At a target of 0.9 the multiplier is 0.152, so
a card becomes due at `p = 0.9` — while its dot still says **remembered**. The deck
would fill with cards the app describes as remembered, and the comment above would be
false.

Three ways out, and this plan chose none of them:

1. **Thread the target through both.** `recallStatus`'s bottom threshold becomes the
   target and "remembered" scales to preserve today — `p >= target + (1-target)*0.8`
   gives exactly 0.9 at a target of 0.5. Correct, and the largest: `recallStatus` has
   six non-test call sites, three of them in `stats_handlers.go`. **That last leg of
   the blocker is now retired** — the commit that recorded it also gave
   `stats_handlers.go` a `loadPrefs` for the capacity, so preferences are in hand
   there. What remains is threading the value, not finding it.
2. **Decouple them deliberately.** The dot answers "how likely are you to recall this
   now?" (absolute); due answers "does the schedule want to ask?" (the reader's).
   Cheaper, and it makes `dueSQL`'s comment false — it would have to be rewritten, and
   the screen consequence at a high target stated rather than discovered.
3. **Ship the dial after the figure it exists for.** Its only consumer is §3's score,
   which is step 10. Nothing else in the app reads the target.

**Not built, and not because it was forgotten.** A dial that changes when every card
is due, whose own hazard note says raising it makes nearly everything due at once, is
a poor thing to land days before a launch when its consumer does not exist yet.

**The duplication itself IS fixed** (3.1.0): `reviewDuePoint` and `reviewHeldPoint` are
constants, `dueSQL` splices `dueMultiplier(reviewDuePoint)` — `log2(1/target)`, exactly
1 at 0.5 — and `recallStatus` switches on the same two. Behaviour is unchanged and
`TestTheDotAndTheDeckAgreeOnDue` holds them together. So the dial is now a small
change: the constant becomes the preference, in one place.

### Step 6 shipped, and in three places not as the plan drew it

Built: the direction sets, the inverted scorer for Easy (twice — `attachSpeaker` does
not consult `distractorScore` at all and had to be inverted separately), the wider
blank for Hard, Random by seeded hash, and — later, after a rater measured it — the
same-author quota for Medium.

**The quota turned out to matter more than the plan's sentence suggests.** Over a
ten-card deck of one author's quotes with six other authors parked in the pool, the
same author won **ten cards out of ten**: `distractorScore` pays 100,000 for a shared
author against 100 per shared genre. And the plan's shape for it was not enough.
Withholding the bonus — scoring a same-author candidate as though the authors did not
match — was built first and does not deliver "at most one card in three": with the
scores level a shuffle still puts a same-author title in the top three about half the
time. The cap needs the candidate DEMOTED below the whole pool, not merely unrewarded.

**Easy's chips landed after that, and the plan was wrong about which component draws
them.** "Speaker and character chips visible beside the quote, with the face" reads as a
job for `SpeakerChips`, the app's rich chip row — and `review.jsx` cannot import it:
`people.jsx` imports `usePractice` from `review.jsx`, which is the cycle `credits.jsx`
exists to keep open. Moving the row down into `credits.jsx` was tried and reverted, and
two guards said why before any of this was reasoned out — `locale-shadow.test.js` (the
move collided with two local `const t` in that file) and `person-router.test.jsx`, whose
own comment already recorded the answer: *"review.jsx defines its OWN PersonChip —
display-only, because there the answer buttons own the tap."* A chip that became a door
mid-question would take the reader out of the round from the one place every tap is
already spoken for. So the quiz card's own display-only chip draws them, in the same
wrapping row `SourceLines` uses for the attribution side.

**And the corpus-derived cloze lures landed last, as the plan's first recommendation
specified** — `clozeSurfaceScore`, shared stem then initial letter then length, over a
bounded pool of candidates that the work ranking has already ordered. Two things the plan
did not say:

- **At one word — the width every new card is asked at — the stem term is unreachable.**
  A single word that shares the answer's stem IS the answer. So the initial letter and the
  length carry the whole of it there, and the stem term only does work on a multi-word
  blank, which means a guard for it has to park a card past `clozeMultiWordFrom` rather
  than seeding a fresh one.
- **A wrong option could be a phrase the TYPED card would accept**, and that was a defect
  rather than a gap. The duplicate check was normalised equality, so a plural, a tense or
  one of the app's own synonym pairs could be offered as a wrong answer: pick it and you
  are told you forgot a line the other direction calls correct. The grader itself is the
  check now.
- **And the round's same-author cap must not reach these lures.** It was passed straight
  in with the tier, so two cards in three drew their phrases from the FARTHEST works in the
  library — the exact opposite of what this step is for. A phrase carries no visible author,
  so the cap buys nothing here; it is about which TITLE is offered.

**And Easy's chips shipped with a leak, which is recorded in `docs/PLAN.md` and belongs
here too because the plan's own sentence is what produced it.** "Never on a card that asks
it" reads as a list of directions, and a fill-in-the-blank card asks who whenever the
phrase it hides is a name: the chip was the answer, and the reader could type it and be
graded right on a card never recalled. The rule is the mask, not the direction.

**And Hard's same-series lures cannot be built at all yet**, which is recorded in
`docs/PLAN.md` rather than here: there is no series term in `distractorScore` and no
`series` field on `workRef`. A separate entry proposes adding them.

### Step 5's leak is real, and narrower than described

This plan says the masking exists because *"a quote that names its own speaker answers
the speaker card before it is asked… on any line whose text contains the character's
name"*. Two corrections:

- **The character's name is not the answer.** A film line's speaker card asks for the
  **actor** (`attachSpeaker` takes `card.Actor` for `kindScreen`). A line reading
  "Neil, what are you doing here?" gives up Robert De Niro only to a reader who knows
  *Heat* — which is precisely what the card is testing. Masking it would blank a large
  share of the dialogue in a library to remove the knowledge being examined.
- **The prompt-side leak was already closed.** `review.jsx` used to send every
  direction that was not "source" down `SourceLines`, which prints the actor as a face
  chip and the character in its meta line — the answer directly above its own four
  options. The comment there records the fix.

What actually leaks is **the answer string appearing in the words the card shows**, so
that is what `hideTheAnswer` masks: the credit, each split credit, and each credit's
surname. A surname is matched **case-sensitively** — an author called "Stephen King"
would otherwise have the app blanking "the king was dead" in every line of the
library, and prose naming a person capitalises them while prose using the same word as
a common noun does not. A line with nothing left to read is refused, and
`buildQuestion` falls through to another direction.

Not gated on script: the cloze *span* selection needs mostly-Latin text because its
stopword list is English, but a name match needs no stopword list, so the boundary is
"not a letter or a number" rather than `\b` — which is an ASCII-word rule and would
never have fired on a Bengali line.

## The order

1. **The review log** — table, triggers, the one `INSERT`. Nothing else in this
   plan can be measured without it. — a migration, `review_handlers.go`
2. **Ceiling to 365**, fourth rung, tuning range widened. No migration needed.
   — `review_handlers.go`, `review_tuning.go`
3. **Adaptive as the default**, ladder kept as the opt-in. — `review_handlers.go`,
   `review_tuning.go`, and the `PLAN.md` reversal entry
4. **The target dial** — `srTargetRetention`, defaulting to 0.5 so nothing moves,
   and the due rule derived from it. Ships before the tiers because the retention
   figure is unreadable without it. — `review_handlers.go`, `review_tuning.go`,
   `auth_handlers.go`, `Settings.jsx`
5. **Name masking**, and the speaker/author leak it closes at every tier. Folding
   through `store.CastKey` against `work_cast` and the quote's own credit columns.
   — `cloze.go`, `speaker.go`, `review_handlers.go`
6. **The tiers** — direction sets, the inverted scorer for Easy, the same-author
   quota for Medium, the wider blank and series lures for Hard, Random by seeded
   hash. — `review_handlers.go`, `review_questions.go`, `cloze.go`, `speaker.go`
7. **The proverb-language direction**, with its two-language gate and its exclusion
   from the retention figure while it has only two options.
   — `review_questions.go`, `review_handlers.go`
8. **The sibling interleave**, reading `lure_of` from the log in the deck ordering.
   — `review_handlers.go`
9. **The new hard directions** — chapter/act, season/episode, recipient, which came
   first, which year. — `review_questions.go`
10. **The score and the title** — computed from the log, shown with its
   target. — `review_handlers.go`, `StatsPage.jsx`, `review.jsx`
11. **The infodots**, in `en.txt` and `bn.txt`.
12. **Docs** — `docs/PLAN.md` §8 (the ceiling, the default switch as a reversal, the
   tiers, and the measured-difficulty entry this half-satisfies), `CHANGELOG.md`,
   `docs/ui-glossary.html` if the tier picker is documented, `AI.md` if verification
   changes.

## Verification

```bash
go vet ./... && go test ./internal/httpapi/ -run 'Review|Cloze|Quiz|Stability|Tier' -v
go test ./...
cd web/frontend && npm test          # infodot-copy, help-budget, locale-complete
make frontend && make glossary && npm run glossary:check
```

New guards worth naming:

- **Capacity is stated, not discovered.** A test that asserts `quota × ceiling` is
  reported somewhere the reader can see when the library exceeds it.
- **Easy never draws a same-author lure; Hard always does where a series exists.**
  The tier's whole definition, asserted rather than eyeballed.
- **A lure is queued.** Answer a hard card whose options came from a series;
  assert those siblings appear within the next N decks.
- **True retention excludes skips and same-day repeats.** The two ways the figure
  inflates.
- **No title band is derogatory** — a list check against a named vocabulary, in both
  locales, because this is the one string in the app that describes the reader.
- **The default target changes nothing.** With `srTargetRetention` at 0.5, the set
  of due cards is byte-identical to today's. This is the migration test, and it is
  the reason the default is 0.5 rather than 0.9.
- **A quote never shows a name it is about to ask for.** Build a speaker card from a
  line containing its own character's name and assert the name is masked — the
  leak that exists today at every tier.
- **A line that is only a name is refused**, the way an all-stopword quote already is.
- **The proverb card is absent at one language and present at two.**

By hand, against a real backup rather than `seed.mjs`: run a Daily at each tier and
read every infodot on the way past.

## Out of scope, named

- **Verbatim versus gist.** Cloze tests exact wording; gist outlives verbatim
  (Reyna & Brainerd). A commonplace book may want "what was this about" more than
  "which word was missing" — a real question, a different feature, and one that
  would need question types the app does not have.
- **Per-card measured difficulty** — `PLAN.md`'s approved entry. The tiers choose
  what the pool gives; that entry measures what it gave. They compose, and it should
  ship after the log exists.
- **A synonym/antonym dependency**, for the reason `go.mod` gives.
- **Changing the due point from p = 0.5**, until the question above is answered.
