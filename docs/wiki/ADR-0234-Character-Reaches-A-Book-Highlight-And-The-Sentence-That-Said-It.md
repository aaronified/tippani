# ADR-0234: character: reaches a book highlight, and the sentence that said it could not has been rewritten

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** The `character` facet, its counter, its autocomplete and the annotation search hit all now cover book highlights as well as film lines. The Characters **section** on the results screen does not: it is built from dialogue hits, and a section that mixes books and films under one heading is a layout decision for the design pass rather than a column.

**Why it had to move with the column.** `search_facets.go` refused every kind but `rowDialogue` on the stated grounds that *"a book has no characters as a column"* — true when it was written and the opposite of true after 0047. A column that is storable and not findable is precisely the asymmetry `quote_parity_test.go` exists to catch, and a facet that silently answers about one of two kinds that have the field is the worst version of it: the search looks like it worked.

**Four sites, and one of them tests itself.** `where()`, `facetCountKinds` plus the count expression, `vocabulary_handler`'s UNION, and `annotationHitCols`. Widening `where()` and forgetting the counter is caught for free by `TestFacetCountKindsMatchTheFacetPredicates`, which walks the two tables against each other — the reason that test exists.

**Not added: a facet name of its own for the new fields.** `region:`, `recipient:` and `work:` would be a grammar change, and the grammar is parsed on the client against a closed eighteen-name list with its own test. Full-text already finds a recipient and a source title, because both are in the index.

**Approved.** Mine.

<sub>2.2.0 — `internal/httpapi/search_facets.go` · `internal/httpapi/search_facet_counts.go` · `internal/httpapi/vocabulary_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
