# ADR-0005: Dependency budget: three direct Go modules, three runtime npm packages, everything else stdlib

Source of truth: this wiki page.

- **Area:** [§1 The Target Host, the Budgets, and the Scope They Fix](ADR-Index.md#area-1)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** `go.mod` has exactly three direct requirements — `golang.org/x/crypto`, `golang.org/x/time`, `modernc.org/sqlite`. `package.json` has exactly three runtime dependencies — `@chenglou/pretext`, `react`, `react-dom`. Everything else is a devDependency or the standard library.

**Why.** A dependency on a NAS is a thing that has to be audited, updated and trusted forever. Concretely: CSRF is Go 1.25's `http.CrossOriginProtection` rather than a token library, response compression is `compress/gzip`, and backup sealing is AES-256-GCM and Argon2id out of the stdlib and `x/crypto`.

**Approved.** I approved each of the six individually and treat the count as a budget — a seventh needs an argument, which is why "a new always-on dependency" is listed in `Developing.md` as grounds for rejection.

<sub>pre-1.0 — `go.mod` · `web/frontend/package.json` · `Developing.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
