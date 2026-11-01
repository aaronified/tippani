# Plans index

Source of truth: this wiki page.

A plan describes something that is **designed and not built yet**, one page per feature. Nothing on a plan page describes the app
as it stands. The [roadmap](Roadmap.md) says what is built and what is next; a plan holds the detail; the decisions that shaped it
are [ADRs](ADR-Index.md).

**When a plan is built, it is folded into an ADR and its page is deleted.** A plan for a feature that shipped is a design document
in a place whose whole promise is *this is not built yet*, and it goes stale in the one way nothing can detect: every sentence was
true when it was written, some still are, and nothing marks which. So this index lists what is coming and never what has shipped.
The ADR records where the plan turned out to be wrong; git holds the retired page.

A plan that is partly built is cut down to the part that is not, and says so at the top.

## The queue

The order work is taken in, one plan at a time, each its own release. It is the owner's order and is not reordered by whoever
builds.

1. [Read aloud](Plan-Read-Aloud.md): read a quote aloud with the browser's own speech, no service and no download.
2. [Tile slots](Plan-Tile-Slots.md): the machinery for choosing one surface of a material set exists and nothing reaches it.
3. [Episodes](Plan-Episodes.md): episode names, and up to three orderings of a series. The drag it was to extend now exists
   (`reorder.js`, built with the anthologies); reuse it.
4. [Design consistency](Plan-Design-Consistency.md): last; an adversarial pass over the design against the owner's principles.

## Proposed, not yet queued

A plan the owner has not placed in the queue yet.

- [Android app](Plan-Android-App.md): a Flutter client with photo capture and on-device text recognition, page and chapter from the
  header and footer, update check, donation, bug reports by mail, and the rest of Tippani's functions in phases.

## Partly built

- [Work source files](Plan-Work-Source-Files.md): a work keeps the file its quotes came from. All of it shipped in 3.4.0 except a
  bulk-editor screen for the context span fields, corrections for ambiguous matches, an undo for an accepted correction, a per-file
  "skip the mark buckets" and a note about the file itself; this page holds only those.
- [Locators from files](Plan-Locators-From-Files.md): a position for a quote, from the file. Times for film lines and chapter
  and percent for book quotes shipped in 3.4.0; this page holds only what remains: MOBI/AZW3 and EPUB page-list publisher pages.

## Left out of the queue by the owner

- [Atrium, the glass material set](Plan-Atrium-Liquid-Glass.md)
- [Admin and profile](Plan-Admin-And-Profile.md)
- [Nightly backup](Plan-Nightly-Backup.md): needs something that wakes up at four in the morning, and the standing invariant is that
  nothing wakes on a timer.
- [Prefetch and loaders](Plan-Prefetch-And-Loaders.md): a discussion rather than a design.

## Audits and lists

Not features. The found-and-unfixed halves of adversarial passes, and what a release left over. A fixed defect leaves a commit, a
test and a changelog entry; an unfixed one leaves nothing, so these are where it is written down. Each retires when its list is
empty.

- [Screen audit](Plan-Screen-Audit.md): every screen, each finding handed to a second reader.
- [Codebase audit](Plan-Codebase-Audit.md): duplications, latent defects, and what the tests do not guard.
- [Open defects](Plan-Open-Defects.md): every flaw found in the source-file work and elsewhere, with its evidence and its state.
- [Follow-ups](Plan-Follow-Ups.md): what is left over from a release's task list, one line per task.

See also: [Roadmap](Roadmap.md) · [ADR Index](ADR-Index.md) · [Home](Home.md)
