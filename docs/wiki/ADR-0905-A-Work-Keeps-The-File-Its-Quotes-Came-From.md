# ADR-0905: A work keeps the file its quotes came from

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

A quote out of context can read as nonsense, and the file it came from is the context. A work may keep **one source file**: a
subtitle for a film or an episode, an ebook or text file for a book or essay, lyrics for a song.

**The boundary that moved, and the one that did not.** Tippani did not keep source files, and it is not a library of books. It now
keeps one per work, and still never renders one, hands one back or offers a reader, an OPDS catalogue or a sync. What leaves the
server is extracted text: the lines around a quote, or a time. The file is scaffolding for reading context out.

**Type by bytes, never by name.** A subtitle saved as `film.ass.txt` works; a DRM-protected ebook is refused with the reason and
nothing is kept. A second file replaces the first, and a different file is a different edition: its context is cut fresh.

**Rejected.** Many files per work (no use for a second one outweighs choosing between them). Serving the file to the browser
(the line above).

See [Source files and context](Source-Files-And-Context.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
