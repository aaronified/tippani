# ADR-0579: The container healthcheck is the binary probing its own loopback port

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** from 0.3.0

**Decided.** `HEALTHCHECK … CMD ["/tippani", "healthcheck"]`, in exec form, because the runtime image is `gcr.io/distroless/static-debian13:nonroot` and there is no shell and no `curl` to invoke. Rather than add either — which would mean giving up distroless and its attack surface — the binary carries a subcommand that probes its own loopback port and exits with the right status. It adapts automatically when native TLS is on. I approved paying for the subcommand to keep the base image, and I would make that trade again: a healthcheck is a few lines of Go and a shell in the image is permanent.

**Instead of.** A debian-slim runtime with `curl`, or dropping the healthcheck.

<sub>from 0.3.0</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
