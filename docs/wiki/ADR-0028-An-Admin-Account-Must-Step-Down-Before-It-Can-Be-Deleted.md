# ADR-0028: An admin account must step down before it can be deleted

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `internal/httpapi/admin_handlers.go`

**Decided.** `handleDeleteUser` refuses when the target is an admin, on the same rule as the revoke guard.

**Why.** Refusing to let an admin take another admin's rights while letting them delete the account those rights belong to protects nothing: the bypass is louder and strictly worse, because it takes that person's whole library with it. Without this line the revoke guard is decorative. The consequence, stated plainly rather than hidden: an admin account can only be removed after it steps down, and only its own holder can do that — so getting rid of an uncooperative admin is a database operation, not a UI one. That is the correct place for it, on an instance whose alternative is that any admin can quietly delete any other. I approved this as the second half of one decision, not as a separate feature.

<sub>`internal/httpapi/admin_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
