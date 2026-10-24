# ADR-0615: The documented release command pushes one named tag

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.3

**Decided.** The instruction names the tag and pushes one thing.

**Why.** `git push origin main --tags` sends the whole local tag list, and `--follow-tags` sends every annotated tag reachable from the commit, which is all of them. Either will publish a tag made weeks ago and forgotten, firing its entire pipeline beside the one that was meant. That is how `v1.3.0` — created 4 August, never pushed — shipped on 9 August.

**Approved.** My call; the documented command was mine and so was the tag sitting in my local repository.

<sub>1.7.3 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
