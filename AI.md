# AI disclosure

**Tippani was written with AI assistance, and not marginally — essentially all of
it.** This file says exactly what that means, because "AI-assisted" is used to
describe everything from a tab-completed variable name to a wholly generated
codebase, and those are not the same claim.

Two separate questions get conflated whenever AI comes up in a repository. They
are answered separately below:

1. **Was the code written with AI?** Yes, throughout. See *How this repo was
   written*.
2. **Does the app use AI — does it send your library anywhere, call a model, run
   inference?** **No.** Nothing. See *The app itself contains no AI*.

---

## The app itself contains no AI

This matters more than the first question for anyone deciding whether to run
Tippani, so it comes first.

- **No model calls at runtime.** There is no OpenAI, Anthropic, or local-inference
  code path in `internal/` or the frontend. Not disabled by default — not present.
- **No model ships with the binary.** Tippani is one static Go binary with an
  embedded SPA and a SQLite file.
- **Your highlights are never sent to a model.** They are never sent anywhere.
- **The only outbound calls are metadata lookups you trigger**, to the sources
  named in the README (Google Books, Open Library, TMDB, TheTVDB, Wikidata) plus
  a GitHub release check that runs **only when an admin presses the button**.
  Cover and portrait fetches go through a host allowlist with an SSRF guard.
- **Nothing is sent anywhere to be encrypted either.** Backup archives are sealed
  (AES-256-GCM, Argon2id, both from Go's standard library and
  `golang.org/x/crypto`) entirely in-process. No key service, no escrow, no
  network call. Since 1.4.2 there is a recovery key, and it is 32 bytes in your own
  data directory — nothing holds a copy but you.

There is one AI *feature* under consideration, and it is in
[the roadmap](docs/roadmap.html) under **Later / maybe** — not built, not started:
opt-in digest summaries against an **OpenAI-compatible endpoint you configure
with your own key**, off unless you turn it on. If it is ever built it will be
off by default and will say plainly what leaves the machine. Until then, the
honest summary is: **an AI wrote this app; the app does not use AI.**

---

## How this repo was written

Practically all of it was written in
[Claude Code](https://claude.com/claude-code) — design discussion, schema, Go,
React, CSS, SQL migrations, tests, and the documentation including this file —
with me directing the work, deciding what gets built, and reviewing what comes
back.

The audit trail is the git history itself: nearly every commit carries a
`Co-Authored-By:` trailer naming the model that worked on it.

| | |
| :-- | :-- |
| Commits in the repository | 262 |
| Commits with an AI co-author trailer | **258** |
| Period | 2026-07-02 → 2026-08-07 |

Models used, by commit count:

| Model | Commits |
| :-- | --: |
| Claude Opus 4.8 | 151 |
| Claude Fable 5 | 55 |
| Claude Opus 5 | 42 |
| Claude Haiku 4.5 | 5 |
| Claude Sonnet 5 | 4 |
| Claude Sonnet 4.6 | 1 |

Four commits carry no trailer. One (`1687961`) adds attribution URLs for
Bookcision, Readest and pretext to the README — typed by hand. The other three are
`github-actions[bot]` regenerating the roadmap's known-bugs block from the issue
tracker, which is machine-written but not AI-written, and the distinction is the
point of this file: a script that renders a JSON file into HTML is not a model
making choices.

To see it yourself:

```bash
# every commit, with the model that co-authored it
git log --date=short \
  --format='%h %ad %s — %(trailers:key=Co-Authored-By,valueonly,separator=%x2C)'

# the count, and the breakdown above
git log --format='%b' | grep -c 'Co-Authored-By: Claude'
git log --format='%b' | grep 'Co-Authored-By' | sort | uniq -c | sort -rn
```

The agent configuration used to do the work — session skills and subagent
definitions under `.claude/` — is **gitignored and not part of this repository**,
so what you see here is the output, not the toolchain.

---

## What is actually checked, and what that does not cover

AI-written code fails differently from hand-written code. It compiles, it reads
well, it is plausibly commented, and it can still be wrong — so plausibility is
worth nothing here and only execution counts. What the repo actually runs:

- **380 test functions across 71 test files**, over real HTTP handlers against a
  real SQLite database — not mocks.
- **CI on every push**: `go vet ./...`, `go test ./...`, a smoke test that boots
  the server and health-checks it, a frontend build, a check that the roadmap's
  generated regions still match the data files they come from, a check that the
  UI glossary's inlined stylesheet matches the one the app actually ships, and a
  check over the Home greeting's fixed-date tables — 129,210 greetings across 59
  regions, every day of a year and every hour bucket. That last one exists because
  every way it can break is silent: a greeting rendering `{name}` literally, a
  commemoration wishing you a happy one, or a country resolving to its neighbour's
  time zone. None of those throw, and none of them fail a build.
- **`docs/PLAN.md`** carries the design and, more usefully, the *reasoning* —
  including decisions that were wrong once and why the current shape replaced
  them. Comments in the code explain why rather than what, for the same reason.
- **Migrations are numbered, embedded and append-only**, each in its own
  transaction.

What that honestly does not cover:

- **Passing tests are not proof.** A real example from this repo: the parity test
  whose entire job is to fail when a field is added to one quote kind and not the
  other **skipped embedded structs**, so two new fields rode past it while the
  suite stayed green. It was found by reading the test, not by running it. Tests
  can pass for the wrong reason, and AI-written tests can be confidently wrong
  about their own coverage.
- **Confident documentation is not verified documentation.** Where this file
  makes a claim, it was checked against the tree; treat prose elsewhere in the
  repo as a strong hint and the code as the truth.
- **The one thing here with no test at all is the demo.** `web/frontend/src/demo/
  install.js` is a fetch shim that answers the API with dummy data so the Pages
  demo can run with no server, and nothing checks it against the handlers it is
  imitating. In 1.4.1 its backup response was found returning `created_at` where
  the server returns `created` — so the demo's Settings screen had been rendering
  "Invalid Date" for as long as that card existed. Nobody's data is at risk from a
  shim, which is exactly why it drifts: a fake that is close but not identical
  fails in the one place no test looks.
- **The frontend has no test runner, so anything it parses is parsed on trust.**
  1.4.2 found the sharpest example: `web/frontend/src/secret.js` reads the backup
  archive's binary header in the browser, by fixed byte offsets into a format
  defined in Go. Nothing checked the two agreed. `scripts/archive-header-check.mjs`
  now does, in CI — and it earned itself immediately by failing on the first run,
  for a bug I had written into the parser minutes earlier: the read window covered
  a maximal account name but stopped a few bytes short of the field after it, so
  an archive's recoverability read as absent for exactly the accounts with long
  names. That is the shape of every bug in this class. It does not throw, it does
  not look wrong, and it is only ever wrong for inputs nobody happened to try.
- **`docs/ui-glossary.html` is half honest by machine now, and half still by
  hand.** Its oldest failure mode was mechanical: the page inlines the built
  stylesheet so its samples are styled by real app rules, and every frontend build
  renames `index-<hash>.css`, so the snapshot rotted silently. `scripts/glossary-css.mjs`
  regenerates it and CI fails when it is stale, which ends that half. The *entries*
  are still written by hand and can still lag — 1.4.0 moved the app's explanatory
  copy into one registry (`web/frontend/src/help.jsx`) that the in-app help panel
  reads, and feeding the glossary from the same registry is the remaining half of
  [the roadmap's §9](docs/roadmap.html).
- **Known bugs are recorded, not hidden** — see *Known bugs, not yet fixed* on
  [the roadmap](https://aaronified.github.io/tippani/roadmap.html#bugs). That list is
  **generated from the issues I have accepted**, so it cannot quietly go stale in either
  direction: an accepted report lists itself without me writing it up, and a fix removes
  it only by the issue actually being closed. Accepting is a human step on purpose —
  publishing a stranger's text to a public page automatically is a different risk from
  the ones on this page, and no amount of escaping makes a wrong report right.
- **AI review is worth more than AI code, and it is the same model.** 1.4.2's
  design went to three adversarial reviewers before a line was written — one asked
  to attack the cryptography, one disaster recovery, one the Go implementation —
  and between them they killed the design. The recovery key was to live in a
  column of the `users` table; a restore replaces that table wholesale, so
  restoring any archive, resetting the instance, or deleting the account would have
  destroyed the key silently, and the only surviving copy sat in a directory the
  next restore deletes. Two of the most ordinary operations there are, in order,
  no error at any point. The same reviews disproved a claim I had already put in
  the 1.4.1 release notes — that renaming an account orphaned its archives — by
  pointing at the two lines that make it false. The fix for both was to make the
  design smaller. Worth being precise about what happened, though: the reviewers
  are the same model that wrote the design, given a different instruction. What
  changed was not intelligence but *stance* — "find what is wrong with this" is a
  different question from "build this", and it is the one that was not being asked.
- **A confident diagnosis is worth no more than confident code.** The concurrency
  defect that sat in that list for two releases came with a written-up cause — the
  connection pool allows four writers where the plan specified one — and a written-up
  fix, a mutex. Both were wrong. The real fault was the lock order: a `DEFERRED`
  transaction that reads before it writes must upgrade its read lock, and SQLite fails
  that upgrade instantly rather than waiting, so the 5000ms `busy_timeout` was never
  consulted. It was caught by making the test *fail* on purpose and reading the error
  code — `517`, `SQLITE_BUSY_SNAPSHOT`, which names the upgrade — not by re-reading the
  explanation, which was fluent and had been sitting there being fluent for months.

---

## Third-party code

A fair question about AI-written code is whether any of it is somebody else's.
What can be stated from the tree:

- **The dependency surface is deliberately tiny and fully declared** — three
  direct Go modules (`modernc.org/sqlite`, `golang.org/x/crypto`,
  `golang.org/x/time`) in [`go.mod`](go.mod), and three runtime npm packages
  (`react`, `react-dom`, `@chenglou/pretext`) in `web/frontend/package.json`.
  Everything else in the binary is standard library.
- **What was borrowed is credited by name** in the README's *Attribution*
  section — the `pretext` text-reflow library, the CC0 texture packs behind the
  paper/film skins, the metadata sources, and the apps whose export formats are
  read as import sources.
- **Design influences are named where they apply**, in the code and in
  `docs/PLAN.md` — the Radarr-style status bar, the `*arr`-style cover folder — so
  an idea taken from elsewhere is attributed rather than passed off.

If you spot something in here that belongs to someone else and is not credited,
that is a bug worth an issue.

---

## Responsibility, and license

I am responsible for this code — for what it does, for its bugs, and for the
decision to ship it. "An AI wrote it" is an explanation of method, never an
excuse, and it does not transfer to whoever runs the software.

Tippani is **MIT licensed** (see [`LICENSE`](LICENSE)) and I hold the copyright,
on the same terms as any other MIT project. If you find something wrong, open an
issue — a bug report is as useful here as anywhere, and arguably more so.

*Last verified against the tree at v1.4.2.*
