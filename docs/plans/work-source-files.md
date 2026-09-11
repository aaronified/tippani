# Source files — a work keeps the file its quotes came from

A quote out of context can read as nonsense. The file it came from is the context,
and until now the app has never held one. This plan gives a work **one source file
per role** — a subtitle track for a film, an ebook for a book, a text for an essay
— and two things to do with it: find where each quote sits, and show what is around
it.

**Both answers are stored the moment the file is read**, and the file is never a
read path afterwards. A locator is a row and a context is a row, so a quote opens
its surroundings whether the file is still there or not. What the file is for is
**making** those rows — and re-making them, for quotes added since.

It arrives one of two ways: **uploaded**, or **found on a read-only mount** the
operator already keeps their library on. The second is the one that scales, and it
is the only one where re-making is free. When an uploaded file has done its job,
**it can be thrown away** — measured below at 29× smaller than keeping it, and
costing nothing that is already stored.

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
  -- WHERE THE BYTES ARE, and it means one of two things depending on `origin`:
  -- a stored filename under Sources/ (like a cover or a font), or a path RELATIVE
  -- to a configured mount root. Never an absolute path, so re-pointing a mount at
  -- a moved library is a settings change and not a migration.
  path       TEXT    NOT NULL,
  -- upload | mount. A mounted file is never copied, so a prune has nothing of ours
  -- to delete -- see "A mounted source can still be pruned".
  origin     TEXT    NOT NULL DEFAULT 'upload',
  -- Which mount, when origin = mount. A box may have books and films on different
  -- disks, and one going away must not take the other's rows with it.
  mount_id   TEXT    NOT NULL DEFAULT '',
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
  -- WHAT WAS STORED. `unit` is paragraph | cue; the stored pair is how many were
  -- kept, at the global CEILING rather than at anyone's preference -- see "store
  -- wide, render narrow". The panel renders the effective pair out of these, so
  -- narrowing never needs the file back.
  unit          TEXT    NOT NULL,
  stored_before INTEGER NOT NULL,
  stored_after  INTEGER NOT NULL,
  -- THIS QUOTE'S OWN ADJUSTMENT, and NULL is not 0. NULL means "inherit from the
  -- board or work, then the global"; 0 means "nothing, deliberately" -- the owner's
  -- chapter-start case. Independently nullable, so "nothing before, inherit after"
  -- is expressible, which is that case verbatim.
  want_before   INTEGER,
  want_after    INTEGER,
  -- WHERE THE SPAN RAN OUT RATHER THAN STOPPED. Set when extraction hit a chapter
  -- edge or a long silence instead of reaching the ceiling, so the panel can say a
  -- span is short because the work is, not because the app is.
  bound_before  INTEGER NOT NULL DEFAULT 0,
  bound_after   INTEGER NOT NULL DEFAULT 0,
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
{ id: 'sourceApply', where: ROW,      available: isWork && !!ctx.applySource && readable(item) }
{ id: 'sourcePrune', where: OVERFLOW, available: isWork && !!ctx.pruneSource  && item.sourceState === 'file' }
{ id: 'inContext',   where: ROW,      available: !isWork && !!ctx.inContext && !!item.hasContext }
```

**Each is absent, not disabled, when it would do nothing** — the owner's *"and
another to adjust as per it (when it is present)"*. The registry already expresses
absence through `available`, so this is four predicates and no new mechanism.

**One field carries it: `sourceState` ∈ `none | file | mounted | pruned | missing`.**
Not booleans — `hasSource` plus `isPruned` makes `{false, true}` a state nothing
should be in, and somebody eventually writes the branch that handles it. One
`LEFT JOIN` on the work query answers all of them, and `readable(item)` is
`sourceState === 'file' || sourceState === 'mounted'` — the two states where bytes
can still be read, which is what running the matcher or a rescan needs.

**Pruning needs `file` specifically**, not `readable`: a mounted file has no bytes of
ours to remove, so the action is absent there. See the mount door.

**Quotes carry `hasContext`, and it is one `EXISTS` over `source_context` — nothing
else.** Not "a row or a readable file": the row *is* the context, so a quote with a
row has context whether or not any file survives, and a quote without one does not
have context however many files are lying about.

**`missing` is the state a mount makes necessary.** A stored file is there or the
app has a bug; a mounted one is there or the disk is not. So the work query stats
the path, and a work whose mount has gone says *"the file is not where it was"* —
which names the remedy — rather than *"no source"*, which does not.

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

### 5 — a read-only mount

> *"or, the user may mount the book and song and the movie folders (strictly ro
> mode), and the app will check the files and update all (via the checks screen).
> that can be one easy route!"*

It is the easy route, and it is the one that scales: a reader with three hundred
books does not upload three hundred times. **A mounted file is never copied.** The
row points at a path inside the mount, `Sources/` stays empty for it, and both
locators and context read through.

This is a fifth door onto the same store, not a second system.

#### It is read-only twice, and only one of those is the app's promise

- **The mount.** `docker-compose.yml` already carries the idiom, including an
  opt-in mount annotated with its own risk (the Docker socket). A library mount
  is `- /srv/books:/library/books:ro`, and the `:ro` is **the operator's**
  guarantee, not the app's.
- **The app.** Every open is `O_RDONLY`. Nothing under a mount is written,
  renamed, moved or deleted, ever, including by the prune — which has no bytes of
  its own to remove there. **A guard asserts it**, because "we only read" is the
  kind of promise a later convenience feature quietly breaks.

#### The security surface, which is new to this codebase

**Nothing in this app reads a filesystem path a user supplied.** Every path today
is derived from `DataDir` or is internal — a mount is the first, and that deserves
saying rather than discovering.

- **Admin only.** Mounts are configured by an administrator, through the
  `requireAdmin` + global-`settings` pattern the metadata API keys already use.
  `settings` is a key-value table with **no `user_id`**, which is right here — a
  mount is a property of the box, not of a reader — and the consequence must be
  stated: **every user's scan sees the same mount.** Files on it are the operator's,
  not another reader's rows, so this does not breach per-user isolation; the
  *proposals* it produces are per-user like everything else.
- **The configured root is resolved once and every candidate path must stay under
  it** after `filepath.EvalSymlinks`. A symlink out of the mount is the obvious
  escape and the check is cheap.
- **Regular files only.** No devices, no FIFOs, no sockets — a `Stat` per candidate,
  and anything else is skipped and counted.
- **No path from the client, ever.** The reader picks a work, not a path. No request
  carries a filename, so there is no traversal to defend: the scan walks and the
  client chooses from what it found.

#### Scanning without a goroutine

**This is the hard constraint and it has to be led with.** The invariant is
absolute — *no goroutine outlives its request; no worker pool, ticker or
scheduler* — and a folder scan is the shape that most wants one.

**The repo has already answered this once, and the answer is Cleanup's.** Its scan
is on demand, capped at 500 findings, and returns `truncated` with the reason
written down: *"a silently truncated list is indistinguishable from a clean
library."* The mount scan is the same shape:

1. The reader presses **Scan** — it is never automatic, never on boot, never timed.
2. The walk runs **inside the request**, bounded by a file cap and a wall-clock
   budget, whichever comes first.
3. It answers what it found, **`truncated`, and a cursor** — the path it stopped
   at. Pressing Continue resumes from there.

So a large library is several presses rather than one background job, and the
reader can see it working instead of wondering. **The cost is honest** and should
be in the plan rather than discovered: identifying one EPUB is **5 ms measured**
(below), so a thousand-book shelf is about five seconds of walking — one press,
not several. A cap exists for the pathological folder, not the ordinary one.

#### Identifying a file without its filename — and books need no exception

The standing rule is that content decides. For an EPUB it holds completely, and
cheaply. Measured on the supplied file:

> Reading the zip's central directory, `META-INF/container.xml` and the OPF —
> **10,258 bytes of a 1,455,315-byte file, in 5.0 ms** — yields
> `title: "Dust of Dreams: The Malazan Book of the Fallen 9"`,
> `creator: "Steven Erikson"`, and identifiers including
> **ISBN `9781409091530`** and **ASIN `B003QXMYUC`**.

`books` has carried `isbn` and `asin` since 0001. So:

1. **ISBN or ASIN match — exact, and no fuzz at all.** Where both sides have one,
   this is not a guess and is accepted without a proposal's usual hedging.
2. **Folded title + creator**, otherwise — and this is where it is genuinely fuzzy,
   because the file says *"Dust of Dreams: The Malazan Book of the Fallen 9"* and
   the library says *"Dust of Dreams"*. A proposal, not an assumption.
3. **No match** — the file is listed as unclaimed, and the reader can attach it to a
   work by hand. The scan never creates a work.

**Subtitles are the exception and it is a real one.** An SRT contains no title, no
year and no identifier — the owner's own file opens with an advertisement. So a
film's subtitle is identified by **the folder it sits in and the video file beside
it**, which is depending on a name. That is a departure from the standing rule and
the plan states it as one rather than pretending otherwise: *there is nothing inside
the file to read.* The layout it expects is the one every media server already
assumes — `Movie Title (Year)/…` — and where the guess is wrong, the reader
reassigns it. Songs are the same: an `.lrc` names nothing, so its filename and
folder are all there is.

**A show is per episode**, so `S01E04` in the name is part of the same
name-based reading, and `subject_key` already carries the episode.

#### What lands in Checks

Everything, and that is the owner's *"update all (via the checks screen)"*. The scan
writes no source rows on its own — it proposes them, in the same section, under the
same durable-refusal rule as everything else:

- **Attach** this file to this work (exact identifier matches grouped for accept-all,
  fuzzy ones one press each — the split *Approving* already draws).
- **Then the locators**, because attaching a subtitle to a film whose lines have no
  times is a proposal waiting to be made. One scan, two kinds of row.
- **Refused once, not offered again** — `cleanup_ignores`' key shape, hashed over the
  path and the work, so declining to attach a file stays declined through rescans.

#### A mounted source is never pruned, and an earlier draft of this was wrong

This section previously argued that pruning a mounted file was worth doing because
it *"makes the context survive the mount going away."* **That reasoning is gone.**
Context is extracted and stored the moment a file is attached (*Context*, below), so
it already survives the mount going away — pruning adds nothing.

And there is nothing to delete: the bytes are the operator's, on their disk, and the
app does not write there. So **prune is simply absent for a mounted source**, the
way it is absent for a work with no file at all. `sourceState` already distinguishes
`mounted` from `file`, so this is a predicate on an action that already exists
rather than a new rule.

What a mount gives instead is the thing prune has to give up: **rescan is free and
repeatable.** New quotes get context on the next press, the window can be widened by
changing the setting and scanning again, and the locator matcher always has its
input. That is the case for mounting rather than uploading, and it is stronger than
any space argument.

### 6 — the global import

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
| Subtitle | **Cues** | 5 before, 5 after |
| EPUB / text | **Paragraphs**, never a character count that cuts a word | 2 before, 2 after |

A character count would slice mid-sentence and read as damage. Paragraphs and cues
are the units the files themselves are made of, and both are cheap to count outward
from a known offset.

**Before and after are two numbers, never one.** The owner's example is exactly the
asymmetric case — *"an annotation may be the first in the chapter, so it needs
nothing before it"* — so a single "amount" cannot express what this feature is for.
Every tier below carries a pair.

**Every edge lands on a line start and a line end.** The owner's, and it is a hard
rule rather than a preference: a span that begins mid-sentence reads as damage even
when the text is right. With paragraphs and cues as the units this is automatic —
both *are* line boundaries. Where it bites is the **character floor** from *The
prune* (`N paragraphs, or M characters, whichever gives more`, which exists because
this novel's paragraphs run to a 91-character median): the floor **rounds outward to
the next boundary** and never cuts at the character it reached.

### Where the work happens — **the context is stored, and that is the whole design**

> *"the context will be stored in the app, and locators too. the scans will reapply
> context in new quotes. that's all."*

`GET /quotes/{kind}/{id}/context` reads **one `source_context` row** and answers
`{before, body, after, unit, span}`. It opens no file. There is no second backing,
no fallback path, no branch.

**An earlier draft of this plan had two backings — a stored row or the live file —
and called it the hinge. It is withdrawn, and the simpler shape is better on every
axis it was supposed to win on.**

| | Two backings | Stored only |
| :-- | :-- | :-- |
| Read path | Row, or open a zip and seek | **One indexed row** |
| Works when the file is gone | Only if pruned first | **Always** |
| Works when a mount is unplugged | No | **Yes** |
| In the backup | Only the pruned half | **All of it**, it is rows |
| Code | An interface, two implementations, a fallback order | A `SELECT` |

The file is not a read path. It is **where context comes from once**, and there are
exactly three moments it is read:

1. **On attach** — a file uploaded, or a scan matching one on a mount. Every located
   quote gets its row then.
2. **On rescan** — new quotes since get theirs. This is the owner's *"the scans will
   reapply context in new quotes"*, and it is the only refresh there is.
3. **On a locator run**, which is reading the same file for the same reason.

**So extraction moved to attach time, and this reverses another line of the earlier
draft** — *"nothing is extracted at upload"*. It is now: at attach, the spine
documents holding matched quotes are parsed, the spans around each are taken, and
the zip is closed. Still not reading the book — the supplied EPUB's 36 highlights
touch a fraction of its 52 documents — but no longer deferred, because deferring it
was only ever in service of the second backing that is now gone.

**Widening the window is a rescan, and that is the honest cost.** A stored span is
cut at the size the setting had when it was cut. Raise the setting and the old rows
keep their old width until something reads the file again — which the reader can do
deliberately, and which the panel reports from the stored pair rather than
implying. On a
mount that is one press; on an upload it means adding the file again.

**The risk this carries, named:** a stored position is a byte offset into an
extraction rule (`locators-from-files.md` freezes it for exactly this reason).
**Change the rule and every re-extraction lands in the wrong place** — silently,
because a paragraph of the same novel looks like a paragraph of the same novel.
Already-stored rows are unaffected, which is a quiet virtue of storing them: they
are text, not offsets, and they cannot rot. What needs the guard is the *next*
extraction, so the golden test pins the rule and `sha256` records which file a row
came from — so a rescan against a different edition is recognised rather than
merged.

### How much context — three tiers, and a boundary that beats all of them

> *"users should be able to adjust context size for each annotation… the global rule
> will be overridden by board/work rules, which in turn will be overridden by
> annotation level adjustments."*

#### First: the boundary, because it answers the owner's own example structurally

*"An annotation may be the first in the chapter, so it needs nothing before it."*

**That one needs no setting at all.** A chapter start has nothing before it *in the
chapter*, and the extractor must not cross out of one — so the answer is a hard stop
in the extractor, not a number the reader has to discover and type. Measured on the
supplied files:

| | Boundary | Measured |
| :-- | :-- | :-- |
| EPUB | **The spine document**, refined by an NCX/nav point where one falls inside it | 52 spine documents, **median 400 paragraphs** each (max 905); **41 NCX navPoints**. So a 2-paragraph window almost never meets a boundary — it meets one exactly at the chapter edges, which is where it matters |
| Subtitle | **A long silence** — and this is weaker, stated as weaker | Gaps between cues: median **0.00 s**, p90 2.64 s, p95 6.51 s, p99 21.69 s, max **476.9 s**. A 30 s threshold stops **9 times** in the whole film; 20 s stops 22 |

**A subtitle has no chapter and the app must not pretend otherwise.** Nine stops in
a two-hour film is not scene detection — a film has a hundred scenes. It is an
absurdity stop: it prevents context reaching back across eight minutes of silence
into an unrelated sequence. Called what it is (*a long silence*), defaulted at 30 s,
and never described to the reader as a scene break.

So the tiers below express *want*; the boundary expresses *possible*, and the
boundary wins. A span that hits one is shorter than asked for, and the panel says so
rather than looking broken.

#### Then: store wide, render narrow

**This is the move that makes the rest cheap.** Extraction stores the span at a
generous **ceiling** — one global number, not the reader's preference — and the
panel renders the *effective* limit out of it.

- **Narrowing is instant and needs no file**, at any tier, forever. It is a
  `SELECT` and a trim.
- **Widening is free up to the ceiling**, for the same reason.
- **Only exceeding the ceiling needs the file** back, and a rescan.

The cost is storage, and the measurement says it is not a cost: at 5 paragraphs
either side the owner's book stores 95,007 bytes against 50,814 at 2 — still **15×
smaller than the 1.45 MB file**. So the ceiling is set generously once (recommend 10
paragraphs / 15 cues) and the three tiers become arithmetic rather than I/O.

**The ceiling is the one setting with a real bill**: raising it means re-extracting
every work that has a file and leaves pruned works behind at their old width. It
belongs with the maintenance operations, not beside the type dials.

#### The cascade

| Tier | Where it lives | Applies to |
| :-- | :-- | :-- |
| **Global** | one `settings` pair | everything |
| **Board or work** | `boards` for utterances; `books` / `movies` for the rest | the quotes under it |
| **The quote itself** | `source_context` | one |

**The middle tier is one tier with two names, and the tree is why.** `board_id`
exists **only on `utterances`** (0036) — annotations and dialogues have no board at
all, so the owner's own example, an *annotation*, cascades global → **work** →
annotation. Utterances have no work row (`work_title` is free text), so they cascade
global → **board** → utterance. The two are mutually exclusive in practice, which
makes "board/work rule" one concept rather than two competing ones.

**And there is no ambiguity to resolve**, because 0036 already refused the thing
that would have caused it: *"One board per quote. Many-to-many was considered and
refused."* A quote has at most one middle tier. Tags are many-to-many and are
therefore **not** a tier — a quote with four tags carrying four rules is the problem
0036 avoided, and this plan does not reintroduce it.

**`NULL` means inherit and `0` means nothing.** Two different facts that a single
integer conflates, and conflating them is how *"this annotation needs nothing
before it"* becomes indistinguishable from *"nobody has said"*. Both halves of the
pair are independently nullable, so "nothing before, inherit after" is expressible —
and that is the owner's example verbatim.

**Every override carries a way back.** A *Reset to inherited* on each tier, because
an override system without one leaves the reader holding a number they cannot
remember choosing.

**The panel says where the effective number came from, once.** One short line — *"2
before, 5 after · from this work"* — and not a sentence per tier. The standing rule
is that a row says a thing once.

#### Changing a board or work rule: the prompt, and why it only clamps down

> *"any change to the board/work rule will ask whether the rule should be enforced
> on existing quotes (always as a higher limit, never increasing it so a chapter
> start annotation doesnt suddenly has text from previous chapter)."*

A new rule applies to quotes added afterwards without asking. For quotes that
already exist, the change offers to enforce, and **enforcement is a clamp and never
an expansion**:

- A quote whose effective span is **wider** than the new rule is brought down to it.
- A quote whose effective span is **narrower** is left alone — whether it is narrow
  because the reader set it so, or because it sits against a chapter boundary. Both
  are deliberate and neither should be undone by a number typed at the work level.

**So the work rule behaves as a ceiling on its quotes, not as an assignment to
them.** That is the owner's *"always as a higher limit, never increasing it"* read
as a mechanism: the rule sets the most a quote may show, and each quote keeps
whatever it already shows below that.

The consequence to state rather than discover: **raising a work rule changes
nothing about existing quotes.** It only widens what they *may* be raised to, one at
a time. A reader who wants everything wider has to say so per quote, or clear the
overrides — and the prompt should offer *"clear the per-quote adjustments on this
work"* as the explicit second option, because it is the only thing that makes a
raise take effect and it is destructive enough to need naming.

#### Show more, for this read only

Most of the time a reader does not want to change a policy; they want more text
right now. Since the span is stored to the ceiling, **the panel can extend in place**
— a press that reveals more of what is already there, up to the ceiling or the
boundary, whichever comes first, and forgets it on close.

That keeps the *settings* for what should stick and stops the cascade being fiddled
with to answer a one-off question. It is also free: no file, no request beyond the
one already made.

#### What a rescan may and may not touch

**A rescan never clobbers an override.** It fills context for quotes that have none
and re-extracts spans whose file changed; a per-quote adjustment is the reader's
judgement and a scan is a mechanical pass. The guard is explicit because the
tempting implementation — delete the work's rows and re-derive — destroys exactly
this.

#### Bulk

Context limits are per-quote fields, so they belong in the **shared field table**
`docs/plans/bulk-editors-one-field-table.md` designs rather than in a control of
their own. Narrowing forty quotes at once is then the bulk editor doing what it
already does, and this plan adds two fields to a list instead of a screen.

---

## Correcting the quote from the file — a fourth Cleanup family

> *"the context and matching may be used to correct issues in the annotations (in
> the checks screen)."*

Once a quote is matched, the file holds **the same words as somebody else typed
them**. Where the two disagree, one of them is wrong — and which one is the question
this section is careful about.

### The measurement first, because it decides the whole design

Thirty stored lines of *V for Vendetta* against its own subtitle:

| | |
| --: | :-- |
| **12** | identical after the fold — nothing to say |
| **18** | differ |

And of those eighteen, what a corrector would want to do:

| | |
| --: | :-- |
| **13** | same character set, similar length — **a real wording difference**, and a question |
| **3** | the quote carries join ellipses the file does not — safe to trim |
| **1** | the file is longer; the quote looks truncated — safe to extend |
| **1** | **the file has fewer accented characters than the quote** — must be refused |

**That last row is the whole point.** The subtitle contains **zero** non-ASCII
characters in 145,695 bytes; the stored quotes contain two. This is the
`Voilà` → `Voil ` damage measured earlier, and it is not hypothetical: **in a
thirty-quote sample, a corrector that trusted the file would have destroyed one
correctly-accented line.** Across a library that is a steady trickle of silent
damage, dressed as tidying.

So: **4 of 18 are safely proposable, 1 must be refused outright, and 13 are
questions.** This is a question-asking feature and not a fixing one — which is what
Cleanup's own preamble already decided, and this family inherits it word for word:

> **THIS FINDS AND NEVER FIXES, and that is the whole design rather than a first
> step.** Every rule below has a false positive that is somebody's real text… An
> automatic pass would edit the reader's own words on the strength of a guess,
> silently, in a library whose whole point is that the words are theirs.

**And it extends it, because an extrinsic rule's false positive is worse.** An
intrinsic rule's mistake flags text that was fine. This family's mistake *overwrites
good text with a worse version of itself* — the guess arrives with a whole file
behind it, which makes it look like evidence.

### The rule, stated so it can be tested

**A correction may add information or remove a known artefact. It may never leave
the text poorer than it found it.**

| Class | Direction | Proposed? |
| :-- | :-- | :-- |
| Quote is a prefix of the file's line (Kindle-clipping truncation) | adds | **Yes** |
| Join ellipses at an edge — measured at 274 opening and 290 closing cues in this one file | removes an artefact | **Yes** |
| Whitespace, line-break and soft-hyphen damage | removes an artefact | **Yes** |
| Speaker's `NAME:` prefix inside the quote | removes an artefact, and **fills** `character` | Yes — a fill, never an overwrite |
| The file has characters the quote lacks (accents, a dash, typography) | adds | Yes |
| **The quote has characters the file lacks** | **subtracts** | **Refused — never offered** |
| Same charset, similar length, different words | neither | **A question**, with both texts shown and no default |
| The locator | adds | That is `locators-from-files.md`, not this |

**The charset test is cheap and does the heavy lifting**: count the characters
outside ASCII on each side. A file poorer than the quote is a degraded file, and the
whole of it becomes untrusted for character-level corrections — structural ones
(truncation, joins, whitespace) still stand, because those do not depend on the
file's encoding being intact.

### It needs no file, and that is the stored context paying off again

`source_context.body` already holds **the file's own words for the span** — the
schema comment says so, and the reason given there was that *"a quote they tidied and
the line as published are both worth seeing."* That is the second string this family
needs. So corrections are proposable from the database alone: on a pruned work, on an
unplugged mount, forever.

### Where it does not fit, and the sibling type

`cleanupRule` is `{ID string; find func(string) [][]int}` — **a pure function over
one string**, and the file explains why: *"They are the part worth testing, and
testing them through a database and an HTTP handler would make the interesting cases
… expensive to write and easy to leave out."*

An extrinsic rule needs **two** strings. So it gets a sibling type rather than a
distorted `cleanupRule`:

```go
// contextRule compares what the reader kept against what the file says, and is
// pure over the pair for the same reason cleanupRule is pure over one string.
type contextRule struct {
	ID   string
	find func(stored, published string) []contextFinding
}
```

Everything downstream is unchanged: the finding shape, the accept/ignore pair, the
`stale` answer, and **`cleanup_ignores` needs no migration** — its key already
carries `rule`, so new rule IDs slot into the existing refusal table and a declined
correction stays declined through rescans.

### A quote the reader has edited is treated differently

`utterances`/`annotations`/`dialogues` all carry `updated_at`, and `source` records
where a row came from. A quote edited since it arrived has been *deliberately*
worded — the reader may have fixed the publisher's own typo — so a file-based
correction to it is the most likely false positive in the family.

Such a row is still shown, but **as a question rather than a proposal**, and it says
that the reader changed this text themselves. It never joins an accept-all group.

### And one finding is about the file, not the quote

If most of a work's quotes differ widely, the attached file is the wrong thing — a
different cut, a different edition, a different translation. That is **one work-level
row** saying so, not forty per-quote rows saying it forty times. It reuses the
offset-detection reasoning from `locators-from-files.md`: a consistent discrepancy
across matches is evidence about the file.

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
   and the stored pair recorded**, because the cut cannot be undone and the panel
   able to say what it was.
3. Delete the bytes. Keep the `work_sources` row, empty its `path`, stamp
   `pruned_at`.

**A quote with no position is skipped and counted.** Pruning cannot invent a
location, so the confirmation says how many quotes will keep context and how many
will not — before the file is gone, which is the only moment that number is useful.

### What it costs, said before it is pressed

**Much less than the earlier draft of this plan claimed, and the reason is that
context is stored.** Every quote that had context keeps it — the rows are the read
path, and throwing the file away does not touch them. What is lost is the ability to
*make new rows*:

- **A quote added later gets no context** until the file comes back. The owner's own
  line. It says *"no context — re-add the source"*, which names the remedy rather
  than showing an empty panel.
- **The window cannot be widened** for that work. Raising the setting needs a
  re-extraction and re-extraction needs the file.
- **The locator matcher loses its input.** Positions already applied are rows and
  survive; a new quote cannot be placed.

All three are the same sentence — *nothing new can be derived* — and the
confirmation should say it once rather than three times. A prune is not reversible
from inside the app, but it is **recoverable**: add the file again and everything
resumes, which is a materially smaller warning than the one this section used to
carry.

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
| **The context endpoint opens no file.** | The whole design in one assertion: a request served while the source file is deleted and the mount unplugged still answers. A file-open census inside the handler |
| **A rescan fills in quotes added since and leaves the rest alone.** | The owner's "reapply context in new quotes". Attach, add two quotes, rescan: two new rows, the others untouched |
| **A rescan never clobbers a per-quote adjustment.** | The tempting implementation — delete the work's rows and re-derive — destroys exactly this. `want_before`/`want_after` survive |
| **`NULL` and `0` are different answers.** | Inherit against deliberately-nothing. A quote set to 0 before stays at 0 when the work rule rises |
| **Enforcing a work rule clamps and never expands.** | The owner's rule. Quotes wider than the new rule come down; narrower ones — set or bounded — are untouched |
| **Extraction never crosses a chapter edge or a long silence.** | Measured: 52 spine documents at a 400-paragraph median, and 9 gaps over 30 s in the film. A quote at a chapter start gets nothing before it without anyone configuring that |
| **A bounded span is reported as bounded.** | `bound_before`/`bound_after`, so short-because-the-work-is never reads as short-because-broken |
| **Every edge is a line start and a line end.** | Including when the character floor decides the width — it rounds outward, never cuts |
| **A correction is never proposed that makes the text poorer.** | The measured case: the supplied subtitle has 0 non-ASCII characters against the quotes' 2, so a quote with an accent the file lacks must produce **no** row. One in thirty in the real library — the fixture is that quote |
| **A poorer file loses only its character-level rules.** | Truncation, joins and whitespace still fire on an ASCII-degraded file; spelling and typography do not |
| **A wording difference has no default.** | Both texts shown, neither pre-selected, never in an accept-all group. 13 of 18 differences are this |
| **A reader-edited quote is a question, not a proposal.** | `updated_at` past its arrival. It never joins an accept-all group |
| **A `NAME:` prefix fills `character` and never overwrites it.** | A fill is safe; an overwrite is somebody's correction being undone |
| **A wrong-file work produces one row, not forty.** | Wide discrepancy across most matches is evidence about the file |
| **Correction rules are pure over the pair.** | `contextRule` tested without a database or a handler, for the reason `cleanupRule` is |
| **A declined correction stays declined.** | New `rule` IDs in the existing `cleanup_ignores` key — no migration |
| **A rescan against a different file is recognised, not merged.** | The `sha256` on the row. One work's context never comes from two editions |
| **A prune keeps context for every located quote and no others.** | Count in equals count out, and the skipped ones were the unlocated ones |
| **A prune deletes the bytes and keeps the row.** | `path` empty, `pruned_at` set, the file gone from disk, the name and `sha256` still readable |
| **A quote added after a prune says why it has no context.** | "Pruned, re-add the source" and "never had a source" are two different answers, not one empty panel |
| **The frozen window is reported, not implied.** | Extract at 2, raise the setting to 5, and the panel still says 2 until something re-extracts |
| **Prune is absent for a mounted source.** | There are no bytes of ours to remove, and the context is already stored. Not disabled — absent |
| **Re-upload of a different file re-derives rather than merges.** | A changed `sha256` discards the old rows. One work's context never comes from two editions |
| **Kept context is in the archive; raw files follow the setting.** | Both directions, since the default is the one nobody re-tests |
| **Nothing prunes on its own.** | No sweep, no age rule, no size trigger — assert no caller but the handler |
| **Nothing under a mount is ever opened for writing.** | The promise the app makes, as against the one `:ro` makes. Assert every open under a mount root is `O_RDONLY`, and that no delete, rename or create path can reach one — a mounted prune removes rows, never bytes |
| **A path outside the mount root is refused.** | After `EvalSymlinks`. A symlink pointing out is the escape, and the fixture is a symlink |
| **Only regular files are read.** | Devices, FIFOs and sockets are skipped and counted, never opened |
| **No request carries a path.** | The client names a work, never a filename. A route census, because this is the property that makes traversal unreachable rather than defended |
| **Mount config is admin-only.** | A non-admin `PUT` is refused, like the metadata keys it copies |
| **The scan is bounded and resumable.** | A folder past the cap answers `truncated` with a cursor, and Continue from that cursor covers the rest exactly once — no gap, no repeat |
| **No goroutine outlives the scan request.** | The invariant, on the feature most likely to break it. Assert goroutine count before and after |
| **An identifier match is exact and a title match is not.** | An ISBN hit attaches without hedging; a folded-title hit is a proposal. The supplied EPUB is the fixture — its title carries "The Malazan Book of the Fallen 9" and the library's does not |
| **A vanished mount reads as `missing`, not `none`.** | Different sentence, different remedy |
| **A refused attachment is not offered again.** | `cleanup_ignores`' key shape, hashed over path and work |
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
6. **Extraction and context.** `source_context`, filled at attach; the endpoint that
   reads one row and opens nothing; the panel; the cascade; the boundary stops; the
   stored-pair reporting. **This is the step the plan turns on** — everything after it either
   adds a way to fill the table or a way to refill it.
   — `internal/httpapi/context.go` (new), the panel, `actions.jsx`
7. **The cascade's middle and top tiers** — the work/board rule pair, the enforce
   prompt that clamps and never expands, *Reset to inherited*, and the two fields
   into the shared bulk table. The per-quote pair and the boundary stops came with
   step 6; this is what sits above them. — `actions.jsx`, the work and board forms,
   `bulkOps.jsx`
8. **The prune**, which is now small: delete the bytes, empty `path`, stamp
   `pruned_at`, and one confirmation saying nothing new can be derived until the file
   returns. Then the library-wide list sorted by what it frees. Absent for mounted
   sources. — `internal/httpapi/prune.go` (new), maintenance
9. **The correction family.** `contextRule` as a sibling of `cleanupRule`, the
   direction-of-information rule and its charset test first, then the safe classes,
   then the question class. A third section on Checks in Cleanup's mould — or a
   fourth family inside Cleanup's own, which is the better answer if its section can
   carry the pair view. **Build the refusal before the proposals**: the destructive
   case is measured and real. — `internal/httpapi/cleanup_context.go` (new),
   `CleanupPage.jsx`
10. **The mount.** Admin settings for the roots, the `O_RDONLY` and containment
   guards first and the walk second, EPUB identification by ISBN/ASIN then title,
   the bounded resumable scan, the name-based reading for subtitles and lyrics, and
   the attach proposals into Checks. **Take the guards before the feature** — this is
   the first path in the codebase that a user chose, and the tests are what make the
   rest of it boring. — `internal/mount/` (new), `internal/httpapi/mount.go` (new),
   `docker-compose.yml`
11. **The orphan sweep**, for sources and for covers, in maintenance.
12. **Help and infodots** — `en.txt` and `bn.txt`, which are a **frontend** change
   and force a `web/dist` rebuild in the same commit. The prune confirmation is the
   one that has to be written carefully: it destroys something.
13. **Docs** — `docs/PLAN.md` gains the **Reversal paragraph** quoted at the top of
   this file and an entry for the backup default; `CHANGELOG.md`; `DEVELOPMENT.md`'s
   file map for the new packages; `docs/troubleshoot.md` for the new `TIP-*` codes;
   `docs/ui-glossary.html` for the panel; and **`docker-compose.yml` gains the
   commented `:ro` library mount** beside the two opt-ins it already documents,
   which is where most readers will meet this feature at all.

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
- Add a quote to a pruned work and read what the panel says about it — then confirm
  every *older* quote on that work still opens its context, because the rows are the
  read path and the file was never one.
- Re-upload the same file, then a different one, and confirm the first fills in the
  gaps and the second is recognised as a different edition.
- Narrow one annotation to nothing-before and confirm it stays there when the work
  rule is raised and enforced.
- Run the corrections over *V for Vendetta* and check the numbers against this
  plan's: **18 of 30 differ, 13 of them questions, and the accented line refused.**
  If the accented quote appears as a proposal, the direction rule is not wired.
- Open the context of a quote that sits at a chapter start and confirm it shows
  nothing before it **without anyone having configured that**, and says why.
- Raise the global ceiling and confirm it is the one change that needs the files
  back — and that pruned works are reported as left behind rather than silently
  narrower.
- Prune from the review card and confirm the confirmation names the work, not the
  quote you were looking at.
- Mount a folder `:ro`, scan, and read the proposals. Then mount one containing a
  symlink pointing outside it and confirm the walk refuses rather than follows.
- Scan a folder past the cap and press Continue; confirm the second pass covers the
  rest exactly once.
- Unmount the volume and reopen a work that used it. **Every stored context must
  still open** — that is the design's central claim. What must change is only the
  offer to scan, which says the file is not where it was rather than that there is
  no source.
- Remount read-write and confirm the app still never writes: the `:ro` is the
  operator's promise and this checks ours.
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
- **Correcting anything automatically.** Cleanup's doctrine, and this family has the
  stronger reason for it: its mistakes overwrite good text with a whole file standing
  behind the guess.
- **Correcting the file.** It is the reader's or the operator's, and on a mount the
  app does not write there at all.
- **Lyrics embedded in an MP3.** The owner's: *"lrc embedded in mp3 will not be
  processed for now."* ID3 `USLT`/`SYLT` frames are not read, and **no audio file is
  opened at all** — a mounted music folder is scanned for `.lrc` and `.txt`
  sidecars only. Stated rather than assumed, because "mount the song folder" sounds
  like it includes the songs.
- **Watching a mount for changes.** No inotify, no poll, no timer — that is a
  goroutine outliving its request by definition. The reader presses Scan.
- **Writing to a mount**, including moving, renaming or tidying a library. Other
  applications do that properly and this one is a guest on their disk.
- **Creating a work from a scanned file.** The scan attaches files to works that
  exist; it does not populate a shelf from a folder, which is the catalogue this
  app has already refused to become.
- **A per-user disk quota.**
- **DRM'd files of any kind** — refused at the header, by name.
- **Guessing the work from a filename**, at any door. Door 4 asks.
