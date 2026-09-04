# Tippani — developer handoff

Everything the desk and phone prototypes decided, why, and what differs from the
committed app. Written to be handed to Claude Code as the single source; read this
first, then the companion file for the area you are building.

| File | Covers |
| --- | --- |
| `handoff.md` (this) | Every design decision, and what differs from the committed app |
| `repo-design-system.md` | The system as the repo defines it — tokens, type, components |
| `material-instructions.md` | The eight material families, the light model, the three stations |
| `person-instructions.md` | Person identity — one record, many credits |
| `field-model.md` | Corrections the spec made to the first phone prototype |
| `CLAUDE.md` | Standing rules: edge fade, spacing constants, em over px, placeholders |

**Prototypes.** `Book Detail Wide.dc.html` (desk — book detail, Metadata, Stats,
Settings), `Book Detail.dc.html` (phone), `UI Glossary.dc.html` (every component and
material, pressable), `Icon Candidates.dc.html` (the glyph proposal, with its rule).

**Source of truth for values.** `docs/ui-glossary.html`, `theme.js`, `fonts.js`,
`ui.jsx`. Never from memory. This is not a style preference — the repo's icon test
strips coordinates and fails near-duplicates, so a hand-drawn lookalike is a CI failure.

---

# Part 1 — What differs from the committed app

Everything here is a **change to build**. Ordered by how much of the app it touches.

## 1.1 Details is a form, not a corridor of sheets

**Committed:** every field on Details is a row that pushes a sheet holding one input.
Tap Title → panel → type → Save → panel leaves. Four surface changes to edit a year.

**Change:** a field whose value fits on its own row is edited **on that row**. A pencil
swaps the value for an input; ✓/✕ and Enter/Escape answer it; the list never moves.

Four fields keep a sheet, each for a stated reason:

| Field | Why it cannot be a row |
| --- | --- |
| Description | prose — needs several lines and room to reread |
| Genres | a token input with its own filter list |
| People | not a value; a list of rows with roles and their own actions |
| Cover | a grid of images; no text to type |

**Why:** the old shape made a 4-character year and a 60-word description look equally
expensive, so nothing told the reader which edits were quick.

**Ordered by relevance, not by editor** — title · subtitle · people · description ·
genres · year · language · publisher · series · pages · isbn · links. Grouping by which
editor a field opens sorts the record by implementation and buries People under ISBN.
No section headings: "Fields" above a list of fields in a panel called Details is the
panel title said twice.

## 1.2 Metadata source is per field

**Committed:** one `Source: Open Library` row for the whole record.

**Change:** every field carries its own source tag — `OL` · `GB` · `AZ` · `you`.
Tapping it opens that field's candidates **with the value each source is offering**,
side by side. Mixing is the normal case, not an exception.

**Why:** a record is assembled. The ISBN came from the scan, the page count from Google
Books because Open Library had the wrong edition, the description you wrote. One
provenance line for eleven fields cannot say that, and it makes Refetch an
all-or-nothing gamble — which is why people stop pressing it.

**Consequences to build:**
- Typing over a value **re-sources that field to `you`** in the same action. Refetch
  then leaves it alone while updating its neighbours.
- Refetch names which source each proposed change comes from, per row.
- The source list is **per field** (`field.sources`), not global — links answer a
  different question (1.3), and a future field may answer a third.
- Three providers ship and the list is open: a fourth is one key in `SRC` and one
  column in `FIELDS`.

## 1.3 Links out, on both works and people

**Committed:** nothing. A reader pastes URLs into the note field.

**Change:** a `Links` field on the work and a `Links` row on the person, each opening
the same form renderer over that record's links.

**The list is what is added, not what exists.** Any provider on any record. A novel with
a film adaptation legitimately wants a TMDb id; a game novelisation wants IGDB. A fixed
roster with "not linked" beside half of it is a panel made mostly of absences, and it
decides for the reader which providers their record may have.

**A key and a URL are one fact written twice.** Every provider has a URL shape
(`PROVIDERS[id].url(key)`). Paste `nm0119232` under IMDb and it stores the key; paste
the whole imdb.com URL and it parses back to IMDb + that key. `+` in the panel header
takes a pasted address and **shows the reading before you commit** — a field that
silently transforms what you typed is a field you stop trusting. A URL matching nothing
known is kept whole under the globe, which is why there is no WorldCat slot: an obscure
catalogue is not a special case, it is just a URL.

**The globe is not a failure state.** "A web page" is a legitimate kind of link — a
review, an author's own site, a scan somebody hosted. A dashed box or an error colour
would tell the reader they had done something wrong by linking to the open web.

**Two provenances, not three.** A link is either one the app worked out for itself
(matched from an ISBN, or a name against an authority file) or one you pasted:
`auto` or `you`.

**A summary row has no source of its own.** The `Links` row on Details shows no tag —
the links under it come from a dozen places, and one is a pasted URL. The answers are
one level down, one per link.

**Fandom sits alongside Wikipedia, not instead of it.** Wikipedia covers the book; a
fandom wiki covers what is inside it — characters, places, timelines. A reader chasing a
name and a reader checking a publication date want different links.

**Marks: 13, vendored, never hotlinked.** Simple Icons (CC0) supplies eleven; Amazon was
withdrawn from the pack so it is the wordmark alpha-passed to a stencil and cropped by
connected component to the letterform alone (the smile is a second shape and smears at
22px); TVDB is in no open pack and was supplied by hand. All are inlined as data-URI
masks at `--soft`, never brand colour — a dozen brand hues in one panel would be the
loudest thing on a screen made of paper, and a links panel that phones a dozen companies
to draw itself is exactly the network request the app promises not to make.

## 1.4 A picture is not a field

**Committed:** `Cover` and `Photo` are rows reading `none · ✎`, opening a grid the row
cannot preview.

**Change:** one **media block** at the top of the panel, shared by the work's cover and a
person's portrait:

- the picture at a usable size — 108×162 rect for a cover, 118px circle for a face
- its **pixel size**, stated as `1000×1500 px`, going `--error` below the floor:
  400×600 for a cover, 400×400 for a face. Missing is `0×0 px`, under the floor and red
  for the same reason — it is not usable.
- four verbs in a 2×2 grid: **Fetch · Search · Upload · Paste URL**, at 36px so the
  block reads as one object rather than a picture and a separate toolbar
- every candidate in the picker states its own size; undersized ones are inked red

**Shape carries the kind.** A portrait is round, a cover is the hand-drawn rectangle, and
the placeholders follow: silhouette for a missing face, `.ph` hatch for anything else.
Not interchangeable.

**No label on the portrait.** A round silhouette with four image verbs under a panel
titled with the person's name does not need the word "Photograph". The cover keeps its
label because it sits among eleven other named fields.

## 1.5 Quotes carry their speaker

**Committed:** a quote belongs to a work, and the only person on it is the author.

**Change:** `quote.speakerId` → a character of that work, rendered as a person chip that
opens that character.

**Why:** "Cowardice is the most terrible of vices" is Yeshua's, not Bulgakov's, and the
difference between the author saying it and a character saying it is the whole meaning of
the line. A reader who collects dialogue and cannot say who spoke it has kept the words
and thrown away half of what they meant.

Narration keeps **no** chip. Inventing a speaker where there is none is worse than
leaving it off.

## 1.6 Books have characters

**Committed:** characters exist for film/show/game, bound to the performer. Books have
makers only.

**Change:** a book's People panel has a Characters section with its own picker, and a
character is a person record with `kind: 'character'`.

**A book character has no actor.** Do not add a second name slot: a slot invites a value,
and there is nothing true to put in it.

## 1.7 Duplicate a quote

**Committed:** nothing. Quoting the same page twice means retyping six fields.

**Change:** `Duplicate` in the quote's ⋯ menu opens the add form **on a copy** — note,
tags, colour, locator and sticker carry over, the words do not. The title reads
"Duplicate this quote" and one line names what came across.

- **Nothing is created until Save.** A duplicate you abandon never existed.
- **Same surface as Add,** deliberately: a duplicate *is* a new quote being written, and
  a second dialog would be two forms to keep in step for one difference — what is already
  in the fields.
- The line naming what carried over is what stops a duplicate being saved with the
  original's words still in it. A form that silently arrives full is a form you have to
  audit field by field before trusting Save.

## 1.8 Six default portraits, picked by name

**Committed:** one `person-silhouette.svg` for everybody.

**Change:** `assets/person-1…6.svg`, chosen by a hash of the person's canonical `name`.

- **Six, not one:** a list of people wearing one silhouette reads as one person repeated,
  and the face is the fastest thing on a row to recognise.
- **Hashed, not random:** the same character must wear the same face on the card, in
  People and on a share image. A face that changes is a face you cannot learn.
- **Hash `name`, never `creditAs`** — see `person-instructions.md`. Otherwise a person
  changes face between two books.
- Masks filled with `--faint`, not `<img>`: they take the theme in both modes and can
  never be mistaken for an uploaded photograph.

## 1.9 The person panel is three scopes

**Committed:** one flat list, `Rename` at the top.

**Change:** **On this work** (role, credit-as) · **Across the library** (counts, aliases,
links) · **This person** (the shared record). The split is the schema — see
`person-instructions.md` — and the sub-lines say so, because without them a reader
believes they just renamed the author on 31 other books.

`Dates` became **Born** and **Died**, separately blank-able. "Dates" beside Name and
Sort name could as easily have meant when the record was created.

## 1.10 Metadata, Stats and Settings are real screens

**Committed:** the rail lists all three. Built from `MetadataPage.jsx`, `StatsPage.jsx`
and `Settings.jsx` — read, not guessed at: an invented settings screen produces plausible
rows the app does not have and section names that cannot be mapped to a file.

**One card renderer for all three,** because all three are the same *kind* of screen: a
column of cards, each a heading over a body, read rather than edited. Six row kinds cover
every card between them — tile · bar · toggle · segmented pick · dropdown · reading row,
plus the heat calendar.

**Metadata**
- **Coverage** is one tile per gap, in the console's own order, using its own gap words
  (`BOOK_GAPS` / `MOVIE_GAPS`). A tile **is** the filter. A gap inks itself `--error`
  only when the count is above zero, so a screen of zeros is a calm screen and any red on
  it is a real gap.
- **Sources** was in Settings and moved here — a setting describing the console it governs
  is how a setting ends up disagreeing with the thing it controls. Which providers are
  tried at all; the per-field choice stays on the work.
- **Catalogue** rows carry a tick for the bulk selection, their gaps as chips, and three
  keys: edit · look up · open. The first two **latch** rather than changing their words,
  because both are toggles and a row reading "Close · Close · Open" says nothing about
  what either closes.
- **Bulk edit is opt-in per field.** An empty author would legitimately clear the author
  on every selected work, so setting one is a deliberate act rather than a side effect of
  leaving a box empty.
- **Duplicates** are fuzzy-matched and never merged automatically. The copy with the most
  quotes is the default keeper because it has the least to lose — and two editions of one
  book are legitimately two records, since different pagination means different locators.
- **Speaker remap** maps a title's speaker labels onto its cast. An ensemble ("V, Evey")
  is not a remappable label: the line contributes each character separately, because
  mapping two names onto one actor is not a thing.

**Stats**
- **Activity** has three streams. Saves counts things you kept and the count *is* the
  fact; Quiz and Practice count **answers**, where a day of twelve all wrong shades
  exactly like a day of twelve all right — so those two report the right/wrong split and
  the count alone is the less interesting half.
- The calendar is **single-hue sequential** — the accent mixed over `--line` in four
  steps. A heatmap with a colour ramp asks the reader to learn an order the numbers
  already have.
- **Breakdown** offers ten dimensions and leads with **best remembered** and **most
  forgotten**. A ranked list answers "who do I quote most"; those two answer "where is the
  drill working", which is the question the curve was collected for.
- Characters sit **beside** actors, not instead of them: one actor plays several
  characters, one character is played by several actors, and a book has characters and no
  actors at all — the case that settles it.
- **Colours** uses the reader's own category names. A breakdown headed "Blue" when every
  card in the app says "Fact" is a breakdown of something else.
- **Timeline** is when the works are *from*; the calendar answers when you saved them.
  Only a decade is clickable through to a search: "1984" is a book somebody owns, and a
  century would be answered *wrong* rather than not at all.
- Every superlative is a doorway. Naming a thing you cannot go to is naming it twice.

**Settings**
- Theme and labels are **three-way, not switches**: the middle answer — follow the
  system, decide per tile — is the default the app ships, and a switch cannot hold it.
- Type, colours, quotation marks and shortcuts are **openers**, not rows. Anything whose
  value you must *see* while choosing cannot be chosen from a row. Same rule Details
  follows for description, genres, cover and people.
- Quotation marks are per language, because `" "` is wrong in French, German and Bengali
  in three different ways.
- A device is paired with a code. Self-hosted, so this is a list of machines you own
  rather than of sessions somebody else is keeping.
- Nothing in cleanup is deleted on a schedule. An orphan is usually the trace of a work
  you removed on purpose and occasionally the trace of a mistake, and only you can tell
  which.

**Dropdown or segmented follows the option count,** as the repo's own choice does. Ten
dimensions as pills is a two-line wall; three states behind a dropdown hides the
alternatives behind a click.

## 1.11 A pick closes its panel

**Committed:** the category filter stays open after you choose.

**Change:** single-choice panels dismiss on answer. Multi-select ones (tags, export
includes) stay open, because there the next pick is likely.

## 1.12 Shell corrections

- **Help sits against the search field.** Beside the breadcrumb it read as "help with
  this book" and left 700px of dead bar. Both are shell controls; they sit together.
- **The panel header is three slots.** Two equal flexible slots with the title between,
  each reserving the 44px a key needs. The title is centred on the *box*, not on the space
  left over, so it does not move as you walk the panel stack — and everything in the head
  shares one 44px line box, so a back key and a title cannot sit a few pixels apart
  vertically.
- **The header casts.** A 1px rule alone made content look like it passed *through* the
  header rather than under it. Unconditional: a shadow that appears on scroll is a layer
  changing depth while you read.
- **A panel may carry one verb in its header,** and only its own — `+` on Links. The list
  is what is already there; adding to it is not another member of it.
- **The breadcrumb follows the screen.** `Tippani / Stats` on a library-wide screen, and
  the "in this book" scope pill is suppressed — it means nothing on a page about every
  book.

---

# Part 2 — The icon rule

`Icon Candidates.dc.html` is the live sheet. The app is drawn in **wireframe** — 1.85px
strokes from `ui.jsx` — and that stays. Swapping the whole set to a filled pack would
double the ink on every screen to fix a problem the app does not have.

**Wireframe is the default and needs no argument. A fill needs one, and only four count:**

1. **Fill is the ON state.** The outline is the glyph, the fill is that glyph switched on
   — heart, seal, quizSkip. Both halves must be the same drawing *to the decimal*, which
   is exactly what drawing them separately cannot guarantee. Where the pack has no honest
   candidate, the fill is derived from the outline's own coordinates.
2. **The glyph names a place, not a job.** The rail and drawer are the reader's map of
   what the app contains; everything else is a verb. Solid says "somewhere to go" before
   the word beside it is read — the same logic the shell already uses one step later,
   where the active row wears an accent fill.
3. **The subject is a silhouette in life.** A mortarboard is recognised by its outer
   shape, and at 19px an outline turns that shape into a diamond. **This is the narrowest
   of the four, and the rejections are its limit:** a face and a film reel both looked
   like they qualified and neither did, because both sit inside something that already
   supplies the ring — the person chip is a bordered circle, and the reel's hub and holes
   are what the outline was carrying.
4. **The fill carries information.** The palette's wells hold the six category colours.
   An outlined palette has nowhere to put them.

**Everything else stays wireframe.** A **key** — tick, plus, ✕, chevron, three dots — is
a pen mark with nothing inside to fill. A **letterform** — translate, a question mark —
becomes a blob at 19px.

**A verb gets no fill.** Duplicate fires once and leaves nothing behind, so there is no
state for a fill to mean.

**Nav glyphs take a `nav*` prefix and are named for the destination, not the drawing** —
`navLibrary`, not `navBooks`. Prefixing only the ones that collided would make the prefix
mean "this one had a clash" rather than "this one is a destination". `quote`, `tag` and
`books` each need a second drawing, because each name currently does both jobs.

## What this cost, so it is not relearned

- **Five redesigns of `quizSkip` all lost to the glyph already in the file.** A broken
  ring, a slashed ring, an inverted disc, a dot on a line, a staircase with a hop. The
  repo's card-with-a-rule is right because `practise` is the *same rect* — the two read as
  one family, which no invented shape gives back. **The rule at the top of `icons.js`
  applies to shapes already in the file, not only to ones being added.**
- **Four glyphs were hand-drawn before checking `ui.jsx`, which already had them.**
  `IconLanguages`, `IconReading` (the two-page spread this project calls `shelf`),
  `IconWatching` (the filled play triangle, i.e. `play`), `IconRecords` (filed here as
  `duplicate`, which is *exactly* why it read as `copy`). Read the file first.
- **Two duplicate keys in `icons.js`** — `quizSkip` and `ruler` — each silently
  overwriting the other. Invisible because neither copy was *wrong*; the danger is the
  next edit changing whichever one is not the winner. Search before adding a key.
- **`bookmark` was proposed and dropped:** the heart favourites, the seal marks, the shelf
  tracks position. An icon in search of a feature is how it got there.
- **`ruler` and `discuss` are drawn by nothing.** They stay in `icons.js` because
  `ui.jsx` has them and the repo is the source of truth for what *exists*, but nothing
  should place one until a feature asks. Completeness is not a job.

---

# Part 3 — Standing rules these decisions obey

Restated from `CLAUDE.md`, which is authoritative.

- **An edge fade means it scrolls; a button at the fade opens the full set.** Both axes:
  `data-scroll-x` fades 26px, `data-scroll-v` fades `1.6em`. Vertical is em so the fade
  lands on the last line at any type size.
- **Never collapse a list to fit.** It scrolls under the fade, or it gets a button.
- **A scrolling row must be reachable by pointer** — press-and-drag, with a drag past 3px
  swallowing the click.
- **Spacing is a constant, never a literal.** A screen declares `ROW` and `EDGE` once.
  Five hand-tuned paddings agree the day they are written and drift on the next change,
  invisibly. On the new screens `EDGE` is *derived* from `STREAM_PAD` so the pages and the
  book stream cannot disagree about the margin.
- **Rows carry horizontal padding only.** Vertical distance belongs to the column's gap.
- **Type size is a setting, so no box around text is measured in px.** Label columns are
  `ch` (9ch for fields, 12ch for names). Folds are line counts. `StatsPage` sizes its
  label column at 8.4px per character and says why — charging 7px under-measured by a
  fifth and wrapped every name past eight letters. `ch` sidesteps the arithmetic.
- **The test:** root font size at 24px. Every line count holds, every fade lands on ink.
- **Placeholders are not interchangeable.** Silhouette for a person, `.ph` hatch for
  anything else.
- **Round is a person or a value; 9px is something that acts.**
- **Glyphs come from `ui.jsx` verbatim.** The icon test fails near-duplicates.

## Two implementation traps this prototype hit

- **A row built with `createElement` cannot take `style-hover` / `style-active`** — those
  compile from template *attributes* — and is opaque to the editor. Nine Settings toggles
  set `--ihg`/`--iag` and nothing read them, and 538 nodes of copy could not be clicked
  into. Row kinds are template markup with flat string values.
- **Never ask the DOM a question the markup can answer.** The glossary's mask sweep walked
  `querySelectorAll('*')` calling `getComputedStyle` on each — which flushes layout — on a
  400ms interval *and* every scroll event. 2.5 full-document layout passes a second,
  forever, on a page nobody was touching. Now: scrollers are tagged once, reads are
  batched before writes, scroll and resize coalesce into one frame, and a
  `ResizeObserver` replaces the interval and is silent when nothing moves.

---

# Part 4 — Still to build

- **Library, Catalogue and Quotes screens,** with at least one work in each.
- **Port the material/light system into `Book Detail Wide.dc.html`** — it lives in
  `UI Glossary.dc.html`; see `material-instructions.md`.
- **The four Settings editors** — type, colours, quotation marks, shortcuts. The openers
  exist and are wired to panel keys; the panels do not.
- **The link picker's provider list.** Paste-and-parse works; appending a provider by
  picking it from a list does not.
- **`navQuotes` / `navTags` / `navLibrary` as distinct drawings** — three names are doing
  two jobs each (1.10, Part 2).
- **The phone's Metadata, Stats and Settings.** `Book Detail.dc.html` now loads
  `icons.js` rather than transcribing glyphs; the three screens are desk-only.
