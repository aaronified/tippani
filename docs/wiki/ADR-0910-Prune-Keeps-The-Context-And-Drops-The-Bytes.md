# ADR-0910: Prune keeps the context and drops the bytes

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

A file is scaffolding. **Checks > Attached files** lists uploads biggest first with when a quote was last added; **Prune** deletes
the file and keeps everything read from it. What it gives up is one thing: nothing new can be read until the file is added again,
which restores everything. A mounted file has nothing to prune and nothing prunes on its own. A sweep tidies files no work names
(a crash between writing a file and its row); files under ten minutes old are left alone.

**Backups** always carry the read context and carry the files only if the administrator turns that on, because they are the bulky
half and can be attached again.

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
