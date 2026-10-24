# ADR-0580: Native TLS from a PEM pair, hot-reloaded, with an explicit refusal on ACME

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.9.4

**Decided.** `TIPPANI_TLS_CERT` and `TIPPANI_TLS_KEY` point at a PEM pair and Tippani serves TLS itself, with no reverse-proxy container required; both must be set together or the boot fails. The pair is re-read per TLS handshake, gated on a cheap size-plus-mtime stamp — two `Stat`s per connection, nothing per request — so external renewal tooling can rotate the files in place and the next handshake serves the new pair with no restart. A failed re-load keeps serving the previous pair and logs `TIP-HTTP-001` rather than dropping TLS, because a renewer that writes cert and key non-atomically parses as a mismatched pair for a moment, and the retry fires again when the second file lands. The stamps are adopted even on failure so a broken file warns once rather than once per handshake. Certificates come from wherever the operator already gets them — a home CA, `tailscale cert`, an acme.sh or certbot renewal on the host — and Tippani deliberately does not speak ACME: a renewal loop wakes on a timer and brings a third-party client with it, and nothing in this app wakes on a timer — its queue runs only what a person or the app's own lookup started. I approved the refusal as firmly as the feature.

**Instead of.** `autocert`, which would add a dependency, a background renewal loop and an outbound obligation.

<sub>0.9.4 — `cmd/tippani/tls.go` · `README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
