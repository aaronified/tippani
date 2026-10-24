# ADR-0689: A field's source is shown per field, with the supplier's own mark

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

- **Decided** — every row in Details carries the mark of whoever wrote that field, or
  **You** where the reader typed it, or nothing where the record has no answer. The marks
  are vendored `data:` URIs painted as CSS masks.
- **Why** — a record is assembled from several suppliers and one provenance line for
  eleven fields cannot say which wrote what. It also makes Refetch an all-or-nothing
  gamble, which is why people stop pressing it.
- **The data was already there and the client was throwing it away.** `work_field_source`
  has served `field_sources[]` on both detail endpoints since 0054; nothing in the SPA
  read the key. So the visible half of this was a UI change, not a schema one.
- **Three states, and collapsing any two would lose the point.** A supplier's mark means
  that supplier wrote it. `manual` means somebody decided. NO ROW means we do not know —
  which the store already argued is a different fact, and the UI now agrees.
- **Instead of** the pack's `OL` · `GB` · `AZ` initials. The owner asked for marks, and
  two-letter codes are a second vocabulary to learn for something a logo says instantly.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
