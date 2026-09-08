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

- **DO NOT EDIT CODE FILES WHILE A RATER IS RUNNING.** The owner's, standing: "do not edit
  code files when the rater is running. keep this in memory." A rater reads the tree it was
  pointed at and re-runs its suites there, so an edit mid-pass means it is rating a commit
  that no longer exists — its line numbers drift, its mutations land on code that moved, and
  a finding it reports cannot be checked against what it saw. Editing DOCUMENTS is the same
  hazard for the same reason: a rater's central job here is checking prose against the line
  it cites. So a pass owns the tree until it reports. Start the pass and wait, or do the
  reading, planning and question-asking that needs no edit; a worktree-isolated rater still
  gets its own checkout, and that is not a licence to work in the main tree beside it,
  because the isolation protects the RATER's copy and not the coherence of what it says.

## The design pack

`docs/design/` holds the prototypes and handoff documents this app is being built to —
`handoff/handoff.md` first, then the companion for the area in hand, and the `.dc.html`
prototypes for what a screen should look like. They live in the repo because an upload
does not survive a session reset: read them there rather than asking for them again.
`docs/design/README.md` indexes the lot.

## Testing against a real library

**The seeded fixture hides a whole class of defect.** `scripts/screenshots/seed.mjs`
builds a library of public-domain titles with **no cover artwork** (this container cannot
fetch one — every image request comes back 403) and a cast of three. So a probe run
against it cannot see a poster behind a medium glyph, a name long enough to truncate, or a
card whose chip and whose credit line print the same performer. Every one of those was
reported by the owner from their own phone and not one of them reproduced here.

So **screenshots and probe runs go against a real backup, and that is the default**. The
owner's ruling, 7 September: *"why don't you use the backup instead for seeding? … save it
in your claude.md to use it for all tests."*

**`scripts/screenshots/backup.env` is where it lives, and it is gitignored.**
`backup-env.sh` reads it and `scratch-server.sh` sources that, so every harness in the
directory picks the archive up with no flags at all — `make controls`, `make sheet-drag`,
`make typescale`, `make panel-depth`, `make frame-scroll`, `make hero-control`,
`make overlay-scroll`, and `run-with-server.sh --seed`. Each says which library it is
against on its first line. The WIRING is checked by
`test/pure/harness-archive.test.js`; the WORKING was checked by running them — **all
eight now exit 0 against a restored archive** (`sheet-drag`, `panel-depth`, `typescale`,
`frame-scroll`, `hero-control`, `overlay-scroll`, a capture from
`run-with-server.sh --seed`, and `make controls`). `make controls` was the last of them:
it exited 3 while the backup shelf had no ceiling recorded — the app came back clean and
the touch floor was measured against nothing, which is exactly what 3 says. Both ceilings
are recorded now (`small 0 / labelled 0` at 1280, `small 301 / labelled 24` at 390), so a
full run reports `ok` at both widths and takes about seventy minutes.
**Exactly four names are read out of that file, and these are their spellings:**

```bash
TIPPANI_BACKUP=/path/to/tippanibackup*.tpbk   # the archive
TIPPANI_BACKUP_PASSWORD=…                     # it is sealed
TIPPANI_BACKUP_USER=…                         # the account INSIDE it
TIPPANI_BACKUP_PASS=…
```

**THE ACCOUNT IS `TIPPANI_BACKUP_USER`, NOT `TIPPANI_USER`, and this file said
`TIPPANI_USER` for a day.** A `backup.env` written from that line loads its archive and
signs in as the harness bot: `ensureSession` gets a 401 and then thirty seconds of
`waitForFunction` before dying with a timeout that mentions no account at all. The
`_BACKUP_` prefix is deliberate — `run-with-backup.sh` maps it onto `TIPPANI_USER` only
after a restore has actually happened, because when the file held `TIPPANI_USER` directly a
SEEDED run picked it up and tried to sign in to the fixture as somebody who does not exist
there. Thirty surfaces reported "did not render", which reads like thirty broken screens
and is one wrong login.

**THE PASSWORD IS NOT IN THIS FILE AND MUST NOT BE.** `CLAUDE.md` is committed; the
archive is somebody's library and those credentials open it. The owner asked for the
archive to be saved here for all tests, and this is that — the mechanism, not the secret.
A machine without a `backup.env` has no `TIPPANI_BACKUP`, and every harness falls back to
seeding and says so on its first line.

**AND THE PROMISE IN THIS PARAGRAPH WAS A PROMISE, NOT A CODE PATH, FOR A DAY.** The branch
was written into `run-controls.sh` alone while these lines claimed all seven had it, and
five went on calling `seed.mjs` unconditionally. It is now one function —
`scratch_prefer_archive` in `scratch-server.sh` — and `test/pure/harness-archive.test.js`
fails when a harness seeds without calling it, when it calls it after booting a server, or
when it keeps its own copy of the branch. The account had the same shape of defect one
layer down: the `TIPPANI_USER` override was a line in `controls.mjs`, so that probe reached
the archive and the other six could not. It lives in `HARNESS_ACCOUNT` (`capture.mjs`) and
the same test fails on a second copy.

`run-with-backup.sh` boots a scratch server on a fresh data dir and restores through
`POST /auth/restore/upload`, the onboarding path — it is gated on the users table being
empty, which a fresh mktemp dir is, and needs no session. Calling it by hand still works
and is what `scratch_prefer_archive` does:

```bash
TIPPANI_BROWSER=chrome scripts/screenshots/run-with-backup.sh node scripts/screenshots/sheet-drag.mjs --base-url http://127.0.0.1:8129
```

**`--fixture` names the shelf, and `controls.mjs` refuses to run without it.** The
touch-floor ratchet counts controls, and a bigger library draws more of them — so a
ceiling recorded against the backup says nothing about a seeded run and the two must not
be compared. They were, for a while: the seeded run measured 187 against the backup's 326
and printed `ok` with 139 controls of slack. `make controls` names the shelf itself, both
ways.

**AND THE SEEDED FIXTURE IS NOT DETERMINISTIC**, which is the other reason to prefer the
archive. Seeding provokes the app's own author lookups, every one of which comes back 403
here — but WHICH ones land first varies between runs, so the people rows differ, so Home
draws a different set of author chips, so the count moves. That is how the ratchet read
187 three times and 188 on the fourth with no change to the app. A ceiling can only be
exact over a library that does not drift, and a restored archive is one.

**THE ARCHIVE IS STABLE; THE PROBE IS NOT QUITE.** This paragraph used to end there, and
that was one claim too far. The archive removes the seeding drift — the same rows every
run, so the same author chips — but `controls.mjs` PRESSES what it finds, and some of what
it finds changes the library: it accepts and ignores rows on Checks, and it toggles a
category on Settings and then reads the toggle back, which is why one run's list carries
"Hide this category" where another's carries "Offer this category". So the 390 count moves
by about one between runs on identical code (300 then 301), and a `small` figure a control
or two above its ceiling is drift rather than a regression. THE WAY TO TELL THEM APART is
the list, not the number: `--update-baseline` prints every control under the floor with
its size and its surface, so diff two runs' lists and read the names. A control this
session added would be in the diff under its own name.

**The archive is somebody's library and never leaves this machine.** The server binds to
127.0.0.1, the data dir is a mktemp the trap removes, and the archive is NOT committed —
`.gitignore` covers `*.tpbk`. Ask the owner for it, or fall back to `seed.mjs` and say in
the report which fixture the run used.

## The plan queue

**A separate planning agent designs new features; its plans land in `docs/plans/`, one
file per feature.** This session does not invent the queue and does not reorder it — work
is fetched from there **one plan at a time** and finished before the next is started. The
directory's own rule still holds (`docs/plans/README.md`): a plan describes something that
is **not built yet**, and when it ships it is folded into `docs/PLAN.md` with a pass
recording where the plan turned out to be wrong, and the file here is deleted.

**The roadmap has to keep up with that directory, and a sonnet subagent sweeps it.** The
sweep is periodic and its job is narrow: read every file in `docs/plans/`, and make
`docs/roadmap.html` say what is actually coming. Concretely —

- a plan with no roadmap entry gets one, as an entry in `docs/data/features.json`'s
  `manual[]` (hand-written, no issue number needed — the same shape `bugs.json` has always
  had for a bug nobody filed);
- an entry whose plan file is **gone** has shipped, so it takes a `shipped_in` and stops
  rendering;
- an entry whose plan has changed shape gets its prose corrected.

Then `node scripts/roadmap-data.mjs` re-renders the page and `--check` proves it is in
step. Nothing else in `docs/data/` is the sweep's to touch: `tracker.json` is generated
from the issue tracker and `overrides` answers to issue numbers.

**The sweep reports; it does not decide.** Adding a plan to the roadmap is publishing a
promise on a public page, so a sweep that is unsure says so rather than inventing a card.

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
- **Two things that look the same behave the same.** The owner's, made a
  directive: "the home favourite chips directly opens the character. the work page
  chips gives the option. both should behave similarly. in fact this should be a
  repo directive. similar things should act similarly." A control drawn by one
  component on two screens has ONE behaviour, and it lives in one function that
  both screens call — not in a line each, which is how one of them goes on being
  right while the other quietly stops. Where a screen genuinely needs something
  the other does not, it passes that fact IN; it does not keep its own copy of
  the verb. `openCharacterDoor` is the worked example.
- **A question wears the same chrome as its answer.** A chooser that opens
  full-screen and then opens a popup reads as the two swapping weights — "the
  picker is full screen but then the menu that is opened is a popup… still feels
  weird". If every answer is a panel, the question is a panel, on the same stack.
- **A row says a thing once.** A label, a sub-line and a value that all state the
  same scope is prose, and the reader stops reading rows that talk. A sub-line
  earns its place by carrying something the label does not — "Yours, private,
  this work only" does; "This work only" under "In this work" does not. The
  absence of a thing is not worth a sentence: no alias needs no line saying so.
- **A rest state may not depend on anything firing.** Disable every animation and the
  content is still there — see `entrance-rule.test.js`.
- **Direction belongs to the text, not to the app.** A quote's own language decides which
  way it reads, so `dir` goes on the element holding that text — in MARKUP, never as CSS
  `direction`, which is [W3C i18n's own rule](https://www.w3.org/TR/string-meta/) and what
  makes `:dir()` and form controls behave. Where the language is unknown, `dir="auto"` and
  the Unicode bidi algorithm decide from the first strong character; a guess in CSS cannot.
  **The interface itself does not mirror.** Apple's HIG and Material 3 both tie mirroring to
  the UI being LOCALIZED into a right-to-left language, and this app's two locales are
  `en` and `bn` — both left-to-right — so there is nothing to mirror for. New CSS is
  written with logical properties all the same: `margin-inline-start`, not `margin-left`;
  `text-align: start`, not `left`. That is iOS's leading/trailing rule under another name,
  and it is why the day an RTL locale arrives is a flip rather than a rewrite. The physical
  properties already in `index.css` are left alone and there is NO ratchet counting them —
  neither design system asks for one, and a rule that fires on every unrelated stylesheet
  edit teaches people to route around it.

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

- **A subagent with `isolation: "worktree"` puts a full checkout of this repo at
  `.claude/worktrees/<id>`, INSIDE the tree.** Every sweep that walks the filesystem
  rather than git then sees the repo twice — `ai-counts` reported 3,016 Go test functions
  against AI.md's 1,508, which reads like a wildly stale document and is a scratch
  checkout nobody removed. It is gitignored, so `git status` says nothing. `git worktree
  list` is what shows it and `git worktree remove --force <path>` is what clears it (the
  harness only auto-cleans a worktree the agent left unchanged, and a rater that mutates
  the tree to test it never leaves one unchanged). `ai-counts` now skips `.claude`; a new
  repo-wide walk should too.

- **A chip's on-state class is `active`.** `.tp-filter-chip.active` is what the
  stylesheet styles; `is-on` belongs to other things (`.cat-swatch`, `.meta-rail-item`,
  `.to-top`) and on a filter chip matches nothing — so the chosen one draws exactly like
  the ones it was chosen over, and only a render shows it.
- **`useFormHost` must be called by a CHILD of the `FormModal` it means to join.** It
  reads the context `FormModal` puts around its children, so calling it in the component
  that renders the modal registers with whatever surface is further out — and a modal with
  nothing registered draws no ✓ at all.
- **`make glossary` embeds the BUILT stylesheet, so it runs AFTER `make frontend` and never
  before.** `glossary-build.mjs` reads the CSS out of `web/dist/`, not `src/index.css`, so a
  glossary built between a stylesheet edit and the next `make frontend` bakes in the
  PREVIOUS build's rules — and `npm run glossary:check` then fails on a commit where both
  commands were run, just in the wrong order. It is a silent failure until the gate: the
  page renders, the entry count is unchanged, and only the embedded declaration is stale.

- `git diff --exit-code -- web/dist` failing on a whitespace-only diff is line endings —
  read `.gitattributes` before touching `core.eol`/`core.autocrlf`.
- A Go test that passes suspiciously fast: check the `-run` filter actually matched.
- An app-logged `TIP-*` code has a row in `docs/troubleshoot.md`.
