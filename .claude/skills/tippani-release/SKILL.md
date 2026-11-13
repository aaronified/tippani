---
name: tippani-release
description: Cut a Tippani release — changelog section, version, census, tag via the release workflow. Use when the owner asks to release, cut a version, or write release notes; runs on sonnet.
---

# Tippani release

**The changelog and the release itself are a `sonnet` agent's job**, including the cut, the notes and
the check before it. A session on a higher model delegates and reviews; it does not write them.
Base: the kit's `changelog-release` and `release-validator`.

## Facts (docs/wiki/Releasing.md, ADR-0924/0926/0927)

- A release = `## [X.Y.Z] - date` section in `CHANGELOG.md`, commit `chore(release): X.Y.Z` (changes only that file), tag `vX.Y.Z`.
- Made by the `release.yml` workflow, run by hand from `main` with the version. It moves `[Unreleased]`,
  rebuilds `web/dist` as its own `chore(dist): rebuild (release)` commit, pushes with the deploy key, tags, builds the image, publishes the Release.
- Notes are written as work lands: `node scripts/changelog-entry.mjs <Section> "<entry>"`. Empty `[Unreleased]` falls back to commit subjects — worse; avoid.
- Never trigger the workflow, push a tag, or bump a version unless the owner asked for that release in this turn.

## Before

1. Version follows semver from the diff since the last tag (user-visible feature → minor, fix → patch).
2. `go vet`, `gofmt -l .`, `go test ./...`, `npm test`, `npm run lint:rules`, `node scripts/wiki-check.mjs` green.
3. AI census regenerated for the release commit: `ai_census.py --check --ai-file docs/wiki/How-this-was-written.md`,
   block pasted at the top of "How this repo was written" (full clone, not shallow); keep the filled-in *Unmeasured history* bullet and move `SHA=`.
4. Roadmap sweep (sonnet, report-only): `Roadmap.md` matches `Plans-Index.md` and plan pages; unsure ⇒ say so, add nothing.
5. Entries are plain-language, user-facing; every entry is checked against the diff.
