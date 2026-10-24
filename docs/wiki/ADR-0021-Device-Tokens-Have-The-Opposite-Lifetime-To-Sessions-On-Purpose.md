# ADR-0021: Device tokens have the opposite lifetime to sessions, on purpose

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `docs/wiki/Design-decisions.md` · `internal/auth/auth.go`

**Decided.** A device token is constructed exactly like a session — 256 random bits, only the SHA-256 stored — and then given the opposite policy: no expiry at all, and a password change does not revoke it.

**Why.** A browser cookie is ambient and long-lived by accident, so capping it and sweeping it on a password change is right. A paired phone is deliberate: you went and paired it. Silently unpairing every device on a routine password rotation gives the device no signal at all — from the phone it is indistinguishable from an outage — and that is worse than the threat it would mitigate. Unpairing is therefore its own explicit act, per device or all at once, in Settings → Devices. The revoke endpoint returns one error for "no such device" and "not yours" together, because distinguishing them turns it into an oracle for which device ids exist on other accounts. This is my call and I would make it again; it is the one place in the app where the less-secure-looking option is the correct one.

<sub>`docs/wiki/Design-decisions.md` · `internal/auth/auth.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
