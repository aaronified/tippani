# ADR-0213: Tag and genre facets carry the user scope on both halves

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** For each matching tag the handler runs two queries: a count, and a page of the quotes wearing it. Both carry `user_id`. For book annotations and film dialogues the scope arrives through the parent join; for standalone quotes it is on the row itself, because since `0026` an utterance has no parent. The comment in the code gives the reason bluntly: a tag id is guessable, and the count alone would report how many quotes a stranger filed under it. A count is a disclosure. I approved this and I would treat a missing scope on either half as a security defect rather than a bug.

**Instead of.** Scoping only the page and trusting the count as harmless.

<sub>1.5.0 — `internal/httpapi/search_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
