# Locators from files — what is left to build

Source of truth: this wiki page.

A quote you kept has words but often no position, and the file it came from knows. Times for film lines and chapter and
percent-through for book quotes shipped; they are recorded in
[ADR-0905](ADR-0905-A-Work-Keeps-The-File-Its-Quotes-Came-From.md) (the file, and the boundary that does not move) and
[ADR-0916](ADR-0916-A-Books-Location-Is-A-Percent-Of-This-File.md) (why a book's place is a percent of this file and not a page).
How it works now is on [Source files and context](Source-Files-And-Context.md). The longer history of this plan is in git.

Only what is **not built** is below.

## Not built

- **MOBI, AZW and AZW3.** Only EPUB is read. The format findings the earlier design held are kept below, because they decide the
  cost.
- **Publisher page numbers from an EPUB's page list.** EPUB 3's `page-list` and EPUB 2's NCX `pageTarget` carry the *print
  edition's* pages. Where a file has them they are a real page number and should be offered as one. The file this was measured on
  had none, so a book gets a chapter and a percent, which is the common case.

### Ebooks — MOBI is a different order of work

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

**Recommendation: MOBI/AZW behind the sample.** Which compression the owner's own files use is the fact that decides whether this
is a week or a month, and it is a two-byte read on a file not yet in hand. One non-DRM `.azw3` or `.mobi` is the sample that
decides it.

### Where a page map does exist, it wins

EPUB 3's `page-list` and EPUB 2's NCX `pageTarget` carry the *print edition's* pages. That is a real page number and should be
offered as one, labelled as the publisher's, and never beside a computed percent as though they were the same thing.

### Out of scope, still

- **HUFF/CDIC**, until a sample proves it is needed.
- **KFX**, Amazon's newer format, which is a different container again.
- **A reader.** Nothing here renders the file.

See also: [Plans index](Plans-Index.md) · [Work source files](Plan-Work-Source-Files.md) · [Roadmap](Roadmap.md) · [Home](Home.md)
