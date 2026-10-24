# ADR-0016: Ownership lives inside the write statement, and a foreign row answers 404

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted

**Decided.** Every read and write carries its own ownership predicate — either `WHERE user_id = ?` or the parent join that stands in for it — and a row that is not yours is reported as absent, never as forbidden.

**Why.** For annotations and dialogues the ownership check and the parent join are the same clause (`JOIN books b ON b.id = a.book_id WHERE b.user_id = ?`), so forgetting it is not really possible — there is nothing to select from. Standalone quotes have no parent and therefore no safety net, which is why every query in `utterance_handlers.go` carries `WHERE user_id = ?` and a missing one is a cross-account leak rather than a hidden row. The status code follows from the same premise: 403 confirms the row exists, so it is an existence oracle over another account's library. 403 is kept only where the refusal is genuinely about who is asking (the admin gate, and stepping down on someone else's behalf), which is a different fact and says so. My call, and I stand by it.

<sub>`internal/httpapi/utterance_handlers.go` · `internal/httpapi/book_handlers.go` · `internal/httpapi/read_history_handlers.go` · `internal/httpapi/admin_handlers.go` · `internal/httpapi/maintenance_avatar_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
