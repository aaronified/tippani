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
const REGISTER = join(ROOT, 'docs', 'plans', 'open-defects.md')

const shas = [...new Set(
  (readFileSync(REGISTER, 'utf8').match(/`[0-9a-f]{7,40}`/g) || [])
    .map((s) => s.replace(/`/g, ''))
    // A seven-hex word in backticks is nearly always a commit here, but the file
    // also quotes ids and keys — anything git cannot resolve AT ALL is left to
    // the ancestor check below to report rather than filtered away silently.
    .filter((s) => /^[0-9a-f]{7,40}$/.test(s)),
)]

describe('every commit the defect register names', () => {
  it('is reachable from the branch it claims to be on', () => {
    expect(shas.length, 'the register cites no commits at all — the citation format changed')
      .toBeGreaterThan(5)
    const unreachable = shas.filter((sha) => {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: ROOT, stdio: 'ignore' })
        return false
      } catch {
        return true
      }
    })
    expect(unreachable,
      'these are cited as the commit that fixed a row and are not ancestors of HEAD — an amended SHA looks exactly like a real one:\n  ' +
      unreachable.join('\n  ')).toEqual([])
  })
})
