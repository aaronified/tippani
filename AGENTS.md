# Agents

This repository's instructions for any coding agent live in [CLAUDE.md](CLAUDE.md). Read it first; the rules there are not
suggestions, and several are enforced by tests that fail the build.

The short version:

- **Documentation is the wiki**, `docs/wiki/`, and nothing else is HTML. Start at [Home](docs/wiki/Home.md). Decisions are
  ADR pages ([index](docs/wiki/ADR-Index.md)); a feature not built yet is a plan ([index](docs/wiki/Plans-Index.md)).
- **Tests name behaviour** ([Testing](docs/wiki/Testing.md)). Do not add a test of wording, markup or a private helper.
- **`web/dist` is a committed build.** Rebuild it (`make frontend`) as its own last commit, never mid-change.
- **Nothing under a mounted library folder is ever written**, and no test reaches the network.
- Check your work with `go vet ./...`, `go test ./...`, and from `web/frontend`: `npm test`, `npm run lint:rules`,
  `node ../../scripts/wiki-check.mjs`, `node ../../scripts/doc-map-check.mjs`.

**Where the work stands** is the roadmap's [Next steps](docs/wiki/Roadmap.md#next-steps-from-30-october-2026): what is on the
working branch, what is not merged, and what to do first. A plan in the wiki is the queue; do not reorder it.
