# ADR-0614: ":latest" and "X.Y" are claimed by rank, not by arrival

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.3

**Decided.** Both moving tags are computed from the tag list, so an old tag rebuilt at any time can move nothing. `X.Y.Z` stays ungated and always publishes.

**Why.** The tag was claimed by whichever build finished last, which is the newest release only by coincidence: that ordering is build completion, not version. On 9 August an orphaned `v1.3.0` tag went up alongside `v1.7.2`, both fired the image workflow, `v1.3.0` built about two minutes slower on a colder cache — and `:latest` came to mean 1.3.0. Anyone tracking it was silently moved back four minor versions, onto a binary with no standalone quotes in it at all. The same accident had a second unfired barrel: `X.Y` was ungated too. `X.Y.Z` stays ungated because an immutable per-release tag is what recovery is done with — it is what was still correct while `latest` was wrong.

**Approved.** Mine, and I approved gating both moving tags rather than the one that had fired.

<sub>1.7.3 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
