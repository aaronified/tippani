# ADR-0918: Kindle files and PDFs are source files, read by their text alone

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0905](ADR-0905-A-Work-Keeps-The-File-Its-Quotes-Came-From.md), [ADR-0916](ADR-0916-A-Books-Location-Is-A-Percent-Of-This-File.md)

**What was left over.** Only EPUB was read. The owner's library holds 1,170 EPUBs, about 40 AZW3 files and 240 PDFs, and several
books exist only as AZW3 ([#62](https://github.com/aaronified/tippani/issues/62)). [Plan: locators from files](Plan-Locators-From-Files.md)
held back MOBI until "one non-DRM sample" showed which compression the files use, because that decides whether it is a week or a
month. Three of the owner's AZW3 files were read for that: all three are unencrypted, PalmDOC-compressed, UTF-8 and KF8, with no
HUFF/CDIC. The decoder is short.

**What is read.**

- **MOBI, AZW and AZW3** are one container, a Palm database, and are recognised by their bytes (`BOOKMOBI` at offset 60), never by
  the extension. Uncompressed and PalmDOC text is read. A KF8 file's other flows (style sheets, vector art) follow its markup in the
  text and are cut off at the flow table, or they would read as prose. Trailing data on each text record is stripped. Both UTF-8 and
  Windows-1252 books are decoded.
- **Refused by name:** a file whose header says it is encrypted (DRM), and one compressed with HUFF/CDIC, which says so in the
  message. KFX, Amazon's newest container, is not recognised.
- **Chapters** are the nearest heading in the text (`h1` and `h2` where the book has any, otherwise `h3`), not the title in the
  file's contents index. The index records are not parsed. For the owner's files the heading names read as the chapter names.
- **The same place rule as EPUB.** A highlight's place is the percent of the file's text before it, by the rule pinned in
  `ebook.Paragraph.Percent`, shared by all three readers. It is a percent of this file, so the same book as an EPUB and as an AZW3
  gives slightly different numbers. That is why the number is never offered as a page.
- **Measured on the owner's data.** For *The Crippled God*, 77 of its 78 highlights were found word for word in the AZW3, one was
  ambiguous and none was missed, the same as in the EPUB.
- **PDF** is read from its text layer with the standard library alone (no new dependency): page order, cross-reference tables and
  streams, object streams, Flate, LZW and ASCII filters, fonts through their Unicode map (so Bengali, Cyrillic and CJK come out as
  those letters), outline entries as chapters, and de-hyphenation across a line. A PDF with no text layer (a scan, a comic) is
  refused with that reason. It does **not** do OCR, decrypt anything, or read text in a font that has no Unicode map. A scanned
  book with a few words of text on its cover reads as a book with a few words.
- **A scan identifies an ebook by what is in it**: an ISBN or ASIN in an EPUB or the header of a Kindle file is an exact match.
  **A PDF is identified by its file name only** ("Title - Author (Year).pdf"), because opening 240 scanned books to read a title
  nobody set is gigabytes of reading for nothing, and a PDF is therefore only ever proposed for review.
- Titles are compared with a leading article removed on both sides, so "Fires of Heaven" matches "The Fires of Heaven"
  ([ADR-0920](ADR-0920-A-Quote-Is-Matched-In-The-Script-It-Was-Written-In.md)).
- A dropped file is told apart by its bytes: a PDF is a file that begins with `%PDF-`, so a text that merely mentions it is text.

**Bounds.** Each reader reads a file it does not trust: nothing is written to disk, every inflate is bounded, and a malformed file
answers an error rather than a crash or an exhausted box.

**Not done.** The Kindle contents index, KFX, HUFF/CDIC, text inside images, and an MKV's embedded subtitles. The Roadmap's
[Still to build](Roadmap.md) section keeps the rest.

See also: [Source files and context](Source-Files-And-Context.md) · [ADR index](ADR-Index.md) · [Home](Home.md)
