# Tippani

A self-hosted, multi-user home for book highlights, movie dialogues, and quotes from
anywhere else. Ships as one static Go binary with the SPA embedded — no Node at runtime.

## claude-kit

This project references [claude-kit](https://github.com/aaronified/claude-kit) (agents,
skills, commands, hooks) in **Reference mode** via `.claude/settings.json`
(`extraKnownMarketplaces` + `enabledPlugins`). Nothing from the kit is copied into this
repo, so there is nothing here to keep in sync. In an interactive session, Claude Code
prompts to install the plugin the first time; in a headless/remote session it does not
auto-install. Prefer the kit's skills/agents (e.g. `test-summary`, `git-sync`,
`screenshot-runner`, `repo-doc-set`) over ad hoc equivalents when one already fits the task.

**IN A CLOUD SESSION THE KIT IS NOT INSTALLED FOR YOU, AND INSTALLING IT BY HAND REACHES ONLY
THE CONTAINER IT RAN IN.** The cloud docs: a session does not install the plugins a repo
turns on under `enabledPlugins`, and each session is a fresh VM
(code.claude.com/docs/en/cloud-environments). The kit is a private repository, which the
session's git proxy serves only once it is attached to the session. By hand, in this order:
attach `aaronified/claude-kit` (at session start, or `add_repo`), `claude plugin
marketplace add aaronified/claude-kit`, `claude plugin install claude-kit@claude-kit` —
`install` alone answers *Plugin "claude-kit" not found in marketplace*. What it installs
does not load in the session that ran it.

**`scripts/claude-kit-setup.sh` IS FOR THE ENVIRONMENT'S SETUP SCRIPT**, which the owner
pastes in (not done as of 25 September). A setup script runs once per environment cache,
before Claude Code launches, so the session that builds the cache must be started with the
kit picked. That route has not run end to end, so check rather than assume:

- **Before relying on the kit,** its skills (`work-rating`, `pre-commit-gate`) are in the
  session's skill list. `claude plugin list` reports what is on disk, not what loaded.
- **Before the first commit,** with nothing staged,
  `sh "$(git rev-parse --path-format=absolute --git-path hooks)/pre-commit"` prints
  `kit-guard: clean`. Anything else: run the script, after attaching the kit if its plugin
  cache is missing.

What was measured, what the script was tested against, and what is still unknown are in
`docs/wiki/How-this-was-written.md`.

**PER CLONE, TWO LOCAL PIECES THAT GIT NEVER COMMITS**, both the kit's instructions:
`/.visual-verify/` in `.git/info/exclude`, where `visual-verify` writes its working
screenshots, and the kit's commit guard as the pre-commit hook. The guard knows the kit's
files by a built-in list of names that predates `work-rating`, `prose-style` and several
more, so a plain copy of one of those is only flagged for review; the list is the kit's to
fix.

**FIREFOX CANNOT BE HAD IN THE CLOUD CONTAINER** (the comment above `CHROME_CANDIDATES` in
`scripts/screenshots/capture.mjs` says why), **AND THE KIT SAYS NOT TO TRY**: `visual-verify`
forbids installing a browser to reach Firefox. Captures there take the pre-installed
Chromium with `TIPPANI_BROWSER=chrome`, and the report names the engine.

**THE KIT'S `AI.md` IS `docs/wiki/How-this-was-written.md`**, moved there and not copied
(the wiki's Home says so). **It carries the census block at the top of "How this repo was
written"**, the owner's call on 26 September: *"Top of that section"*, with the page's
breakdown by model following it. The kit looks for `AI.md`, so the check names the page:
`ai_census.py --check --ai-file docs/wiki/How-this-was-written.md`. The block is figures
stamped at one commit, so any later commit makes them stale (exit 1) until the block is
regenerated and pasted over the old one. Keep the filled-in *Unmeasured history* bullet
rather than the template's `<Fill in or delete…>` placeholder, and move the `SHA=` line in
the page's *To see it yourself* commands to the new stamp. Count from a full clone: a shallow one understates
every figure. An `AI.md` made anyway would be a second copy of a page the wiki says has
none.

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

- **WHEN TO RERUN A RATER, and it is a ceiling on passes rather than on score.** The
  owner's ruling: *"run and fix. if the rater crosses 8/10, fix and stop. if it is below
  8/10, rerun after fix."* So —

  | The pass says | What happens |
  |---|---|
  | **8/10 or better** | fix every finding, then **stop**. No second pass. |
  | **below 8/10** | fix every finding, then **rerun**, and repeat until a pass lands at 8 or better. |

  EVERY FINDING IS FIXED EITHER WAY. The score decides whether another pass runs, never
  whether the findings are worth acting on — a 9/10 pass's three findings are three real
  defects, and "we already cleared the bar" is not a reason to leave them. Where a finding
  is genuinely wrong, say so with the line that disproves it rather than silently dropping
  it.

  A TARGET IS STILL NEVER HANDED TO THE RATER. This table is how THIS session decides what
  to do with a score; telling a rater what score to reach is how a rater stops being worth
  running.

- **THE DIGEST IS OFF. THE OWNER TURNED IT OFF, AND THE REASON IS THE INTERESTING
  PART.** On 13 September: *"Not the session digest. Turn that off. It is picking up old
  rubbish."* It was — twice it reported work that was finished and PUSHED (#162, #163,
  #164, #169, #170, #171–175, #131–138) as "not started", because it compares the
  ledger's old prompts against the CURRENT UNCOMMITTED DIFF. A session that commits as it
  goes therefore looks, to the digest, like a session that has done nothing. A summary
  that is wrong about finished work is worse than no summary: it invites re-doing it.

  `session_digest.py` fires on whichever of three thresholds trips first — prompts,
  minutes, tool calls — so switching it off means pushing **all three** out of reach, not
  one. They are `CLAUDE_KIT_DIGEST_MINUTES`, `_EVERY` and `_TOOLS`, all at `100000`. Not
  the kit's single switch, `CLAUDE_KIT_DIGEST=0`: that also stops the ledger, and the ledger
  is what `/digest` reads when the owner asks for a summary (the kit's `commands/digest.md`).

  **AND THE PROJECT FILE IS NOT THE ONLY PLACE THEY HAVE TO BE SET.** A remote session once
  fired a digest while the project file said it could not: the hook read the three names as
  unset and used its own defaults (60 tool calls). Which session that was is not recorded,
  but the cloud docs name a cause that fits: a session with several repositories reads no
  repo's `.claude/settings.json` (code.claude.com/docs/en/cloud-environments, *What carries
  over from your setup*), and picking the kit alongside this repo at session start makes a
  session exactly that. Where the
  project file IS read, it reaches the hooks: on 25 September (Claude Code 2.1.282) a nested
  `claude -p` in the cloud container, started with every `CLAUDE_KIT_*` stripped from its
  environment, handed the kit's hooks the project block and the user block alike, and with
  the value in neither the hook fell back to its default, as a control. So the same three
  names are also in `/root/.claude/settings.json`, which is NOT in this repo: a fresh machine
  needs them written there, by hand or by `scripts/claude-kit-setup.sh`. **The route the docs
  give, and the one that needs no file at all, is the cloud environment's own environment
  variables**, which every session copies into its process environment at startup (same
  page, *Set environment variables*). They are the owner's to set, and this environment sets
  none of the three — the session's launch environment carries no `CLAUDE_KIT_*`. A setting
  that is true in one file and inert in the process is the shape of thing this document
  exists to stop.

  History, kept because it is what the settings will look like if the digest is ever wanted
  back: it ran on a clock rather than a counter, first at 30 minutes and then at 120
  (*"digest bot can work every 120 mins for now"*), with `_EVERY` and `_TOOLS` already
  pushed out of reach so the clock was the only trigger left. Summaries on request were
  always the owner's preference: *"when i ask for summaries, it will be run manually."*

  `notify.py` needs nothing — it writes a log and a desktop toast and says nothing in the
  conversation, and its per-tool toast is off by default.

- **A SUBAGENT'S FINDING IS A LEAD, NOT EVIDENCE. ALWAYS VERIFY.** The owner's, asked
  whether to check an inventory before building on it: *"yes, always verify."*

  THE NUMBERS FROM THE DAY THE RULE WAS MADE, because they are the argument. A six-question
  diagnosis fan-out with **three refuters per answer** had **four of its six answers
  killed** — including the session's own hypothesis, and including two that were killed only
  for being HALF the cause, which is the failure a single reader cannot see. The same
  afternoon, a six-question inventory run with **no verification pass at all** got every
  component right and **line numbers wrong** — it cited `Movies.jsx:792, 1653` for card
  sites that are actually at `1383, 1424`. Right conclusion, unusable citations, and the
  difference only showed under a grep.

  SO: a finding is checked at its own line before any work rests on it. Either give the
  fan-out adversarial verifiers — prompted to REFUTE, defaulting to refuted when unsure —
  or check it first-hand afterwards. Checking a cited line is a `haiku` job by the rule
  above, so this is cheap; what it is not is optional.

  AND SAY WHICH IT IS WHEN REPORTING. "Verified" and "an agent said" are different claims,
  and a table that mixes them silently is worse than one that reports less: the reader
  cannot tell which rows to trust, so the checked ones lose their value too.

- **A PLAN IS A LIST OF TASKS, AND IT LISTS EVERY ASK.** The owner, twice: *"the plan area
  need not be so much populated. all it needs is the list of tasks. always do that only"*,
  then *"in this session, you will always plan using only the task list and include every
  single ask there. for actual elaborate planning i will use another agent in another
  session."*

  So a plan is one line per ask and no more: no context section, no rulings table, no
  per-item evidence, no proposed-order paragraph, no verification appendix. **Brevity is
  per item, never in coverage** — the list is short because each line is short, not because
  it was pruned, and an ask made this session that is not on it is the defect this rule
  exists to prevent. The reasoning still has to happen and still has to be recorded; it
  goes in the commit body and `docs/wiki/Design-decisions.md`, where the house style already puts it and
  where it is read at the line it is about rather than scrolled past before work starts.

  AND THE PANEL IS NOT THE FILE. `/root/.claude/plans/<name>.md` can be rewritten and the
  Plan panel goes on showing the text captured when the plan was APPROVED. Replacing what
  the reader sees means re-submitting through plan mode; editing the file and reporting the
  panel fixed is a claim about something that was never checked.

- **BEFORE EVERY PUSH, EVERY COMMIT IN IT IS RATED, BY NO MORE THAN FIVE RATERS, AND THE RATER
  LOOKS.** The owner's: *"before every push, every commit in that push will be rated by separate
  agents (to ensure the best detailed coverage), and the rater will also visually verify
  stuff"*, and *"rater will have a guideline to check basic hygiene and feature list when
  visually checking"*. Then, on 26 September, stopping a fan-out of twenty-two: *"Don't fan out
  more than 5 raters. Group commits if needed"*, because *"if you create such minute raters
  they will start hallucinating issues resulting in regressions."* So at most five `work-rater`s
  run in parallel, and when a push holds more commits than that they are grouped, by area or
  by the finding they answer. Each rater is handed the prompts behind its group verbatim and
  the group's diffs, never a target, and scores each commit in the group. The pass table above
  applies per commit. Each captures the screens its commits touch (390 and 1280, light and
  dark, against the archive when there is one) and checks them against the list below,
  reporting each line as seen or not seen.

  **A RATING THAT FINISHED STILL STANDS WHEN THE FAN-OUT IS STOPPED.** The owner's: *"You can
  act on whatever raters already rated. If they were more than 8, those commits are already
  rated then."* Recover the finished results from the workflow's journal, act on them by the
  pass table, and re-rate only what had no result. The kit's `work-rating` skill carries the
  same rule (claude-kit ac0b427).

  **The visual guideline.** The owner asked for one; the items are the session's, drawn from
  the owner's reports (the first three) and from the Standing UI rules below.
  - *Feature list*: every ask the commit answers, found on screen and pressed, not read in the
    diff.
  - *Hygiene*, on every screen the commit touches, measured where a number exists:
    - A card's content is inset the same on all four sides, measured (`--card-pad` where the
      screen defines it: Settings and Metadata).
    - Every card wears `.hand-card`'s material, the same as a quote card.
    - The phone dock slides away on scroll.
    - No horizontal page scroll at 390 (`sideways` = 0).
    - No text box is sized in px, and nothing clips at 175% type (`make typescale`).
    - Glyphs are the app's own, never an emoji, and sit on the text's line.
    - Every dropdown is the themed `Select`.
    - Faces are circles and works are rectangles.
    - A name is not truncated where the reader is there to read it.
    - The ✓/✕ pair follows its arming and colour rules.
    - Both themes read.
    - The console shows no error.

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

## A test uses the app; it does not read the app

**The ruling, and the measurement that forced it.** A feature shipped **100% dead** —
the bulk season/episode control answered HTTP 400 on every press and wrote nothing —
while two tests stayed green through it: one asserting the shape the client sends, one
asserting the shape the server accepts, each right about its own half, nothing comparing
them, and neither ever pressing the button. That is not a gap in coverage; it is a suite
measuring the wrong thing. Measured at the time: **99 of 385** vitest files read SOURCE
TEXT with regexes, **128 of 235** jsdom tests mocked the network entirely, and **0**
tests drove a browser.

So: **tests act like human users. They do not know what the code is, except in
justifiably exceptional cases.**

A test may know **the address it opens, what is on the screen, what a person can do to
it, and what the app shows or keeps afterwards.**

A test may **not** know a function's name, a module's path, a CSS class, a JSON field
name, a Go type, or the text of any source file. Exceptions are declared in the file's
own header, naming what it knows and why nothing observable could serve. *"It would be
slower"* is not a reason.

**FOUR TIERS, AND EACH ANSWERS A DIFFERENT QUESTION.**

| | runs | what it is for |
|---|---|---|
| `test/journeys/` | `npm run journeys` | a real browser, a real server, a real database, one sentence a person would say |
| Go `internal/httpapi` | `go test ./...` | the API journey — create → export → upload → approve → verify, against a real SQLite file |
| `test/pure/`, `test/dom/` | `npm test` | where the function IS the observable unit: a date parser, an FTS escaper, a scheduler |
| `test/rules/` | `npm run lint:rules` | the source scanners — design ratchets and cross-source contracts, **Not tests.** |

`test/rules` is out of `npm test` on purpose and runs as its own CI step, so a broken
design rule still fails the build while a green test count stops meaning "the app works".
A scanner moves there; a scanner is deleted when a journey covers its ground.

**A JOURNEY THAT PASSES WITH ITS DECISIVE ACTION DELETED PROVES NOTHING, so delete it
and watch.** Every journey over the app has been mutation-verified that way, and the
mutation is named in the commit that added it. (`harness-vocabulary.journey.mjs` is the
one file this cannot be done to and the reason is not an excuse: its assertions are
`rejects.toThrow` on a named message, so there is no passing-while-asserting-nothing state
to mutate into. It also carries the directory's only declared exception — it knows the
harness's own promises, because a guarantee nothing checks is a comment.) This is not a nicety: within this
directory's own first day, one journey passed with its `press('Library')` removed (the
book was on Home too), one asserted a search result that Home's shuffle produced by
itself, and one agent-written file was a debugging probe — every press in a `try`, an
`it('probe')` — that could not fail at all.

**SETUP MAY USE THE API; THE JOURNEY MAY NOT.** Arranging the world is not the thing
under test, and a reader does not curl their own library into existence either. What has
to be user-like is the part being ASSERTED.

**THE VOCABULARY IS THE POINT** (`test/journeys/harness/screen.mjs`): `see`, `gone`,
`press`, `pressAll`, `pressKey`, `hold`, `type`, `choose`, `chosen`, `upload`, `valueOf`,
`onScreen`, `sideways`, `inReach`, `said`, plus `goto` and `downloaded` on the world. (`said` was
in the harness and missing here; `inReach` — can a thumb press this without scrolling —
arrived when `press` began centring its target, which made a press unable to tell whether a
control had followed the reader down.) (This list had stopped
counting at nine while the harness carried thirteen — `hold`, `choose` and `chosen` were
missing before `sideways` was added, which is the same drift the numbers in
`How-this-was-written.md` now have a guard for.) `sideways` is the only one that is a
NUMBER rather than a word — how far the whole page slides left and right, 0 where it does
not — because a page laid out three times wider than the phone it is on still looks like a
phone in a picture, and there is nothing on the screen to read. Names come from Chrome's own accessible-name computation, so
no journey ever names a class. `press` REFUSES an ambiguous name rather than guessing,
and case is folded because `innerText` reports text as rendered — a label the stylesheet
uppercases reaches a journey shouting.

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
`make overlay-scroll`, `make metadata-layout`, and `run-with-server.sh --seed`. Each says which library it is
against on its first line. The WIRING is checked by
`test/rules/harness-archive.test.js`; the WORKING was checked by running them — **all
eight now exit 0 against a restored archive** (`metadata-layout` is newer and has run only against the seeded fixture; `sheet-drag`, `panel-depth`, `typescale`,
`frame-scroll`, `hero-control`, `overlay-scroll`, a capture from
`run-with-server.sh --seed`, and `make controls`). `make controls` was the last of them:
it exited 3 while the backup shelf had no ceiling recorded — the app came back clean and
the touch floor was measured against nothing, which is exactly what 3 says. Both ceilings
are recorded now (`small 0 / labelled 0` at 1280, `small 302 / labelled 24` at 390), so a
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
`scratch_prefer_archive` in `scratch-server.sh` — and `test/rules/harness-archive.test.js`
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
is **not built yet**, and when it ships it is folded into `docs/wiki/Design-decisions.md` with a pass
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

(cd scripts/screenshots && npm ci)    # once, for npm run journeys: they launch their browser through it
cd web/frontend && npm ci
npm test                              # vitest: the pure + dom projects
npm run journeys                      # the browser tier — real server, real database
npm run lint:rules                    # the source scanners, out of npm test on purpose
npm run dev                           # Vite dev server, proxies /api -> 127.0.0.1:8080
npm run build                         # -> ../dist, a COMMITTED artefact the binary embeds

cd web/frontend && npm run glossary:check # docs/ui-glossary.html is generated — `make glossary`
node scripts/roadmap-data.mjs --check     # docs/roadmap.html vs. docs/data/*.json
node scripts/doc-map-check.mjs            # the wiki's Developing page maps the tree
```

Docker: `docker compose up` (see `docker-compose.yml`, `Dockerfile`). Daemon must be
running (`dockerd &` if not already up in this environment).

## Layout

- `internal/` — all Go backend code; `web/frontend/` — the React SPA; `web/dist/` — its
  committed build output, embedded via `web/embed.go`.
- `internal/metadata/` is where an outbound HTTP call to a provider belongs, and
  `internal/updater/` is an exception — it asks GitHub for the latest release — and so is
  `internal/httpapi/notify.go`, which posts to Pushover.
  THIS LINE SAID "THE ONLY PACKAGE" FOR A LONG TIME AND WAS ONE PACKAGE SHORT.
  All three go through `internal/outbound`, which is what makes `TIPPANI_OFFLINE` real; a new
  `&http.Client{}` anywhere under `internal/` or `cmd/` fails
  `TestEveryOutboundClientCarriesTheGate` until it is either gated or excused there by
  name and reason. The standing exemptions are the operator's own machines, not the
  internet: the `healthcheck` subcommand and the Docker Engine API (loopback), and the
  OIDC provider in `internal/auth/oidc.go` — switching the app offline must not lock
  everyone out of sign-in.
  `internal/store/` is the only package that opens the database.
- The canonical docs live in `docs/wiki/`, one question each — see Developing's "Which document
  answers what". Don't duplicate a fact across two of them.

## Conventions

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), scoped
  like `feat(cast): ...`. Subject says what changed; body says why, and the rejected
  alternative — see `git log` for the house style.
- Comments explain why, not what.
- **ONE COMMIT PER FEATURE OR FIX, AND `web/dist/` IS REBUILT ONCE PER PUSH.** The owner's:
  *"keep committing individual features and fixes"*, then *"you dont need to rebuild web/dist
  for each … only do that when you are pushing the commits"*. So feature commits carry
  source, tests and docs, and the last commit before every push is `chore(dist): rebuild`,
  made with `make frontend` (which writes `web/dist/` and `web/dist-inputs.json`, committed
  together) and then `make glossary`. "Frontend" includes `internal/i18n/en.txt` and
  `bn.txt`, which `src/i18n.js` imports with Vite's `?raw`. `go test ./...` fails on a stale
  `dist`, so a commit between two rebuilds is red there; every PUSHED head is not, and that
  is the line held.
- Docs that go stale with a change and belong in the same PR: `CHANGELOG.md` (user-visible
  changes), `docs/ui-glossary.html` (interface renames), `docs/wiki/How-this-was-written.md` (verification changes),
  `docs/wiki/Design-decisions.md` (design departures).

## Standing UI rules

- **USE THE SPACE. PUT WHAT IS USED MOST IN FRONT. THINK LIKE THE READER.** The owner's,
  made the mantra for every design decision in this repo: *"Use the space available. Think
  like the user. Whatever will be used more needs to be up front. This is how to design an
  intuitive ui."*

  It binds hardest where a surface has MOVED. A control that was folded away because the
  screen it sat on was one long scroll is not folded away because folding is right — it is
  folded away because of a constraint that no longer exists. The Review section is the
  worked example: its ten tuning numbers went behind an "In-depth controls" door when
  Settings was a single column of nine cards, and Settings is five sections now, each its
  own screen, with most of a phone's height standing empty under a card of three rows. The
  door survived the reason for it.

  So, at every screen: what does a reader come here to DO, how often, and is that thing the
  first thing they can reach? What is genuinely rare goes behind a door; what is merely
  detailed goes lower on the same screen. Empty space under a card is not restraint, it is
  a surface not doing its job — and a door with four presses behind it costs more than the
  rows it hides.


These are the design pack's, landed in code — they bind new work rather than describing
old work, so a screen that breaks one is a bug and not a variation.

- **An edge fade means it scrolls; a button at the fade opens the full set.** Use
  `Scroller` or `useEdgeScroll` — never bare `overflow`, which gives no signal and no
  mouse gesture. The fade is measured, so a row that fits wears none.
- **A NAME IS NOT TRUNCATED WHERE THE READER IS THERE TO READ IT — AND A MAINTENANCE
  SCREEN IS NOT THAT PLACE.** The owner's, 21 September, over a metadata console
  printing "The Witcher 3: Wild H": *"The work name truncation is fine. Delete that
  fucking rule. It is not okay when the work is the main concern. It is fine when it is
  used for maintenance."*

  THE BLANKET BAN IS GONE AND THIS IS WHAT REPLACES IT. The old rule was right about
  WHY — a shortened name and a short name look alike, so an ellipsis on one destroys
  the thing the row exists to show — and wrong about WHERE, because it read that
  reasoning as applying to every name in the app. It does not. On a shelf, a work's
  detail, a quote card, a cast list, the name IS the content: the reader is identifying
  a thing from what is printed, so it scrolls under the fade or it wraps. On a
  maintenance console — the metadata sections, the bin, Checks, the review screen's
  lists — the reader is not identifying anything. They came to fix a row they already
  know, every one of those names is printed in full on the shelf it came from, and a
  name that wraps to four lines there costs the density that makes a list of two hundred
  usable at all.

  So the question at each site is **what is the reader here to do**, not what kind of
  string this is. A clip still has to be HONEST wherever it happens — a real
  `overflow: hidden` with a real `text-overflow: ellipsis`, never a name cut off
  mid-letter with nothing saying so — and that is what
  `test/rules/no-truncated-names.test.js` enforces, over a list of the reading surfaces
  where the rule binds. `scripts/screenshots/typescale-baseline.json` still records
  clipping sites and its number may fall and never rise, which is a ratchet on drift
  rather than a ban.
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
- **A FACE IS A CIRCLE AND A WORK IS A RECTANGLE.** The owner's, made a rule:
  *"work images are rectangle, which is fine, but people and character images should
  be circles. Consistency is key (note that down in claude.md as well)."*

  The shape is the fastest thing on a row to read — faster than the picture, because
  it is legible before a pixel of it has loaded, and legible at 20px where a face is
  not. So it has to mean something, and what it means is WHICH KIND OF THING this is.
  A character wearing a 2:3 box beside a poster wearing a 2:3 box makes the reader
  read the label to tell a person from a film, which is the row's own caption doing
  work the picture should have done.

  Every portrait of a person or a character is `aspect-ratio: 1` and
  `border-radius: 999px` — the console rows, the cast rows, the duplicate cards, the
  form thumbnails and the record's own photograph. Every cover, poster and still
  keeps its medium's ratio. **A circle needs a square**: `border-radius: 999px` on a
  34×42 box draws an EGG, which reads as a broken picture rather than as a portrait,
  so the box is squared in the same edit as the radius. And where a portrait has not
  arrived yet, its PLACEHOLDER is square too — a 7:9 gap that becomes a circle
  reflows the text beside it the moment a photo is chosen.

- **EVERY DROPDOWN IN THE APP WEARS THE APP'S OWN THEME.** The owner's: *"app
  dropdowns shall all be app themed. Always."* A native `<select>` does not draw its
  list — the operating system does, in its own face, its own row height, its own
  highlight, on iOS a wheel that takes the bottom third of the screen. None of the
  app's type dials reach it, none of its material sets, none of its accent, so the
  one control in a themed row that ignores the theme is the one that looks broken.
  And it is not only looks: `Select` in `ui.jsx` carries the arrow keys, the
  drag-to-pick thumb, the Escape and outside-click rules, the ARIA, and a `filter`
  that a list of two hundred films needs and a native one cannot have.
  `test/rules/dropdowns-are-the-apps-own.test.js` is a ban rather than a ratchet —
  the count is zero and the replacement exists for every case.

- **A screen's glyphs are the app's own, never an emoji.** `NavIcon`, `Icon*` in
  `ui.jsx`, and nothing hand-picked beside them. An emoji is the platform's drawing: it
  changes with the reader's font, sits off the baseline every other glyph shares, and is
  the one picture `docs/ui-glossary.html` cannot document. A lookalike next to the real
  glyph is two pictures of one thing.
- **A COUNT WEARS THE GLYPH OF WHAT IT COUNTS, AND WHERE IT SITS DECIDES WHETHER THE
  WORD STAYS.** The owner's, asked how far "use them everywhere" reached: *"Everywhere a
  glyph exists. when there is enough space (like in section subtitle or subheaders), the
  glyph will follow the text so the association is clear. where there is small space, like
  rows with buttons and lots of info, they will serve as a visual indicator of the nouns,
  just like they do for the verbs."*

  So there are two shapes and ONE component — `Tally` in `ui.jsx`, where `showWord` is the
  only difference — written here in the owner's own notation, because the app's glyphs are
  the app's own and an emoji standing in for one in this file would be the very thing the
  rule above forbids on a screen:

  | the site | what it draws |
  |---|---|
  | a section subtitle or subheader — room to spare | **the word AND the glyph**: `42 skipped <skip> in 2 works <work>` |
  | a row already carrying buttons and several facts | **the glyph INSTEAD of the word**: `27 <skip> / 28 <quote>` |

  THE ROOMY ONE IS NOT DECORATION — IT IS WHERE THE READER LEARNS THE DRAWING, and it is
  the only reason the tight one reads at all. Written as two components they drift, and
  the day one changes its glyph the other goes on teaching the old one.

  **THE NOUN IS ALWAYS IN THE NAME, DRAWN OR NOT.** A glyph alone is a picture to a screen
  reader and nothing at all; `showWord` decides whether the noun is PAINTED, never whether
  it is said. The label goes on the GLYPH — the part standing in for a word — and the
  figure stays ordinary text, so it is read, copied and found in the page as drawn.

  TWO WAYS OF SAYING IT WERE TRIED AND BOTH WERE WRONG, each measured: an `sr-only` word
  is still `textContent`, which is how this repo's tests and the journey tier read a screen
  (`settings-changed.test.jsx` went red on "Review1 changed"); and an `aria-label` on the
  wrapper makes every count in the app a second `role="img"` on its screen, which broke a
  tile test whose helper said "the bar is the only role=img on a tile" and was right until
  it was not.

  **THE SPACE BETWEEN A FIGURE AND ITS NOUN IS A CHARACTER, NOT A FLEX GAP.** A gap puts
  air between two boxes and nothing between two strings, and flex items are blockified — so
  "6 skipped" reaches `innerText` as two lines, and a journey asking whether the screen says
  it is told no over a screen that plainly does. What a reader copies is the text.

  **RED IS FOR A COUNT THAT IS THE PROBLEM**, never for emphasis, and it takes the figure
  AND its glyph: a red number beside a grey drawing says the number is the warning and the
  noun is neutral. A count of things the reader owns is never red.

  **A COUNT WHOSE NOUN HAS NO DRAWING KEEPS ITS WORD**, and
  `test/rules/a-count-wears-its-glyph.test.js` is the list of which those are with the
  reason each — a count inside a SENTENCE (a confirm body, a flash) would be a rebus, an
  `<option>` can only hold text, a breadcrumb joined into a string has nowhere to put an
  element. A new standalone count of a drawn noun joins one column or the other; it cannot
  arrive in neither.

- **A GLYPH SITS ON THE LINE OF THE TEXT BESIDE IT, AND ITS BASELINE IS ITS BOTTOM EDGE.**
  The owner's, over the release log: *"The chevrons are slightly up compared to the version
  numbers. This is an alignment problem i see app wide. This kind of things differentiate
  casual from professional."*

  An `<svg>` has no text in it, so its baseline is its bottom margin edge — which means a
  glyph in an `align-items: baseline` flex row hangs its ENTIRE body above the text. That
  is the cause, it is invisible by eye at three pixels, and it is why nothing in this repo
  could find it. **The row stays baseline and only the glyph is centred** (`align-self:
  center`): baseline is what makes two type sizes read as one line, so changing the row
  fixes the glyph by breaking the pair beside it.

  **MEASURE THE INK, NOT THE BOX.** `make glyph-align` reports the glyph's ink —
  `getBBox()` mapped through the viewBox — against the painted rect of the text. A first
  pass measured element boxes, reported every count in the app as within 1.5px and
  disagreed with the owner, who was right: these are Phosphor fill icons with viewBoxes
  cropped off centre, so a box centred to the pixel can still have its drawing three pixels
  high. `glyph-align-baseline.json` records what is left with a reason per site and may
  fall and never rise.

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
  against the verification document's 1,508, which reads like a wildly stale document and is a scratch
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
- An app-logged `TIP-*` code has a row in `docs/wiki/Troubleshooting.md`.
