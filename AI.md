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
| Commits in the repository | 627 |
| Commits with an AI co-author trailer | **619** |
| Period | 2026-07-02 → 2026-08-19 |

Models used, by commit count:

| Model | Commits |
| :-- | --: |
| Claude Opus 5 | 403 |
| Claude Opus 4.8 | 151 |
| Claude Fable 5 | 55 |
| Claude Haiku 4.5 | 5 |
| Claude Sonnet 5 | 4 |
| Claude Sonnet 4.6 | 1 |

Some of those trailers carry a `(1M context)` suffix naming the long-context
variant — 286 of the Opus 5 commits and 147 of the Opus 4.8 ones. It is the same
model with a larger window, so the table folds them; the second command below
prints them unfolded if you would rather see it raw.

Eight commits carry no trailer, and they divide three ways. **Four** are
`github-actions[bot]` regenerating the roadmap's known-bugs block from the issue
tracker — machine-written but not AI-written, and that distinction is the point of
this file: a script rendering a JSON file into HTML is not a model making choices.
**One** (`1687961`) adds attribution URLs for Bookcision, Readest and pretext to
the README, typed by hand. The remaining **three** are oversights rather than
categories — the `2.0.0` and `2.1.0` release stamps and one Go test refactor,
each of which was AI-written and should have said so. They are named here instead
of being quietly fixed, because a disclosure that rounds its own gaps away is not
one.

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

### Increasingly this is several agents at once, not one conversation in sequence

Later releases were built by fanning a task out across **parallel subagents** under
my direction and then reconciling what came back, rather than by one session doing
everything in order. Three examples from 2.1.x, all of them in the history:

- **The Bengali interface** (2.1.1, 2,446 strings) was written by **six agents in
  two passes**, each working from a committed style sheet — `docs/plans/bengali-style.md`
  — rather than from the English alone, because six writers with no shared
  register produce six registers in one interface. The merge was then checked
  mechanically: key set, placeholder parity, nothing lost, and on the 442 keys
  where writers disagreed, that the file holds one of *their* readings rather than
  an invented third. The register checks are in `docs/plans/multilingual.md`.
- **The roadmap audit** ran one reader per section and then **four sceptic agents
  whose instruction was to refute the first pass**, not to agree with it. They
  overturned or amended **ten of thirty-three findings**. Acting on the first pass
  alone would have deleted real backlog items and kept stale ones, which is the
  whole argument for the second pass.
- **Two decision entries in `docs/PLAN.md`** were drafted by agents from the plan
  documents and then verified line by line against the code before being inserted.
  One of them corrected a figure I had written and repeated: "1,299 of 2,446 keys
  carry a comment" had counted comment *lines*.

**The rule that makes this safe is that an agent's finding is worth nothing until
something executes or cites.** More agents means more plausible-looking output per
unit of my attention, which is a hazard and not a benefit unless the verification
scales with it. So a finding carries a `file:line` or it is not a finding; a test
is broken on purpose to watch it go red before it is trusted; and where a claim
matters, a second agent is pointed at it with instructions to break it. This
session alone, that pass caught two of my own tests asserting the wrong thing — one
that a comma stays inside a tag name when the vocabulary deliberately splits on it,
and one that a Bengali abbreviation may not end in a vowel sign when that is
exactly how Bengali abbreviates.

---

## What is actually checked, and what that does not cover

AI-written code fails differently from hand-written code. It compiles, it reads
well, it is plausibly commented, and it can still be wrong — so plausibility is
worth nothing here and only execution counts. What the repo actually runs:

- **1,307 Go test functions and 2,193 frontend tests, across 387 test files** — the
  Go half over real HTTP handlers against a real SQLite database, not mocks.
  Counted, not estimated, and every number here has a command that reproduces it:

  ```bash
  grep -rhoE '^func Test[A-Za-z0-9_]+' --include='*_test.go' . | wc -l   # Go functions
  cd web/frontend && npm test                                            # frontend tests
  find . -name '*_test.go' -not -path './node_modules/*' | wc -l         # 217 Go files
  find ./web/frontend -path '*/node_modules' -prune -o \
       -type f \( -name '*.test.*' -o -name '*.spec.*' \) -print | wc -l # 170 frontend
  ```

  A number in a file like this one is stale the moment it is written, so recount
  rather than trust it — these three had drifted from 645 / 1,293 / 180 before
  anyone checked them at 1.12.0, from 725 / 1,581 / 203 before they were
  recounted at 1.14.2, from 765 / 1,672 / 217 by 1.15.0, from 807 / 1,759 /
  233 by 2.1.1, from 924 / 1,771 / 284 by 2.2.0, from 1,085 / 1,844 / 320
  by 2.3.0, from 1,100 / 1,853 / 323 when they were recounted for 2.2.3, and most
  recently from 1,153 / 1,977 / 338 before this recount — which is why each one now
  sits beside the command that produces it.
  The 2.2.4, 2.2.5 and 2.2.6 passes added forty-four cases between them, every one
  for a defect a release review found rather than for a feature — and six of those
  defects were introduced by the pass before. That is the number worth reading
  here rather than the total: the two habits named below are what stops a fix pass
  being a source of work, and they did not stop it three times running.

  THE ONE THAT GOT PAST THREE REVIEWS is worth naming, because it is a gap in the
  habits rather than a lapse. A panel called a callback it did not define with no
  argument; the prop it had been handed was the host's record setter, so the host
  was set to `undefined` and the page unmounted. Twenty tests around it asserted
  requests, payloads and absences — and every one of them stubbed that callback as
  `() => {}`, which cannot see what it was given. The repair for THAT then passed
  the host its own record back — never undefined and never anything either, since
  setting React state to the same reference is a bail-out — and the new test could
  not see it, because it asserted what the panel passes and stopped there.

  **A callback crossing a component boundary has three things worth asserting:
  that it is called, what it is called WITH, and what the other side does with
  it.** A stub answers only the first, and the second missed a release.

  **The frontend count went DOWN while its file count went up**, which is the sort
  of number that ought to be explained rather than reported. `5751757` collapsed
  per-datum tests into tables and dropped eleven that asserted nothing the
  neighbouring case did not already assert. A suite is not better for containing
  eleven tests that cannot fail alone, and a total that only ever climbs is a total
  nobody is reading.

  Two habits behind those numbers are worth naming, because they are what stops a
  plausible test from being a useless one. **Assert on values, never on counts**:
  "got 3, wanted 3" passes happily while the three are the wrong three, which is
  the entire failure mode of a filter or a facet. And **check the test by breaking
  the code**: the search facets landed green on the first run, which is not
  reassuring on a change that touches fifteen queries — so the predicate was
  neutered to confirm seventeen tests noticed, and again to confirm two more
  noticed a subtler reversal. A test written after the code, by the thing that
  wrote the code, is worth exactly what its failure proves.

  1.15.0 added a third habit, for a case the other two cannot reach. Seven
  features in that release all rewrote the same two functions, so instead of
  building them in sequence I had seven implementation specifications written
  against the tree, each blind to the others, and then reconciled. **It found
  three defects live in the shipped app before a line of the feature was
  written** — a render branch that would print the answer above the options, a
  switch whose default returned the correct quote among the distractors, and a
  badge that counted cards the deck then refused to serve, whose test asserted
  the empty deck as correct. It also found two bugs that lived *between* two
  features and belonged to neither, which is the class no single spec and no
  single test was ever going to reach. The reconciliation is folded into
  `docs/PLAN.md` §8.

  The same release is also the clearest case for writing the plan first: the
  retired plan specified cloze grading word by word and said why in as many words
  — "a whole-string budget earned by long neighbours will hide a wholly missing
  short word" — and I built the whole-string version anyway. Three commits later
  a documentation pass compared the two and found that `"want of a wife"` was
  accepting `"want of a life"`. The plan was right and the code was not, and only
  reading them side by side said so.
- **CI on every push**: `go vet ./...`, `go test ./...`, a smoke test that boots
  the server and health-checks it, a frontend build, a check that the roadmap's
  generated regions still match the data files they come from, a check that the
  UI glossary's inlined stylesheet matches the one the app actually ships, and a
  check over the Home greeting's fixed-date tables — 129,210 greetings across 59
  regions, every day of a year and every hour bucket. That last one exists because
  every way it can break is silent: a greeting rendering `{name}` literally, a
  commemoration wishing you a happy one, or a country resolving to its neighbour's
  time zone. None of those throw, and none of them fail a build.
- **Two harnesses run a real browser rather than a DOM emulator**, because the two
  things they measure do not exist in jsdom. `make perf` measures how long the app
  holds the main thread per action; `make typescale` turns every type dial to 200%,
  sets the root font size to 24px, and fails when a screen clips something it did not
  clip before. The second is a DIFFERENCE and not a threshold on purpose: plenty of
  this app clips deliberately — a line-clamped intro, an ellipsised path — so a check
  that failed on all clipping would fail on the design and would be switched off
  within a week. Its first run found 59 elements, twelve of them the user avatar's
  initial cut off on every screen in the app at once, because a 38px badge was
  inheriting the page's 1.55 leading around a letter that grew with the type dial. The
  first repair froze the letter's size instead, which fixed the clipping by taking it
  off the dial — and `typescale.test.js`, a guard that predates all this, failed it in
  the same run. That is the check working: two rules met, and the older one was right.
  The remaining 47 sit in
  `scripts/screenshots/typescale-baseline.json` as a ratchet that may fall and never
  rise. Note what the LITERAL version of the pack's test would have reported here:
  nothing. Tippani never sets a root font size — `applyTypeScale` writes finished
  pixels into `--type-*` — so setting the root to 24px alone leaves the app untouched
  and would have returned a clean bill of health for a stylesheet full of px boxes.
- **Two guards added in 2.2.0 were each watched to fail before being kept**, which
  is the same standard the rest of this list is held to and is worth naming because
  both protect something invisible. `CASE WHEN ? <> ''` in the cast merge is what
  stops a TMDB refetch blanking the character art a TheTVDB fetch found — replaced
  with plain assignment, the test reports both an untouched and a corrected row
  losing it. And `OneTimeEnv.FreshInstall`, which stops a new install being told
  about a change it never lived through, needed a SECOND test: on a genuinely
  fresh database the pass writes nothing whether the guard is there or not, so
  inverting the guard left the obvious test green and only a direct call with a
  populated database caught it.
- **The committed SPA is checked against the sources it was built from**, by
  `web/dist_inputs_test.go` against the hashes in `web/dist-inputs.json` that
  `npm run build` writes. This one is here because the guard it backs up was
  correct and still let a stale bundle onto `main`: CI rebuilt `web/dist` and
  diffed it, which works, but only speaks after the push — and the commit it
  caught had not touched `web/frontend` at all. It edited `internal/i18n/en.txt`
  and `bn.txt`, which `src/i18n.js` imports with Vite's `?raw`, so every string in
  the interface comes from them and editing one changes the bundle. Nothing about
  a `.txt` file inside a Go package says "you have just changed the frontend".
  Moving the check into `go test` is the whole point: it needs no Node, no
  six-second build and nothing installed in the clone, so it fails in the working
  tree rather than in a workflow. The input set outside `web/frontend/` is derived
  from the imports that escape it, because a hand-kept list is the same blind spot
  one level up.
- **`docs/PLAN.md`** is a decision log: every design decision, the reasoning that
  produced it, the alternative turned down, and — where it applies — the part I
  got wrong and what changed my mind. It used to be the design document I wrote
  before building, and it had drifted into describing a system that was partly
  never built and partly rebuilt underneath it. A log fixes that structurally: an
  entry that records a decision *and* records that the decision was wrong stays
  true forever, where a design document that is 80% accurate gives you no way to
  tell which 80%. Comments in the code explain why rather than what, for the same
  reason.
- **Migrations are numbered, embedded and append-only**, each in its own
  transaction — and the runner **refuses to open a database newer than itself**.
  Forward-only means the downgrade failure mode is a *success*: an old binary
  finds all its own migrations applied, skips them, returns nil, and serves an
  app missing every table added since, with nothing in the log. It happened, from
  a stray tag winning `:latest` in CI. Stopping with both version numbers turns a
  four-migration audit into one line.

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
- **The demo was the one thing here with no test at all, and now has one.**
  `web/frontend/src/demo/install.js` is a fetch shim that answers the API with
  dummy data so the Pages demo can run with no server, and nothing checked it
  against the handlers it is imitating. In 1.4.1 its backup response was found
  returning `created_at` where the server returns `created` — so the demo's
  Settings screen had been rendering "Invalid Date" for as long as that card
  existed. Nobody's data is at risk from a shim, which is exactly why it drifts:
  a fake that is close but not identical fails in the one place no test looks.
  1.5.0 exported its `route` function and started asserting shapes, which caught
  two of the same class before they shipped. The cover is partial — it asserts
  the answers the newest screen reads, not every route — so the drift risk is
  reduced rather than closed.
- **A bug report is a report of a symptom, and the symptom is often not the
  bug.** 1.7.0 opened with "quotes should be included in the daily quiz". They
  already were — the deck has drawn them since the medium existed, and two tests
  written to check that passed against the code as it stood. What was broken was
  the Settings control, which offered *Books*, *Films & shows* and a third option
  labelled *Both* that silently meant all three: the word undercounted what it
  did, and there was no way to ask for quotes at all. Building what the report
  literally asked for would have meant changing a deck that was correct. The
  first move on any report like this is a test that tries to reproduce it, and
  the useful outcome is as often "this passes, so look upstream" as a red bar.
  Neither of those two tests existed before, either: every deck test seeded a
  single medium, so "the deck serves standalone quotes" had only ever been
  asserted for a library containing nothing else, which is not a library anyone
  has.
- **Consistency is not something you can review for.** 1.6.0's whole subject was
  the app agreeing with itself, and almost nothing in it was found by looking at
  a screen. Four icons were another icon — Share and Upload were both a tray with
  an arrow in it a pixel and a half apart, Export and Metadata were the same three
  strokes at coordinates half a unit apart — and the nav kept its own copy of the
  set at a different stroke weight, so the Library tab was the identical open book
  the "currently reading" badge wears. The same action was `delete` on a card and
  `del` in a table. A window could be dismissed five different ways. Every one of
  those is invisible in a screenshot of any one screen, because each screen is
  internally fine. The tests that now hold the line compare every exported glyph
  with every other one — both exactly and with all coordinates stripped, so a
  near-miss cannot hide behind a rounding nudge — and read the *source* for
  control labels rather than the help file, because a doc test that only reads the
  docs agrees with itself forever. Three of them earned it immediately by failing
  on the tree as found.
- **The frontend had no test runner, so anything it parsed was parsed on trust.**
  1.5.0 added one (Vitest, dev-only — the three runtime packages below are
  unchanged) and moved the two bespoke check scripts into it. What it covers is
  the pure logic: routing, credit splitting, recall status, grouping, the share
  formats, the quote-card wrap engine, the partial-date rules, the demo shapes.
  Rendering is still largely unchecked, so this list has shrunk rather than
  emptied. What prompted it was this, from 1.4.2: `web/frontend/src/secret.js`
  reads the backup archive's binary header in the browser, by fixed byte offsets
  into a format defined in Go. Nothing checked the two agreed. A check script
  did, in CI — it is a Vitest case since 1.5.0 — and it earned itself
  immediately by failing on the first run, for a bug I had written into the
  parser minutes earlier: the read window covered
  a maximal account name but stopped a few bytes short of the field after it, so
  an archive's recoverability read as absent for exactly the accounts with long
  names. That is the shape of every bug in this class. It does not throw, it does
  not look wrong, and it is only ever wrong for inputs nobody happened to try.
- **`docs/ui-glossary.html` is generated now, and the hand-written half is what
  had gone wrong.** Its oldest failure mode was mechanical: the page inlines the built
  stylesheet so its samples are styled by real app rules, and every frontend build
  renames `index-<hash>.css`, so the snapshot rotted silently. A generator
  regenerates it and CI fails when it is stale, which ends that half — though only
  after 1.5.2 found that it had been regenerating 140KB of stylesheet *inside an
  HTML comment* for two releases, because the page's opening comment named the
  `<style>` tag in its own prose and never closed, and the generator finds its
  block by searching for that tag. Every sample rendered unstyled, which is the one
  thing the page exists not to do, and `--check` passed throughout: the bytes it
  compared were exactly the bytes it had written. A gate that only reads its own
  output cannot fail. It refuses now rather than writing into a comment.

  **The entries used to be hand-written too, and they had lagged a full release.**
  The page went on offering a *Paper / Film aesthetic* toggle after v3 replaced
  aesthetics with material sets — a control driving an attribute that appears zero
  times in the stylesheet — and drew four CSS classes the app had deleted. They are
  now built by `web/frontend/scripts/glossary-build.mjs` from a catalogue module, from
  `glossary` declarations beside the components (which render the **real** component,
  so a sample cannot quietly lose a class the way the buttons had lost `tactile`), and
  from `web/frontend/src/tokens.js` for the constants. `glossary-registry.test.js`
  fails when an entry names a class or an identifier the source no longer has, and it
  carries two ratchets — 57 components with no entry (37 of them icon glyphs), and
  141 of the 171 entries still on carried markup — that may fall and may not rise.
  Documenting the filled icon set took the glyph figure from 49 to 37 in one pass,
  which is the ratchet working as intended rather than a number being relaxed. **Those two numbers are the honest
  measure of what is still undone here**, and they are asserted rather than described.
  Feeding the *prose* from `web/frontend/src/help.jsx` remains
  [the roadmap's help &amp; density section](docs/roadmap.html#help-density).
  What 1.6.0 added is the cheaper
  half of that: `web/frontend/test/pure/help.test.jsx` asserts that every screen a
  nav list can reach has an entry, and that a control the app labels is a control
  the help names. It found three gaps on the first run — the whole Quotes filter
  row, the Catalogue's group-by, and an "Export all" button that had stopped
  meaning "all" when the list screens started exporting the filtered view. All
  three had been read past repeatedly. The test reads the *source* for those
  labels, not the help file, for the reason above: a doc test that only reads the
  docs agrees with itself forever.
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
- **Changing a default changes nothing, if the default was ever written down.**
  1.7.2 turned the share image's colour switch off by default. The one-character
  version of that change — flip `true` to `false` — is correct, reviews clean, and
  alters the behaviour of no device that has ever opened the panel: the hook
  behind it persists on *mount*, so the old default had already been stamped into
  local storage by the first render, and a stored value beats a default every
  time. What makes this worth writing down is that the obvious test passes. Clear
  the storage, render, assert the switch reads Off — green, and green for a change
  nobody would experience. The test that means anything is the one that seeds the
  *retired* key with the *old* value and asserts the switch still reads Off, which
  is the only version that can tell a default from a decision somebody made.
- **The safest-looking way to walk a schema was the one that lost data.** The bin
  snapshots a deleted thing and its whole subtree, and "follow the foreign keys"
  is obviously the robust way to find that subtree — it cannot go stale, it needs
  no list to maintain. Except that in this schema two of the tables that travel
  with a quote have no foreign key at all: `item_reviews` is polymorphic
  `(kind, item_id)` and `work_reads` is `(kind, work_id)`, and both are cleared by
  AFTER DELETE triggers instead. An FK walk finds neither. The restore then works
  perfectly: the book comes back, the quotes come back, and a year of
  spaced-repetition history is silently a new card. Nothing throws, nothing logs,
  and the person who notices is the person who had that history. The fix was to
  declare the table list and write down, in the migration, why the obvious
  approach is wrong — because the next person to touch it will reach for the FK
  walk for exactly the same good reasons.
- **A feature request names a mechanism; the thing worth building is the need
  underneath it.** "Show the changelog by fetching it from git" cannot be done by
  the shipped artifact at all — the image is distroless, there is no git and no
  shell in it, the docs are outside the build context, and the CSP stops the
  browser calling GitHub. Taking the mechanism literally leads to a dead end;
  taking the NEED — "stop sending me to a website to find out what changed" —
  leads to embedding the file, which is better on the hardware this runs on
  because it also works with the network off. Worth saying out loud to whoever
  asked, though, rather than quietly building something else.
- **"No importer can fill this column" is not a reason to leave it out of the
  import path.** Adding a translator to books made the staging queue look
  irrelevant: no third-party format carries one, so a column on the approval queue
  could only ever move an empty string. The step that argument skips is that the
  app's OWN Markdown export is an importer's source, and every import is staged —
  so the field survived the export, survived the parse, and was dropped on the way
  into the queue. Exporting a library and importing it back would have lost every
  translator in it, with a successful import and matching counts saying nothing had
  happened. The question is never "can a source fill this", it is "does anything on
  the round trip have to carry it".
- **A switch written as a default plus overrides is a bomb with the fuse in the
  next feature.** `handlePeopleNames` read `q := <the books.author query>` and then
  overrode `q` for actor, director and speaker. Correct for exactly as long as
  author was the only book-side role — and the moment translator became valid,
  asking for translators answered with every AUTHOR in the library, tallied, named
  as translators and offered for renaming. The same file already carried a
  twenty-line comment explaining this hazard about two OTHER functions, which had
  been fixed; this third one had been missed. Knowing the shape is not the same as
  having swept for it.
- **A control strip that grows one button per release has no moment where it
  breaks.** The selection bar shipped with four word-buttons and left 1.11.1 with
  eleven controls, every one of them added for a good reason and none of them the
  one that broke it — because nothing broke. It simply became, on a phone, a strip
  wider than the phone, one release at a time. The fix was not smaller buttons but
  a decision the bar had never been asked to make: WHICH THREE matter, with the
  rest behind a ⋯. Worth noticing that the failure had no error, no test and no
  screenshot — the only signal was a reader saying it looked crowded.
- **Turning words into glyphs takes the state off the screen with them.** The quiz
  toggle reads “Skip in quiz” or “Add to quiz”, and that label was doing two jobs:
  naming the action and reporting which way round the selection currently is. A
  single glyph would have kept the first and silently dropped the second, and the
  loss is invisible in review because the button still works. So the picture flips
  with the label — two glyphs drawn as a pair, which is the only reason the set has
  two drawings that are nearly the same picture on purpose.
- **A rule that five queries splice belongs in the one string they share.** Keeping
  a quote out of the Daily Quiz is a single condition, and it has to reach the three
  candidate fetches, the count behind the cards-left badge, and the breakdown behind
  "where you stand". Written into four of the five, the failure is not an error: it
  is a badge counting a card the deck will never serve, which reads as the quiz
  being broken rather than as a filter being inconsistent. `reviewSource.where()`
  already existed as that shared string, and the whole feature is one clause added
  to it — which is only obvious once you have gone looking for every place the
  condition would otherwise have to be repeated.
- **The obvious home for a flag can invent history.** "Not in the quiz" is a
  scheduling fact, so `item_reviews` looks like where it belongs. But that table has
  no row at all for a quote that has never been reviewed, and four separate queries
  read "a row exists" as "this card has been seen" — so excluding a quote and
  putting it back would quietly promote it from never-seen to seen-and-overdue. A
  lie about the reader's own history, told by a preference they set for something
  else entirely. The column went on the quote instead, where it also travels for
  free through the bin, the account backup and the export, none of which had to learn
  it exists.
- **A presence flag is a function waiting to be called.** The selection bar draws
  some of its own controls (the tag field, the sticker dialog, the delete confirm),
  so for those it passed a bare `true` into the action registry purely to mean
  "available". That read fine for two releases and broke the moment a new action
  — a shelf dropdown — was one whose `run` the bar actually invoked: the action
  appeared, the control rendered, and choosing a shelf threw. Nothing about the flag
  was wrong; it was that a value in a slot typed as a callback will eventually be
  called.
- **A gesture bound to `closest('button')` breaks on the day the card IS a button.**
  Long-press-to-select ignores presses that land on one of the card's own controls,
  which is right, and it did it by asking whether the target had a button ancestor.
  Quote cards are `div`s, so it worked. A cover tile is a `<button>` — the whole
  cover is the thing you click to open the book — so every press on it matched, and
  the gesture did nothing at all on two entire screens. Invisible to inspection,
  invisible on a desktop, and caught only because the new board got its own test.
- **A bug of omission needs a sweep, not a case.** Scrolling inside a popup also
  scrolled the page behind it. The fix is one CSS property, and the temptation is
  to add it to the popup that was reported — but the defect is not a wrong value
  anywhere, it is that nobody thought about scroll chaining at all, so the test
  is an invariant over the stylesheet: every scroll container declares
  `overscroll-behavior`, with a named exemption list and a guard that the sweep
  still matches something. Widening it from vertical to sideways immediately
  found one nobody had reported — the top navigation, where running off the end
  is the browser's back gesture, so a nav that navigates away. The same sweep
  showed the other half was worse than the report: eleven full-viewport overlays,
  and seven of them never froze the page behind them at all.

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
- **Eighteen type families ship in the build**, all `@fontsource` packages and all
  **OFL-1.1** — free to use, embed, modify and redistribute. Twelve of them arrived
  in 1.15.0 as the alternates behind Settings → Type. They are bundled rather than
  fetched, which is the same rule as everything else here: this app makes no
  network request the reader did not ask for, and a type picker that phoned a font
  CDN would have been the first exception, on a screen about how your own words
  look.
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
