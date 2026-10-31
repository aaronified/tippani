## What this changes

<!-- One change. Say why, not only what. -->

## Checklist

- [ ] Changelog entries added under `## [Unreleased]` with `node scripts/changelog-entry.mjs` (`Internal` if a user cannot see it). One set for this pull request.
- [ ] `go vet ./...`, `go test ./...`, and from `web/frontend`: `npm test`, `npm run lint:rules`, `node ../../scripts/wiki-check.mjs`, `node ../../scripts/doc-map-check.mjs`
- [ ] `web/dist` is not touched: the release workflow regenerates it
- [ ] CI is green, and the pull request has had its Sonnet review before it is merged
- [ ] A decision made here is an ADR in `docs/wiki/` and in the ADR index
