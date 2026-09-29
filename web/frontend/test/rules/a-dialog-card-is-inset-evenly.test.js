// A dialog card's content is inset the same on all four sides.
//
// A SOURCE SCANNER, NOT A TEST, which is why it lives here. The house rule (CLAUDE.md's
// visual guideline: "a card's content is inset the same on all four sides, measured")
// was broken by the same padding in three dialog shells — `'18px 20px 20px'` on
// FormModal, HelpSheet and Settings' PromptFrame — so the restore dialog measured
// 18/20/20/20 at 1280 (#45). A shorthand that names different sides is the whole of
// the defect, and it is visible in the source: this reads every `.hand-card` element's
// inline `padding` and fails when its sides differ.
//
// What it reads: an element whose className names `hand-card`, and a `padding:` given
// as a string within the next three lines of its opening tag (the three shells put it
// one line down). A padding from a stylesheet rule is not its business; `--card-pad`
// already answers for those.
import { describe, expect, it } from 'vitest'

import { readSource, sourcesUnder } from '../src-files.js'

// The four sides a CSS padding shorthand of one to four values names.
function sides(v) {
  const p = v.trim().split(/\s+/)
  const [t, r = t, b = t, l = r] = p
  return [t, r, b, l]
}

function unevenCards() {
  const out = []
  for (const file of sourcesUnder((n) => n.endsWith('.jsx'), 60)) {
    const lines = readSource(file).split('\n')
    lines.forEach((line, i) => {
      if (!/className=\{?["'`][^"'`]*\bhand-card\b/.test(line)) return
      const window = lines.slice(i, i + 4).join('\n')
      const m = /padding:\s*(["'])([^"']+)\1/.exec(window)
      if (!m) return
      const s = sides(m[2])
      if (new Set(s).size > 1) out.push(`${file}:${i + 1} padding '${m[2]}'`)
    })
  }
  return out
}

describe('a dialog card', () => {
  it('names one inset for all four sides', () => {
    expect(unevenCards()).toEqual([])
  })
})
