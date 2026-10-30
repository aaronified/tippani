# Source files and context

Source of truth: this wiki page.

A quote out of context can read as nonsense, and the file it came from is the context. A work can keep **one source file** for
the quotes you kept from it: a subtitle track for a film or an episode, an ebook or a text file for a book or an essay, lyrics for
a song. What follows from that is on this page.

**The line this does not cross.** Tippani never renders a source file, never hands it back and never offers a reader, an OPDS
catalogue or a sync to a device. It is not a library of books. What leaves the server is extracted text: the lines around a quote,
or a time. See [ADR-0905](ADR-0905-A-Work-Keeps-The-File-Its-Quotes-Came-From.md) for how that boundary moved and what did not.

## Attaching a file

Three ways, all the same result:

- **From the work.** A work's card menu and its details panel have **Add source file**. A show asks which episode first, because a
  subtitle covers one episode. A game never offers it: games have no equivalent.
- **Drop it on Import.** The import screen reads the bytes, and a subtitle or an ebook is neither highlights nor an error: it asks
  which work the file belongs to and attaches it. Nothing is staged.
- **From a mounted library.** The administrator mounts your folders ([Library folders](Library-Folders.md)); you press **Scan** once on
  Metadata > Source files (it runs as a job and walks the whole folder) and accept what it finds, there or on Checks, even while it
  is still running.

The type of file is decided by its bytes, never its name, so a subtitle saved as `film.ass.txt` still works. A file the app cannot
read (including an ebook that is DRM-protected) is refused with the reason, and nothing is kept. A second file for the same work
replaces the first.

Limits: 25 MB per file. A work with a mounted file keeps no copy: the row points at the path inside the folder.

## Where it shows

- **Metadata > Source files** is the base. It lists every work that has quotes, with its file (name, kind, size, uploaded or in a
  library folder) or a line saying it has none, and how many of its quotes have context. Filters show all works, works with no
  file, works with a file, or works a scan found a file for. Each row has Add or Replace, Rescan, Prune (uploaded files only),
  Remove, and Attach or Not this one for a found file. At the top are the library folders, **Scan** with its progress and **Stop**,
  the reason the last scan of a folder failed, and links to Settings > Server (to add folders) and to Checks.
- **A work's details panel** shows the same rows for that one work, a file the last scan found for it, a line while a scan is
  running with a link to the jobs card, and the context size rule. A show lists its episode files on Metadata > Source files.
- **The quote edit form** has the stored context under the quote text, **folded until you open it** (press **In context**; it
  folds again the same way). Open, it shows the lines before and after with the quote marked, which file it came from,
  **Show more**, and the size adjustment for this quote with **Reset to inherited**. A quote the file could not place gets one
  line saying so, and only when the work has a file; that line and a failed load stay showing while the rest is folded.
- **In context** is on every quote card that has stored context: Library, Catalogue, Quotes boards, search results, Home's
  favourites and shuffle, and anthologies. The quiz card does not offer it, because the lines around a quote would give away the
  answer.
- **Checks > Found files** shows only what the last scan left to decide: files found for works, to accept or refuse (Accept all for
  exact matches), a scan that failed or was cut short with its reason, and how many files matched no work. While a scan runs it shows
  one line with its progress. It has no Scan of its own; it links to Metadata > Source files, and it draws nothing when there is
  nothing to decide. **Checks > Attached files** lists uploaded files for pruning.
- **Settings > Jobs** shows a running scan as "Library scan" with the folder's name, the files read and the files found, and a Stop.
- **On a phone**, the index of Metadata and of Settings carries two shortcuts under Source files and under Server: **Scan**,
  with its progress, and **Found files**, which opens Checks and says how many findings wait.

**Errors are shown.** Every request here has a time limit. A request that fails or gets no answer says so in a message with
**Try again**, and a read that fails says so where its answer would have been. A scan that ended in failure shows its reason on
Found files and on Metadata > Source files.

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
changed).

## Places in a book

For a book with an attached ebook, the section of **Checks** now titled **Times and places from files** also proposes where each
highlight sits: the **chapter** and a **percent through**, such as "42%". The percent is of this file's text. It is never a page
number and never a Kindle location, because those are counted differently and would not match. Highlights found in exactly one
place are grouped and accepted together; a fuzzy match is one press each.

**A highlight that already has a location keeps it.** Kindle imports write one, and it is the better number. For those the file
proposes the chapter alone, and an exact match can be accepted together like any other. A chapter you typed is never replaced. See
[ADR-0916](ADR-0916-A-Books-Location-Is-A-Percent-Of-This-File.md) and
[ADR-0919](ADR-0919-A-Highlight-Keeps-Its-Own-Location-And-The-File-Proposes-The-Chapter.md).

**Which files are read.** EPUB, the Kindle container (MOBI, AZW and AZW3: one format, recognised by its bytes) and PDF. See
[ADR-0918](ADR-0918-Kindle-Files-And-PDFs-Are-Source-Files-Read-By-Their-Text-Alone.md). A quote and its file have to be in the
same script; matching is tested on Bengali, Hindi, Russian, French, Arabic, Japanese, Chinese and Thai
([ADR-0920](ADR-0920-A-Quote-Is-Matched-In-The-Script-It-Was-Written-In.md)).

## How much context shows

The number of lines or paragraphs around a quote is the first of these that is set: the quote's own adjustment, then the rule for
its work or board, then your own pair in Settings next to the quote dials, then the default. The panel says once which one it
came from, for example "2 before, 5 after · from this work". Changing a work or board rule asks whether to apply it to the quotes
already there. If you say yes it only **lowers** values that are wider than the rule and never widens one, because a quote at the
start of a chapter has less before it than the rule asks for, and no rule can add what the file does not have. **Clear per-quote
adjustments** and **Reset to inherited** undo what was set. A quote you never adjusted follows a rule when the rule is raised.
There is no screen for setting these on many quotes at once yet. See
[ADR-0914](ADR-0914-Context-Size-Is-A-Cascade-That-Only-Clamps-Down.md).

## Corrections from the file

Where the file's own words differ from a saved quote, **Checks** has a **Corrections** section that proposes the file's version.
The differences come in buckets: spacing, punctuation, capitalisation, accents, several marks, extend, trim, one word, a few words,
and wording. Apply a whole bucket or a single row. **Nothing is written until you accept**, and a dismissal is remembered when the
file is scanned again. A quote you edited after it arrived is skipped and counted, so a bucket press never undoes your own edit.
Ambiguous matches get no proposal, because they have no stored context to compare, and an accepted correction has no undo. See
[ADR-0915](ADR-0915-Corrections-Come-From-The-File-As-Proposals.md).

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

See also: [Library folders](Library-Folders.md) · [Work source files plan](Plan-Work-Source-Files.md) · [Locators plan](Plan-Locators-From-Files.md) · [Roadmap](Roadmap.md) · [Home](Home.md)
