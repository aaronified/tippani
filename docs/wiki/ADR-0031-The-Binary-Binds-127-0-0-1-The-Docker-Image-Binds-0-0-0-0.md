# ADR-0031: The binary binds 127.0.0.1, the Docker image binds 0.0.0.0

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `docs/wiki/Design-decisions.md` · `cmd/tippani/main.go`

**Decided.** `TIPPANI_BIND` defaults to `127.0.0.1:8080` for the binary; the image binds `0.0.0.0:8080` and the shipped compose publishes `8080:8080`.

**Why.** §1's table states a flat "binds `127.0.0.1`" and that is no longer the whole truth, so §2 softens it explicitly rather than leaving the two in disagreement. A NAS app that is not reachable on the LAN is not a NAS app. The cost is named rather than buried: first-run onboarding is unauthenticated, because the first caller claims admin, so there is a window on a fresh box in which anyone on the LAN can become its administrator. The remedy is stated in the same breath — onboard promptly, or publish host-local behind a proxy until you have. After onboarding every route requires a credential. I approved shipping the window with the warning attached rather than shipping an app nobody can reach.

<sub>`docs/wiki/Design-decisions.md` · `cmd/tippani/main.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
