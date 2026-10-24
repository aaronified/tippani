# Source files and context

Source of truth: this wiki page.

A quote out of context can read as nonsense, and the file it came from is the context. A work can keep **one source file** for
the quotes you kept from it: a subtitle track for a film or an episode, an ebook or a text file for a book or an essay, lyrics for
a song. Four things follow from that, and this page is all of them.

**The line this does not cross.** Tippani never renders a source file, never hands it back and never offers a reader, an OPDS
catalogue or a sync to a device. It is not a library of books. What leaves the server is extracted text: the lines around a quote,
or a time. See [ADR-0905](ADR-0905-A-Work-Keeps-The-File-Its-Quotes-Came-From.md) for how that boundary moved and what did not.

## Attaching a file

Three ways, all the same result:

- **From the work.** A work's card menu and its details panel have **Add source file**. A show asks which episode first, because a
  subtitle covers one episode. A game never offers it: games have no equivalent.
- **Drop it on Import.** The import screen reads the bytes, and a subtitle or an ebook is neither highlights nor an error: it asks
  which work the file belongs to and attaches it. Nothing is staged.
- **From a mounted library.** The administrator mounts your folders ([Library folders](Library-Folders.md)); you press **Scan** on
  Checks and accept what it finds.

The type of file is decided by its bytes, never its name, so a subtitle saved as `film.ass.txt` still works. A file the app cannot
read (including an ebook that is DRM-protected) is refused with the reason, and nothing is kept. A second file for the same work
replaces the first.

Limits: 25 MB per file. A work with a mounted file keeps no copy: the row points at the path inside the folder.

## Context

Attaching a file reads it once and stores, for every quote of that work it can place, the lines or paragraphs before and after
(up to 15 cues or 10 paragraphs), as the **file** has them. After that **In context** on a quote card opens a panel with the quote
marked, and it works whether the file is still there, was pruned, or sat on a folder that is unplugged: the panel reads one stored
row and never opens a file.

- **Fuzzy on both sides.** The match ignores punctuation, accents and case, and forgives small differences: a mistyped word, a tidied
  quote, a subtitle that dropped its accented letters. A quote that appears in several places (a short line like "Yes.") is not
  guessed at: it gets no context and is counted as ambiguous.
- **It stops where the work does.** A span never crosses a chapter edge, so a quote at the start of a chapter has nothing before it
  and nobody had to say so. A subtitle span stops at a silence longer than 30 seconds. The panel says when a span ran out.
- **Show more** widens the window for that look only, up to what is stored.
- **A rescan fills, it never overwrites.** Adding the same file again, or **Rescan** on a work, gives context to quotes added since
  and leaves every existing row alone. A different file is a different edition: its context is cut fresh, never merged with the old.

## Times for film lines

For a film or episode with a subtitle, **Checks** proposes a time for each line that has none or a different one, with the file's own
words beside it as evidence. **Nothing is written until you accept.** Lines found once, word for word, are grouped: accept them
together. Anything fuzzy is one press each. A refusal is remembered; a changed line is not overwritten (it is reported as having
changed). Book locations are on the [roadmap](Roadmap.md).

## A book's own metadata

An attached EPUB says what its publisher, year, series, subjects, description and ISBN are, from the edition you actually hold. It is
a metadata source called **Book file**: **Fill gaps** uses it for whatever a book is missing (even a book with no online identity),
and the field picker offers it beside the other sources at any time. It never overwrites a value you have.

## Pruning

A file is scaffolding. **Checks > Attached files** lists the files you uploaded, biggest first, with when a quote was last added to
each work. **Prune** keeps what was read from the file, so every quote keeps its context, and deletes the file. What it gives up is
one thing: nothing new can be read until you add the file again. Adding the same file again restores everything. A mounted file has
nothing to prune. Nothing prunes on its own.

## The bin and backups

Deleting a work moves its source file and its context to the bin with it, and **Undo brings them back**. Emptying the bin removes
the parked file for good. A backup always carries what was read from your files; the files themselves are included only if the
administrator turns that on (Settings > Server > Library), because they are the bulky half and can be attached again. A restore lists
the works whose files the archive did not carry.

See also: [Library folders](Library-Folders.md) · [Roadmap](Roadmap.md) · [Home](Home.md)
