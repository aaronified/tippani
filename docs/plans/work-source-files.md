# Source files — a work keeps the file its quotes came from

A quote out of context can read as nonsense. The file it came from is the context,
and until now the app has never held one. This plan gives a work **one source file
per role** — a subtitle track for a film, an ebook for a book, a text for an essay
— and two things to do with it: find where each quote sits, and show what is around
it.

— and then, when the quotes stop arriving, **a way to keep the context and throw
the file away**, which is measured below at 29× smaller on the owner's own book.

It is the spine. `docs/plans/locators-from-files.md` is the reader of these files
and is written against them; this plan is where they come from, where they live,
who can reach them and when they go.

Verified against `v3` at **`b51feaf`**. The branch moves — re-check a line before
trusting it.

---

## The decision this reverses, and the honest way to reverse it

`docs/PLAN.md` carries this under *Considered and set aside*:

> ### No built-in reader, no OPDS, no file sync — annotations are wanted, files are not
>
> **Decided.** Tippani holds no book files. No reader, no OPDS catalogue, no sync to
> a Kobo or Kindle.
>
> **Why.** It is a home for what you marked, not for what you own… **reading
> annotations out of KOReader or Kobo is very much wanted** … **serving files is
> not.**

`locators-from-files.md` was written to fit *inside* that line by never storing the
file. **The owner has now asked for the EPUB to be stored**, so the line moves, and
it has to move in writing rather than by a handler that quietly keeps a file.

**The house has a form for this and it is not a new entry.** The neighbouring
decision — the hosted read-only page — carries a **Reversal** paragraph inside the
entry it contradicts, and says what the author got wrong. That is what this needs:

> **Reversal.** A file is now kept, and only for the two jobs the marks themselves
> cannot do: placing a quote in the work, and showing what surrounded it. What was
> right in the original is untouched — no reader, no pagination for display, no
> catalogue, no sync, nothing served to another device, nothing fetched from
> anywhere. What was wrong was treating *storage* as the boundary when the boundary
> was always **serving**: a file the app never renders and never hands out is a
> private index, not a shelf.

**The narrow line, stated so a guard can hold it:**

- The app **never renders** a source file as a document. There is no reader.
- The app **never serves the file back** — no download route, no `ServeFile`. Covers
  have one (`GET /covers/{file}`) and this must not copy it.
- What leaves the server is **extracted spans of text**, sized by the request, never
  the file.
- It is **never fetched** — only uploaded by the reader who owns it.
  `internal/metadata/` keeps its monopoly on outbound calls because nothing here
  makes one.

**"For now, will not be read fully"** is the owner's, and it is kept as written: the
file is stored whole, and only the spans a request needs are read out of it. No
extraction pass at upload, no derived full-text column, no index.

---

## What already exists

| Piece | State |
| :-- | :-- |
| A file uploaded by the reader and kept | **`user_fonts` (0039) is the precedent, and it is a close one** — a row with `user_id`, `name`, `path`, `format`, `created_at`; the bytes written under `MediaCover` with a 16-hex name; `os.Remove` on delete; `maxFontUpload` 12 MB |
| Covers | `<DataDir>/MediaCover/<16 hex>.<ext>`, `coverFile` regex on the served name so nothing we did not store can be served, `maxUploadBytes` 12 MB, cache-forever |
| **An attachment table** | **None.** No `attachments`, no `files`, no `assets`. `work_sources` would be the first |
| The backup archive | `tar` + `gzip`, **walks every top-level entry in `DataDir`** that is not a control entry or the live DB. A new directory is archived **with no code change**. `maxRestoreEntries` 200,000, `maxRestoreBytes` 8 GiB |
| Orphan cleanup | **Absent.** A cover file is not removed when its work is deleted — only a factory reset clears `MediaCover`. At ~100 KB an orphan that is invisible; at 1.5 MB it is not |
| The action registry | `web/frontend/src/actions.jsx` — `actionsFor(kind, item, ctx)` / `bulkActionsFor`, `ROW` vs `OVERFLOW` placement, `isWorkKind(kind) => kind === 'book' \|\| kind === 'movie'`. Its own header: *"nothing knew the SET, so nothing could offer the set anywhere else — which is exactly why there is no context menu"* |
| A single work's context menu | **Does not exist.** `actionsFor` is called only with `annotation`, `dialogue`, `quote`; `book`/`movie` reach only `bulkActionsFor` (SearchPage, SelectionBar). The registry already carries `isWork` branches (`fillGaps`, `practise`, `setShelf`) with nothing calling them |
| The work-detail button row | `WorkDetails.jsx:1480` — a hand-rolled `flex flex-wrap` with `GhostButton`+`IconMetadata`, an `InfoDot`, a `flex-1` spacer and Delete. **Does not import `actions.jsx` at all** |
| The three media | `book` (books + annotations), `screen` (movies + dialogues), `utterance` (standalone). `movies.media_type` ∈ `movie \| show \| game` |
| Standalone kinds | `quoteKinds` = `speech \| letter \| essay \| poem \| song \| proverb \| other` (0053, 0067, 0068) |
| **An utterance's work** | **There is no work row.** `utterances.work_title` and `utterances.locator` are free text (0047), named generically *on purpose*: *"Naming these two `essay_title` and `essay_page` would make each of those three a migration instead of a label"* |
| How an utterance is keyed elsewhere | `item_reviews` uses `utterance:<folded title>` — a string key, not an id |
| The import drop target | **Built** (`b51feaf`). `importer.Detect(data []byte) string` with no filename parameter, as planned. `Detect` **already returns `"epub"`** for a zip carrying the EPUB mimetype |
| `Checks` | Composes `StagingPage` + `CleanupPage`, each lazy and each taking `embedded`. A third section is the same shape |
| Migration head | `0072_drop_transliteration.sql` |

### What the verification changed

**The import picker has an `accept` filter, and it would hide every file this plan
adds.** `ImportPage.jsx:50` derives `ACCEPT` from the source list and resolves it to
`.md,.json,.html,.txt,.markdown,.htm,.text`; line 198 puts it on the input. So an
`.srt`, `.ass`, `.vtt` or `.epub` is **greyed out in the OS dialog** — and so is the
owner's own `.ass.txt`, which is the file that proved the never-depend-on-the-
extension rule in the first place. The file's own comment at `:32` says *"no file
input, no accept filter, no colour"* while the constant twelve lines below it builds
one. **The comment and the code disagree inside one file, and the code wins.**
Door 4 cannot work until the filter widens or goes.

**The backup will grow by the size of the library's books, and nobody has to write
a line for that to happen.** The archive walks `DataDir` top-level entries and takes
everything it finds. The owner's restored archive is **21 MB** for 27 books and 13
films; at the supplied EPUB's 1.45 MB, storing one per book is **~40 MB of new
payload — roughly triple**. Subtitles are noise beside it (a 145 KB SRT). This is a
decision, not an accident waiting to happen, and it is taken below.

**There is no orphan sweep, and this is where that starts to cost.** A deleted work
leaves its cover behind today and nobody notices. A deleted work leaving a 1.5 MB
EPUB behind is the same bug with a hundred times the bill, and it compounds with the
paragraph above because the backup archives the orphans too.

**Two of the four doors are the same control, and the registry exists to stop them
drifting.** The repo's own directive — *"a control drawn by one component on two
screens has ONE behaviour, and it lives in one function that both screens call"* —
and `actions.jsx`'s header say the same thing. But `WorkDetails.jsx` does not import
the registry, and no screen asks it for a single work's actions. So doors 1 and 2
are **one registry entry and one missing consumer**, not two features.

**An essay has no work to hang a file on.** This is the structural surprise. The
owner asked for essays, poems and songs to take a source, and those are
`utterances` — which carry `work_title` as free text and have no row of their own to
reference. The plan cannot assume an id. See *What can carry a source*.

---

## The store

### The row

```sql
-- 0073_work_sources.sql
CREATE TABLE work_sources (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- WHAT IT BELONGS TO. `subject` is the media word the rest of the app already
  -- uses; `subject_id` is a row id for book and screen and is 0 for utterance,
  -- which has no row -- see subject_key.
  subject     TEXT    NOT NULL,          -- book | screen | utterance
  subject_id  INTEGER NOT NULL DEFAULT 0,
  -- AND FOR AN UTTERANCE, THE FOLDED TITLE, which is how item_reviews already
  -- keys one. Empty for book and screen.
  subject_key TEXT    NOT NULL DEFAULT '',

  -- WHAT IT IS FOR. A film may want its subtitle; a book its ebook. One current
  -- file per (subject, role) -- a second upload replaces the first.
  role       TEXT    NOT NULL,           -- subtitle | text
  -- WHAT THE BYTES ARE, from the magic bytes and never the extension.
  format     TEXT    NOT NULL,           -- srt | vtt | ass | epub | txt
  -- The stored filename under Sources/, like a cover or a font.
  path       TEXT    NOT NULL,
  -- What the reader called it, for the row that says which file this is.
  name       TEXT    NOT NULL DEFAULT '',
  bytes      INTEGER NOT NULL DEFAULT 0,
  -- The fold of the bytes, so a re-upload of the same file is recognised as one
  -- -- and so a kept context can say whether it came from THIS file.
  sha256     TEXT    NOT NULL DEFAULT '',
  -- PRUNED: the context was extracted and the file thrown away. The ROW STAYS,
  -- with `path` empty, because it is the only record that this work ever had a
  -- source -- what it was called and what its bytes hashed to. That is what lets
  -- the app say "re-add V for Vendetta.srt" instead of "no source", and what lets
  -- a re-upload be recognised as the same file. See The prune.
  pruned_at  TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- WHAT SURVIVES A PRUNE. One row per quote, because the windows barely overlap --
-- measured at 1% on the owner's own book, so a shared span pool would be
-- machinery bought for nothing.
CREATE TABLE source_context (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id  INTEGER NOT NULL REFERENCES work_sources(id) ON DELETE CASCADE,
  -- The quote this is the context of.
  subject    TEXT    NOT NULL,          -- annotation | dialogue | utterance
  item_id    INTEGER NOT NULL,
  -- What came before, the span itself as the FILE has it, and what came after.
  -- `body` is the file's words and not the reader's: a quote they tidied and the
  -- line as published are both worth seeing, and only one of them is here.
  before     TEXT    NOT NULL DEFAULT '',
  body       TEXT    NOT NULL DEFAULT '',
  after      TEXT    NOT NULL DEFAULT '',
  -- THE CUT IS RECORDED BECAUSE IT CANNOT BE UNDONE. `unit` is paragraph | cue and
  -- `span` is how many either side this was kept at, so the panel can say "two
  -- paragraphs either side, kept on 14 March" rather than implying there is more.
  unit       TEXT    NOT NULL,
  span       INTEGER NOT NULL,
  -- A subtitle's context is timed; a book's is not.
  start_at   TEXT    NOT NULL DEFAULT '',
  end_at     TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_source_context_one
  ON source_context(user_id, subject, item_id);
CREATE INDEX idx_source_context_source ON source_context(source_id);

CREATE UNIQUE INDEX idx_work_sources_one
  ON work_sources(user_id, subject, subject_id, subject_key, role);
CREATE INDEX idx_work_sources_user ON work_sources(user_id);
```

**The UNIQUE is the owner's "a second upload will replace the first"**, made a
constraint rather than a convention. Replacement is one transaction: write the new
file, update the row, `os.Remove` the old path. No history, no versions — nothing has
asked for one and an ebook is not a document you edit.

**`subject_key` rather than a second table** for the utterance case. It costs one
always-empty column on two thirds of the rows and saves a second table, a second
handler and a second delete path. The alternative — a nullable `utterance_title`
column — says the same thing less clearly.

### The bytes

`<DataDir>/Sources/<16 lowercase hex>` — the cover naming scheme, **without an
extension**, because nothing serves these files and an extension's only job is to
tell a browser what it is getting. The format is in the row, from the magic bytes.

**Not under `MediaCover`.** That directory is *arr-style and means downloaded
artwork; fonts already bend it and a second tenant would make the name a lie. A new
top-level directory also makes the backup question answerable in one place.

**Per-user isolation is a path question here, not only a query one.** The name is
random and the row is scoped by `user_id`; a request for another user's source is a
404 like every other foreign row. There is no route that takes a path.

### The backup — **the prune answers this, and the earlier recommendation is withdrawn**

A new directory under `DataDir` is archived automatically, so *doing nothing*
chooses "include" — which is why this has to be chosen.

An earlier draft of this plan recommended excluding sources from the archive by
default, on the grounds that an EPUB can be downloaded again and a highlight cannot.
**The measurement under *The prune* withdraws that**, and the reason is arithmetic
rather than principle: kept context is **~4% of the raw files**, so the owner's
library carries ~1.5 MB pruned against ~41 MB raw. At 1.5 MB there is nothing to
argue about.

So the rule splits along the line the reader has already drawn:

- **Kept context is always archived.** It is rows, it is tiny, and it is the half
  that cannot be re-derived once the file is gone. Excluding it would make a restore
  lose something no re-download can bring back.
- **Raw source files follow a setting, default off.** They are the bulky half and
  the recoverable half. A reader who wants a self-contained archive turns it on.
- **The restore reports what the archive did not carry**, by work, so a dead control
  is never the way this is discovered.

That also means `Sources/` is skipped by the archive walk by default while the two
new tables ride along in the database snapshot with no special handling at all —
which is the cheap outcome, and it is cheap because of the prune rather than in
spite of it.

### Deletion, and the orphan debt

- **Deleting a work deletes its sources** — the row and the bytes, in the same
  handler. This is the thing covers do not do, and it is not inherited.
- **A source can be deleted on its own**, from the same place it was added.
- **A sweep for the ones that got away**, in `maintenance_handlers.go` beside the
  reset: files under `Sources/` with no row, and rows with no file. Covers deserve
  the same sweep and it costs almost nothing to walk both — but that is a fix to
  ship beside this one, not inside it, and this plan only notes the neighbour.

### Caps

**25 MB per file**, above the 12 MB font and cover precedent, because the precedent
is for an image and this is a book. The supplied EPUB is 1.45 MB and a long novel's
is rarely over 10; 25 leaves room for an illustrated one without inviting an
audiobook. Over the cap the answer names the size and the cap, never a generic
failure.

**No total quota.** A per-user disk budget is a feature with a settings page, a
counter and an eviction policy, and nobody has asked for one. The sizes are visible
in the maintenance screen; that is the honest amount of mechanism for a self-hosted
box whose owner can see their own disk.

---

## What can carry a source, and what it can carry

| Subject | Kind | Role `subtitle` | Role `text` | Notes |
| :-- | :-- | :-- | :-- | :-- |
| `movies` | **movie** | `.srt` `.vtt` `.ass`/`.ssa` | — | The timestamp case |
| `movies` | **show** | same, **one file per episode** | — | See below |
| `movies` | **game** | — | — | **Nothing.** The owner's: *"games have no equivalent."* Absent from the menu, not disabled |
| `books` | — | — | `.epub`, `.txt` | Locations, chapters, context |
| `utterances` | **essay** | — | `.epub`, `.txt` | The essay, or the book holding it |
| `utterances` | **poem** | — | `.epub`, `.txt` | The collection, or the single poem |
| `utterances` | **song** | — | `.txt`, `.lrc` | The lyrics, or the book holding them |
| `utterances` | speech · letter · proverb · other | — | — | No file form exists for these. A speech has a recording and this app does not hold audio |

**A show needs a file per episode and the table above does not say so.** A dialogue
carries `season` and `episode`; a subtitle covers one episode. The row therefore
needs the episode in its key for a show, and the honest way is to **fold it into
`subject_key`** — empty for a film, `s01e04` for an episode — rather than add two
more columns that are null for everything else. The UNIQUE index already includes
`subject_key`, so this costs nothing beyond writing it.

**A `.lrc` is a subtitle format wearing a song's name** — timestamped lyric lines —
and it parses with the subtitle machinery, not the text machinery. It is listed
under `text` for the reader because that is what a song's source *is* to them; the
parser picks itself from the magic bytes as everywhere else. If it turns out to want
timestamps on a lyric quote, that is the subtitle path and it already exists.

**Nothing here is chosen by extension.** `importer.Detect` already answers `epub`;
it gains `srt`, `vtt`, `ass`, `lrc` and `txt` and the same function decides. The
`.ass.txt` the owner sent is the standing proof, and a rule that has already caught
a real file once is not a hypothetical.

---

## The doors

All four open the same two verbs. **The verbs live in `actions.jsx` and nowhere
else**, which is the repo's directive and also the file's own stated reason for
existing.

```js
// actions.jsx — actionsFor(kind, item, ctx)
{ id: 'sourceAdd',   where: ROW,      available: isWork && !!ctx.addSource }
{ id: 'sourceApply', where: ROW,      available: isWork && !!ctx.applySource && item.sourceState === 'file' }
{ id: 'sourcePrune', where: OVERFLOW, available: isWork && !!ctx.pruneSource  && item.sourceState === 'file' }
{ id: 'inContext',   where: ROW,      available: !isWork && !!ctx.inContext && !!item.hasContext }
```

**Each is absent, not disabled, when it would do nothing** — the owner's *"and
another to adjust as per it (when it is present)"*. The registry already expresses
absence through `available`, so this is four predicates and no new mechanism.

**One field carries it: `sourceState` ∈ `none | file | pruned`.** Not two booleans —
`hasSource` plus `isPruned` makes `{false, true}` a state nothing should be in, and
somebody eventually writes the branch that handles it. One `LEFT JOIN` on the work
query answers all three. Quotes carry `hasContext`, which is one `EXISTS` over
`source_context` or the work's live file.

**Prune sits in the overflow, not the row.** It is rare, it is destructive, and the
registry's own rule is that the destructive thing is never adjacent to something
that merely sets a field.

### 1 — the work-detail panel

Beside metadata fetch, which is its sibling: a file picker rather than a lookup.
**And this is where `WorkDetails.jsx` starts rendering from the registry** instead
of hand-rolling its row — otherwise door 1 and door 2 are two lists of the same two
buttons, which is exactly the drift `actions.jsx` was written to end. The row is
`flex flex-wrap` and wraps; with four controls, an `InfoDot`, a spacer and Delete it
is at the point where a `Scroller` becomes the right answer, and the standing rule
says which one.

### 2 — the work context menu

**Which does not exist yet.** `actionsFor` has carried `isWork` branches since it
was written and no screen has ever asked it for one work's actions. So door 2 is:
call `actionsFor('book' | 'movie', work, ctx)` from the work card, render `atRow`
and `atOverflow` the way Home and Library already do for a quote. The two source
actions arrive with it — and so do `fillGaps`, `practise` and `setShelf`, which have
been sitting in the registry unreachable from a single work. **That is a bigger win
than this feature and it should be said out loud rather than smuggled in**: the
builder is finishing the registry, and this plan is what finally calls it.

### 3 — Checks

The third section (`locators-from-files.md` designs it) also **offers the upload**,
because Checks is where a reader goes when the app is waiting on them, and "this
film has 30 quotes and no times" is exactly that. A work with quotes, no positions
and no source is a row there with an Add button.

### 4 — the work page, and the review card

The owner's: *"this option should also be in the book details, and reviews screen."*

Neither is new work, and that is the point of having put the verbs in the registry:

- **`WorkDetail.jsx`** — the work *screen*, as against `WorkDetails.jsx`'s editable
  panel. It renders `actionsFor` and the three source verbs arrive. Its header
  already states the rule this depends on: *"what differs is a row in `workKinds.js`
  — change one place, and every work page changes with it."* So the game exclusion
  is a row there and not a condition typed into a screen.
- **`review.jsx`** — the quiz card. It gets **In context** on the quote, which is
  where an out-of-context line is most jarring: the card shows you a sentence with no
  surroundings by design, and this is the way out of it.

**Prune from the review card acts on the work, not the card**, and this is the one
place a reader could reasonably get it wrong — you are looking at one quote and the
button throws away a file serving thirty. So it names the work and the count in the
confirmation, or it is not offered there at all. **Recommendation: offer it, named**
— the owner's *"prune the stack"* describes exactly the moment of going through
quotes and tidying behind yourself, and a verb that exists in three places and not
the fourth is the drift `actions.jsx` was written to end.

### 5 — the global import

The one drop target takes these too, and **asks which work** — the owner's, and it
is the one case where content genuinely cannot decide. A subtitle names no film
inside itself.

Two things this needs and does not have:

- **The `accept` filter has to widen or go** (see *What the verification changed*).
  Going is the better answer and is what the file's own comment already claims.
- **A route for "this file is not an import".** `Detect` answering `srt` or `epub`
  means *do not stage this* — it is a source, and the next question is which work.
  So the import answer grows a third outcome beside staged and unrecognised, and the
  screen asks rather than fails. `Detect` already answers `epub` today and the import
  can only refuse it, which is the shape of the gap.

**A source upload is not an import and never touches staging.** The staging
invariant is about rows entering the library; a file entering `Sources/` writes no
quote. Worth stating because door 4 goes through the import screen and the two would
otherwise look like one path.

---

## Context — what the stored file is for

> *"imagine a quote from a book, it may sound weird out of context. this feature
> will allow the user to jump right into the context, with a set amount of text
> before and after (or dialogues before and after) from the epub/srt."*

### The shape

One action on a quote — **In context** — available exactly when its work has a
source and the quote has been located in it. It opens a panel showing the quote in
place, with what came before and after, the quote itself marked.

**A panel, on the stack, like every other answer.** The standing rule: *a question
wears the same chrome as its answer.* It is opened from a quote card and from a
quote's detail, and it is **one component both call** — the registry again.

### The unit is the file's, not a number of characters

| Source | Before / after | Default |
| :-- | :-- | :-- |
| Subtitle | **Cues** | 5 each way |
| EPUB / text | **Paragraphs**, never a character count that cuts a word | 2 each way |

A character count would slice mid-sentence and read as damage. Paragraphs and cues
are the units the files themselves are made of, and both are cheap to count outward
from a known offset.

**One setting, two numbers, in the reading preferences beside the type dials.** The
owner asked for "a set amount", which is a number the reader sets once — not a
control on the panel, which would make every reader tune it on every quote.

### Where the work happens

**Server reads the span, client draws it.** `GET /quotes/{kind}/{id}/context`
answers `{before, body, after, unit, span}`. The file never leaves. This is the same
division the subtitle screen uses and for the same reason — one parser, in Go,
tested.

**And the endpoint has two backings, which is the hinge this whole plan turns on.**
It asks for a quote's context and does not care where it comes from:

1. **A `source_context` row**, if one was kept — answered as stored.
2. **The file**, if it is still there — opened, seeked, read outward, closed.
3. **Neither** — answered as absent, with *why*: pruned and added since, or never
   had a source at all. Two different sentences, because they have two different
   remedies.

One interface, two backings. Pruning swaps the backing and changes nothing above it
— no second endpoint, no branch in the panel, no "pruned mode". If the panel has to
know, the abstraction is in the wrong place.

**Nothing is extracted at upload and nothing is cached.** "For now, will not be read
fully" is honoured literally: an EPUB is opened, the one spine document holding the
position is parsed, the paragraphs around it are taken, and the zip is closed.
Reading one document of 52 is not reading the book.

**The risk this carries, named:** a stored position is a byte offset into an
extraction rule (`locators-from-files.md` freezes it for exactly this reason).
**Change the rule and every context jump lands in the wrong place** — silently,
because a paragraph of the same novel looks like a paragraph of the same novel. The
plan's answer is the golden test that pins the rule, plus a **fingerprint**: the row
records the `sha256` of the file the offset was computed against, and a context
request whose file no longer matches says so rather than drawing the wrong page.
That is what `sha256` is doing in the table above.

### What has no context, and says so once

- **A game.** No file, no context, no action in the menu.
- **A proverb, a speech, a letter.** Same.
- **A quote with a source but no position.** The action offers to find the position
  first — which is the locator run, arriving where the reader already is.

---

---

## The prune — keep the context, throw the file away

> *"add an option to parse the srt/ass/epub files and only keep the context text.
> this will save on space. but no context for new quotes (until the file is uploaded
> again). so user will keep it as long as they are actively adding new ones in the
> works, and then they just prune the stack."*

The reader's own lifecycle: the file is scaffolding. It earns its space while quotes
are still arriving, and once they stop it is 1.4 MB holding 50 KB of usefulness.

### What it saves — measured, not estimated

Both supplied files, against the quotes the owner actually keeps for them.

| | Raw file | Kept context | |
| :-- | --: | --: | :-- |
| *Dust of Dreams* (EPUB), 36 highlights, **2 paragraphs** either side | 1,455,315 B | **50,814 B** | **29× smaller** (3.5%) |
| …at 5 paragraphs either side | 1,455,315 B | 95,007 B | 15× smaller (6.5%) |
| *V for Vendetta* (SRT), 30 quotes, **5 cues** either side | 145,695 B | **11,410 B** | **12.8× smaller** (7.8%) |
| …at 10 cues either side | 145,695 B | 19,579 B | 7.4× smaller (13.4%) |

Extended over the owner's library — 27 books and 13 films — the source store goes
from roughly **41 MB to about 1.5 MB**. That is the number that settles the backup
question above, and it is why this option is worth building rather than worth
mentioning.

Three things the same measurement decided:

- **Do not build span dedupe.** Overlapping windows collapse 180 paragraphs to 178
  — **1%**. The owner's highlights are spread across a novel, not clustered, so a
  shared span pool is machinery bought for one percent. One row per quote.
- **A paragraph count alone is not enough of a floor.** Paragraphs in this novel
  average 155 characters but the **median is 91** — dialogue exchanges, a line each.
  Two either side of a short exchange is four short lines and reads as no context at
  all. So the cut is *"N paragraphs, or M characters, whichever gives more"*, and the
  character floor is what stops a fast exchange collapsing.
- **The subtitle case saves an order of magnitude less** (12.8× against 29×) and on
  a file a tenth the size. A reader pruning to save space is pruning ebooks; offering
  it for subtitles is consistency, not economy, and the screen should not oversell it.

### What the prune does

One pass, in one request, with no goroutine outliving it:

1. Read the stored file. For every located quote of that work, cut its window at the
   reader's current setting.
2. Write a `source_context` row per quote — `before`, `body`, `after`, and **`unit`
   and `span` recorded**, because the cut cannot be undone and the panel has to be
   able to say what it was.
3. Delete the bytes. Keep the `work_sources` row, empty its `path`, stamp
   `pruned_at`.

**A quote with no position is skipped and counted.** Pruning cannot invent a
location, so the confirmation says how many quotes will keep context and how many
will not — before the file is gone, which is the only moment that number is useful.

### The three things this costs, said before it is pressed

The confirmation names all three. A prune is not reversible from inside the app, so
a reader who did not understand it has lost something.

- **New quotes get no context.** The owner's own line. A quote added after the prune
  says *"no context — re-add the source"*, which names the remedy rather than
  showing an empty panel.
- **The window is frozen at the size it was cut at.** Prune at two paragraphs and
  later raise the setting to five, and the old works stay at two. The panel says so
  from `span`, rather than silently showing less than the setting promises.
- **The locator matcher loses its input for that work.** Re-running the match needs
  the file. Positions already applied are rows and survive; a new quote cannot be
  placed.

### Re-uploading, and why `sha256` is in the table

Re-adding the file restores everything: full context again, new quotes placeable,
the matcher runnable.

**If the hash matches** the pruned row's, it is the same file: the kept context is
still true, and the new upload simply supersedes it.

**If it does not match**, it is a different file — another edition, another release,
another cut — and the stored context was computed against text that is no longer
there. **The kept rows are then re-derived from the new file, not merged with it.**
Keeping both would mean one work whose context comes from two editions, with nothing
on screen to say which line came from which, and that is a worse failure than
re-doing the work.

### Pruning the stack

The owner's phrase is plural, so the operation is too.

- **One work** — from any surface that offers the verbs (below).
- **Everything** — a maintenance action listing each work with a raw source, its
  size, when a quote was last added to it, and what the prune would leave. Sorted by
  what it frees. *"Last added"* is the column that makes the decision: a work nobody
  has added to in six months is the one to prune, and that is the reader's judgement
  rather than a rule the app should apply on its own.

**Nothing prunes automatically.** No age threshold, no size trigger, no sweep. It
destroys something on the reader's behalf and the reader presses it.

---

## Guards

| Guard | What it needs |
| :-- | :-- |
| **No route serves a source file.** | The boundary this plan is allowed under. Assert no handler `ServeFile`s, streams or redirects to anything under `Sources/`; a route census in the test, not a code review |
| **A context answer is bounded.** | The span is the configured unit and cannot be widened by a parameter into "send me the book" |
| **The context endpoint answers the same shape from a file and from a pruned row.** | The hinge. One golden fixture read both ways, byte-identical answers |
| **A prune keeps context for every located quote and no others.** | Count in equals count out, and the skipped ones were the unlocated ones |
| **A prune deletes the bytes and keeps the row.** | `path` empty, `pruned_at` set, the file gone from disk, the name and `sha256` still readable |
| **A quote added after a prune says why it has no context.** | "Pruned, re-add the source" and "never had a source" are two different answers, not one empty panel |
| **The frozen window is reported, not implied.** | Prune at 2, raise the setting to 5, and the panel still says 2 for that work |
| **Re-upload of a different file re-derives rather than merges.** | A changed `sha256` discards the old rows. One work's context never comes from two editions |
| **Kept context is in the archive; raw files follow the setting.** | Both directions, since the default is the one nobody re-tests |
| **Nothing prunes on its own.** | No sweep, no age rule, no size trigger — assert no caller but the handler |
| **A second upload replaces the first, bytes included.** | Upload, upload again, assert one row, one file on disk, and the first path gone |
| **Deleting a work deletes its sources.** | Row and bytes. This is the bug covers have; it must not be inherited |
| **Another user's source is a 404.** | The standing invariant, on a new table |
| **The archive skips `Sources/` by default and takes it when the setting is on.** | Both directions, because the default is the one nobody will re-test |
| **A restore reports the sources it did not carry.** | Otherwise the loss is discovered by a dead button |
| **A game offers neither action.** | `media_type = 'game'` — absent, not disabled |
| **An utterance's source is keyed by the folded title.** | Two essays sharing a `work_title` share one file; two spellings do not accidentally |
| **A show's source is per episode.** | `subject_key` carries the episode; a film's is empty |
| **The picker has no extension filter.** | The `.ass.txt` case. A test over `ImportPage.jsx` that the input has no `accept`, since the file's comment already claims this and the code already broke it once |
| **Format comes from the bytes.** | `Detect` decides; renaming a file changes nothing |
| **A context request against a changed file refuses.** | The `sha256` fingerprint, or the offsets are quietly wrong |
| `go test ./...` | New migration, new table, and the staging mirror question answered (it needs no mirror — a source is not a staged row) |

---

## The order

1. **The table and the store.** 0073, `Sources/`, upload, replace, delete, the
   per-user 404, the caps. No UI. — a migration, `internal/httpapi/sources.go` (new)
2. **The backup decision.** The skip, the setting, the restore report. Small,
   isolated, and the thing that gets forgotten if it is left to last.
   — `backup_handlers.go`
3. **The registry, and the work context menu that has never existed.** The two
   actions into `actions.jsx`; `WorkDetails.jsx` rendering its row from the
   registry; the work card gaining `actionsFor`. Doors 1 and 2 together, because
   they are one entry. — `actions.jsx`, `WorkDetails.jsx`, `Library.jsx`,
   `Movies.jsx`
4. **Door 4.** Drop the `accept` filter, teach `Detect` the subtitle formats, add
   the "this is a source, which work?" outcome. — `ImportPage.jsx`,
   `internal/importer/detect.go`
5. **Door 3.** The Checks row for a work with quotes and no source — after
   `locators-from-files.md`'s section exists, since it lands in it.
6. **Context.** The endpoint behind its two-backing interface, the panel, the two
   settings, the fingerprint refusal. Write the interface first even though only one
   backing exists yet — retrofitting it after the panel has learned to read files is
   how the branch ends up in the panel.
   — `internal/httpapi/context.go` (new), the panel, `actions.jsx`
7. **The prune.** `source_context`, the per-work pass, the confirmation that counts
   what will and will not keep context, the frozen-window reporting, the re-upload
   rule. Then the library-wide list sorted by what it frees.
   — `internal/httpapi/prune.go` (new), maintenance
8. **The orphan sweep**, for sources and for covers, in maintenance.
9. **Help and infodots** — `en.txt` and `bn.txt`, which are a **frontend** change
   and force a `web/dist` rebuild in the same commit. The prune confirmation is the
   one that has to be written carefully: it destroys something.
10. **Docs** — `docs/PLAN.md` gains the **Reversal paragraph** quoted at the top of
   this file and an entry for the backup default; `CHANGELOG.md`; `DEVELOPMENT.md`'s
   file map for the new package; `docs/troubleshoot.md` for the new `TIP-*` code;
   `docs/ui-glossary.html` for the panel.

## Verification

```bash
go vet ./... && go test ./internal/httpapi/ -run 'Source|Context|Backup|Restore' -v
go test ./...
cd web/frontend && npm test
make frontend && make glossary && npm run glossary:check   # glossary AFTER frontend
node scripts/doc-map-check.mjs
```

By hand, against a restored backup rather than `seed.mjs`:

- Add a subtitle to a film from each of the four doors and confirm all four land in
  the same place with the same result.
- Add it twice and confirm the first file is gone from disk, not just from the row.
- Delete the film and confirm `Sources/` is empty.
- Take a backup with the setting off and with it on, and compare the sizes — the
  number this plan predicts is ~21 MB against ~60 MB on the owner's own library.
- Restore the small one and read what it says about the missing sources.
- Jump to context from a book quote and from a film quote, and check the amount
  reads as enough. **That judgement is the feature** and no test makes it. Do it
  again on a fast dialogue exchange, where the paragraph median is 91 characters and
  the character floor is what is being tested.
- Prune *Dust of Dreams* and compare the numbers against this plan's predictions:
  **1,455,315 B → ~50,814 B at two paragraphs**. A measured feature should be able
  to reproduce its own arithmetic.
- Add a quote to a pruned work and read what the panel says about it.
- Re-upload the same file, then a different one, and confirm the first restores and
  the second re-derives.
- Prune from the review card and confirm the confirmation names the work, not the
  quote you were looking at.
- Rename an `.srt` to `.txt` and add it. Then rename one to `.ass.txt`, which is how
  the owner's own sample arrived.

## Out of scope, named

- **A reader.** No rendering, no pagination for display, no bookmarks, no progress.
  The panel shows a span around a quote and has no next page.
- **Serving the file.** No download, no OPDS, no sync, no second device. This is the
  half of the reversed decision that does not move.
- **Fetching a file.** Sources are uploaded, never looked up. `internal/metadata/`
  keeps its monopoly because nothing here makes a call.
- **Audio and video.** A speech has a recording; this app does not hold one.
- **Versions or history.** A second upload replaces.
- **Un-pruning.** The file is gone; the only way back is to add it again. An app
  that offered to undo this would have to have kept the file.
- **Automatic pruning** on age, size or a schedule. It destroys something on the
  reader's behalf and no goroutine outlives its request anyway.
- **Span dedupe between overlapping windows** — measured at 1% on real data.
- **A per-user disk quota.**
- **DRM'd files of any kind** — refused at the header, by name.
- **Guessing the work from a filename**, at any door. Door 4 asks.
