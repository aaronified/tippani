# ADR-0927: Main is protected, and the release pushes to it with a deploy key

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0925](ADR-0925-Work-Goes-Through-Pull-Requests-And-The-Release-Rebuilds-Dist.md), [ADR-0926](ADR-0926-The-Release-Regenerates-Dist-And-Pull-Requests-Do-Not-Carry-It.md)

**What was wrong.** "Nothing is pushed to `main` directly" was a rule in the documents and nothing else. And the release workflow
has to push a commit to `main` (the changelog cut and the dist rebuild), which a protected branch refuses unless the pusher may
bypass the rule. The workflow's own token cannot be made a bypass actor on a personal repository (GitHub answers "Actor GitHub
Actions integration must be part of the ruleset source or owner organization").

**Decided, by the owner, 31 October 2026.**

- **A repository ruleset, `main is changed by pull request`,** requires a pull request and the CI jobs (`go`, `go-httpapi` 1 to 4,
  `frontend`, `docs`, `race`, `journeys` 1 to 3), and forbids force-push and deletion. No approving review is required, because
  the review is by Sonnet, before the owner merges, and is not a GitHub approval.
- **The release workflow pushes the release commit with a deploy key**, the repository secret `RELEASE_DEPLOY_KEY` (write
  access), which the ruleset lets bypass. The repository admin role also bypasses, for the owner. The tag is pushed with the
  Actions token: a tag pushed by a key would start `release.yml` and `docker-publish.yml` again.
- **The push is now two pushes, branch first.** It used to be one atomic push. If the tag push fails, `main` has the release commit
  and no tag; a re-run then stops because the section already exists, and the commit is tagged by hand.
- With no secret set, the workflow warns and pushes with the token, which works only while `main` is unprotected.

**Turned down.** Opening a pull request for the release commit (the release stops being one button and needs a merge before the
tag). A personal access token (it belongs to a person, expires, and reaches every repository the owner has).

**What it costs.** A deploy key is a second way to write to `main`, held as a secret. It is scoped to this repository, and it can
be removed in Settings, Deploy keys. The ruleset was created switched off and is turned on after the 3.5.0 release, because that
release runs the workflow that was on `main` before this change.

See [Releasing](Releasing.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
