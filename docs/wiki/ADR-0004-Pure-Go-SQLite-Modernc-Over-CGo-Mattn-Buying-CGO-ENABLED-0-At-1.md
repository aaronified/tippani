# ADR-0004: Pure-Go SQLite (modernc) over CGo mattn, buying CGO ENABLED=0 at ~1.5–2× per-query CPU

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** `modernc.org/sqlite` is the only driver. The Dockerfile builds with `CGO_ENABLED=0` and cross-compiles on `$BUILDPLATFORM` with no QEMU, into a distroless static image.

**Why.** The plan states the trade honestly — modernc costs roughly 1.5–2× the per-query CPU of `mattn/go-sqlite3` — and takes it anyway, because queries at this scale are single-digit milliseconds either way while the build story is the difference between one multi-arch image and a cross-compilation toolchain. FTS5 is compiled in by default with no build tag, which was part of the choice.

**Instead of.** CGo `mattn/go-sqlite3` — faster per query, rejected on build and deploy complexity.

**Approved.** Mine, taken with the CPU cost written down beside it so nobody later discovers it as a surprise. I approved paying it.

<sub>pre-1.0 — `docs/wiki/Design-decisions.md` · `go.mod`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
