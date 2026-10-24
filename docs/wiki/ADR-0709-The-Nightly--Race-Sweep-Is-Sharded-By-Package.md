# ADR-0709: The nightly -race sweep is sharded by package

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Was said to close the open question above; it did not. The owner: "Shard the nightly by
package."*

- **One job per package, `fail-fast: false`,** which is the point rather than a detail: a
  race in `internal/store` must not cancel the run that would have found the one in
  `internal/importer`. 60m per package. That gave `internal/httpapi` nothing it did not
  already have — `-timeout` applies to each test binary on its own — and the 2.2.9 nightly
  (run 36112406641) timed out in it anyway; see the next entry.
- **The list is explicit and a test keeps it honest.** `go list ./...` in a shell step
  would be self-maintaining and would also silently drop a renamed package, with the sweep
  going green because it swept nothing — the same false green that cost this repo v1.7.4.
  `TestEveryTestedPackageIsInTheNightlySweep` fails in both directions.

<sub>Unreleased — `.github/workflows/ci.yml` · `internal/olog/codes_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
