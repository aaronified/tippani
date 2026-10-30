# ADR-0916: A book's location is a percent of this file, never a page

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refined by:** [ADR-0919](ADR-0919-A-Highlight-Keeps-Its-Own-Location-And-The-File-Proposes-The-Chapter.md) (a highlight with a location
  keeps it), [ADR-0918](ADR-0918-Kindle-Files-And-PDFs-Are-Source-Files-Read-By-Their-Text-Alone.md) (MOBI, AZW3 and PDF are read)

For a book with an attached EPUB, the **Times and places from files** section of Checks proposes the **chapter** (from the EPUB's
own contents list, nav or NCX) and a **percent through** ("42%") for each highlight it can place, beside the film times. Migration
0086 holds what it needs. A match that lands in exactly one place is grouped and accepted together; a fuzzy one is a press each; a
highlight that already has a location went to the one-press group so it was never overwritten in bulk (changed by ADR-0919: it now
keeps the location and is proposed the chapter alone).

**Why a percent, and not a page or a Kindle location.** A page number depends on the viewport and the font, and Readest's pages
are not in its own file: they are computed at export time. A Kindle location counts bytes of Amazon's file, and this counts text
of this EPUB, so the two are not the same scale and never were. Anything shown as a page or a location for a file with no
publisher page list would be invented. A percent of this file's own text is true, repeatable, and says what it is. It is
labelled as of this file, so it is never read beside a Kindle location.

**The extraction rule is part of the contract.** How tags are stripped and whitespace is folded moves every percent a little;
changing it later changes numbers already accepted.

**Not built.** EPUB page-list publisher pages, which would be real page numbers where a file carries them. They stay on
[Plan: locators from files](Plan-Locators-From-Files.md). MOBI and AZW3 were built afterwards: see ADR-0918.

**Rejected.** A fitted page number estimated from the pages a reader already recorded (a fit from one app's pagination of one
edition); proposing a Kindle-style location.

See [Source files and context](Source-Files-And-Context.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
