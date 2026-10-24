# Testing

Source of truth: this wiki page.

What a test is for in this repository, which suites there are, and what each is allowed to claim. The short version: a test names
something a person sees happen. Everything else is either a rule that runs as lint, or it is not tested.

## What a kept test is

A test earns its place when it checks **behaviour**: a person presses, types or drags, and something on screen or something kept
changes. "A cleared tick leaves the value alone" is a test. "`format()` returns this string" is not.

- **One behaviour, one test.** Several cases of the same behaviour are a table or a loop inside one test, not a test each.
- **A reported regression keeps its test.** If the owner reported it, or it shipped dead, the single test that would catch it
  coming back stays, and its header says what happened.
- **Nothing tests wording or markup.** Copy, labels, class names, tokens, markup shape and private helpers change with every
  edit and say nothing about whether the app works.
- **A test that mocks the whole network measures the mock.** A DOM test of that kind stays only where no real-browser journey can
  reasonably reach the behaviour.
- **Documentation is not tested by its wording.** The wiki is checked for links and structure (`node scripts/wiki-check.mjs`), not
  for what a sentence says.

The frontend suite was cut on this doctrine from 3,804 tests to a few hundred in v3.4.0. The reasoning was the owner's: a suite that
asserts every code change is a second copy of the code, and it taxes every change without catching more than a handful of real
mistakes. See [ADR-Index](ADR-Index.md) for the decision.

## The suites

| Suite | Where | Run | What it claims |
|---|---|---|---|
| Go | `internal/**/*_test.go` | `go test ./...` | Handlers, stores and packages behave over real SQLite and real HTTP; no outbound network |
| Frontend pure | `web/frontend/test/pure` | `npm test` | Plain JavaScript behaviour with no DOM |
| Frontend DOM | `web/frontend/test/dom` | `npm test` | A component under jsdom, driven the way a person drives it |
| Journeys | `web/frontend/test/journeys` | `npm run journeys` | A real browser against a real server: the app works end to end |
| Rules | `web/frontend/test/rules` | `npm run lint:rules` | Design rules read from the source. Lint, not tests |

**Rules are lint.** A file that reads source to enforce a design rule (no text shadow, one verb per glyph, spacing from a token,
every character pill through one door) lives in `test/rules` and runs as `lint:rules`. It is counted as lint and never as a test.

## Habits that keep it honest

- **Tests act like users.** Find a control the way a person would, press it, look at what changed. A test that reaches into a
  component's hooks or refs is testing the wiring.
- **No outbound network.** A test that reaches a real provider is a bug; stub the search or the fetch.
- **Nothing under a mount is ever written**, in a test or otherwise. The `mount` package holds no call that writes, and a test keeps
  it that way.
- **A package with tests is in the nightly sweep.** A Go package that gains tests is added to the race matrix in `ci.yml`, and a
  test fails if one is missing.

## When a test fails

Read the failure as a report from a user. If the behaviour really changed on purpose, change the test in the same commit and say so
in the commit body. If it did not, the code is wrong, not the test. A test is never loosened to make a build pass.

See also: [Developing](Developing.md) · [Releasing](Releasing.md) · [Home](Home.md)
