# Import — one target, and the bytes say what the file is

Import is seven cards. The reader picks a format, and the card they picked chooses
the endpoint. This replaces the wall with **one file row that is also a drop
target**: drop a file, the server reads it and works out what it is, it parses, it
lands in the queue. The list of what is supported moves into help, where a list
belongs.

**Nothing in this plan may depend on a file's extension or its declared type.**
Every format Tippani imports is text a person could open in any editor, and a
reader who saved an IMDb page as `imdb quotes` or a Readest export as `.txt` has
not made a mistake worth a rejection. The current build already holds this line for
markdown; this generalises it.

The shape is not invented here. The design pack drew this row and argued it —
`docs/design/prototypes/book-detail-wide.dc.html:5649-5653`:

> ONE OR MANY, THE PHONE'S OWN PAIR. The bulk path is not a power-user corner: a
> reader arriving with a year of Kindle highlights has nothing to do with a form
> that takes one. Same task at two scales, so it is a segmented control rather
> than a second door — **and the wide screen gets the file row as a drop target,
> which is the one thing a desk can offer that a phone cannot.**

And the repo already decided the hard question. `import_movies.go:70-86`, on why an
unrecognised media type is never a 400:

> a parsed file must never 400 over its media type — **an import guesses, and the
> queue is where a wrong guess gets corrected**

That is the answer to "ask only if necessary": **no blocking questions.** The
staging queue is the question, asked once, in bulk, after the fact — and its
repair machinery is already built.

---

## What already exists

Verified against `611b225`, and against two real Readest exports of one book
(41 annotations) that are not in the repo and must not be committed.

| Thing | State |
| :-- | :-- |
| A drop target | **Built, and it ignores the file.** `ImportPage.jsx:281-301` posts whatever is dropped to whichever card it landed on — a `.txt` dropped on the Goodreads card goes to `/import/goodreads-html`. Its own comment calls drag-drop "a bonus, not the point" (`:270-271`) |
| Format choice | **Seven cards on a desk** (`:110-121`), a hand-rolled searchable combobox on a phone (`MobileImportPicker`, `:183-268`) |
| Extension as a gate | **Present, in two places.** `SOURCES` carries `accept` (`:41-49`) which the OS picker enforces, and `ExtBadge` prints it on each card. Four of seven sources are `.htm/.html`, so it never decided anything anyway |
| Content-based detection | **Built for markdown only.** `MarkdownKind()` (`movie_markdown.go:59-114`) picks book / movie / quotes / anthology off a `type:` line; `Markdown()` (`markdown.go:17-33`) picks Tippani frontmatter vs Readest off the first non-blank line |
| Detection for the other six | **None.** The URL is the format: seven `POST /import/*` routes (`server.go:477-483`) |
| Extension used server-side | **Never.** `readUpload` keeps the filename only for display and states it is "never used AS a path" (`import_handlers.go:194-199`). `PLAN.md:3974-3982` already requires routing by sniffed bytes, "never by declared Content-Type" |
| "Not my format" errors | **Built, one per parser**, each distinctive, each already tested |
| Readest **markdown** | **Built** — `parseReadest` (`markdown.go:283-330`) |
| Readest **JSON** | **Not built.** No `readest-annotations` anywhere in the tree |
| Upload plumbing | **Shared.** `readUpload` (`import_handlers.go:177`) caps at 5 MB *before* `FormFile`, returns `[]byte`; `handleImportN` (`:152`) is the one cap→parse→stage path |
| The queue and its repairs | **Built.** `possible_duplicates` on upload, `Ambiguous`/`Alternatives` on a staged work, `retarget` across book↔film in `POST /import/staged/bulk` |
| Upload progress | **Built and unused here.** `uploadWithProgress` (`api.js:90-110`) is used by restore, boards and identity; import uses `upload()` (`:76`), which has none |
| Folders, zips | **Nothing.** No `webkitGetAsEntry` in the tree; zip is export-only and backup/restore, a separate path with its own `TIP-BACKUP-*` codes |
| A `DropZone` primitive | **None.** No `DropZone`, no `.drop-zone` CSS; the hidden-input-inside-a-label idiom is copy-pasted across nine call sites |
| A help list of sources | **None.** Import is one row in the `capture` help section (`help.jsx:404`) with a four-box `file → pending → approve → library` SVG |
| Guards on this screen | **Almost none.** `screens.js:41-62` has no `import`; `controls.mjs:83-99` never reaches Import or the Add surface at all; no test in `web/frontend/test/**` covers `ImportPage` |
| A `TIP-*` code for an unreadable upload | **None.** `TIP-IMPORT-001..004` cover staging, listing, approval and queue mutations |

### What the verification changed

**The drop target is not a feature to build; it is a defect to delete.** I expected
to add drag-and-drop. It is already there, on all seven cards, and it does not look
at the file at all — the drop handler passes `e.dataTransfer.files` straight to the
card's own endpoint, ignoring the `accept` list two lines above it. It also has no
dragenter/dragleave depth counter, so the highlight flickers whenever the pointer
crosses into the card's own children. Neither is worth fixing, because one target
with detection removes both.

**The Readest markdown parser drops every note, and the owner's own file has four.**
`parseReadest` flushes a quote on the first non-`>` line, and its `default` branch
matches only the page regex — so `**Note**: …`, which Readest writes on its own line
between the quote and the page line, hits nothing and is discarded. The `· Time: …`
stamp beside the page number is dropped the same way, so `noted_at` is never set
from a Readest file. Four of forty-one annotations in the file measured here carry
notes; all four are lost today, silently.

**The Readest JSON export is the better source, and is not supported at all.**
It is self-describing — `"$format": "readest-annotations"`, `"version": 1` — and
carries three things the markdown does not: the highlight **colour**, the real
`createdAt`/`updatedAt` in milliseconds, and the book's **reading progress**
(`progress: [879, 1837]` plus a cfi `location`). It also distinguishes `style`
(`highlight` ×40, `squiggly` ×1 in the measured file), which the markdown renders
identically. What it *lacks* is the chapter name and the page number, both of which
the markdown has. **Neither export is a superset of the other**, which is why both
stay and why the plan says plainly what each one carries.

**The Import screen is not a screen.** `/import` is a section of the ＋ Add surface
(`AddSurface.jsx:1368`, `routes.js:232-240`), and `ImportPage`'s `!embedded` branch
— its `PageHeader`, its mobile sticky bar — is dead code nothing renders. The
section's "?" opens the **capture** help section (`AddSurface.jsx:1384,1406`), so
"pressing a help menu" does not today reach anything about import beyond one row.

**Two documents still call `ImportPage` un-migrated for i18n, and it is not.**
`test/pure/infodot-copy.test.js:37` and `docs/plans/multilingual.md:141` both list
it among files whose strings are still English literals. It resolves every word
through `t()` against 71 `import.*` keys, and its one `InfoDot` (`:307`) is built
from `t()`-resolved steps. The claim is stale for this file; a rewrite should not
inherit it.

**Detection cannot be honest about everything, and the roadmap already says so.**
`#bug-14` (`roadmap.html:450-463`): legacy catalogue exports re-import as books, and
*"a detector cannot infer what the file never recorded, so this one stays listed
rather than pretending to be fixable."* One target must not imply it can read a file
that carries no answer.

---

## The design

### One row, two affordances, no format choice

The pack's row, verbatim (`book-detail-wide.dc.html:475-481`):

```
Choose a file, or drop one here
Kindle My Clippings.txt · CSV · Markdown
Every row lands in the import queue for review — nothing joins the book until you approve it.
```

Styling (`:5686-5692`): `min-height:62px; width:100%; padding:0 14px;
border-radius:12px; border:1.4px dashed var(--line)` over `fieldInset`, with
`ico('importBox', 20)`. The phone's (`book-detail.dc.html:4063-4066`):
`min-height:54px; border-radius:9px; background:var(--raised); border:1.4px dashed
var(--line)` — and the phone says only **`Choose a file`**, because a drop
affordance on a touch screen is a lie.

Three departures, stated rather than smuggled:

1. **The middle line names the real sources.** The pack's hint says
   `Kindle My Clippings.txt · CSV · Markdown`; CSV is not a source — it is roadmap
   §8. The row names what actually parses; the full list is one press away in help.
2. **The pack's row is scoped to one work** (its Add sheet's "Many" mode adds rows
   to the book in front of you). The Import section is library-wide, so the standing
   note is the queue promise already in the file — `import.nothing-lands.body`.
3. **The picker filters nothing.** See below.

### The extension is never consulted — including by the file picker

Three places have to change, and the third is the one that is easy to miss:

- **Server-side**: `Detect` reads bytes. It takes no filename. `readUpload` keeps
  the name for the queue's own grouping and display, exactly as it does now.
- **Client-side**: nothing inspects `File.name` or `File.type`. `File.type` is
  the browser's own guess from the extension and is wrong for every one of these
  formats saved without one.
- **The `<input type="file">` carries no `accept` attribute at all.** An `accept`
  list is the operating system's file dialog *hiding* files from the reader — a
  Readest JSON saved as `.txt`, an IMDb page saved with no extension, a
  `My Clippings` copied off a device. Filtering there is depending on the
  extension, one dialog removed, and it fails silently: the file simply is not
  offered. `SOURCES.ext` survives only as **documentation in the help list**, and
  `ExtBadge` goes with the cards.

### One cheap gate before any signature: is it text?

Every supported format is text — HTML, JSON, Markdown, plain text — which is the
reader's own observation and it is worth spending. A first pass that rejects
non-text separates every near-miss below in one check, before any signature runs:
valid UTF-8 (BOM tolerated, as the parsers already do), no NUL bytes in the head.
Anything failing it is not an import, and gets named rather than refused.

### One question, and it only appears when detection has failed

The seven cards do not become a dropdown. They become help. But detection can be
wrong, and the queue cannot repair *that* class of error: `retarget` moves staged
rows between works, not a file between parsers. If a Goodreads page is read as
Hardcover, the parse is empty or wrong and no bulk edit rescues it.

So there is exactly one control, and it is a **second door, not a front one**:

- Detection succeeds → the file parses, the result row says which source it was read
  as, and the reader goes to the queue. Nothing is asked.
- Detection fails, or the reader disagrees with the result row → **"Read this as…"**,
  a `Select` with `filter: true` (`ui.jsx:3368`) over the sources, which re-posts to
  that source's existing endpoint.

`Select filter` already is the searchable combobox `MobileImportPicker` hand-rolls,
so the override deletes that component rather than adding one.

### What the row must say back

The one thing the reader loses is the certainty of having chosen. The result row
(`BatchResults`, `ImportPage.jsx:356-399`) already prints per-file outcomes; it
gains the detected source by name, stated as a reading rather than a fact — "read
as **Goodreads**" — with the override beside it. `possible_duplicates`, the per-work
"joins your existing X / a new book" notices and the clippings counters stay.

---

## Detection

### Where it lives: Go, beside the parsers

Every signature below is a parser's own anchor. Writing them in JavaScript would put
a second copy of each in a second language, drifting from the parser that owns it —
what `theme.js:255-259` refuses by name for texture filenames. There is no latency
argument either: detection and parse happen in one request, on bytes `readUpload`
already holds, so the client makes **one** request, as it does today.

`internal/importer/` is the right home — its contract is "Pure parsing only — no DB,
no HTTP" (`importer.go:1-8`), and a byte sniffer is pure. It already hosts
`MarkdownKind`. Add:

```go
// Detect answers which parser owns these bytes, or "" when nothing does.
// It is given no filename, deliberately: see the note on extensions.
func Detect(data []byte) string
```

`httpapi` maps the slug to the handler it already has — the dispatch table belongs
there, since `importer` has none and should not grow one.

**This is a roadmap prerequisite, not just a refactor.** §3 `#capture` asks for a
bookmarklet that POSTs a page's raw HTML "parsed server-side by reusing the existing
Hardcover / Goodreads / IMDb HTML importers" — which is `Detect` with no filename
and no extension in the first place. Built client-side, that item has nothing to
call.

### The signatures

Cheap substring or prefix tests near the head of the file. The bytes are already in
memory, so order costs nothing.

| Source | Anchor in the bytes | Owner |
| :-- | :-- | :-- |
| `readest_json` | `"$format"` = `readest-annotations` | **new** |
| `bookcision` | JSON object with a top-level `title` and `highlights[]` carrying `text` | `bookcision.go:16-28` |
| `kindle_notebook` | `id="annotationBookTitle"`, else `kp-notebook-metadata` | `amazon_notebook.go:20-25` |
| `goodreads_html` | `class="quoteText">` with `<span class="authorOrTitle">` | `goodreads.go:17-20` |
| `hardcover_html` | `data-page="` **and** `UserBookJournals` in the escaped JSON | `hardcover.go:63-67` |
| `imdb` | `__NEXT_DATA__` with `"data":{"title":{"id":"tt` | `imdb.go:22-26` |
| `kindle_clippings` | a line matching `^={5,}$` | `kindle_clippings.go:35-52` |
| `md` | first non-blank line `---` or `# `; sub-kind from `MarkdownKind` | `markdown.go:13-33` |

Order matters in two places, both because a generic marker must not win over a
specific one:

- **Readest JSON before Bookcision.** Both are JSON. They cannot actually collide —
  Bookcision wants a top-level `title` and Readest's is at `book.title`, so
  Bookcision fails cleanly with `"bookcision: missing title"` rather than
  misparsing — but checking `$format` first makes that a rule instead of a
  coincidence.
- **Hardcover requires the component name**, not just `data-page="`, which is a
  generic Inertia attribute.

### The rule the signatures must obey

`MarkdownKind`'s own comment states it, and it was written after a bug:

> The explicit type line outranks every heuristic below: it is written by the
> exporter, which knows the answer, rather than inferred from whichever optional
> fields happen to be filled in.

That rule exists because detection used to rest on `director:` / `creator:` /
character bindings, all optional — so a film with no director recorded and no
character on any line **re-imported its own export as a book, silently**
(`PLAN.md:3916-3926`; the same class bit games at 0040, where a missing `case` fell
through to `KindBook`). `PLAN.md:4082` puts it plainest: *"A default is a fine thing
to omit from a form, and a terrible thing to omit from a file whose reader has to
work out what it is."*

So: **every signature above is a mark the format's own writer always emits.** No
signature may be an optional field, and none may be an extension. `Detect` returns
`""` rather than guessing — the fall-through to `KindBook` that `MarkdownKind` still
has at `:113` is the behaviour not to copy.

### When `Detect` returns nothing

Two stages, and the second is free:

1. No signature matched → **try each parser in order and take the first that
   succeeds.** Every parser already errors distinctively on a foreign file, every
   one of those errors already has a test (`TestIMDbQuotesNotAPage`,
   `TestAmazonNotebookNotAPage`, `TestKindleClippingsRejectsNonClippings`,
   `TestGoodreadsErrors`, `TestHardcoverErrors`, `TestBookcisionErrors`), and the
   bytes are in memory. This is the fallback the parsers were already built for.
2. Nothing parsed → **a new `TIP-IMPORT-005`**, "could not tell what this file is",
   with the row offering "Read this as…" and the help list. There is no code for
   this today because there was no way to reach it: the reader had already asserted
   the format.

---

## Readest JSON — the eighth source

Its own section because it is new parser work, and because it changes what a Readest
import is worth.

### The file

```json
{ "$format": "readest-annotations", "version": 1, "exportedAt": 1788707296898,
  "book": { "title": …, "author": …, "hash": …, "metaHash": …, "format": "EPUB" },
  "annotations": [ { "id", "type", "cfi", "note", "createdAt", "updatedAt",
                     "text", "style", "color", "xpointer0", "xpointer1" } ],
  "progress": [879, 1837],
  "location": "epubcfi(…)" }
```

Measured over one real export, 41 annotations: `type` is `annotation` throughout;
`style` is `highlight` ×40 and `squiggly` ×1; `color` is `green` ×29, `yellow` ×6,
`violet` ×5, `red` ×1; four notes are non-empty; no annotation carries a chapter or
a page. **These proportions are one file's, not the format's** — the parser must
read `style` and `color` as open sets and fold anything unrecognised to the default
rather than reject the file, which is the standing import rule.

### What maps where

| Readest | Tippani | Note |
| :-- | :-- | :-- |
| `book.title`, `book.author` | `Book.Title`, `Book.Author` | |
| `annotations[].text` | `Annotation.Quote` | |
| `annotations[].note` | `Annotation.Note` | **The thing the markdown path loses** |
| `annotations[].color` | `Annotation.Color` | Needs a mapping — see below |
| `annotations[].createdAt` | `noted_at` | ms epoch. Subject to the existing 24h clock-skew bound (`PLAN.md:4008-4016`) |
| `progress` `[pos, total]` | `Book.Progress` / `Book.Pos` | `parseOutOf` (`importer.go:156`) is already the shape for this |
| `book.hash`, `metaHash`, `cfi`, `xpointer*`, `location` | — | Not stored. They address a file on the reader's device, not a work |
| `style: squiggly` | — | See below |
| chapter, page | — | **Not in this format.** The markdown has them |

### Two things only the owner can decide

1. **Colour.** Readest's palette is not Tippani's six slots
   (`yellow · blue · pink · orange · green · purple`). `yellow→yellow`,
   `green→green`, `violet→purple` are unambiguous. **`red` has no slot.** By hue the
   nearest is `pink` (`#D98CA6`, a desaturated rose) — but a slot carries a
   *meaning*, not a hue: the built-ins are named, and a reader may have renamed
   them. Mapping red to pink assigns those highlights whatever pink means in that
   library. The alternative is folding unmapped colours to slot 1, which
   `theme.js:516-521` already defines as "no choice was made" rather than a colour —
   honest, and it loses the distinction. **Recommendation: map the three that match,
   fold everything else to slot 1, and say so in the result row** ("3 highlights in
   a colour Tippani has no slot for"), because slot 1 means "unset" and pink means
   something.
2. **`squiggly`.** Readest's underline style. Tippani has no per-quote style, so it
   is either dropped silently, dropped and counted (the Kindle-clippings precedent —
   `ClippingStats` reports what it threw away), or folded into a colour. **Counting
   it is the cheap honest answer**; the clippings path already proves the shape.

### And the markdown parser gets its notes back

Independent of the JSON, and worth its own commit because it is a defect against a
real file: `parseReadest` must read the `**Note**: …` line that follows a quote, and
the `· Time: …` stamp beside the page number. Both are in the same trailing block
the page regex already matches. The fix is small; the loss is not.

### What it costs to add a source

`PLAN.md:553` made this cheap on purpose — migration 0004 dropped the `CHECK` on
`annotations.source` *because the importer list keeps growing*. So: a slug
(`readest_json`), a parser, a signature, a help entry. Plus, per convention:

- a committed **synthetic** fixture, `testdata/readest_annotations_synth.json`, and a
  `testdata/readest_json_real.json` skip-test (`PLAN.md:6806-6816`: *"A real export
  is somebody's library and cannot be committed, but a parser written against a
  guessed shape is a guess"*). **The owner's two files stay out of git** — the
  `.gitignore` globs `*_real.*` and `/input_samples/` exist for exactly this.
- **No new README attribution.** Readest is already credited (`README.md:382-384`),
  which is what `PLAN.md:7226` requires. Its export *formats* line should say both.
- **No experimental label.** `PLAN.md:4018-4026` requires either a real file to
  verify against or a label on the face; there is a real file.

---

## Near-misses, which are the whole point of one target

A single target invites every file a reader has. Answering "unrecognised" to a
backup archive is a worse failure than the wall was. `secret.js:79-88` already
states the principle, about the restore prompt:

> so the prompt can ask for the right thing instead of offering every field and
> hoping

The text gate above catches most of these before any signature runs, and each is
then named by what it is, not by what it isn't:

| Dropped | Answer |
| :-- | :-- |
| `TPBK` magic (`secret.js:63`) | "That's a Tippani backup — Settings → Restore." |
| A zip | "Export archives aren't imported whole — unzip and drop the files inside." Named because the app's own export **is** a zip (`export_handlers.go:67-108`) and this is the likeliest wrong drop of all |
| An image | "Covers are set from a book or film's own page." |
| A font | "Settings → Type → upload." |
| An EPUB | "Tippani reads your highlights, not your books — export the annotations from your reader." The one a Readest user is most likely to try |
| A folder | "One file at a time." Nothing in the tree traverses a directory |

Each is one signature and one string. They are not politeness; they are the
difference between a target a reader trusts and one they stop using.

---

## The help list

Invent nothing: the list already exists as data. `SOURCES` holds the keys, and
`sourceTitle`/`sourceDesc`/`sourceSteps`/`sourceCaveat` resolve them.

The pattern to copy is `HelpSwatches` (`help.jsx:64-72`), which draws the reader's
own six category colours using the app's own `.color-dot` class, under the file's
stated rule (`:50-57`): *"A LIVE CONTROL is first choice because it is not a picture
of the app, it IS the app… A SCHEMATIC is second… A screenshot is last."*

So: a `HelpSources` component mapping over `SOURCES`, rendered as the `asset` of the
import help entry beside the existing `HelpImportFlow` diagram. **The list cannot
drift from the parser table, because it is the parser table.** Extensions appear
there as a hint about where to find the file — never as a rule.

Two things to settle in the doing:

- **Where the entry sits.** Import is one row inside `capture` (`help.jsx:404`).
  Eight sources with steps is a section, not a row — but a new top-level section
  must also go into `GUIDE_ORDER` (`:430-457`), or it is missing from the rail and
  the test catches it. The glossary documents the help panel as "one row per control
  … one registry keyed by screen" (`catalogue.js:518-556`), so a source list is a
  different shape and needs the argument written down.
- **Seven step strings say "here".** `import.source.*.step.*` currently end "Drop
  the saved .html here" / "drop it here", pointing at a card that no longer exists,
  and `bookcision.step.3` says "Use the Kindle notebook **card**". Seven keys in
  `en.txt` (3811, 3816, 3823, 3829, 3835, 3841, 3848) and their `bn` twins need
  rewording, plus a new set for `readest_json`. `import.drop.hint = or drag & drop
  here` becomes the row's own words and stops being per-card. `import.source.
  markdown.desc` should stop implying markdown is the only Readest path.

Also: the section's "?" must stop opening `capture`. `helpScreen(tab, detail)`
(`routes.js:288-292`) is where that is decided.

---

## Multi-file, and what stays

- **Many files at once stays**, unchanged in mechanism: one request per file
  (`ImportPage.jsx:76-82`), each detected independently, all landing in the queue
  together. A reader with a year of highlights is the case the pack's comment names.
- **Move import onto `uploadWithProgress`** (`api.js:90-110`) with `ProgressBar`
  (`ui.jsx:8956`, indeterminate when `max <= 0`). A 5 MB clippings file staging tens
  of thousands of rows shows nothing today. `App.jsx:402-430` is the worked example.
  Note the deliberate absence of a timeout on import (`api.js:66-74`: "a timeout on
  an import or a backup would abort work the server is really doing") — do not add
  one.
- **`busy` must be checked in the drop handler**, not only inside `runBatch`
  (`:70`), which today swallows a drop silently.
- **Extract the drop target and the hidden-input-in-a-label** as the app's first file
  primitives. Nine call sites copy the second one, and `cast.jsx:562-565` already
  writes down the rule they all follow.

---

## Mobile

The phone keeps a button and loses nothing: `MobileImportPicker` exists only to
choose a format, and detection retires it. What is left is the pack's phone row —
`Choose a file`, `min-height: 54px`, the same dashed border — wrapping the same
hidden `<input type="file" multiple>`, **with no `accept`**, opening the system
document picker. `import.pick.label` already carries the phone's wording.

`README.md:134` claims "files that open straight into import", so a share-target /
`Open with` path lands on this row eventually. Detection is what makes that possible
at all: a share target cannot ask which of eight formats it received, and on Android
it frequently arrives with no usable name.

---

## What this deletes

The change is mostly subtraction:

- `SourceCard` and the seven-card grid (`ImportPage.jsx:270-350, 110-121`)
- `MobileImportPicker` (`:183-268`) — replaced by `Select filter` in the override
- The per-card `onDragOver`/`onDragLeave`/`onDrop` and its flicker
- The dead `!embedded` branch (`:98-102`), `PageHeader` and mobile sticky bar
- **Every `accept` attribute and `ExtBadge`** — the extension stops gating anything
- `handleImportMarkdown`'s duplicate `MarkdownKind(data)` call
  (`import_handlers.go:39` and `:48`)
- `CARD_COLORS` and the paste-on wobble, if nothing else uses them
  (`PLAN.md:5633-5635` moved that wobble to a chrome-only underlay)

---

## The order

Each step is separately shippable. Steps 1–3 touch no frontend.

1. **Readest markdown gets its notes and timestamps back.** A defect fix against a
   real file, independent of everything else. — `internal/importer/markdown.go`,
   `internal/importer/markdown_test.go`, `testdata/markdown_readest_synth.md`
2. **`importer.ReadestJSON`** — the parser, the colour mapping, the counted
   `squiggly`, `progress` → `Book.Progress`/`Pos`. — `internal/importer/readest.go`,
   `readest_test.go`, `testdata/readest_annotations_synth.json`
3. **`importer.Detect`** — the signature table, the text gate, `""` for no answer,
   the near-miss kinds, **no filename parameter**. Unit-tested against every
   synthetic fixture plus one negative per near-miss.
   — `internal/importer/detect.go`, `detect_test.go`
4. **`POST /import/auto` and `POST /import/readest-json`** — `readUpload` → `Detect`
   → the existing handler, the try-in-order fallback, `TIP-IMPORT-005`. The
   per-source endpoints stay: they are the API, the override re-posts to them, and
   `handleImportN` is already the shared funnel.
   — `internal/httpapi/import_handlers.go`, `server.go`, `internal/olog/codes.go`,
   `internal/httpapi/import_search_test.go`
5. **The row** — one drop target and one picker with no `accept`,
   `uploadWithProgress` + `ProgressBar`, the detected source named in each result
   row, the `busy` guard. Extract the drop-zone and file-button primitives here.
   — `web/frontend/src/ImportPage.jsx`, `ui.jsx`, `index.css`
6. **The override** — "Read this as…" on a failed or disputed row, `Select filter`,
   `MobileImportPicker` deleted. — `web/frontend/src/ImportPage.jsx`
7. **Help** — `HelpSources` from the same table, the entry's home decided,
   `GUIDE_ORDER` if it is a section, `helpScreen` pointed at it, the "here" strings
   reworded and the Readest JSON strings added, in both locales.
   — `help.jsx`, `routes.js`, `internal/i18n/en.txt`, `internal/i18n/bn.txt`
8. **Guards** — see below; net-new, not a migration.
9. **The docs that go stale.** — `docs/PLAN.md` §9 (the decision, and this plan
   folded in per this directory's rule), `docs/troubleshoot.md` (the new code),
   `DEVELOPMENT.md:445-449` (its "Add an import format" checklist ends "add the
   source card in `ImportPage.jsx`" — that becomes the signature and the help
   entry), `README.md:90-95` (whose screenshot alt text hard-codes "cards for
   Markdown, Bookcision, Hardcover, Goodreads, IMDb and Kindle imports") and its
   Readest attribution line, `docs/ui-glossary.html` + `catalogue.js` (the first
   documented drop zone), `CHANGELOG.md`, `AI.md` if verification changes

---

## Guards — this screen currently has none

| Guard | What it needs |
| :-- | :-- |
| `internal/importer/detect_test.go` | **New.** Every synthetic fixture detects as itself; every near-miss detects as its near-miss kind; a file with no signature returns `""`. **And every fixture detects correctly after being renamed**, since `Detect` takes no filename — a test that passes only because the fixture is called `.json` is the bug this plan exists to prevent |
| `internal/importer/readest_test.go` | **New.** Colour mapping including the unmapped case, the counted `squiggly`, an empty `note`, `progress` → `Pos`/`Progress`, and an annotation whose `style`/`color` this build has never seen |
| The `*_real.*` corpus | Every parser has a skipped real-file test (`.gitignore:23,30`; `PLAN.md:6806-6816`). **`Detect` and the Readest JSON parser must join them.** The owner's two exports install as `testdata/readest_json_real.json` and `testdata/markdown_real.md` — gitignored, never committed |
| `web/frontend/test/screens.js:41-62` | `import` is absent, so `screens-mount.test.jsx` never mounts it. Adding it is the first test this file has ever had |
| `scripts/screenshots/controls.mjs:83-99` | `SURFACES` never reaches Import **or the Add surface at all**, so `MIN_CONTROLS`, the 44px touch floor and the unlabelled-control count do not police it. Adding it means new entries in `controls-baseline.json` under both `"390"` and `"1280"` |
| `web/frontend/test/pure/routes.test.js:95-99` | Pins `parsePath('/import')` → `{tab:'import'}`. Unchanged — but `helpScreen` gains a case |
| `web/frontend/test/pure/help-budget.test.js` | Measures copy budgets from `en.txt` via each entry's `roles`. New import help keys land in it |
| `web/frontend/test/pure/infodot-copy.test.js:37` | Its comment lists `ImportPage` among un-migrated files. Stale for this file — correct it while rewriting, do not inherit it |
| `test/pure/locale-complete.test.js` | Every new key in both `en.txt` and `bn.txt` |
| `go test ./...` | `TestDistWasBuiltFromTheseInputs` fails on a stale `web/dist`. `internal/i18n/*.txt` counts as a **frontend** change — `src/i18n.js` imports it with Vite's `?raw` |
| `npm run glossary:check` | Byte-exact against `docs/ui-glossary.html`; re-run `make glossary` |

## Verification

```bash
go vet ./... && go test ./...
go test ./internal/importer/ -run 'Detect|Readest' -v
cd web/frontend && npm test                # screens-mount, help-budget, locale-complete, routes
make frontend && make glossary && npm run glossary:check
bash scripts/screenshots/run-controls.sh   # after adding Import to SURFACES
```

Then, by hand, because no guard reaches it:

- Drop each synthetic fixture; confirm the result row names the right source. Then
  **rename every one of them to `notes` with no extension and drop them again** —
  the answers must not change. That is the test for the rule this plan is built on.
- Drop the real Readest JSON and the real Readest markdown of the same book.
  Confirm: the JSON brings four notes, the colours, the timestamps and the reading
  progress; the markdown brings the chapter names and page numbers; approving both
  enriches rather than duplicates (`INSERT OR IGNORE` + the fill-empty-only
  enrichment at `import_handlers.go:288-353`). **That round trip is the strongest
  case this plan has, and it is also the one most likely to expose a dedupe-hash
  disagreement between the two.**
- Drop a backup archive, a zip, a JPEG, a font, an EPUB and a folder; confirm each
  is named rather than refused.
- Drop a markdown file with no `type:` line and no decisive binding. Today it
  becomes a titleless book, silently. Confirm the new behaviour is `Detect` → `""`
  → the fallback → either a parse or `TIP-IMPORT-005` with the override offered.
- Drop twelve files at once and watch the progress bar and the twelve rows.
- On a phone: no drop affordance, one button, the system picker showing **every**
  file rather than a filtered set.

## Out of scope, named

- **A window-level drop target** — drop anywhere in the app and land in Import.
  Tempting, and it is what the eventual share-target wants, but it is a behavioural
  change to every screen rather than to this one, and it collides with the sticker
  drag. Separate plan.
- **Per-batch import rollback** — roadmap §7 `#data-hygiene` notes approval deletes
  the `import_batches` row and nothing it writes carries a batch id, so it needs a
  provenance record rather than an endpoint.
- **New sources** — roadmap §8 `#import-sources` wants Kobo, Apple Books, Readwise,
  KOReader, subtitles and a generic CSV importer. One target makes each cheaper: a
  new source is a signature and a help entry, not a card. Two conditions stand:
  `PLAN.md:4018-4026` requires either a real file to verify against or an
  *experimental* label, and `PLAN.md:7226` requires a README attribution.
  **CSV with column mapping is the exception that proves the rule** — the one source
  that genuinely must ask questions, because its columns carry no self-describing
  marks. It gets its own surface, not this row.
