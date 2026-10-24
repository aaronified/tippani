# ADR-0070: user id on utterances is the ownership path, and it is load-bearing

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`, with every single query against the table carrying its own `WHERE user_id = ?`, and an ownership case in the tests per endpoint.

**Why.** For the other two kinds, `JOIN books b ON b.id = a.book_id WHERE b.user_id = ?` is simultaneously the parent join and the access check — there is nothing to select from without it, so forgetting the scope is impossible. An utterance has no parent, so that net does not exist, and a missed scope is a cross-account leak rather than a hidden row. This repo treats per-user isolation as a security property: a foreign row answers 404, never 403.

**Approved.** Mine, approved with the risk written into the migration header rather than left for someone to discover.

<sub>1.5.0 — `internal/store/migrations/0026_utterances.sql` · `internal/store/utterances_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
