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

// THE EXTRACTION ABOVE MISSED MOST OF THE COPY, and the miss was total: when
// this rule was widened the four longest payloads in the app were 1113, 930, 783
// and 614 characters, and none of them had ever been measured. All four passed a
// suite whose entire purpose is to cap them at 240.
//
// They were missed because `<InfoDot text="..." />` is not how the long ones are
// written. A dot with a paragraph in it gets hoisted to a module constant
// (`const BIN_INFO = '...'`), or it is handed to a wrapper as `info=` / `hint=` /
// `blurb=` and that wrapper renders the InfoDot — so the tag this scanned for
// carried no literal at all.
//
// The lesson is the one the FTS sweep taught: a check that reads a NARROWER thing
// than the rule it enforces reports success about the part nobody was worried
// about. So the payload is now taken from wherever it is written.
const PROP_RE = /(?:text|info|hint|blurb)="([^"]{12,})"/g
// A module constant is only counted when its name says what it is for; a general
// sweep of every long string in the file would drag in prose that is not a dot.
const CONST_RE = /^const\s+([A-Z][A-Z0-9_]*(?:INFO|HELP|BLURB|COPY))\s*=\s*'([^']{12,})'/gm

function payloadsIn(src, file) {
  const out = []
  for (const b of infoDotBlocks(src)) {
    for (const text of branches(b)) out.push({ file, title: titleOf(b), text })
  }
  for (const m of src.matchAll(PROP_RE)) {
    out.push({ file, title: '(prop)', text: m[1] })
  }
  for (const m of src.matchAll(CONST_RE)) {
    out.push({ file, title: m[1], text: m[2] })
  }
  return out
}

const ALL = FILES.flatMap((f) => payloadsIn(readFileSync(join(SRC, f), 'utf8'), f))

describe('InfoDot copy stays within its budget', () => {
  it('found the dots at all, so a passing suite is not an empty one', () => {
    // Every guard here is only as good as the extraction, and an extraction that
    // silently matches nothing turns this whole file into a no-op that reports
    // success. The count is deliberately a floor rather than an exact number.
    expect(ALL.length).toBeGreaterThan(28)
  })

  // A COUNT IS A WEAK GUARD FOR THIS, because the miss it is meant to catch was
  // not "found nothing" — it was "found the short ones". Both of the shapes the
  // long copy is actually written in have to be represented, or the widening
  // above can rot back to the tag-only scan and the number will barely move.
  it('reaches the two shapes the long copy is written in', () => {
    // Named by their opening words rather than by a marker the extractor sets,
    // so this asserts the COPY is reached rather than that the code took a
    // particular branch. Both were over a thousand and eight hundred characters
    // and invisible to this file until 1.14.1.
    const reaches = (opening) => ALL.some((d) => d.text.startsWith(opening))
    expect(reaches('One dated, encrypted archive'), 'the backup dot (an info= prop) is not measured').toBe(true)
    expect(reaches('Everything you delete waits here'), 'the bin dot (a hoisted const) is not measured').toBe(true)
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
