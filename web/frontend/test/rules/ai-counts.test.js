// THE NUMBERS IN AI.md ARE COUNTED, NOT REMEMBERED.
//
// THAT FILE'S OWN ARGUMENT is that AI-written code fails plausibly, so only
// execution counts — and it opens with a count of what executes. It has also
// said "a number in a file like this one is stale the moment it is written, so
// recount rather than trust it" through six recounts, and gone stale after five
// of them. Twice that happened inside the session that recounted it: the commit
// that fixed the numbers, then two commits later a test file deleted and cases
// added, and the file was wrong again with its own commit message selling the
// recount.
//
// A HABIT THAT FAILS THAT RELIABLY IS A GUARD'S JOB. The three counts below are
// static facts about the tree and are checked here with the same definitions the
// commands in AI.md use.
//
// AND THE FOURTH IS NOT CHECKED, deliberately. The frontend TEST total comes out
// of the runner: `it.each` expands at run time, so counting `it(` in the source
// would produce a number that is confidently wrong — which is worse than one
// that is honestly stale. AI.md says which of its four numbers to distrust.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that this asserts
// the DOCUMENT against the tree, not the tree against the document — a case
// failing here means the sentence needs recounting, not that a test went missing.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const AI = readFileSync(join(REPO, 'AI.md'), 'utf8')

// Everything under `dir` matching `pred`, skipping the directories the commands
// in AI.md skip.
//
// AND `.claude`, WHICH IS NOT THIS REPO'S SOURCE — `.gitignore` says so in as many
// words ("Everything else under .claude/ ... stays ignored"). It matters because a
// subagent launched with worktree isolation gets a FULL CHECKOUT OF THIS REPO at
// `.claude/worktrees/<id>`, so this walk counted every Go test file twice and
// reported 3,016 functions against AI.md's 1,508 — a doubling that reads like a
// wildly stale document and is a scratch checkout the harness has not cleaned up
// yet. A count of the repo may not include a copy of the repo.
function walk(dir, pred, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === '.claude') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, pred, out)
    else if (pred(name, full)) out.push(full)
  }
  return out
}

const goTestFiles = walk(REPO, (n) => n.endsWith('_test.go'))
const goTestFuncs = goTestFiles.reduce(
  (n, f) => n + (readFileSync(f, 'utf8').match(/^func Test[A-Za-z0-9_]+/gm) || []).length, 0)
const feTestFiles = walk(join(REPO, 'web', 'frontend'), (n) => /\.(test|spec)\./.test(n))

// The claim, as one sentence: "N Go test functions and M frontend tests, across
// K test files".
const claim = AI.match(/\*\*([\d,]+) Go test functions and ([\d,]+) frontend tests, across ([\d,]+) test files\*\*/)
const num = (s) => Number(String(s).replace(/,/g, ''))

describe('the counts AI.md opens with', () => {
  it('are still written in the shape this reads', () => {
    expect(claim, 'AI.md no longer states its counts in the sentence this guard reads — reword the guard or the file, but not silently').toBeTruthy()
  })

  it('name the Go test functions this tree actually has', () => {
    expect(num(claim[1]), `AI.md says ${claim[1]} Go test functions; the tree has ${goTestFuncs}`).toBe(goTestFuncs)
  })

  it('and the number of test files, both halves together', () => {
    const total = goTestFiles.length + feTestFiles.length
    expect(num(claim[3]), `AI.md says ${claim[3]} test files; the tree has ${total} ` +
      `(${goTestFiles.length} Go + ${feTestFiles.length} frontend)`).toBe(total)
  })

  it('and the per-half counts in the commands beside them', () => {
    // The comments on those command lines carry their own numbers, and they went
    // stale independently of the sentence above at least once.
    const go = AI.match(/# (\d+) Go files/)
    const fe = AI.match(/# (\d+) frontend/)
    expect(go, 'the Go file count beside its command is gone').toBeTruthy()
    expect(fe, 'the frontend file count beside its command is gone').toBeTruthy()
    expect(Number(go[1]), `the command says ${go[1]} Go files; there are ${goTestFiles.length}`).toBe(goTestFiles.length)
    expect(Number(fe[1]), `the command says ${fe[1]} frontend files; there are ${feTestFiles.length}`).toBe(feTestFiles.length)
  })
})
