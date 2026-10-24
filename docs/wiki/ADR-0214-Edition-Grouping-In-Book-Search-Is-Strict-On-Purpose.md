# ADR-0214: Edition grouping in book search is strict on purpose

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** Printings of the same book — identical title *and* author — fold into one row, with the editions one tap behind a chevron. The match folds only case, diacritics and punctuation, so *Dune* and *Dune: Book One* stay apart. That strictness costs me some genuine duplicates that stay unfolded, and I accepted the cost knowingly: fusing distinct works is the unrecoverable direction. An unfolded pair is a cosmetic annoyance the reader can see and fix; a fused pair hides a book behind another book's chevron and looks correct. I approved the conservative rule.

**Instead of.** Fuzzy title matching, which is what the metadata candidate ranker does — but that surfaces a *choice* to a human, and this does not.

<sub>1.0.0</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
