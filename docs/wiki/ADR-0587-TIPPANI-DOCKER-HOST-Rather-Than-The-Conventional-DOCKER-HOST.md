# ADR-0587: TIPPANI DOCKER HOST rather than the conventional DOCKER HOST

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.9.4

**Decided.** The endpoint variable is deliberately its own name rather than the conventional `DOCKER_HOST`, so an unrelated variable in the operator's stack can never silently redirect Tippani's updates. `DOCKER_HOST` is a widely-set variable with a broad blast radius, and the failure it would cause here — pulling and recreating against a different engine than intended — is not one I want reachable by an environment inherited from a compose file someone else wrote. The conventional name is still used in exactly one place, as the value handed *to* the Watchtower helper, which is the one context where it means what the convention says it means. My call, and the cost is one line of README.

**Instead of.** Honouring `DOCKER_HOST`, which is what an operator would expect and is exactly why it is unsafe here.

<sub>0.9.4 — `internal/updater/docker.go` · `README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
