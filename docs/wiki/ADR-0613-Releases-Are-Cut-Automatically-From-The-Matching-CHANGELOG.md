# ADR-0613: Releases are cut automatically from the matching CHANGELOG section

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 0.4.3

**Decided.** `release.yml` cuts a GitHub Release from the matching CHANGELOG section on every `v*` tag, and is runnable by hand to backfill.

**Why.** The release notes already exist and are already the thing I write carefully. Copying them by hand is a step that gets skipped, and a Release whose body disagrees with the CHANGELOG is worse than no Release.

**Approved.** Mine, and I approved the CHANGELOG being the source rather than a separate notes field.

<sub>0.4.3 — `CHANGELOG.md` · `.github/workflows/release.yml`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
