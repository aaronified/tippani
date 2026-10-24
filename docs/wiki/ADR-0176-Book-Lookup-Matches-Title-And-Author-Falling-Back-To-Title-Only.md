# ADR-0176: Book lookup matches title and author, falling back to title-only

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/metadata/books.go`

**Decided.** With no ISBN, query Google `intitle:… inauthor:…` and Open Library `title=&author=`, rank the merged list by title+author similarity, and if the author-scoped query returns nothing, re-run title-only.

**Why.** Author-scoping sorts the edition you meant above the box sets, study guides and foreign reprints a title-only search surfaces first. It can also over-constrain — a slightly-off author string, or a supplier that indexes the author differently — so the fallback guarantees the change never yields *fewer* results than before, which is the property that made it safe to ship. Mine.

<sub>`internal/metadata/books.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
