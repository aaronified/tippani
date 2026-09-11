# Locators from files — a subtitle for a timestamp, an ebook for a location

A quote you kept has words but often no position. The file the words came from
knows: a subtitle track carries the start and end of every line, and an ebook
carries the text in order. So the reader hands over the file, the app reads it,
finds each quote in it, and offers the positions it found — as proposals, never as
writes. One file on one work offers them on a screen showing that file; a run over
several files offers them on Checks. Same proposals, two doors.

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
| An end time | **Shipped while this plan sat.** `dialogues.timestamp_end TEXT NOT NULL DEFAULT ''` and the same on `staged_quotes` — migration 0070, commit `6800f97`, 10 September. See the correction below |
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

**The supplied subtitle contradicts most of what a parser would assume.** Measured
over the owner's own file — *V for Vendetta*, 1,823 cues — and every one of these is
a requirement rather than an observation:

| Measured | Consequence |
| :-- | :-- |
| **8,236 CRLF and 78 bare LF in one file** | Splitting on `\r\n` silently loses 78 cue boundaries. Split on `\n`, strip `\r` |
| **274 cues open with `...`, 290 close with it** — about one in six | A sentence running across cues is the norm, not an edge case, and those ellipses are **join markers, not the reader's punctuation**. They come out before any compare |
| **114 cues are nothing but a bracketed effect** | Never a quote. Excluded from matching, kept visible on the screen |
| **177 cues carry two speakers**, one per line behind a leading `-` | A cue is not one utterance, so neither the character nor the selection can assume it is |
| **44 distinct `NAME:` labels, on roughly 120 lines of 1,823** | The character is available on about **7%** of cues. "Add character if available" is genuinely conditional, and the screen must not imply otherwise |
| **One cue carries `<i>`** | Markup is rare here and must still be stripped, because rare is not never |
| **The file is ASCII with accented letters dropped** — `Voilà` appears as `Voil ` with the letter simply gone, not mis-encoded | A correctly stored quote **will not match its own subtitle line** on a literal compare. This is the evidence, from the owner's file, that the fold has to be lossy on both sides |

**The same track arrived twice, and the pair is the best guard in the plan.** The
owner then supplied the ASS of the *same* subtitle — 1,823 `Dialogue:` lines against
the SRT's 1,823 cues, cue for cue, with the text identical on **1,822 of the 1,823**
(the one difference is the italic cue, `<i>…</i>` in the SRT and `{\i1}…{\i0}` in the
ASS). So the two parsers can be asserted against *each other* rather than against a
hand-written expectation: parse both, and every cue must agree. That is a test with
no fixture to maintain.

| Measured in the ASS | Consequence |
| :-- | :-- |
| **`Name` is empty on all 1,823 lines** | ASS has a field for the speaker and this file does not use it. The character still comes from the `NAME:` prefix inside the text, which is the SRT's only mechanism. The `Name` field is **read when present and never depended on** |
| `; Script generated by Ebby.co`, `ScriptType: v4.00+`, **one `Default` style, no positioning, two override tags in the whole file** (`{\i1}` and its `{\i0}`), no drawing commands | This `.ass` is **a converted SRT**, which is what most `.ass` files in the wild are. It carries none of ASS's extra capability, so it does **not** exercise the styled-signs path the parser most needs testing on — that sample is still outstanding |
| Times are `0:00:01.00` — `H:MM:SS.cc` | Centiseconds confirmed against a real file rather than a spec |
| **The ASS is up to 5 ms from the SRT on the same cue** (`4.07` against `4.074`) | Centisecond storage is lossy, so two containers of one track do not give identical times. The cross-format guard compares to a tolerance — and the written output is whole seconds regardless, because `locformula`'s clock regex admits no fraction |
| **1,021 of 1,823 lines carry `\N`** | The line break is the majority case, and it is the same break the SRT spells as a newline — so the two-speaker `-` cue and the `NAME:` prefix both survive the conversion |
| The `[V4+ Styles]` `Format:` line declares 23 fields and the one `Style:` line supplies 23 | The declared-order rule holds in both sections, not only in `[Events]` |
| Pure ASCII, accents dropped, exactly as the SRT | The lossy fold is required on this path too |
| **Cue 1 of both files is `Subtitles downloaded from www.OpenSubtitles.org`** | A real file opens with an advertisement. To a parser it is a cue like any other: it must not anchor an offset estimate, and it will sit at the top of the screen looking like dialogue |
| **The file was delivered as `.ass.txt`** | The never-depend-on-the-extension rule, demonstrated rather than argued |

**Three files are three files, and the owner's caution is the right one** — *all srt
/ epub are not the same.* Everything above was measured on one subtitle track in two
containers and one EPUB. What that is good for is the **floor**: a parser that
cannot survive a bare LF, a dropped accent, a `\N`, an NCX-only EPUB or an
advertisement in cue 1 is wrong, because a real file does all of those. It says
nothing about the ceiling. So:

- **Nothing branches on what these files happen to do.** No "a film has about 1,800
  cues", no "an ASS has one style", no "an EPUB has ~50 spine documents".
- **Every number here is a fixture, not a threshold.** The edit budget, the ambiguity
  margin and the offset tolerance are tuned against a library, not against this film.
- **The parser reports what it did not understand** instead of dropping it. A cue it
  cannot time, a spine document it cannot open, a `Format:` field it does not know:
  counted, named in the answer, shown on the screen. That way the next unfamiliar
  file announces itself rather than quietly producing 40% fewer matches.
- The long tails these three did not exercise are real and are not crashes: an SRT
  with a byte-order mark, numbering that restarts mid-file, overlapping cues,
  `X1:`/`Y1:` coordinates after the arrow; an ASS with several styles, positioned
  signs and `Comment:` lines; an EPUB with a wrong `mimetype`, obfuscated fonts, a
  spine out of document order, or XHTML that is not well formed.

**The match rate is measured now, against the owner's own library, and it changed
the algorithm.** The archive was restored to a scratch server, its *V for Vendetta*
and *Dust of Dreams* rows read back, and both files matched against them.

| Measured | |
| :-- | :-- |
| **30 of 30** stored lines of the film found their place in its subtitle | 12 verbatim after the fold, 12 within 5% edit distance, 6 within 15%, **none missed** |
| **36 of 36** stored highlights of the book found their place in its EPUB | Every one, and the positions come out in reading order |
| Worst ratio on a match | **11.8%**, on a 76-character line. A flat 5% budget would have lost six of the thirty |
| Exact-and-unique share | **12 of 30 — 40%** |

Four things follow, and the third is a change to the plan rather than a
confirmation of it.

**The accept-all group is a large minority, not most of a film.** 40% is worth
having — it is twelve presses saved out of thirty — but the phrase "a 200-line film
becomes one press" below was optimistic and is corrected. Most rows still get an
eye, which is the outcome Cleanup's rule wanted anyway.

**The budget has to be length-scaled and generous.** The worst true match sat at
11.8%, and it was one of the *short* lines — which is the opposite of the intuition
that short lines are easy. A short quote has few characters for a dropped accent or
a swallowed article to hide in, so the same one-word difference is a far larger
ratio. 15% of length, floored at a few characters, admitted every true match here
and invented none.

**The sliding window of consecutive cues is wrong, and the measurement is what says
so.** *The matching* below proposes a window of a few consecutive cues. The owner's
stored lines span **1 to 21 cues, median 3** — the long ones are speeches kept
whole, and no fixed cap that admits a 21-cue speech is still a cheap filter. The
correct shape is the one that has no cap: **fold every usable cue into one string
with a character-to-cue map, then find the best-fitting substring** by edit distance
with a free start and a free end. The span falls out of the alignment — the cue
owning the first matched character gives the start, the cue owning the last gives
the end — which is the same answer the window was reaching for, without having to
guess how wide it should be. The token prefilter still does its job: it chooses
where to align, not how far.

**Junk cues have to leave the concatenation, not just the candidate list.** With the
OpenSubtitles advertisement still in the string, a 138-character quote aligned back
across it and reported a start of 1s for a line that begins around 40s. Excluding a
cue from *being matched* is not enough; it has to be absent from the text the
alignment runs over, or it lends its characters to a neighbour's span. 116 of 1,823
cues go (114 bracketed effects, the advertisement, one empty), and the screen still
draws all 1,823.

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
and font.

The supplied EPUB — *Dust of Dreams*, 1.45 MB, 67 entries — says the rest:

| Measured | Consequence |
| :-- | :-- |
| `mimetype` first and correct, `META-INF/container.xml` → `content.opf` at the root, **52 spine documents, all resolved**, 64 manifest items | The walk is exactly as specified; nothing exotic |
| **No `encryption.xml`, no `rights.xml`** | DRM-free, so it parses. EPUB DRM is a file's presence, not a header field — unlike MOBI's two-byte read |
| **EPUB 2.0, NCX only, no nav document** | Both generations have to be read. A parser written only to EPUB 3 fails on this |
| **No `page-list`, no `pageTarget`, no `epub:type="pagebreak"` anywhere** | This file carries **no publisher page numbers**. Any page shown for it would be invented |
| **2,197,915 bytes of text across the spine → 17,171 locations at 128 bytes** | A plausible figure for a novel this size, and the arithmetic works |

**Where a page map does exist, it wins.** EPUB 3's `page-list` and EPUB 2's NCX
`pageTarget` carry the *print edition's* pages. That is a real page number and
should be offered as one. This file has neither, so it gets locations and chapters
— which is the common case, not the exception.

**And where one does not, the reader may already have supplied it.** All 36 stored
highlights of this book carry a `p.NNN` location, from Readest's markdown export.
Matched against the EPUB, the stored page and the computed position agree on order
**perfectly** — Spearman ρ = **1.0000** over all 36 — and the scale is close to
constant at ~0.0574 percent per page across the later two thirds, drifting to 0.041
over the first ten (front matter, which is pages with little text in them).

So a book with no page map can have one **fitted** from the pages its reader already
recorded, and a proposal for a new highlight can then be offered in the unit the
library is already written in. That is a real capability this measurement found, and
it carries three cautions that are not optional:

- **It is a fit, not a fact.** It interpolates between the reader's own pages, which
  came from one app's pagination of one edition. Offer it labelled as estimated, and
  never beside a `page-list` page, which is the real thing.
- **It needs enough anchors, well spread.** Thirty-six across a novel is plenty;
  three clustered in chapter one is not, and the front-matter drift above is exactly
  what a fit built on early anchors alone would get wrong.
- **It is one book.** Rank agreement this clean on a second title would make it a
  feature; on its own it makes it a hypothesis worth testing before it ships.

### A correction to this plan's own earlier claim

An earlier draft proposed, as its most convincing test, that computed locations
would land near the `loc` values the Kindle importer already wrote for the same
book. **That is wrong and the arithmetic says so.** A Kindle location counts bytes
of *Amazon's* file; this counts bytes of *this EPUB's* text. Different markup,
different source, different total — the two are not comparable and were never going
to be.

So a computed location is a **new, internally consistent unit**, not a reproduction
of anyone's. Two consequences the plan has to carry rather than gloss:

- **The proposal names where the number came from.** A location from an EPUB and a
  location from a Kindle export are both "location" and are not the same scale. The
  reader is told which they are accepting.
- **The extraction rule is part of the contract and must be frozen.** The byte
  offset depends entirely on how tags are stripped and whitespace is normalised —
  collapse runs or keep them, drop `<script>`/`<style>` or not, include or exclude
  `alt` text — and each choice moves every location by thousands. Pin it, test it,
  and record that changing it later **renumbers every location ever computed**,
  which is the kind of silent breakage this repo writes entries about.

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
4. **Align, do not window.** One folded string of every usable cue with a
   character-to-cue map, then a **best-fitting substring** by edit distance with a
   free start and a free end. The span falls out: the cue owning the first matched
   character gives the start, the cue owning the last gives the end. Measured spans
   run **1 to 21 cues** on the owner's own library, so no fixed window is both safe
   and cheap — and the prefilter in step 2 chooses *where* to align rather than how
   far to reach.
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

## The end time — decided elsewhere, the same way

**This section is now a record, not a decision.** It recommended a column; migration
0070 added exactly that column on 10 September, from the owner's own three words
("Film timestamp: start and end"), and reached it by the same argument this plan
gives — *"a second column, not a range inside the first… every consumer of
`timestamp` would have to learn the new spelling on the same day"*. It went further
than this plan did, onto `staged_quotes` as well, so the app's own Markdown
round-trip does not lose the field.

The debt the section warned about — *"a debt paid at each site is a debt one site
forgets"* — **appears to have been paid**: `timestamp_end` reaches the single
`INSERT INTO dialogues`, the export binding, `import_staging.go`, the staged bulk
editor, the Markdown importer, the shared bulk field table and the card's meta line.
The builder should confirm rather than trust this, but the column is not this plan's
work any more. **Step 3 of the order becomes a check, not a migration.**

The reasoning is kept below because it is still the argument for the shape, and
because a later reader deserves to see that the two sessions agreed.

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

### One file opens a screen; a bulk run goes to Checks

Two destinations, and the split is by how much the reader is holding in their head.

**One file on one work opens the file.** The reader chose this work and this file;
they can see both, and the fastest correction is the one made in front of the
evidence. That is the owner's instruction: *"adding the srt shall open a screen with
the srt, and the user may highlight text from that screen."*

**Several files at once cannot open several screens.** A bulk run reports per file
and its proposals land in Checks, reviewed the way every other proposal in this app
is.

They are the same proposals either way — one matcher, one row shape, one durable
refusal. **The screen is Checks' rows drawn against the file that produced them**,
not a second pipeline: a proposal left unaccepted on the screen is waiting in Checks
when the reader closes it, and accepting it on either surface accepts it on both. A
screen that produced its own answers would be the second copy of a verb the repo's
standing rule forbids.

### The subtitle screen

Not a reader and not a player: a list of cues, which is what the file is.

**What it shows.** Every cue in order — index, start, end, text — *including* the
ones matching is not allowed to use (the 114 bracketed effects, the advertisement in
cue 1), because hiding them makes the list disagree with the file and leaves the
reader no way to tell why. An excluded cue is drawn as excluded and names the rule
that excluded it.

**What is already marked.** Every quote the library holds for this work is matched
against the file before the screen draws, and each match is a highlight over the
cues it spans. The reader opens the screen and sees their own lines already lit,
with the proposed times beside them.

- **One good match** — highlighted, the proposal shown, one press to accept.
- **Several plausible matches** — *all* of them highlighted, as alternatives, and the
  reader picks. The owner's instruction: *"if there are multiple fuzzy matches, show
  all as options."* This is the ambiguity rule from *The matching*, rendered: the
  screen does not choose, and neither did the server.
- **No match** — the quote sits in a list of unmatched quotes beside the cues, and
  the reader finds it by hand. Which is what the selection is for.

**Fuzzy means fuzzy on both sides.** Punctuation, the join ellipses, the `NAME:`
prefix, the leading `-`, `\N` and `<i>` are all gone before either side is compared —
*"when fuzzy matching, all punctuation, timestamp will be ignored"* — and the fold is
`store.CastKey`, not a second normaliser written for this screen.

**Selecting by hand.** A drag across the cues selects text, and a selection crossing
cue boundaries is the normal case rather than the awkward one: it is how a line
spanning three cues is marked. The selection yields the **start of the first cue it
touches** and the **end of the last** — the same rule the automatic window uses, so a
hand selection and a found match produce the same kind of answer. It is then assigned
to an unmatched quote picked from the list beside the cues, or — because the reader
is looking at the line anyway — kept as a new quote on this work.

**The character, when it is there.** A `NAME:` label at the head of the first
selected cue, or the ASS `Name` field where a file fills it, is *offered* as the
character. Offered, because about **7%** of this file's cues carry one and a control
that is empty nineteen times in twenty must not look broken. The name goes through
`store.CastKey` — the fold cast dedupe already uses — so an existing person is found
rather than a near-duplicate created, and an unknown name is proposed, never silently
added.

**Where the work happens.** The **server parses, once.** The client receives cues
with times and text already normalised, plus the matches. There is exactly one
subtitle parser and exactly one matcher, both in Go and both tested; a JavaScript
second copy would be the two-implementations failure the repo has a directive
against, and it would need the file handed to it, which the invariant forbids. The
parse is a request and the bytes die with it — what the client holds is parsed cues,
for as long as the screen is open.

**Scale, and it is the one unknown here.** 1,823 rows is more than any list in the
app draws today, and there is no windowing anywhere in the tree — the perf harness
seeds 2,000 quotes precisely because that is where the board goes slow. So the cue
list is the first surface that genuinely needs it, and *The order* puts it where it
can be measured before anything inherits it. A cheap retreat exists if the
measurement demands one — draw the cues near each match plus a run either side, the
rest reachable — but it is a fallback, not the design, because a reader searching by
hand needs the whole file.

**The standing rules it is bound by.** The cue list scrolls, so it is a `Scroller` or
`useEdgeScroll` and never bare `overflow`. Cue text wraps and never truncates. A
character name is a name and never truncates either. The accept/discard pair is a
tick and a red cross, and the tick arms only once a selection differs from what is
stored.

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
  alignment. **Accept all of these together.** Measured at **40%** of the owner's
  lines for this film (12 of 30), which is twelve presses saved and not the whole
  film — the earlier draft's "a 200-line film becomes one press" was optimistic and
  is corrected here.
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
close to the point where it would. Picking a file here **opens the screen**, the way
the metadata button opens `setView('lookup')` — the sibling control's sibling
behaviour.

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
| One `.srt` for a film with quotes already in the library | **Supplied** — *V for Vendetta*, 1,823 cues. It produced the requirements table above. What it still cannot settle is the match rate, which needs the library |
| One `.ass` **with styled signs in it** | **Half supplied.** The ASS of the same track arrived and gives centiseconds and the ninth-comma rule a real test — but it is a converted SRT with one style and two override tags, so **styled signs remain untested** |
| One `.vtt` | Whether cue settings and cue ids appear in practice |
| One non-DRM `.epub` | **Supplied** — *Dust of Dreams*: EPUB 2, NCX only, no page list, 52 spine documents, 17,171 computed locations. It settled the page-number question by having none, and disproved this plan's own comparability claim |
| One `.azw3` or `.mobi` | **The biggest open cost in the plan** — a two-byte read says whether `Compression` is 2 (short decoder) or 17480 (HUFF/CDIC, its own decision) |
| One subtitle file **for the wrong cut** of a film you have | The offset detection, which cannot be tested with a matching file. **Still outstanding** — the supplied file is the right cut, which is why it matched 30 of 30 |
| A **second** book with stored page numbers | Whether the page fit above is a feature or a coincidence of one title |

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
| **A quote spanning 21 cues gets the first start and the last end.** | Measured: the owner's longest kept speech spans 21. A fixed window is the failure this replaces |
| **An advertisement cue is absent from the concatenation, not merely unmatched.** | With it present a real quote aligned across it and reported a start 40 seconds early |
| **The budget admits an 11.8% difference on a short line.** | The worst true match measured. A flat 5% loses six of thirty |
| **An ambiguous match is reported, not resolved.** | A quote that matches several cues produces an ambiguous row |
| **A wrong-cut file reports an offset.** | Shift a fixture by 3s and assert the estimate |
| **A refusal survives a rescan and does not survive a changed proposal.** | The `cleanup_ignores` contract, restated for locators |
| **A stale proposal is refused, not applied.** | Edit the quote between scan and accept |
| **Computed times satisfy `locformula`'s clock regex.** | Otherwise the first offset correction on a computed value does nothing |
| **The extraction rule is frozen.** | A golden test pins the byte offsets a known EPUB yields. Changing how tags are stripped or whitespace collapsed renumbers every location ever computed, so it has to break a test rather than a library |
| **A computed location is labelled as computed.** | It is not the same scale as a Kindle `loc` — see the correction above — and the proposal says which it is. Assert the two never quietly become one number |
| **The SRT and the ASS of one track parse identically.** | Both supplied files: 1,823 cues each, same order, same text once `\N` and `<i>` are resolved, times equal to within a centisecond |
| **The ASS `Name` field is used when present and never required.** | The supplied file leaves it empty on all 1,823 lines; a fixture that fills it must also work |
| **A hand selection spanning three cues gives the first start and the last end.** | The same rule as the automatic window, so the screen and the matcher cannot drift apart |
| **A file the parser only partly understood says so.** | Unparsed cues, unopenable spine documents and unknown `Format:` fields are counted and named in the answer, never dropped |
| `go test ./...` | `timestamp_end` shipped in 0070; confirm the debt is paid at every write site rather than adding the column again |

---

## The order

1. **The subtitle parsers** — SRT, VTT, ASS/SSA, with the traps above. Pure
   functions, synthetic fixtures, no HTTP. — `internal/subs/` (new)
2. **The matcher** — normalise through `store.CastKey`, token filter,
   `search.Distance`, cue windows, ambiguity, offset estimate. Pure.
   — `internal/subs/match.go`
3. **Confirm `timestamp_end`'s debt is paid** — the column shipped in 0070, so this
   is a read of the write sites, the export binding and the round-trip test, not a
   migration. — `dialogue_handlers.go`, `import_*.go`, `export_handlers.go`
4. **The proposals section** — table, the durable refusal, `stale`, the grouped
   accept. — a migration, `internal/httpapi/locators.go` (new),
   `ChecksPage.jsx`, `CleanupPage.jsx`'s row component as the model
5. **The work-detail button and the subtitle screen.** Measure the 1,823-row list
   before anything else inherits the pattern. — `WorkDetails.jsx`, the screen, and
   `Scroller`
6. **The bulk surface**, reporting per file into the same proposals.
7. **EPUB** — zip, `container.xml`, OPF spine, XHTML to text with offsets, then the
   same matcher; location, chapter, percent. The extraction rule is pinned by a
   golden test in the same commit that writes it. — `internal/ebook/` (new)
8. **MOBI/AZW3** — the header read, DRM refusal, compression 1 and 2. **Only after
   the sample says what it is.** — `internal/ebook/mobi.go`
9. **Help and infodots** — a fifth `checks.*` help entry for the new section, and
   the InfoDot beside the new button, in `en.txt` and `bn.txt`
10. **Docs** — `docs/PLAN.md` (the boundary sentence, the end-time column, the
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
- Drop a real EPUB for a book you also imported from Kindle and confirm the two
  location scales are **labelled apart** rather than reconciled — they are not
  comparable, and the screen must not imply they are.
- Open the screen on a 1,800-cue file and scroll it on a phone. If it stutters, that
  is the windowing decision, and it is better taken here than after five surfaces
  copied the list.
- Reject a proposal, rescan, and confirm it stays rejected.
- Re-run the measurement above on a second film and a second book before the
  thresholds are frozen. 15% of length and a 40% exact share are two titles' worth
  of evidence, not the library's.

## Out of scope, named

- **A reader.** Stated because the feature reads book files and the boundary is the
  reason it is allowed to: no rendering, no pagination for display, no storage. The
  subtitle screen is not an exception — it lists cues the server parsed, holds no
  file, and has no ebook counterpart: an EPUB run reports, it does not open.
- **Folders and archives.** One file at a time, several files at once, no
  traversal — the same limit the import plan holds.
- **VobSub, PGS and any bitmap subtitle**, which would need OCR.
- **HUFF/CDIC**, until a sample proves it is needed.
- **KFX**, Amazon's newer format, which is a different container again.
- **Writing an end time back out to a subtitle**, or any export of positions.
- **Guessing the work from a filename.** The content decides.
