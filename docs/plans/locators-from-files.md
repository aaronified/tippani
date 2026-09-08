# Locators from files — a subtitle for a timestamp, an ebook for a location

A quote you kept has words but often no position. The file the words came from
knows: a subtitle track carries the start and end of every line, and an ebook
carries the text in order. So the reader hands over the file, the app reads it,
finds each quote in it, and offers the positions it found — as proposals on the
Checks screen, never as writes.

## The boundary, and why this is inside it

`docs/PLAN.md` §1 carries a decision that looks like a refusal of this feature and
is not:

> **Decided.** Tippani holds no book files. No reader, no OPDS catalogue, no sync
> to a Kobo or Kindle.
>
> **Why.** It is a home for what you marked, not for what you own… The distinction
> worth stating, because the two look alike from outside: **reading annotations out
> of KOReader or Kobo is very much wanted** and is on the roadmap; **serving files
> is not.**

The line is *holding and serving*, not *reading*. The owner's own framing of this
feature says the same: **"it will not provide a reader screen. it will read itself
to determine position of the quotes."**

So the decision stands, and this plan is bound by it as an invariant rather than
excused from it:

> **The file is never stored.** It arrives in a request, is parsed in memory,
> yields positions, and its bytes are discarded when the handler returns. Nothing
> is written to disk, nothing to the database, no cache, no cover-store sibling. A
> guard asserts it, and `docs/PLAN.md` gains the sentence.

---

## What already exists

Verified against `v3` at the commit this file lands on.

| Piece | State |
| :-- | :-- |
| `dialogues.timestamp` | **One free-text `TEXT` column** (0003), documented as "free text; HH:MM:SS sorts lexically" |
| An end time, anywhere | **None.** No `end`, no `duration`, on any table. `timestamp_orig` exists only on `staged_quotes`, not on the live row |
| `annotations.location` | Free-text `TEXT` (0001) — "free text page/loc/%", holding `p.142`, `610-612`, `42%`, `1234`; **not part of the dedupe hash** |
| `annotations.chapter` / `chapter_no` | `TEXT` (0001) / `REAL` (0044) |
| The clock vocabulary | `locformula.go:92` — `(\d{1,3}):([0-5]\d)(?::([0-5]\d))?`, and a match counts as a clock **only when not touching a digit** on either side |
| Locator arithmetic | **Built** — `locformula.go` rewrites the numbers inside a locator string and leaves the surrounding text alone; `add`/`subtract`/`multiply`/`divide`/`set`/`reset` |
| The work-detail control row | `WorkDetails.jsx:1471-1489` — a `GhostButton` with `IconMetadata` calling `onFetch` (`:885` → `setView('lookup')`), an `InfoDot`, a `flex-1` spacer, an optional Delete. A plain `flex flex-wrap`, **not** a `Scroller` |
| Re-verify | **Built, and it is this feature's shape**: fetch → per-field diff with alternatives → the reader ticks each row → apply. `reverifyBookFields` / `reverifyMovieFields` are the allow-lists; `emptyStored()` ticks a pure fill and leaves an overwrite unticked |
| The Checks screen | **A composite of two sections** — `StagingPage` (imports awaiting approval) and `CleanupPage` (stray marks). `ChecksPage.jsx` is 63 lines of composition |
| Cleanup's approval model | Per-finding: shows before and after, **Accept** applies the fix, **Ignore** records a refusal in `cleanup_ignores` (0052) keyed `(user_id, kind, item_id, field, rule, match_hash)`, hash = a fold of the matched spans. Accept answers `{applied, stale, duplicates}` — `stale` meaning the text moved since the scan |
| Accept-all | **Deliberately absent from Cleanup**, argued in the file: each finding is one press |
| Cleanup's scan | On demand, capped at **500** findings with a truncation warning; nothing stored but the refusals |
| Upload caps | Imports **5 MB**; **fonts 12 MB** (`maxFontUpload`), **covers 12 MB** (`maxUploadBytes`). So a 12 MB precedent exists |
| Text matching | `internal/search.Distance(a, b string, budget int) int` — full edit distance, returns `budget+1` when exceeded, already used by cloze grading |
| Normalisation | `store.CastKey(s)` = `normalizeQuoteText(s)` — **the same fold the dedupe hashes use**, "reused rather than restated so a curly apostrophe means the same thing in a character's name as it does in the line she speaks" |
| `archive/zip` | Imported and in use (`export_handlers.go`) |
| `encoding/xml` | **Never imported.** EPUB parsing would be its first use — stdlib, no budget cost, but a first |
| TIP codes | `TIP-META-011..018` is the **force-fetch and re-verify** family; `TIP-CLEANUP-001..003` is scan / apply / ignore-record |

### What the verification changed

**There is no end time, and adding one costs more than a column.** I assumed a
dialogue could hold a span. It cannot — `timestamp` is one free-text field, and it
is read by the export binding, the card's meta line, the quiz's locator display,
the bulk field table and `locformula`'s rewriter. An end time touches all of them.
See *The end time* below; it is the one schema decision in this plan.

**This is re-verify with a file as the provider**, and that is the strongest thing
available to build on. Re-verify already fetches from somewhere, produces a
per-field diff, asks the reader to tick, and applies. A subtitle track is a
provider that arrives as bytes instead of over HTTP — which incidentally keeps
`internal/metadata/`'s monopoly on outbound calls intact, because there is no
outbound call. A new code belongs in the `TIP-META-*` family for the same reason.

**Checks is a composite, so "flows to Checks" means a third section, in Cleanup's
mould rather than Staging's.** Staging is for rows that do not exist yet; these are
proposed *corrections to existing rows*, which is exactly what Cleanup is.
Cleanup also already solved the requirement a repeatable bulk scan cannot do
without: **a durable refusal**, so a rejected proposal is not offered again on the
next run. `cleanup_ignores`'s span-hash key is the model.

**Cleanup's "no accept-all" is a real constraint on the word "bulk", and it needs
splitting rather than overriding.** Its argument is that a text rewrite needs an
eye per finding. That is true of a fuzzy match and false of an exact one — so the
evidence differs per row, and the plan groups by it rather than picking one rule
for all. See *Approving*.

**The clock regex constrains the output format.** Any computed time must be written
in a form `locformula.go` still recognises, or the first offset correction applied
to a computed value silently does nothing. `H:MM:SS` and `HH:MM:SS` qualify;
`1:2:3` and `01:02:03.480` do not — the fractional part would leave a stray
element beside a rewritten clock, which is the exact failure that regex's
digit-adjacency rule was written to avoid.

---

## The formats

### Subtitles — all hand-rollable, no dependency

| Format | Structure | Notes |
| :-- | :-- | :-- |
| **SRT** | index, `HH:MM:SS,mmm --> HH:MM:SS,mmm`, text, blank | Comma decimal separator, not a period |
| **WebVTT** | `WEBVTT` header, `HH:MM:SS.mmm --> HH:MM:SS.mmm`, optional cue ids and settings | Period separator; cue settings after the timestamps must be ignored |
| **ASS / SSA** | `[Events]` with a `Format:` line naming the field order, then `Dialogue:` lines | **Two traps.** Times are `H:MM:SS.cc` — *centi*seconds, not milliseconds. And the text field is last, may contain commas, so **everything after the ninth comma is text** — splitting on every comma is the common bug. Override tags `{\pos(...)}`, `{\i1}` and drawing commands must be stripped, and `\N` / `\n` / `\h` unescaped |
| **SUB/IDX (VobSub)** | Bitmap subtitles | **Refused.** There is no text to match without OCR, and OCR is a decision this app already made elsewhere |

The `Format:` line is why ASS cannot be parsed positionally: the field order is
declared per file and readers are required to honour it.

### Ebooks — EPUB is cheap, MOBI is a different order of work

**EPUB** is a zip: `META-INF/container.xml` names the OPF, the OPF's spine gives
the reading order of XHTML documents. `archive/zip` is already imported and
`encoding/xml` is stdlib, so the cost is a parser, not a dependency.

**MOBI / AZW / AZW3** is a Palm database, and two fields at fixed offsets decide
everything (Calibre, `format_docs/pdb/mobi.txt`):

```
PalmDOC header
  2  Compression      1 = none, 2 = PalmDOC, 17480 = HUFF/CDIC
  ...
  2  Encryption Type  0 = none, 1 = Old Mobipocket, 2 = Mobipocket
```

- **DRM detection is a two-byte read.** `Encryption Type != 0` → refuse, by name,
  before anything else is attempted. That is exactly the owner's "no DRM ones", and
  it is certain rather than heuristic.
- **`Compression` decides the cost.** `1` is a copy and `2` is PalmDOC LZ77, which
  is a short, well-understood decoder. **`17480` is HUFF/CDIC — a Huffman
  dictionary — and is a different order of work.** The plan supports 1 and 2,
  detects 17480 and says so plainly, and treats bringing it in as its own decision.
- AZW3 is KF8: a Palm container that also carries a MOBI database for backward
  compatibility, so the same header read applies before anything KF8-specific.

**Recommendation: EPUB first, MOBI/AZW behind the sample.** Which compression the
owner's own files use is the fact that decides whether the ebook half is a week or
a month, and it is a two-byte read on a file I do not have yet.

---

## What position to compute, and what cannot be reproduced

The instruction was to emulate Readest. Reading the two Readest exports the owner
supplied shows that **its page numbers are not in the file and cannot be derived
from one.** The JSON carries `cfi` and `xpointer0/1` per annotation plus a
book-level `progress: [879, 1837]`; the page appears only in the *markdown* export,
computed at export time from Readest's own pagination — which depends on viewport
and font. So a server can produce *a* stable page number, not *Readest's*.

What can be computed deterministically, and is a better fit because the app already
stores it:

| Value | How | Why this one |
| :-- | :-- | :-- |
| **Location** | `floor(byteOffset / 128) + 1` over the concatenated spine text | 128 bytes of raw text is the published convention for a Kindle location, and `annotations.location` **already holds exactly this unit** whenever the Kindle importer writes a `loc` binding. The computed value is the same kind of thing the library already contains |
| **Chapter and chapter_no** | The spine item's nav title and its index | Two columns that already exist and are usually empty |
| **Percent** | offset / total text length | Free, and `location` already accepts `42%` |
| **A page** | — | **Not offered.** It would be a number invented by this app and presented as the book's. Readest's own is its renderer's |

---

## The matching

One algorithm serves both halves; only the unit at the end differs.

1. **Normalise through `store.CastKey`** — the dedupe fold — on both sides, so a
   curly apostrophe in a subtitle means what it means in the stored line. Reused,
   not restated.
2. **Cheap filter first.** Index the file's text by token; take only candidates
   sharing enough rare tokens with the quote. Edit distance on every cue × every
   quote is `O(n·m)` and a film has ~1,500 cues.
3. **Then `search.Distance` with a length-scaled budget**, the same shape cloze
   grading already uses — an edit budget per length band rather than a flat ratio.
4. **Match across cue boundaries.** A stored line often spans two or three cues, so
   the candidate is a sliding window of consecutive cues; the result takes the
   **start of the first** and the **end of the last**.
5. **Refuse ambiguity rather than resolve it.** If the best match is not clearly
   better than the second best, the row is reported as *ambiguous* and carries both.
   A short line — "Yes." — will match a dozen cues, and guessing is worse than
   saying so.
6. **A consistent offset across matches means the wrong cut.** If most matches land
   with the same delta, the file is for a different release, and every timestamp it
   would write is wrong by the same amount. Report the estimated offset and let the
   reader apply or discard it — `locformula`'s existing `add`/`subtract` is the tool,
   which is why the output format has to satisfy its clock regex.

**Shows are per-episode, and that is a real limit.** A subtitle file covers one
episode; a dialogue row carries `season` and `episode`. So a file is matched only
against that episode's lines, and the reader supplies one file per episode. There is
no folder traversal anywhere in the tree, and this plan does not add one.

**The file finds its own work.** For a bulk run over several files, nothing reads
the filename — consistent with the import plan's rule. A file belongs to the work
whose quotes it matches; if it matches none, it says so.

---

## The end time

`dialogues` can hold a start and nothing else. Two ways, and I recommend the first.

**A new column, `dialogues.timestamp_end TEXT NOT NULL DEFAULT ''`.**
An end is a distinct fact, and 0047's precedent is that a fact gets a column. The
bill is the one `docs/PLAN.md` already names as "the debt of a write-not-a-filter":
every path that writes a dialogue owes it — the two create endpoints, the importers,
approval out of staging, the merge — and *a debt paid at each site is a debt one
site forgets*, which is how the review-exclusion flag went missing from one
`INSERT`. It also owes an export binding, a round-trip test, an entry in the shared
bulk field table, and a place in the card's meta line.

**Instead of** a range inside the existing free-text field (`01:02:03–01:02:07`).
Cheaper — no migration, it still sorts lexically by its start, and `locformula`
would shift both ends correctly, which is the behaviour you want. Rejected because
`timestamp` is read as a single locator by the export, the meta line, the quiz and
the bulk editor, and making it sometimes-a-range means every one of those has to
learn the second form. One fact spelled two ways is the failure this repo keeps
writing entries about.

---

## Where the result goes

### A third section on Checks, in Cleanup's shape

`ChecksPage.jsx` composes `StagingPage` and `CleanupPage`. This adds a third —
proposed locators — and it is Cleanup's shape, not Staging's, because these are
corrections to rows that already exist.

Per proposal: the quote, the work, the **current** value, the **proposed** value,
the evidence (the cue text that matched, or the surrounding sentence), and the
confidence. Accept applies; Ignore records a refusal.

**The refusal has to be durable and has to be keyed correctly.** `cleanup_ignores`
keys on `(user_id, kind, item_id, field, rule, match_hash)` where the hash folds the
matched spans — so a refusal survives a rescan but does not survive the text
changing. The same shape applies here, with the hash over the proposed value: reject
`01:02:03` for this line and it stays rejected; a later run that proposes
`01:02:07` is a new proposal, because it is.

**`stale` is the case to copy.** Cleanup's accept answers `{applied, stale,
duplicates}`, where `stale` means the text moved between the scan and the press.
A locator proposal goes stale the same way, and answering it honestly is better
than writing over an edit the reader made in between.

### Approving

Cleanup has no accept-all, deliberately: each finding needs an eye. That argument is
about *judgement*, and judgement is what an exact, unique, verbatim match does not
need. So the section groups by evidence:

- **Exact and unique** — the quote appears once, verbatim after the fold, in one
  window. **Accept all of these together.** This is where a 200-line film becomes
  one press, and it is the reason the word "bulk" is in the request.
- **Fuzzy, or ambiguous, or offset-suspect** — one press each, with the evidence
  shown. Cleanup's rule, unchanged, for the rows it was written for.

That split is a departure from Cleanup's stated position and the plan says so
rather than quietly widening it.

---

## Entry points

**On a work.** A second `GhostButton` in `WorkDetails.jsx:1471`'s row, beside the
metadata fetch it is a sibling of — same shape, same `InfoDot` treatment, a file
picker rather than a lookup view. The row is `flex flex-wrap`, so it wraps rather
than needing a `Scroller`; with two buttons, an `InfoDot`, a spacer and Delete it is
close to the point where it would.

**In bulk.** One surface that takes several files at once and reports per file:
matched, ambiguous, unmatched, and which work each file found. The natural home is
beside the other library-wide operations rather than on a work, and the results all
land in the same Checks section regardless of which door opened them.

**No `accept` attribute on either picker**, per the import plan's rule: a subtitle
saved as `.txt` is still a subtitle, and the OS dialog hiding it is depending on the
extension one dialog removed. Detection is by content — an `[Events]` section, a
`WEBVTT` header, an `-->` arrow, a zip's `container.xml`, a Palm header.

**Cap: 12 MB**, matching the font and cover precedent rather than the import 5 MB,
because an EPUB routinely exceeds five and a subtitle never approaches either.
Above it, the answer names the size rather than failing generically.

---

## The samples this needs before it can ship

`docs/PLAN.md` is explicit that an unverified importer either waits or wears a
label: *"An importer that has never met a real file is a guess wearing the clothes
of a feature."* So:

| Sample | Decides |
| :-- | :-- |
| One `.srt` for a film with quotes already in the library | The whole subtitle path end to end, including whether real matches are exact or fuzzy |
| One `.ass` **with styled signs in it** | The override-tag stripping and the ninth-comma rule — the two places a naive parser breaks |
| One `.vtt` | Whether cue settings and cue ids appear in practice |
| One non-DRM `.epub` | Spine walking, and whether computed locations land near the ones the Kindle importer already wrote for the same book |
| One `.azw3` or `.mobi` | **The biggest open cost in the plan** — a two-byte read says whether `Compression` is 2 (short decoder) or 17480 (HUFF/CDIC, its own decision) |
| One subtitle file **for the wrong cut** of a film you have | The offset detection, which cannot be tested with a matching file |

They install as gitignored `*_real.*` fixtures beside the parsers, per the
convention (`.gitignore`, `PLAN.md`), with a committed synthetic twin for CI. Until
the ebook samples land, the ebook half of this plan is **unverified and ships
labelled experimental or not at all** — the same rule that held Kobo back and
labelled Kindle clippings.

---

## Guards

| Guard | What it needs |
| :-- | :-- |
| **The file is never stored.** | The invariant this plan is allowed under. Assert the handler writes nothing to the data dir and nothing to any table but the proposals; a `t.TempDir()` census before and after |
| **DRM is refused before parsing.** | `Encryption Type != 0` answers with its own message and reads no further |
| **`Compression = 17480` is named, not mishandled.** | A synthetic header is enough; it must not silently produce garbage text |
| **ASS: the ninth comma.** | A `Dialogue:` line whose text contains commas survives intact |
| **ASS: centiseconds.** | `0:01:02.50` is 62.5s, not 62.05s |
| **ASS: `Format:` order is honoured.** | A file with a reordered `Format:` line parses correctly |
| **A quote spanning three cues gets the first start and the last end.** | The whole point of the window |
| **An ambiguous match is reported, not resolved.** | A quote that matches several cues produces an ambiguous row |
| **A wrong-cut file reports an offset.** | Shift a fixture by 3s and assert the estimate |
| **A refusal survives a rescan and does not survive a changed proposal.** | The `cleanup_ignores` contract, restated for locators |
| **A stale proposal is refused, not applied.** | Edit the quote between scan and accept |
| **Computed times satisfy `locformula`'s clock regex.** | Otherwise the first offset correction on a computed value does nothing |
| **A computed location is comparable to an imported one.** | On a book where the Kindle importer already wrote `loc` values, the computed ones land near them. The single most convincing test available, and it needs the real sample |
| `go test ./...` | The new column makes this a schema change; every create path owes it |

---

## The order

1. **The subtitle parsers** — SRT, VTT, ASS/SSA, with the traps above. Pure
   functions, synthetic fixtures, no HTTP. — `internal/subs/` (new)
2. **The matcher** — normalise through `store.CastKey`, token filter,
   `search.Distance`, cue windows, ambiguity, offset estimate. Pure.
   — `internal/subs/match.go`
3. **`dialogues.timestamp_end`**, and the debt at every write site, the export
   binding, the round-trip test, the field table entry, the meta line.
   — a migration, `dialogue_handlers.go`, `import_*.go`, `export_handlers.go`
4. **The proposals section** — table, the durable refusal, `stale`, the grouped
   accept. — a migration, `internal/httpapi/locators.go` (new),
   `ChecksPage.jsx`, `CleanupPage.jsx`'s row component as the model
5. **The work-detail button and the bulk surface.** — `WorkDetails.jsx`, and the
   bulk host
6. **EPUB** — zip, `container.xml`, OPF spine, XHTML to text with offsets, then the
   same matcher; location, chapter, percent. — `internal/ebook/` (new)
7. **MOBI/AZW3** — the header read, DRM refusal, compression 1 and 2. **Only after
   the sample says what it is.** — `internal/ebook/mobi.go`
8. **Help and infodots** — a fifth `checks.*` help entry for the new section, and
   the InfoDot beside the new button, in `en.txt` and `bn.txt`
9. **Docs** — `docs/PLAN.md` (the boundary sentence, the end-time column, the
   accept-all departure, and this plan folded in), `CHANGELOG.md`,
   `docs/troubleshoot.md` for the new `TIP-META-*` code, `DEVELOPMENT.md`'s file
   map for two new packages, `docs/ui-glossary.html` if the section is documented

## Verification

```bash
go vet ./... && go test ./internal/subs/ ./internal/ebook/ -v
go test ./internal/httpapi/ -run 'Locator|Cleanup|Checks|Dialogue' -v
go test ./...
cd web/frontend && npm test
make frontend && make glossary && npm run glossary:check
node scripts/doc-map-check.mjs
```

By hand, against a real backup rather than `seed.mjs`:

- Drop a real `.srt` on a film whose lines you kept. Read the evidence column on
  every fuzzy row and decide whether the threshold is set right — that judgement is
  the feature, and no test makes it.
- Drop a subtitle for the wrong cut and confirm it says so instead of writing 200
  wrong times.
- Drop a DRM'd `.azw3` and read the refusal.
- Drop a real EPUB for a book imported from Kindle and compare the computed
  locations against the imported ones.
- Reject a proposal, rescan, and confirm it stays rejected.

## Out of scope, named

- **A reader.** Stated because the feature reads book files and the boundary is the
  reason it is allowed to: no rendering, no pagination for display, no storage.
- **Folders and archives.** One file at a time, several files at once, no
  traversal — the same limit the import plan holds.
- **VobSub, PGS and any bitmap subtitle**, which would need OCR.
- **HUFF/CDIC**, until a sample proves it is needed.
- **KFX**, Amazon's newer format, which is a different container again.
- **Writing an end time back out to a subtitle**, or any export of positions.
- **Guessing the work from a filename.** The content decides.
