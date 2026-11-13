---
name: tippani-gate
description: Tippani's pre-commit gate — the exact checks, changelog tool, docs and commit rules for this repo. Use before every commit or push here; it replaces the generic claude-kit pre-commit-gate stages with this repo's commands.
---

# Tippani pre-commit gate

The kit's `pre-commit-gate` is the model (sync → test → triage → fix → re-test → verify UI → docs →
changelog → commit); this skill fixes what each stage means in this repo. One commit per feature or
fix, carrying source, tests and docs. Rating (`tippani-rate`) is stage 8, ahead of the commit.

## Stages

| # | Stage | Command / rule |
|---|---|---|
| 0 | Sync | `git fetch`; work on the session branch; kit guard: `sh "$(git rev-parse --path-format=absolute --git-path hooks)/pre-commit"` prints `kit-guard: clean` |
| 1 | Go | `go vet ./...`, `gofmt -l .` (must list nothing), `go test ./... -timeout 30m` |
| 2 | Frontend | `cd web/frontend && npm test` (pure+dom), `npm run lint:rules` (scanners, separate on purpose), `npm run journeys` when UI behaviour changed |
| 3 | Glossary | interface renames: `make frontend` **then** `make glossary` (never the other order); `npm run glossary:check` |
| 4 | Wiki | `node scripts/wiki-check.mjs`, `node scripts/doc-map-check.mjs` |
| 5 | Interface | UI touched → `tippani-visual` |
| 6 | Docs | same commit: `CHANGELOG.md` via `node scripts/changelog-entry.mjs <Section> "<entry>"` (never hand-edit); `docs/wiki/*` for decisions (new ADR numbered after the last, added to `ADR-Index.md`, never renumber); `How-this-was-written.md` if verification changed; `Design-decisions.md` for design departures; a new `TIP-*` log code needs a `Troubleshooting.md` row |
| 7 | Rate | `tippani-rate` |
| 8 | Commit | Conventional Commits with scope (`feat(cast): …`); subject = what, body = why + rejected alternative |

`web/dist/` is not rebuilt by pull requests (ADR-0926); the release workflow regenerates it. `en.txt`
/`bn.txt` under `internal/i18n/` count as frontend.

## Rules that bind the work

- Never skip, delete, loosen or `--no-verify` to reach green. A wrong test is a question to the owner.
- A test uses the app, it does not read it (see CLAUDE.md): new tests go in the right tier
  (`test/journeys`, Go `internal/httpapi`, `test/pure|dom`); a source-text regex test is a scanner and
  belongs in `test/rules`.
- A journey is mutation-verified: delete its decisive action, watch it fail, name the mutation in the commit body.
- Invariants: per-user isolation (`user_id`, other user's row = 404), FTS input only via
  `internal/search/fts.go`, imports go through the staging queue, shipped migrations never edited,
  one-time upgrades in `internal/store/onetime_<version>_<what>.go`, no ticker/poller/cron.
- Subagent work: retrieval/fan-out/screenshots on `haiku`; a subagent's finding is a lead — verify at its line before relying on it, and say which rows are verified.
- AI census: `ai_census.py --check --ai-file docs/wiki/How-this-was-written.md` fails after any later commit; regenerate the block only when the owner asks for it at a release.

## Terminal state

End with exactly one of **GREEN** (sha), **BLOCKED** (yes/no question), **DIRTY-STOP**. Name skipped
stages with a reason; "docs-only" diffs run only stages 0, 4, 6, 8.
