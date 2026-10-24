# ADR-0175: adoptFirstPublished takes min(year), and sameWork stays narrow enough that Ulysses does not merge with Ulysses

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/metadata/books.go` · `internal/metadata/first_published_test.go`

**Decided.** The earliest non-zero year any provider reported for the same work wins. With an ISBN, every candidate is that book, so no matching is needed. Without one, the titles must fold equal *and* the authors must share a token.

**Why.** The two sources answer different questions: Open Library's search returns `first_publish_year` — when the work was written — and Google returns `publishedDate`, which is the date of whichever edition it is describing. For a modern library they agree closely enough not to notice; for anything old they disagree by centuries. The rule is `min()` rather than "prefer Open Library" because a first publication cannot be later than an edition of it, and because if OL is the one missing a year, Google's edition date survives as the fallback. Both providers are already queried in the same call, so this costs no request. `sameWork` is narrow deliberately: a title search can return two different works with one name — Ulysses is Joyce's and Tennyson's — so folding on title alone would date Joyce to 1842. Sharing a *token* rather than matching whole is what lets "Marcus Aurelius" meet "Marcus Aurelius Antoninus", which is the exact case it exists for. Approved, with the Ulysses case pinned as a test rather than left as a comment.

<sub>`internal/metadata/books.go` · `internal/metadata/first_published_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
