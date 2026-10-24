# ADR-0909: A book's own metadata is a source you can pick, and it fills gaps

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

An attached EPUB names its publisher, year, series, subjects, description and ISBN from the edition actually held. It is a metadata
source, **Book file**, in the same machinery as the online ones: re-verify, fill gaps (even for a book with no online identity) and
the field picker, at any time. It never overwrites a value the reader has. Its mark is a Phosphor icon (MIT).

**Rejected.** Reading the EPUB only for context: the metadata is already in the bytes that were read.

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
