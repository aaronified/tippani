// A REGISTER THAT NAMES A COMMIT NAMES ONE THAT EXISTS.
//
// THE RULE IS THE REGISTER'S OWN, in its opening paragraph: "An item leaves only
// by moving to FIXED with the commit that fixed it named, or to NOT A DEFECT
// with the reason." A row citing a commit nobody can reach is a row that has not
// left — and it reads exactly like one that has, which is the failure the whole
// document exists to prevent.
//
// IT HAPPENED TWICE IN ONE SESSION, both times the same way: the row was written
// with the SHA of a commit that was then amended, so the citation named an object
// that is real, reachable by hash, and not an ancestor of anything. `git show`
// finds it; `git log` never will. Both were caught by an independent reader
// rather than by anything in the repo, which is the definition of a gap.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that seven hex
// characters in backticks is how this document cites a commit.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(process.env.TIPPANI_SRC, '..', '..', '..')

// EVERY DOCUMENT THAT CITES A COMMIT, not just the register. The first cut read
// `open-defects.md` alone and passed while four dangling SHAs sat in `AI.md` and
// `docs/PLAN.md` — a guard scoped to the file that happened to fail is a guard
// that only ever catches the failure it was written after.
// AND TWO DIFFERENT QUESTIONS, because the documents make two different claims.
//
// THE REGISTER says "FIXED in X", where X is the commit that fixed a row on THIS
// branch — so X has to be an ancestor of HEAD, or the row is closed by something
// the branch does not contain.
//
// THE OTHER THREE cite the project's history, which is wider than this branch:
// `AI.md` names the commit that added an attribution, `PLAN.md` the release a
// decision shipped in. Those are legitimately on other lines of history, and
// demanding an ancestor of HEAD would fail four true citations. What is NOT
// legitimate is a hash reachable from no ref at all — which is exactly what an
// amended commit leaves behind, and what both real failures were.
const DOCS = [
  ['docs/plans/open-defects.md', 'the defect register', 'ancestor'],
  ['docs/plans/codebase-audit.md', 'the fidelity audit', 'ancestor'],
  ['AI.md', 'the verification document', 'reachable'],
  ['docs/PLAN.md', 'the decision log', 'reachable'],
]

const citations = (file) => [...new Set(
  (readFileSync(join(ROOT, file), 'utf8').match(/`[0-9a-f]{7,40}`/g) || [])
    .map((s) => s.replace(/`/g, ''))
    // A seven-hex word in backticks is nearly always a commit in these files,
    // but they also quote ids and hashes — anything git cannot resolve at all is
    // reported by the check below rather than filtered away silently.
    .filter((s) => /^[0-9a-f]{7,40}$/.test(s)),
)]

const isAncestor = (sha) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// `git branch -a --contains` is empty for a hash no ref can reach — the state an
// amend leaves the old commit in. `git show` still finds it, which is why an
// eye cannot tell the two apart.
const onSomeBranch = (sha) => {
  try {
    return execFileSync('git', ['branch', '-a', '--contains', sha], { cwd: ROOT }).toString().trim() !== ''
  } catch {
    return false
  }
}

describe.each(DOCS)('every commit %s names', (file, what, rule) => {
  const ask = rule === 'ancestor' ? isAncestor : onSomeBranch
  const why = rule === 'ancestor'
    ? `${file} closes rows with these, and they are not ancestors of HEAD — a row closed by a commit this branch does not contain is a row that is not closed`
    : `${file} cites these and no ref can reach them — which is where an amended commit goes, and \`git show\` still finds it, so an eye cannot tell it from a real one`
  it(`can be found from ${what}'s own history`, () => {
    const shas = citations(file)
    expect(shas.length, `${file} cites no commits at all — the citation format changed`)
      .toBeGreaterThan(0)
    const bad = shas.filter((sha) => !ask(sha))
    expect(bad, `${why}:\n  ` + bad.join('\n  ')).toEqual([])
  })
})
