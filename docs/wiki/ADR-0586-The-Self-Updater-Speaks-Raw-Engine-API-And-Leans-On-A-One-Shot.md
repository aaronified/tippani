# ADR-0586: The self-updater speaks raw Engine API, and leans on a one-shot Watchtower

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.6.0

**Decided.** `internal/updater/docker.go` is a minimal Engine-API client covering only what a self-update needs: ping, identify self, pull, run a one-shot updater. The heavy Docker SDK is deliberately avoided — the app stays CGO-free and dependency-light, and this speaks a handful of documented HTTP endpoints over two transports, the mounted unix socket or plain TCP to a socket proxy. For the swap itself it runs `containrrr/watchtower --run-once --cleanup <target>` rather than hand-rolling a container replacement, because Watchtower copies the existing config so the data volume, ports, env and restart policy survive the recreate. Hand-rolling that is where a self-update strands a deployment. The helper is short-lived and auto-removed, and the image is overridable via `TIPPANI_UPDATER_IMAGE` so it can be pinned to a digest. I approved both halves: write the small client, borrow the dangerous part from something that already does it correctly.

**Instead of.** The Docker SDK (a large dependency for four calls), or a hand-rolled recreate (the config-loss risk).

<sub>0.6.0 — `internal/updater/updater.go` · `internal/updater/docker.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
