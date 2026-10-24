# ADR-0358: A quotes export groups by occasion and puts unattributed quotes first

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `internal/httpapi/export_quotes.go`

**Decided.** `POST /export/quotes` writes `## <occasion>` headings and emits the occasion-less quotes *before* any heading.

**Why.** A quotes file groups by occasion the way a book export groups by chapter, and the parser attributes a quote to the heading above it. So an unattributed proverb written after a heading would come back belonging to a speech it was never part of — the ordering is not tidiness, it is correctness given how the reader works. The occasion is not repeated as a binding on each quote, for the same reason the book export does not repeat the chapter. My call.

<sub>`internal/httpapi/export_quotes.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
