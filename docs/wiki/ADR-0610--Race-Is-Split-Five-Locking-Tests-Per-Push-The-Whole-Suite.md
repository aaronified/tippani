# ADR-0610: -race is split: five locking tests per push, the whole suite nightly

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.5

**Decided.** The five locking tests run raced on every push in about two minutes; the whole-suite sweep runs nightly. Plain tests run on every push as before. The job asserts that each named test actually ran.

**Why.** The 1.7.4 sweep passed with forty-three seconds of headroom — 29:17 against a thirty-minute timeout raised for it one commit earlier. The cost is specific to this app: `-race` needs cgo, and the usual assumption that the C library underneath is opaque to the detector is backwards here, because the SQLite driver is pure Go. The detector instruments the entire database engine, in a suite whose premise is that there are no mocks and every test drives a real database file. Raising the number again buys one release and makes every push wait half an hour, and a job that slow is a job people stop reading — which is how the previous breakage survived eight releases. The run assertion exists because a filter that matches nothing still exits 0, and `ok (0 tests)` reads exactly like `ok`, a false green that had already cost an afternoon.

**Approved.** My call, and I approved the split over another timeout raise.

<sub>1.7.5 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
