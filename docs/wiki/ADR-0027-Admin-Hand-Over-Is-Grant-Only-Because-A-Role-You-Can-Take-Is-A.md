# ADR-0027: Admin hand-over is grant-only, because a role you can take is a race

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted

**Decided.** An admin may promote any member and may step down. Nobody may revoke another admin. The last remaining admin cannot step down, guarded by one atomic statement that counts and updates together.

**Why.** Otherwise admin is not a role, it is a race: two admins, and whoever opens the page first is the only one left. There is no seniority here to appeal to, no founder flag, no audit trail, and nothing to undo it with once your own rights are gone. Handing over is still one action each — I make you an admin, you step down, or I do. What was removed is doing the second half *to* somebody.

**Reversal.** This started as grant-then-revoke-your-own, i.e. the full matrix, and I was wrong: I had modelled it as an administrative capability when it is actually a mutual-destruction button on an instance with no recovery path. The refusal answers 403 rather than the 409 its neighbours use, and the distinction is real — it is refused because of *who is asking*, and the identical request from the target themselves succeeds.

<sub>`internal/httpapi/admin_handlers.go` · `internal/httpapi/admin_rights_test.go` · `README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
