# Agents

This repository's instructions for any coding agent live in [CLAUDE.md](CLAUDE.md). Read it first; the rules there are not
suggestions, and several are enforced by tests that fail the build.

The short version:

- **Documentation is the wiki**, `docs/wiki/`, and nothing else is HTML. Start at [Home](docs/wiki/Home.md). Decisions are
  ADR pages ([index](docs/wiki/ADR-Index.md)); a feature not built yet is a plan ([index](docs/wiki/Plans-Index.md)).
- **Tests name behaviour** ([Testing](docs/wiki/Testing.md)). Do not add a test of wording, markup or a private helper.
- **`web/dist` is a committed build.** Rebuild it (`make frontend`) as its own last commit, never mid-change.
- **A user-visible change gets a changelog entry under `## [Unreleased]`**, added with
  `node scripts/changelog-entry.mjs <Added|Changed|Fixed> "**What no longer happens.** Why (#123)."` and never by hand. Never add a
  version heading or edit a released section: the release workflow moves `[Unreleased]` under the version it is given
  ([Releasing](docs/wiki/Releasing.md)), and a test fails if `CHANGELOG.md` stops being something it can cut.
- **Nothing under a mounted library folder is ever written**, and no test reaches the network.
- Check your work with `go vet ./...`, `go test ./...`, and from `web/frontend`: `npm test`, `npm run lint:rules`,
  `node ../../scripts/wiki-check.mjs`, `node ../../scripts/doc-map-check.mjs`.

**Picking up work.** The next jobs, where things stand, and the owner's parked questions are in
[Roadmap: Next week](docs/wiki/Roadmap.md#next-week-from-26-october-2026). Read it before starting. A release is made by running the
`release` workflow with a version ([Releasing](docs/wiki/Releasing.md)); do not tag, bump a version or run it unless told.
