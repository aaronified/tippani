# Source files — what is left to build

Source of truth: this wiki page.

A work keeps the file its quotes came from, and most of this plan has shipped. It is recorded in
[ADR-0905](ADR-0905-A-Work-Keeps-The-File-Its-Quotes-Came-From.md) (the file and the boundary it does not cross),
[ADR-0906](ADR-0906-Context-Is-Read-Once-And-Stored.md) (context read once and stored),
[ADR-0907](ADR-0907-Library-Folders-Are-Mounted-Read-Only-And-Only-Propose.md) (mounted library folders),
[ADR-0908](ADR-0908-The-Bin-Covers-Everything-A-Delete-Takes.md) (the bin),
[ADR-0909](ADR-0909-A-Books-Own-Metadata-Is-A-Source-You-Can-Pick.md) (the book's own metadata),
[ADR-0910](ADR-0910-Prune-Keeps-The-Context-And-Drops-The-Bytes.md) (prune and the orphan sweep),
[ADR-0914](ADR-0914-Context-Size-Is-A-Cascade-That-Only-Clamps-Down.md) (context size rules) and
[ADR-0915](ADR-0915-Corrections-Come-From-The-File-As-Proposals.md) (corrections from the file). How it works now is on
[Source files and context](Source-Files-And-Context.md). The longer history of this plan is in git.

Only what is **not built** is below.

## Not built

- **A bulk-editor screen for the span fields.** The per-quote "lines before" and "lines after" can be set through
  `POST /quotes/context-span`, and nothing on screen reaches that endpoint for many quotes at once. The idea was to add the two
  fields to the shared field table the bulk editors use, so that narrowing forty quotes is the bulk editor doing what it already
  does, rather than a control of its own.
- **Corrections for ambiguous matches.** A quote found in several places gets no stored context, so there is nothing from the file
  to compare it with and no correction is proposed.
- **An undo for an accepted correction.** Cleanup has none either. It would need the old wording kept somewhere.
- **"Skip the mark buckets for this file".** One press on a file, so the spacing, punctuation, capitalisation, accents and
  several-marks buckets are not proposed for it. It was to be offered by the reader, never imposed, and reversible.
- **A note about the file itself.** One line on a bucket saying a fact about the file that explains it (a subtitle with no accented
  letters at all, a file with straight quotes where the library has typographic ones), so a bucket reads in one line instead of
  as many rows.

See also: [Plans index](Plans-Index.md) · [Locators from files](Plan-Locators-From-Files.md) · [Roadmap](Roadmap.md) · [Home](Home.md)
