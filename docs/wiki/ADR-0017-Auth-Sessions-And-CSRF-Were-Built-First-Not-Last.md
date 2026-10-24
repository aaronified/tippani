# ADR-0017: Auth, sessions and CSRF were built first, not last

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `docs/wiki/Design-decisions.md`

**Decided.** The build order is schema + migrations → auth/sessions/CSRF → annotation CRUD + search → importers → metadata + covers → movies → UI → packaging. The plan says "(first, not last)" in the line itself.

**Why.** Every table below `users` has a `user_id` foreign key with `ON DELETE CASCADE`, and every handler above it reads an identity out of the request context. Retrofitting either is a rewrite of the schema and of every handler at once. Doing it first means the ownership predicate is present in the first query anyone writes rather than being added to forty of them later. I signed this off before the first migration ran.

<sub>`docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
