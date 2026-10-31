# Agents

This repository's instructions for any coding agent live in [CLAUDE.md](CLAUDE.md). Read it first; the rules there are not
suggestions, and several are enforced by tests that fail the build.

The short version:

- **Documentation is the wiki**, `docs/wiki/`, and nothing else is HTML. Start at [Home](docs/wiki/Home.md). Decisions are
  ADR pages ([index](docs/wiki/ADR-Index.md)); a feature not built yet is a plan ([index](docs/wiki/Plans-Index.md)).
- **Tests name behaviour** ([Testing](docs/wiki/Testing.md)). Do not add a test of wording, markup or a private helper.
- **All work goes through a pull request**, from a branch off `main` ([CONTRIBUTING](CONTRIBUTING.md)). Do not push to `main`. A
  pull request is one change with its commits and **one set of changelog entries**; leave the merge to the owner.
- **`web/dist` is a committed build.** Rebuild it (`make frontend`) as the pull request's own last commit, never mid-change. The
  release workflow rebuilds it again before it tags, so a tag never carries a stale one.
- **Every pull request adds its entries under `## [Unreleased]`**, with
  `node scripts/changelog-entry.mjs <Added|Changed|Fixed|Internal> "**What no longer happens.** Why (#123)."` and never by hand
  (`Internal` is for what a user cannot see). Never add a version heading or edit a released section: the release workflow moves
  `[Unreleased]` under the version it is given ([Releasing](docs/wiki/Releasing.md)), what is there becomes the release notes, and a
  test fails if `CHANGELOG.md` stops being something it can cut.
- **Nothing under a mounted library folder is ever written**, and no test reaches the network.
- Check your work with `go vet ./...`, `go test ./...`, and from `web/frontend`: `npm test`, `npm run lint:rules`,
  `node ../../scripts/wiki-check.mjs`, `node ../../scripts/doc-map-check.mjs`.

**Picking up work.** The next jobs, where things stand, and the owner's parked questions are in
[Roadmap: Next week](docs/wiki/Roadmap.md#next-week-from-26-october-2026). Read it before starting. A release is made by running the
`release` workflow with a version ([Releasing](docs/wiki/Releasing.md)); do not tag, bump a version or run it unless told.
