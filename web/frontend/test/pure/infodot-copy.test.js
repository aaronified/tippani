// The InfoDot copy budget.
//
// The five-word rule keeps every tooltip and toast short, and it works: of 162
// literal tooltip labels only five exceed it, each by one word. But the rule has a
// consequence nobody bounded — longer copy was told to go and live in an InfoDot,
// and nothing ever constrained an InfoDot. They grew to 400, 700, nearly a
// thousand characters, and what filled them was consistently RATIONALE rather than
// instruction: why the default is what it is, what was rejected, what a decision
// costs. One dot spent 680 characters on a switch whose behaviour takes 90.
//
// That reasoning is worth keeping and already has a home — docs/PLAN.md exists to
// hold exactly it, at whatever length it needs. A popover attached to a control is
// not that place: it is read once, standing up, while the reader is trying to
// decide whether to press the thing.
//
// SO THE BUDGET IS: what the control does, plus at most one consequence you would
// regret not knowing. INFODOT_MAX is a proxy for that — a mechanical rule the way
// the icon-geometry check is, because "is this line necessary" is a judgement that
// quietly stops being made once nothing checks it.
//
// Each BRANCH is measured on its own. A dot whose text is a ternary (a book says
// one thing, a film another) is two alternative payloads and the reader only ever
// sees one, so summing them would penalise a dot that is doing the right thing.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// TIPPANI_SRC, not cwd — vitest is launched from web/frontend, see layout-width.
const SRC = process.env.TIPPANI_SRC

export const INFODOT_MAX = 240

const FILES = readdirSync(SRC).filter((f) => f.endsWith('.jsx')).sort()

// Walk to the `/>` that closes the tag, tracking brace depth so a payload
// containing JSX or a ternary does not end the scan early.
function infoDotBlocks(src) {
  const out = []
  const re = /<InfoDot\b/g
  let m
  while ((m = re.exec(src)) !== null) {
    let i = re.lastIndex
    let depth = 0
    while (i < src.length) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0 && src[i - 1] === '/') break
      i++
    }
    out.push(src.slice(m.index, i + 1))
  }
  return out
}

// Every double-quoted string and every template literal in the payload, which is
// one branch each. Deliberately crude: the payloads are hand-written literals, and
// a parser here would be more machinery than the rule is worth.
function branches(block) {
  const payload = block.replace(/^<InfoDot\b/, '').replace(/\btitle="[^"]*"/g, '')
  const found = []
  for (const m of payload.matchAll(/"([^"]{12,})"/g)) found.push(m[1])
  for (const m of payload.matchAll(/`([^`]{12,})`/g)) found.push(m[1])
  return found
}

const titleOf = (block) => (block.match(/title="([^"]*)"/) || [, '(untitled)'])[1]

const ALL = FILES.flatMap((f) =>
  infoDotBlocks(readFileSync(join(SRC, f), 'utf8')).flatMap((b) =>
    branches(b).map((text) => ({ file: f, title: titleOf(b), text })),
  ),
)

describe('InfoDot copy stays within its budget', () => {
  it('found the dots at all, so a passing suite is not an empty one', () => {
    // Every guard here is only as good as the extraction, and an extraction that
    // silently matches nothing turns this whole file into a no-op that reports
    // success. The count is deliberately a floor rather than an exact number.
    expect(ALL.length).toBeGreaterThan(25)
  })

  it(`keeps every branch under ${INFODOT_MAX} characters`, () => {
    const over = ALL.filter((d) => d.text.length > INFODOT_MAX)
      .sort((a, b) => b.text.length - a.text.length)
      .map((d) => `${d.file} [${d.title}] ${d.text.length} chars`)
    // Named rather than counted, so the failure says which dot and by how much —
    // the fix is always "cut a clause", and knowing which one saves a hunt.
    expect(over, 'trim these to what the control does plus one consequence').toEqual([])
  })

  it('does not lecture: at most three sentences a branch', () => {
    // The cap alone can be met by one enormous sentence, which is not the point.
    // Three allows what-it-does, the consequence, and a short instruction.
    const wordy = ALL.filter((d) => (d.text.match(/[.!?](\s|$)/g) || []).length > 3)
      .map((d) => `${d.file} [${d.title}]`)
    expect(wordy).toEqual([])
  })
})
