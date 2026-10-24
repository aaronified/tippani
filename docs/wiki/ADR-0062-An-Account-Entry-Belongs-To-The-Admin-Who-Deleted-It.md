# ADR-0062: An account entry belongs to the admin who deleted it

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** Deleting a member bins the account, its library, its vocabulary, its review history and its files as one entry in the DELETING ADMIN's bin. Restoring is admin-only and refuses with a 409 that names the clash when the username has been taken since. Sessions, device tokens and quiz sessions are the three user-owned tables deliberately not restored.

**Why.** `trash.user_id` is whose bin a row sits in, and it cascades with that user — so an account entry in the deleted user's own bin would be removed by the same statement that made it necessary. Putting it in the admin's bin also puts it with the person allowed to undo it, so the ownership and the permission are one fact rather than two rules.

The three exclusions are credentials or scratch: a session or a device token that out-survives the account it belonged to is a credential nobody chose to reissue, and pairing a phone again is one scan. A quiz session is a day's state.

The table list is declared, like every other snapshot here, and the test that matters asks the SCHEMA for every table with a `user_id` column and fails when one is in neither list — because otherwise adding a table next release means a deleted account silently drops it, and the loss surfaces on a restore months later.

**Approved.** Mine, and I approved the exclusions individually rather than as a category.

<sub>1.8.0 — `internal/httpapi/trash.go` · `internal/httpapi/admin_handlers.go` · `internal/httpapi/trash_account_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
