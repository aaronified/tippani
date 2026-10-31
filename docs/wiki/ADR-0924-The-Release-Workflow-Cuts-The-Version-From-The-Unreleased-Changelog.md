# ADR-0924: The release workflow cuts the version from the Unreleased changelog

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [Releasing](Releasing.md)

**What was wrong.** A release was a changelog section written by hand on the day, a `chore(release)` commit, and a tag pushed by
hand. The workflow only published a Release for a tag that already existed. When the owner ran it for 3.5.0 with no tag, it failed at
its checkout (its one input was "Existing tag to (re)publish a Release for"), having done nothing, and the cut still had to be made
some other way.

**What replaced it.**

- **One input, `version`**, accepted as `3.5.0` or `v3.5.0` and checked against `X.Y.Z` (a `-rc.1` suffix is allowed and makes a
  pre-release). Lexodle's release workflow takes its version the same way.
- **A version with no tag is cut by the workflow**: the changelog's `## [Unreleased]` section moves under `## [X.Y.Z] - <today>`
  (`scripts/release-changelog.mjs`), the change is committed as `chore(release): X.Y.Z`, the commit is tagged, and the commit and the
  tag are pushed in one atomic push. A version that already has a tag is republished as before, and nothing is cut.
- **Notes come from `[Unreleased]`**, which entries are added to as changes are made (`scripts/changelog-entry.mjs` now adds there and
  creates the heading and the section). When it is empty the notes are built from the `feat`, `fix`, `perf` and `refactor` commit
  subjects since the last tag and the log says so. When there is neither, it refuses before it changes anything. A stub for notes was
  the thing to avoid.
- **The app does not show `[Unreleased]`.** `internal/changelog` skips that heading and what is under it, so the Changelog screen
  lists releases and `Latest()` is the newest version that was cut.
- **The image build is started explicitly.** A tag pushed with the workflow's own token starts no other workflow, so
  `docker-publish.yml`'s tag trigger would never fire for a tag cut here. The workflow runs
  `gh workflow run docker-publish.yml --ref vX.Y.Z`; that workflow reads the tag from the ref, so the image is the one a pushed tag
  would build. The workflow gained `actions: write` for this.

**Keeping the file cuttable.** AGENTS.md and CONTRIBUTING.md say how to add an entry (the tool, under [Unreleased], never a version
  heading). The same test file also reads the real CHANGELOG.md: it must open with one [Unreleased] heading, every release must be
  [X.Y.Z] - YYYY-MM-DD, and a cut must leave the older releases as they were. A hand edit that breaks any of that fails the suite.

**Why this shape.** The pieces that can go wrong in a way a person reads (what the section looks like, what is refused) are in a
script with tests (`web/frontend/test/rules/a-release-is-cut-from-the-unreleased-section.test.js`), because the workflow itself
cannot be run from a checkout. The commit and the tag are one push so a refused push leaves nothing half done. `main` has no branch
protection, which is what lets the bot push to it.

**What it costs.**

- The release commit is not run through CI (same rule as above), so the commit before it is the one CI judged. The Releasing page
  says to look at CI first.
- The date is the day the workflow ran, in UTC.
- The workflow was written without being run. Its shell was replayed against a local bare repository (the commit, the tag and the
  atomic push, and a refused push when the branch had moved) and its YAML parses. Its first real run is its test.

See [Releasing](Releasing.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
