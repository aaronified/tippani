# ADR-0583: The update helper joins all of the target's networks

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.9.4

**Decided.** In proxy mode there is no socket file to bind into the one-shot Watchtower, so the helper gets `DOCKER_HOST` pointed at the same proxy — and must sit on a network from which the proxy's address resolves. It is attached to *all* of the target's networks, not a guessed one: Tippani can only reach the proxy because they already share a network, so every network the target is on is a candidate, and joining all of them is the only choice correct regardless of which one carries the proxy or how the names happen to sort. An earlier version joined the first-alphabetical network, which silently missed the proxy in the documented topology — the proxy on an isolated `*-internal` net while the target also sits on `*_default`, which sorts first. That was mine, and the failure taught the general lesson: sorting is not selection. The helper deliberately does not share the target's network *namespace*, because Watchtower restarts the target and would yank a shared namespace out from under the helper mid-swap.

**Instead of.** A configurable network name, which is another thing to get wrong in a compose file.

**Reversal.** Yes, of the first-alphabetical pick.

<sub>0.9.4 — `internal/updater/docker.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
