# ADR-0691: Typing over a value re-sources that field to you

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

- **Decided** — `PUT /books/{id}` and `PUT /movies/{id}` read the row first, compare, and
  record `manual` for the fields that actually moved.
- **Why** — without it the tag lies the first time anybody corrects anything, and a
  corrected value stays flagged as the supplier's for the next refetch to overwrite.
- **Compared, not taken from the client.** A form that re-posts every field would
  re-source the whole record on any edit — the same lie in the other direction. One
  keyed read inside the transaction that is about to write.
- **Both kinds, not one.** Films had the identical gap; fixing books alone would have left
  exactly the asymmetry the provenance table exists to remove.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
