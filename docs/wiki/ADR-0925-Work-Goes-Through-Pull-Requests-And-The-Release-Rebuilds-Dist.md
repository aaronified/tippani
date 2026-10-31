# ADR-0925: Work goes through pull requests, each with its changelog entries, and the release rebuilds dist

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refined by:** [ADR-0926](ADR-0926-The-Release-Regenerates-Dist-And-Pull-Requests-Do-Not-Carry-It.md) (pull requests no longer carry dist)
- **Refines:** [ADR-0924](ADR-0924-The-Release-Workflow-Cuts-The-Version-From-The-Unreleased-Changelog.md)

**What was wrong.** Commits went straight to `main`, and the changelog was written from them at release time. With the release
workflow cutting versions from `## [Unreleased]`, the notes are only as good as what was put there, and nothing made anyone put
anything there. Separately, `web/dist` (a committed build) had to be the last commit before a push by convention, and CI's rebuild-
and-diff check on it was the thing that turned `main` red whenever a change reached `main` without it.

**Decided, by the owner, 31 October 2026.**

- **All work goes through a pull request**, from a branch off `main`, by anyone including an agent. Nothing is pushed to `main`
  directly. The merge is the owner's.
- **A pull request is one change with its commits and one set of `[Unreleased]` changelog entries**, added with
  `scripts/changelog-entry.mjs`. `Internal` is the section for what a user cannot see. A pull request template carries the
  checklist.
- **The release workflow rebuilds `web/dist` before it tags.** It runs `npm ci && npm run build` and, if that changed anything,
  commits it as `chore(dist): rebuild (release)` ahead of the release commit. Where dist is current it commits nothing.

**Why the dist gate is handled this way.** Read how it works before reading why:

- `CHANGELOG.md` is not a dist input (`scripts/dist-inputs.mjs` hashes `web/frontend/src`, `public`, a few named files and the
  locale files the SPA imports). So the release commit, which changes only the changelog, can never make dist stale. The
  release was not blocked by the gate itself.
- What a release can do wrong is tag a head whose dist was merged stale. The Docker image is not affected (its Dockerfile builds
  the SPA itself), but everyone who builds from the tag gets the old UI. Rebuilding in the workflow removes that without asking
  anyone to remember it. The Linux runner produces the same bytes as a Windows machine: CI's check passes on a dist committed from
  Windows, and a rebuild here of the committed source changed nothing.
- The rebuild is a **safety net, not the way dist is kept current.** CI's check on each pull request stays, because it is what
  stops a stale dist reaching `main` for the people who build from it between releases.
- **Turned down: a bot that rebuilds dist on every pull request or push.** A commit pushed with the workflow's own token starts no
  CI run, so the commit that fixes the check would itself be unchecked, and a token that does start runs is a secret to hold and a
  second way to write to `main`. **Turned down: not committing dist.** The embed needs the directory at `go build`, and the
  non-Docker install is a supported one.
- **What the pull request flow costs.** When `main` moves, `web/dist` conflicts, because its asset names are hashes. It is
  generated: take either side, rebase, `make frontend`, commit. CONTRIBUTING says so.

**What it costs.** The release commit and a dist rebuild commit are pushed by the workflow's token, so neither is run through CI.
The first real run of the dist step is its test; the shell was exercised here against a stale and a current tree.

See [Releasing](Releasing.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
