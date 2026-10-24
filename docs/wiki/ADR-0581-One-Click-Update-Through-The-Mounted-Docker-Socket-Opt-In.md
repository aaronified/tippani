# ADR-0581: One-click update through the mounted Docker socket, opt-in

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.6.0

**Decided.** When the Docker socket is mounted — a documented, deliberate security trade-off — Settings → Updates offers *Update & restart now* to an admin behind a typed `UPDATE` confirm: it pulls the new image, recreates the container with a one-shot Watchtower, then waits for the app to come back and reloads. It works when you track a moving tag. Crucially the no-socket path is not a degraded mode: it shows the exact command to run by hand, and the troubleshooting doc says the guided manual command always works. That is what makes the socket genuinely optional rather than nominally optional. I approved the feature only on that condition.

**Instead of.** Requiring the socket, or shipping no update path at all.

<sub>0.6.0 — `README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
