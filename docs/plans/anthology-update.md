# The anthology update — a rule that fills it, a shelf of formats, and everything the entries are joined to

Three asks, one release:

1. **Automated anthologies** from tags, actors, authors and keyword search.
2. **Share** as EPUB, PDF and Markdown.
3. **Everything an entry is joined to** — the work, the annotation, the character,
   the person — available to the anthology rather than only the six fields it has.

They belong together because they are the same argument from three sides: an
anthology is the one thing in Tippani that faces *outward*, and all three are about
getting more of the library into it and more of it out of the app.

## Why this is a new file, and what it takes over

`docs/plans/anthologies.md` has three open items. **Two of them are done and the
file has not caught up:**

- *"The themed review has no button… Backend only: nothing in the UI presses it."*
  It is built — a `GhostButton` with `IconPractise` in the page header
  (`anthologies.jsx:682-688`) and an action in the screen-bar menu (`:655-656`).
- *"Per-entry field visibility — the choices, made with the owner."* Shipped as
  migration 0045's six flags, and the roadmap already says so: *"2.1.2 added the
  themed round and per-anthology field visibility — six switches deciding what each
  passage shows, governing the reading view and the Markdown alike."*

The third is drag-to-reorder, which that file already hands to
[`episodes.md`](episodes.md)'s `ReorderList`. So what is left of `anthologies.md`
that is its own is **EPUB, deferred on 2026-08-19** — and this plan takes it. That
leaves the older file with nothing open, which is the condition its own directory
sets for retirement. Folding it into `docs/PLAN.md` is the building agent's to do;
naming the fact is this plan's.

---

## What already exists

Verified against `aca715b`.

| Piece | State |
| :-- | :-- |
| `anthologies` / `anthology_entries` | **Built**, 0043. Entries carry `position REAL`, `kind`, `item_id`, `note`. Primary key `(anthology_id, kind, item_id)` — once per anthology, any number of anthologies |
| Per-anthology field visibility | **Built**, 0045 — six flags: `hide_credit`, `hide_source`, `hide_commentary`, `hide_colour`, `show_locator`, `show_date`, all `DEFAULT 0` |
| The entry row the API returns | **Already pre-joined** — `anthologyEntryRow` carries `source`, `credit`, `locator`, `date`, `work_id`, `quote_kind`, `color`, `favorite`, `quote_note` alongside the quote |
| Markdown export | **Built** — `renderAnthologyExport` (`export_anthology.go`), filtering by **passing a filter into** the shared `writeQuoteBlock`, not by forking it |
| Round trip | **Built and tested**, and it loses the parent work: a book highlight re-imports as a standalone quote |
| Themed practice over an anthology | **Built**, backend since 0043 and the button since 2.1.x |
| Reorder | **Built** — midpoint on a `REAL`, renumbering when the gap closes, one row per move |
| Adding quotes | **Built** — `Add to anthology` in `bulkActionsFor`, `POST /anthologies/{id}/entries`, capped at **`anthologyAddMax = 200`** per request |
| Faceted search | **Built** — 16 dimensions in `searchFacets` (tags, genres, colours, shelves, series, years, authors, directors, actors, characters, speakers, book/movie ids, added-from/to, favourite, note, wishlist) |
| FTS | **Built** — `annotations_fts`, `dialogues_fts`, `utterances_fts`, escaping only in `internal/search/fts.go` |
| A saved or persisted query, anywhere | **None.** No saved search, no smart collection, no rule-based board. Every search is stateless |
| "Select all matching" | **None.** Only "select all loaded" |
| `archive/zip` | **Built and in use** — `handleExportAll` writes `tippani-export.zip` |
| A PDF or EPUB writer | **None**, and `go.mod` has exactly three direct requirements |
| Print CSS | **Seven lines** (`index.css:927-933`) that unmask scrollers so nothing clips. No print stylesheet, no print route |
| Share | **Built for a quote, not a document** — `ShareDialog` offers WhatsApp, plaintext, Markdown, Reddit and a PNG, delivered by Web Share API on mobile, a one-shot `/share/image` URL where that is missing, and a blob download on desktop |

### What the verification changed

**The feature is finished except for one deferred item, so this is an extension and
not a completion.** I expected to find a half-built anthology. `anthologies.md`'s
own status header is a release behind its own contents.

**There is no persisted query anywhere in this app.** A rule-based anthology is not
"like boards but automatic" — boards are explicit single membership, tags are
explicit many-to-many, and `reviewTheme` is a predicate evaluated per request, not
something stored. **This introduces the app's first stored query**, which is the
significant architectural fact and the reason the shape below matters more than the
feature does.

**A rule cannot be a client-side selection, and that is decided by an existing
limit rather than by taste.** There is no "select all matching" — the selection bar
knows what is loaded — and `anthologyAddMax` is 200. So a fill over 1,400 matching
quotes cannot be expressed as a list of ids from the browser. The fill has to be
server-side, sending the *facets*, which is the better shape anyway: `searchFacets`
already exists, the search URL is already the honest encoding, and one
implementation of the query means the rule and the search bar cannot disagree.

**PDF is on no roadmap and in no `features.json`** — but *"a print stylesheet, for
the paper version of the same idea"* **is**, in §15 beside EPUB. That is the whole
answer, and it is below.

**The three-kind vocabularies are deliberate, not drift.** `anthology_entries.kind`
is `book | screen | utterance`, and 0043 argues it: the same shape as `item_reviews`
because *"the themed-review clause joins this table against reviewSource.kind
directly, so a second spelling would need a mapping in the one place a mistake is
invisible (a wrong kind matches no rows, and a themed round that draws nothing looks
like an empty anthology)"*. The bulk vocabulary — `annotation | dialogue |
utterance` — is a different layer's, equally deliberate. Any field registry this
plan adds must carry the mapping explicitly rather than pick a winner.

---

## 1. Automated anthologies — the rule fills it, it does not define it

### The decision, and the argument it has to survive

Both the roadmap and the plan open with the same sentence:

> It is not a tag with a nicer hat — the two things a tag cannot do are hold an
> **order** and hold **your writing**, and those are the whole point.

A live query anthology can hold neither. Re-run the rule and the order is the
query's, not yours; per-entry commentary has nothing stable to attach to when
membership moves under it. **A live anthology is precisely a tag with a nicer hat**,
which is the one thing this feature was defined against.

So: **a rule is a way to fill an anthology, not a way to be one.** Matched quotes
become real `anthology_entries` rows at the moment of filling, appended in the
search's own order, and from then on they are ordinary entries — draggable,
annotatable, removable. Everything the feature already is survives untouched.

**Instead of** a live view: that is a *saved search*, it is genuinely useful, and it
is a different feature that should be called what it is. Calling it an anthology
would cost this feature its own definition. It is named in *Out of scope* below.

### What is stored

One rule per anthology, nullable, in the same vocabulary the search already speaks:

```sql
ALTER TABLE anthologies ADD COLUMN rule       TEXT NOT NULL DEFAULT '';  -- the query string
ALTER TABLE anthologies ADD COLUMN rule_auto  INTEGER NOT NULL DEFAULT 0; -- keep it fed
ALTER TABLE anthologies ADD COLUMN rule_run_at TEXT NOT NULL DEFAULT '';  -- last fill
```

`rule` holds the **search query string** — `tag=stoicism&author=Aurelius&q=death` —
because that is already the wire format, already bookmarkable, and already parsed
by exactly one parser. Storing a JSON criteria object would be a second grammar for
a question the app can already ask. The zero value is the empty string, per the
convention throughout this repo, and an anthology with no rule is exactly what an
anthology is today.

### The fill

```
POST /anthologies/{id}/fill   { "rule": "tag=stoicism&q=death", "auto": false }
  → { "added": 200, "matched": 1412, "skipped": 3, "capped": true }
```

- Runs the **same** query builder the search endpoint runs. Not a copy — the
  argument the exporters already make ("three renderers would drift, and drift in
  an exporter is invisible until someone re-imports a file written by the wrong
  one") applies exactly here, and a rule that finds different quotes from the
  search bar showing the same words is worse than either.
- **Appends** at the end, in the search's order, `INSERT OR IGNORE` against the
  existing primary key — so a quote already in the anthology is skipped, not
  duplicated. That reuse is free: the "adding the same quote twice is a no-op" test
  already exists.
- **Never removes and never reorders.** A fill that could remove would delete the
  reader's commentary as a side effect of a library change.
- **Honours `anthologyAddMax`** and says so. `added: 200, matched: 1412, capped:
  true` is the Kindle-clippings habit — report what you did not take rather than
  truncate quietly.

### "Keep it fed"

`rule_auto` means: **the next time the anthology is opened**, run the fill and
append anything new. Not a background job — *"no goroutine outlives its request; no
worker pool, ticker, or scheduler"* is an invariant, and adding one is a design
discussion this feature does not need to open. Filling on read is the cheapest thing
that is honest, and `rule_run_at` is what the screen shows: "12 new since Tuesday",
with the count as a control the reader presses rather than a change that happened
while they were not looking.

### What "actors, authors" reaches, and what it does not

The `author`, `actor`, `character` and `speaker` facets are **substring matches on
the quote's or work's own column** — `books.author`, `dialogues.actor`,
`.character`, `utterances.speaker`. They do **not** reach `work_cast` (0048). So
"every line Rajesh Khanna spoke" finds the lines where the actor is named *on the
line*, and misses the ones where he is in the film's cast and the line is
unattributed. That is the existing search's behaviour and this plan does not change
it — but a reader building an anthology *of an actor* will notice, and it should be
said on the screen rather than discovered.

---

## 2. The formats

### Markdown — shipped

`GET /anthologies/{id}/export` already serves it, filtered by the six flags, and it
round-trips. Section 3 widens what it can carry.

### EPUB — `archive/zip` and `encoding/xml`, no new dependency

The roadmap's own costing:

> **EPUB export of your own highlights** — a small readable book of your own quotes,
> to put back on the e-reader they came off. `archive/zip` is already imported for
> the library export, and an EPUB is a zip with three XML files. Nothing else in
> this category does it.

`archive/zip` is imported and in use; `encoding/xml` and `html.EscapeString` are
stdlib. So an EPUB is: `mimetype` (stored, uncompressed, first entry —
the one thing the format is fussy about), `META-INF/container.xml`, a `content.opf`
manifest and spine, a `toc.ncx`, and one XHTML file per entry or one for the whole
anthology. The intro becomes the first chapter; each entry's commentary is prose
above its blockquote — the same document the Markdown already describes, in a
container an e-reader opens.

**The dependency budget is not touched**, which the plan for this feature already
identified as *"the only reason it is plausible here at all"*.

### PDF — the browser's, over a real print stylesheet

There is no PDF writer in the standard library, and adding one spends the budget
`PLAN.md` defends by name:

> `go.mod` has exactly three direct requirements… **Why.** A dependency on a NAS is
> a thing that has to be audited, updated and trusted forever.

A PDF library is a typesetting engine — fonts, shaping, pagination — and this app
sets Bengali and Devanagari. Buying that to print a thirty-entry anthology is the
worst trade in the plan.

**So the PDF is the browser's own.** Roadmap §15 already asks for exactly this — *"A
print stylesheet, for the paper version of the same idea"* — and the anthology is
the page that most wants one: it is already a document with an introduction, ordered
entries and prose between them. The work is a real `@media print` block (the current
one is seven lines that stop scrollers clipping), a print route or a print-mode flag
on the anthology page, and a **Print / Save as PDF** control that calls
`window.print()`.

What that buys: correct text shaping in every script the reader has, the browser's
own hyphenation and widow control, embedded fonts, selectable text, and zero bytes
of dependency. What it costs, stated plainly as the primary downside: **there is no
server-side PDF endpoint**, so a script, a CLI or a token-scoped feed cannot ask for
one, and the output varies a little between browsers. If a server-rendered PDF is
ever genuinely needed, that is a dependency decision to take on its own merits and
not as a side effect of an anthology.

The print stylesheet is worth building for its own sake — §15 asks for it
independently, and every other screen gets it free.

### Delivery

`ShareDialog` already knows how to hand a file over: `navigator.canShare({files})`
then `navigator.share` on mobile, a one-shot `/share/image` URL where the Web Share
API is missing, and a blob download with a 60-second `revokeObjectURL` delay on
desktop — that delay existing because the save races the revoke on mobile.

An anthology's formats are **files the server already has**, so this is simpler than
the image path: Markdown and EPUB come back from an endpoint with
`Content-Disposition: attachment`, and the same Web Share branch can wrap the
response in a `File` for the native sheet. PDF has no endpoint by construction — its
control is Print, not Share, and the plan should not pretend otherwise by putting it
in the same menu without a word.

**This is not publishing.** `anthologies.md`'s *Deliberately not built* stands: a
public URL brings an access-control model, a rate limit and a moderation question.
Worth noting that its pointer is stale — it sends the question to "§18 (Out in the
world)", which is now directories and icon CDNs, outreach with no code in it. The
question has no home on the roadmap at present.

---

## 3. Everything the entries are joined to

### What the six flags are, and why they are the right thing to widen

0045's flags are booleans over a fixed set: credit, source, commentary, colour,
locator, date. The mechanism is already correct — `renderAnthologyExport` passes a
filter *into* `writeQuoteBlock` rather than forking it, which is what the earlier
plan demanded ("pass a filter, do not copy the function"), and
`anthologyEntryRow` already ships `source`, `credit`, `locator`, `date`, `work_id`
and `quote_kind` pre-joined.

So this is not new plumbing. It is **six booleans becoming a registry**, and the
join widening to reach the three tables it does not currently touch.

### The field registry

One list, in Go, naming every field an anthology entry can show, each with:

- **where it comes from** — the quote row, the work, the person, the cast row;
- **which kinds it applies to**, in `book | screen | utterance` — 0043's
  vocabulary, with the mapping to the bulk side's `annotation | dialogue |
  utterance` written down once rather than assumed;
- **its default**, and the existing asymmetry preserved: `hide_*` where the thing
  shows today, `show_*` where it does not, so **every default is the zero value**;
- **its binding key** in the Markdown, so the export and the reading view cannot
  diverge — which is 0045's own promise ("what you see when you read the anthology
  is what you get when you export it") and is already tested.

Storage: the six columns are already there and must keep meaning what they mean —
`TestAnthologyFieldsDefaultToShowingWhatItAlwaysShowed` asserts a default export is
byte-for-byte what it was before 0045. New fields go in one `fields TEXT NOT NULL
DEFAULT ''` JSON column beside them rather than a column per switch: "EVERYTHING is
switchable" was the owner's answer, and thirty `ALTER TABLE`s is how that promise
gets quietly capped at six again.

### What the join has to reach

| Source | Fields | Cost |
| :-- | :-- | :-- |
| The quote row | note, colour, favourite, tags, translation, language, and every per-kind locator (`chapter`, `chapter_no`, `location`, `timestamp`, `season`, `episode`, `act`, `quest`, `episode_name`, `place`, `medium`, `region`, `recipient`, `work_title`, `occasion_date`) | Already in the row or one column away |
| The work | title, author, translator, editor, subtitle, publisher, pages, year, series and index, ISBN, genres, cover, director, media type | A join on `work_id`, which the row already carries |
| The character | name, portrait | `work_cast` (0048), keyed by work + character |
| The person | the author's, actor's or speaker's bio, born, died, portrait, links | `people` (0012), matched by exact name to `book.author` / `dialogue.actor` / `utterance.speaker` |

The last two are the genuinely new joins, and they are what makes an anthology look
like a book rather than a list: an author's dates under the first quote from them, a
character's portrait beside a line.

**Three cautions worth carrying into the build:**

- **`people` matches by exact name**, so a person row exists only where the name in
  the quote matches the name in the table. A missing portrait is the normal case,
  not an error, and the layout has to read well without one — the same fallback the
  roadmap's portrait-share layout already names as its main work.
- **A field shown for every entry becomes noise.** An author's bio under thirty
  quotes from one book is one bio, thirty times. The registry needs a notion of
  *once per group* as well as *per entry*, or the feature makes worse documents than
  it replaces. This is the design question inside ask 3 and the one I would settle
  first, on paper, before any column is added.
- **The EPUB and the PDF read the registry too**, or the three formats start to
  disagree — which is the exporter-drift argument again, at a moment when the number
  of renderers goes from one to three.

---

## Guards

| Guard | What it needs |
| :-- | :-- |
| `anthology_fields_test.go:29` | `TestAnthologyFieldsDefaultToShowingWhatItAlwaysShowed` — a byte-for-byte default export. The registry must not move it |
| `export_anthology_test.go:86` | `TestAnthologyRoundTrip` — Markdown out, import back, order and prose intact. Every new field has to answer "does it survive the trip", which `PLAN.md` §10 calls the single most useful invariant in the repository |
| **New** — the fill finds what the search finds | The same rule through `POST /anthologies/{id}/fill` and through the search endpoint returns the same ids. This is the drift guard, and it is the one test that has to exist |
| **New** — the fill never removes or reorders | Fill, reorder by hand, add a matching quote, fill again: the hand order survives and the new quote is last |
| **New** — the cap is reported, not silent | `matched > added` implies `capped: true` |
| **New** — EPUB validity | `mimetype` first and stored uncompressed; `container.xml` points at the OPF; the spine lists every XHTML file. An `epubcheck` run belongs in the by-hand list, not CI |
| **New** — every registry field maps to a kind in both vocabularies | The 0043 mapping, asserted rather than assumed |
| `review_theme_test.go:240` | `TestDailyIgnoresAnAnthologyTheme` — untouched, and it must stay untouched |
| `locale-complete` | Every new field name in `en.txt` and `bn.txt`. `common.field.*` already carries 89 of them |
| `go test ./...` | `internal/i18n/*.txt` counts as a frontend change; `web/dist` rebuilds |

---

## The order

1. **The field registry**, replacing the six booleans without changing what they do.
   The default export stays byte-for-byte. — `internal/httpapi/export_anthology.go`,
   `anthology_handlers.go`, a migration for the `fields` column
2. **The work join**, then **the person and cast joins**, with the once-per-group
   decision made first. — `anthology_handlers.go`
3. **The print stylesheet**, and the anthology's Print control. Useful on its own,
   and §15 asks for it independently. — `web/frontend/src/index.css`,
   `anthologies.jsx`
4. **EPUB.** `archive/zip` + `encoding/xml`, reading the same registry.
   — `internal/httpapi/export_anthology_epub.go`, `server.go`
5. **The rule column and the fill endpoint**, reusing the search's own query
   builder. — a migration, `anthology_handlers.go`, `search_facets.go`
6. **The rule UI** — build it from the search bar the reader already knows, show
   `matched` before committing, and say what the actor and author facets do not
   reach. — `anthologies.jsx`, `facets.js`
7. **`rule_auto`**, filling on read, with the count as a control rather than a
   surprise.
8. **Docs** — `docs/PLAN.md` (the decisions, and both this plan and
   `anthologies.md` folded in), `CHANGELOG.md`, `docs/roadmap.html` §4 and §15,
   `docs/ui-glossary.html` if the rule control is documented, `AI.md` if
   verification changes.

## Verification

```bash
go vet ./... && go test ./internal/httpapi/ -run 'Anthology|Fill|Export' -v
go test ./...
cd web/frontend && npm test
make frontend && make glossary && npm run glossary:check
```

By hand, because the interesting failures are documents:

- Build an anthology by rule over a tag with more than 200 matches. Confirm the
  count is reported and nothing is silently dropped. Reorder three entries, write
  commentary on two, fill again — the order and the prose survive and the new
  quotes are appended.
- Export the same anthology as Markdown, EPUB and PDF and read all three. They must
  say the same thing: that is the registry working. Open the EPUB on the e-reader
  the highlights came off, which is the feature's whole point.
- Turn on the author's dates and a character's portrait over an anthology of thirty
  quotes from one book, and see whether the once-per-group rule is right.
- Print an anthology in Bengali and check the shaping, then in a second browser.
- Re-import the Markdown and confirm the round trip still holds with the new fields.

## Out of scope, named

- **Saved searches.** A stored query that stays live, listed on the Search screen,
  is a real feature and a good one — it is what an "automated anthology" would be if
  the word *anthology* did not already mean something with an order and a voice in
  it. This plan stores a rule *on* an anthology; a saved search is its own object
  and its own plan.
- **Publishing.** A public URL for an anthology remains deliberately not built, for
  the reasons `anthologies.md` gives. Its pointer to §18 is stale.
- **A server-rendered PDF**, and the dependency it would take.
- **CSV and JSON export, BibTeX, the feed, export presets** — §15's other items.
  Export presets in particular are the same idea as a rule, one layer out, and
  should reuse whatever shape this settles on.
- **Background refresh** of a fed anthology, which would need a scheduler and
  therefore a design discussion first.
