# ADR-0706: OPEN — the nightly -race sweep no longer fits in its hour

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Closed at 3.0.1 by "internal/httpapi is raced nightly in shards, by test name" below. The per-package
split after this entry did not close it, whatever that entry said.*

- **Measured 2026-09-01**, on an otherwise idle machine: `go test -race
  ./internal/httpapi/` did not finish in 55 minutes. It panicked on the timeout with the
  suite still working — **no data race, no deadlock**, five goroutines alive and one test
  inside `newTestServer`. The package holds **949 test functions** and each builds a fresh
  database through every migration; `-race` instruments the whole of
  `modernc.org/sqlite` because it is pure Go, so the engine is instrumented too.
- **The per-push gate is fine and was run** — the five named locking tests pass raced in
  about 45 seconds, with CI's own "every name must appear as a PASS" guard.
- **What is at risk is the nightly `go test -race -timeout 60m ./...`.** ci.yml's comment
  records ~29m for this package at 1.8.0; it has roughly doubled. Whether a GitHub runner
  is faster or slower than the machine this was measured on is not something that machine
  can answer.
- **The answers all cost something** — raise the timeout and the nightly takes longer than
  anyone waits; shard the package and the split has to be maintained; sample the sweep and
  it stops being a sweep. Not taken here.

<sub>Unreleased — open · `.github/workflows/ci.yml`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
