# ADR-0574: Structured error codes TIP-<SUBSYS>-NNN, append-only, on both streams

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.6.4 onward

**Decided.** Every handled error carries a stable, greppable code of the form `TIP-<SUBSYS>-<NNN>`. Three rules make it worth having. Every code must have an entry in `olog.Registry` *and* a row in `docs/wiki/Troubleshooting.md`, and `TestCodesDocumented` fails the build if the two ever drift — documentation that can go stale is documentation that will. Codes are append-only within a subsystem, never renumbered or reused, so a code in an old log always means the same thing. And lines go to both stdout and stderr, so `docker logs` shows them regardless of how the stream is captured. The whole scheme exists to serve one requirement: an operator with nothing but `docker logs` should be able to diagnose any failure this app knows how to have. I approved it, and the build-time test is the part that makes it real.

**Instead of.** Free-text error messages, which are ungreppable and undocumentable.

<sub>0.6.4 onward — `internal/olog/codes.go` · `docs/wiki/Troubleshooting.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
