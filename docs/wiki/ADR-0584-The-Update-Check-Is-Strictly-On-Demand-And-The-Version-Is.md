# ADR-0584: The update check is strictly on demand, and the version is stamped in

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.6.0

**Decided.** Tippani never contacts GitHub on its own; the check is a click, hitting `GET /repos/{repo}/releases/latest` with an 8-second timeout, and a non-200 — rate limit, no releases yet, offline — is surfaced as an error the caller reports without failing the whole request. The running version is stamped into the binary at build time via `-ldflags -X tippani/internal/buildinfo.Version`, logged at startup, printed by `tippani version`, and surfaced in Settings, so "what version am I on" never depends on a label or a tag being correct. The comparison is a lenient semver parse that returns `ok=false` for non-semver strings like `dev` or a short sha, so a local build is never told it is out of date. My call: no polling, and the version is a property of the binary rather than of its packaging.

**Instead of.** A periodic background check, which is a poller and a phone-home in one.

<sub>0.6.0 — `internal/updater/updater.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
