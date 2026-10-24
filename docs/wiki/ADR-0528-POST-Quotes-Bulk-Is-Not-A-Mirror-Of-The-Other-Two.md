# ADR-0528: POST /quotes/bulk is not a mirror of the other two

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.9.0

**Decided.** The bulk quote kinds are a table of `{table, parentCol, parentTable}`, and the ownership query follows the shape: a child row is filtered through its parent, a standalone quote by `user_id` on the row. All three accept `color`; the two WORK endpoints do not, because a work has no colour.

**Why.** The existing helper took a kind and swapped three names, which reads as parameterised — and both kinds it served were child rows. `utterances` is not one. Swapping the strings would have produced `WHERE user_id IN (SELECT id FROM utterances WHERE user_id = ?)`-shaped nonsense: a filter matching nothing, which is a bulk action that reports success and changes nothing at all.

Both directions are tested because both fail silently and oppositely: matching nothing is a no-op with a confirmation, matching everything is somebody else's library.

**Approved.** Mine, and I approved the table over the string swap specifically because the swap is the version that looks fine in review.

<sub>1.9.0 — `internal/httpapi/bulk_handlers.go` · `internal/httpapi/bulk_quotes_test.go` · `internal/httpapi/capabilities_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
