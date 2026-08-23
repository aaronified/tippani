# Tippani

A self-hosted, multi-user home for book highlights, movie dialogues, and quotes from
anywhere else. Ships as one static Go binary with the SPA embedded — no Node at runtime.

## claude-kit

This project references [claude-kit](https://github.com/aaronified/claude-kit) (agents,
skills, commands, hooks) in **Reference mode** via `.claude/settings.json`
(`extraKnownMarketplaces` + `enabledPlugins`). Nothing from the kit is copied into this
repo, so there is nothing here to exclude or keep in sync. In an interactive session,
Claude Code prompts to install the plugin the first time; in a headless/remote session it
does not auto-install — run `claude plugin install claude-kit@claude-kit` there once.
Prefer the kit's skills/agents (e.g. `test-summary`, `git-sync`, `screenshot-runner`,
`repo-doc-set`) over ad hoc equivalents when one already fits the task.

## Commands

```bash
go vet ./...                          # must pass
go test ./...                         # must pass; CI uses -timeout 20m
go build ./cmd/tippani                # or `make build`
make run                              # go run ./cmd/tippani serve -> :8080, onboard in browser

cd web/frontend && npm ci
npm test                              # vitest
npm run dev                           # Vite dev server, proxies /api -> 127.0.0.1:8080
npm run build                         # -> ../dist, a COMMITTED artefact the binary embeds

node scripts/glossary-css.mjs --check     # docs/ui-glossary.html's inlined CSS vs. web/dist
node scripts/roadmap-data.mjs --check     # docs/roadmap.html vs. docs/data/*.json
node scripts/doc-map-check.mjs            # DEVELOPMENT.md's file map still matches the tree
```

Docker: `docker compose up` (see `docker-compose.yml`, `Dockerfile`). Daemon must be
running (`dockerd &` if not already up in this environment).

## Layout

- `internal/` — all Go backend code; `web/frontend/` — the React SPA; `web/dist/` — its
  committed build output, embedded via `web/embed.go`.
- `internal/metadata/` is the only package allowed an outbound HTTP call;
  `internal/store/` is the only one that opens the database.
- Seven canonical docs, one question each — see `DEVELOPMENT.md`'s "Which document
  answers what". Don't duplicate a fact across two of them.

## Conventions

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), scoped
  like `feat(cast): ...`. Subject says what changed; body says why, and the rejected
  alternative — see `git log` for the house style.
- Comments explain why, not what.
- A frontend change ships with the rebuilt `web/dist/` in the same commit — and "frontend
  change" includes `internal/i18n/en.txt` and `bn.txt`, which `src/i18n.js` imports with
  Vite's `?raw`. `make frontend` rebuilds both `web/dist/` and `web/dist-inputs.json`;
  commit the two together. `go test ./...` fails on a stale `dist`.
- Docs that go stale with a change and belong in the same PR: `CHANGELOG.md` (user-visible
  changes), `docs/ui-glossary.html` (interface renames), `AI.md` (verification changes),
  `docs/PLAN.md` (design departures).

## Invariants

- Per-user isolation: every query scoped by `user_id`; another user's row is `404`, never
  `403`.
- User input never reaches an FTS5 `MATCH` unescaped (`internal/search/fts.go` only).
- Imports land in a staging queue (`internal/httpapi/import_staging.go`) and are approved
  out of it — an import never writes straight to the library.
- Shipped migrations are forward-only and never edited.
- No goroutine outlives its request — no worker pool, ticker, or scheduler; adding one is
  a design discussion first.

## Gotchas

- `git diff --exit-code -- web/dist` failing on a whitespace-only diff is line endings —
  read `.gitattributes` before touching `core.eol`/`core.autocrlf`.
- A Go test that passes suspiciously fast: check the `-run` filter actually matched.
- An app-logged `TIP-*` code has a row in `docs/troubleshoot.md`.
