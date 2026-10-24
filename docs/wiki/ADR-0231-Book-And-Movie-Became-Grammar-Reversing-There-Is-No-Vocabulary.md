# ADR-0231: book: and movie: became grammar, reversing "there is no vocabulary of titles"

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.16.0

**Decided.** Both fields carried `typed: false`, keeping them out of the grammar entirely on the reasoning that *"there is no vocabulary of titles to offer, so typing `movie:blade runner` could only ever open a dropdown with nothing in it"*. 1.16.0 removed the flag, added `books` and `movies` to `/search/vocabulary` as id/title pairs, and made both fields typeable like the rest.

**Why I was wrong.** A personal library *is* a list of its own titles. The list is no longer than the author list the endpoint was already sending, and it costs one query each. The old reasoning described a query nobody had written, not a fact about libraries — and `book:` is the single most obvious thing in the box to reach for, which made it the one field that answered by doing nothing.

The id is still what goes on the wire, and that is why these are their own fields rather than a title search: two editions, a translation and the film of the book can all carry one name, and only an id says which you meant. So they join the colour slots as `{key, name}` vocabularies — chip shows one thing, wire carries another.

**The cost, stated rather than discovered.** `the book: of the new sun` now reads as a facet. That is the same trade thirteen ordinary English words already made in 1.10.0, and it has the same way out: `book\:` searches for the words. The escape exists precisely so a word can become an operator without becoming unsearchable.

**Also.** The dropdown now shows five options at a time with a `More (n)` row, rather than a flat eight. Five is what fits above a phone keyboard; a menu over hundreds of titles that you can fall down is not a menu.

<sub>1.16.0 — `web/frontend/src/facets.js` · `internal/httpapi/vocabulary_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
