# ADR-0026: Roles are one is admin flag, and the first user is the admin

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `docs/wiki/Design-decisions.md` · `internal/httpapi/admin_handlers.go`

**Decided.** A single boolean column. The first user is created by onboarding (or by the CLI on an empty database) and is the admin; onboarding closes the moment any user exists.

**Why.** Under per-user isolation there is nothing for finer-grained permissions to protect. An admin cannot read another account's library — no route exposes one — so the only privileged surface is instance management: add and remove users, metadata keys, backup and restore, maintenance. That is one bit of information. Anything more is a permissions model built for a sharing feature that does not exist, which is YAGNI in its purest form. Mine, and I have refused to widen it twice since.

<sub>`docs/wiki/Design-decisions.md` · `internal/httpapi/admin_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
