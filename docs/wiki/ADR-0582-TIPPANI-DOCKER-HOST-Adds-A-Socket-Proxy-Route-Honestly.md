# ADR-0582: TIPPANI DOCKER HOST adds a socket-proxy route, honestly documented

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.9.4

**Decided.** Setting `TIPPANI_DOCKER_HOST=tcp://dockerproxy:2375` points the update path at a docker-socket-proxy with `CONTAINERS=1 IMAGES=1 POST=1`, on an `internal: true` network, so no socket file is ever mounted into the Tippani container and no `group_add` is needed. The README then refuses to oversell it, and that paragraph is the decision: the update flow must be allowed to create and start containers, and that permission is host-root-equivalent in the wrong hands, because a container can be created with the host filesystem mounted. The proxy still helps — no socket file in the app container, exec/volumes/secrets/swarm endpoints blocked, API reachable only from inside the stack — but it is a hardened version of the same opt-in trade-off, not a removal of it. I approved shipping the route with that warning attached, and I would rather lose the feature than soften the warning.

**Instead of.** Documenting the proxy as "secure", which is what most projects do and what I will not.

<sub>0.9.4 — `README.md` · `internal/updater/docker.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
