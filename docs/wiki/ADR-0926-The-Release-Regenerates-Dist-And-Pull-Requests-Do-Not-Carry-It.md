# ADR-0926: The release regenerates dist, and pull requests do not carry it

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0925](ADR-0925-Work-Goes-Through-Pull-Requests-And-The-Release-Rebuilds-Dist.md)

**What was wrong.** ADR-0925 kept two ways of keeping `web/dist` current: every pull request rebuilt it, and the release rebuilt it
again as a safety net. That is two mechanisms for one file, and the first one was the costly one. `web/dist` conflicts on every
rebase because its asset names are hashes, a failing check on it turned `main` red for a reason unrelated to the change, and a
pull request had to end on a generated commit nobody reviews.

**Decided, by the owner, 31 October 2026.**

- **The release workflow regenerates `web/dist`** (`npm ci && npm run build`) before it tags, and commits it as
  `chore(dist): rebuild (release)` when the result differs. That is the only place it is made.
- **A pull request does not rebuild or commit `web/dist`**, and nothing checks it: the `web/dist matches the source` step is gone
  from the `frontend` job and `TestDistWasBuiltFromTheseInputs` is deleted.
- **The flow is:** a pull request, CI green, a review by Sonnet, then the owner merges it.

**What stays.** `scripts/dist-inputs.mjs` and `web/dist-inputs.json` remain, because `npm run build` writes them and the
journey harness reads them to decide whether it has to build the SPA it drives. The journeys always drive the SPA the pull
request's source builds, never the committed one, so removing the check leaves the browser tests honest. The Docker image
builds the SPA in its own stage and never used the committed one.

**What it costs.** Between releases the committed `web/dist` is the last release's, so a plain `go build` of `main` serves the old
UI (a non-Docker install built from `main`, not from a tag). `go test ./...` can no longer notice a locale edit that changes the
bundle. Releases are the only point the committed build is made, so the release workflow's dist step stops being a safety net
and is the mechanism: its first real run is its test.

See [Releasing](Releasing.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
