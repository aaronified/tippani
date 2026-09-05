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

Two of the kit's rules bind work in this repo even when no kit skill is running:

- **A subagent's model follows its job, not its caller.** An agent that only retrieves —
  inventorying files, mapping a prototype, listing call sites, checking that a cited line
  says what it was claimed to say — runs on `haiku`. Reserve the session model for agents
  that must weigh a trade-off or find a bug. A fan-out inherits the caller's model unless
  told otherwise, and over-tiering never announces itself: the answers come back fine and
  only the bill records it.
- **Rate before reporting done.** Run the kit's `work-rating` skill at the end of a piece
  of work — it is stage 8 of `pre-commit-gate`, ahead of the commit. Hand the rater the
  session's prompts verbatim and never the target; act on its findings before reporting,
  and report the score as given.

## The design pack

`docs/design/` holds the prototypes and handoff documents this app is being built to —
`handoff/handoff.md` first, then the companion for the area in hand, and the `.dc.html`
prototypes for what a screen should look like. They live in the repo because an upload
does not survive a session reset: read them there rather than asking for them again.
`docs/design/README.md` indexes the lot.

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

cd web/frontend && npm run glossary:check # docs/ui-glossary.html is generated — `make glossary`
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

## Standing UI rules

These are the design pack's, landed in code — they bind new work rather than describing
old work, so a screen that breaks one is a bug and not a variation.

- **An edge fade means it scrolls; a button at the fade opens the full set.** Use
  `Scroller` or `useEdgeScroll` — never bare `overflow`, which gives no signal and no
  mouse gesture. The fade is measured, so a row that fits wears none.
- **Never truncate a name.** A shortened name and a short name look alike, so an
  ellipsis on one destroys the thing the row exists to show. It scrolls under the fade,
  or it wraps. `scripts/screenshots/typescale-baseline.json` records the sites that
  still do this; the number may fall and never rise.
- **Spacing is a constant.** `var(--edge)` and `var(--row)`, restated per screen if a
  screen genuinely differs. A step typed into a row is a bug, and
  `spacing-debt.test.js` counts how many remain.
- **No box that holds text is measured in px** — `em`, `ch`, or a share of its
  container. A fixed size that must hold scaling text is a `max(<px floor>, <em>)`, not
  a px. Verify with `make typescale`, not by eye.
- **Every font size answers the type dials** (`typescale.test.js`). If text clips, grow
  the box; freezing the text is the wrong repair and the suite says so.
- **A tick confirms, a cross discards, and the tick lights only when something
  actually changed.** Every editable field and every form wears the pair. The tick takes
  the accent fill *and* a small count badge — how many fields this press will change —
  the moment the substance differs from what is stored; before that it is plain, because
  a control that looks armed when nothing has changed teaches the reader to stop reading
  it. Focus is not a change and neither is retyping the same value.
- **The cross is red wherever there is a pair for it to be half of.** It is the
  discarding half, and the repo's danger colour is how the app says so everywhere else.
  A surface with no form registered draws no tick, so its ✕ is a plain way out and stays
  plain — painting that one red would warn about closing a list of rows. **The colour is
  not gated on whether anything has changed**: the tick's arming answers "has something
  changed", the cross's colour answers "what does this press do", and one fact signalled
  twice leaves the second question unanswered. The tick is never red — the accent is not
  a warning.
- **A screen's glyphs are the app's own, never an emoji.** `NavIcon`, `Icon*` in
  `ui.jsx`, and nothing hand-picked beside them. An emoji is the platform's drawing: it
  changes with the reader's font, sits off the baseline every other glyph shares, and is
  the one picture `docs/ui-glossary.html` cannot document. A lookalike next to the real
  glyph is two pictures of one thing.
- **A rest state may not depend on anything firing.** Disable every animation and the
  content is still there — see `entrance-rule.test.js`.

## Invariants

- Per-user isolation: every query scoped by `user_id`; another user's row is `404`, never
  `403`.
- User input never reaches an FTS5 `MATCH` unescaped (`internal/search/fts.go` only).
- Imports land in a staging queue (`internal/httpapi/import_staging.go`) and are approved
  out of it — an import never writes straight to the library.
- Shipped migrations are forward-only and never edited.
- A one-time upgrade — something that must happen once, on a database that already
  existed, because a release changed what something means — is neither a migration nor a
  boot repair. It goes in its own `internal/store/onetime_<version>_<what>.go`, named for
  the release it first ships in, registering itself from `init()` so retiring it later is
  a file deletion and nothing else. See `internal/store/onetime.go`.
- No goroutine outlives its request — no worker pool, ticker, or scheduler; adding one is
  a design discussion first.

## Gotchas

- **A chip's on-state class is `active`.** `.tp-filter-chip.active` is what the
  stylesheet styles; `is-on` belongs to other things (`.cat-swatch`, `.meta-rail-item`,
  `.to-top`) and on a filter chip matches nothing — so the chosen one draws exactly like
  the ones it was chosen over, and only a render shows it.
- **`useFormHost` must be called by a CHILD of the `FormModal` it means to join.** It
  reads the context `FormModal` puts around its children, so calling it in the component
  that renders the modal registers with whatever surface is further out — and a modal with
  nothing registered draws no ✓ at all.
- `git diff --exit-code -- web/dist` failing on a whitespace-only diff is line endings —
  read `.gitattributes` before touching `core.eol`/`core.autocrlf`.
- A Go test that passes suspiciously fast: check the `-run` filter actually matched.
- An app-logged `TIP-*` code has a row in `docs/troubleshoot.md`.
