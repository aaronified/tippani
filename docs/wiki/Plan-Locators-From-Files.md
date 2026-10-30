# Locators from files — what is left to build

Source of truth: this wiki page.

A quote you kept has words but often no position, and the file it came from knows. Times for film lines and chapter and
percent-through for book quotes shipped; they are recorded in
[ADR-0905](ADR-0905-A-Work-Keeps-The-File-Its-Quotes-Came-From.md) (the file, and the boundary that does not move) and
[ADR-0916](ADR-0916-A-Books-Location-Is-A-Percent-Of-This-File.md) (why a book's place is a percent of this file and not a page).
How it works now is on [Source files and context](Source-Files-And-Context.md). The longer history of this plan is in git.

Only what is **not built** is below. MOBI, AZW3 and PDF are built: see
[ADR-0918](ADR-0918-Kindle-Files-And-PDFs-Are-Source-Files-Read-By-Their-Text-Alone.md).

## Not built

- **Publisher page numbers from an EPUB's page list.** EPUB 3's `page-list` and EPUB 2's NCX `pageTarget` carry the *print
  edition's* pages. Where a file has them they are a real page number and should be offered as one. The file this was measured on
  had none, so a book gets a chapter and a percent, which is the common case.

### Where a page map does exist, it wins

EPUB 3's `page-list` and EPUB 2's NCX `pageTarget` carry the *print edition's* pages. That is a real page number and should be
offered as one, labelled as the publisher's, and never beside a computed percent as though they were the same thing.

### Out of scope, still

- **HUFF/CDIC**, the dictionary compression some old MOBI use: refused by name, until a sample proves it is needed.
- **KFX**, Amazon's newer format, which is a different container again.
- **The Kindle contents index** (the INDX records). A Kindle file's chapter is its nearest heading instead.
- **A reader.** Nothing here renders the file.

See also: [Plans index](Plans-Index.md) · [Work source files](Plan-Work-Source-Files.md) · [Roadmap](Roadmap.md) · [Home](Home.md)
