# ADR-0204: prefix='2 3' and remove diacritics 2, plus a 200 ms client debounce

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** from 0.1.0

**Decided.** Every FTS table is declared `tokenize='unicode61 remove_diacritics 2'` and `prefix='2 3'`. The prefix index keeps 2- and 3-character typeahead index-backed instead of term-expanding, at roughly a 20–30% larger index. That is the trade I want on this hardware: disk is cheap, CPU is not, and the box is a NAS sharing itself with about a hundred other services. `remove_diacritics 2` makes "Bronte" find "Brontë". The client debounces input around 200 ms so a typeahead box does not issue a query per keystroke. I approved the whole set as one decision, because they only make sense together — the prefix index exists to serve typeahead, and the debounce is what keeps typeahead affordable.

**Instead of.** No prefix index and a trailing `*`, which term-expands at query time; that moves the cost from disk to CPU, which is backwards here.

<sub>from 0.1.0 — `docs/wiki/Design-decisions.md` · `internal/store/migrations/0001_init.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
