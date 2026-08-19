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
// ---------------------------------------------------------------------------
// WHERE THE COPY IS NOW, and why this file changed shape.
//
// It used to read src/*.jsx and pull the payload out of a `text="…"` prop, a
// `<InfoDot>` tag or a hoisted `const SOMETHING_INFO = '…'`. The words have moved
// into internal/i18n/en.txt (design §1) and the props now carry keys, so that scan
// finds less every week and would eventually find nothing — and its own header
// says what that failure looks like: "a check that reads a NARROWER thing than the
// rule it enforces reports success about the part nobody was worried about."
//
// So the payload is taken from the FILE, selected by the key's last segment:
// `.info`, `.info.body`, `.hint` and `.blurb` are the four roles a dot's body is
// written under, and nothing else in the file plays them. `.info.title` is the
// dot's heading and is excluded, exactly as the old scan stripped `title="…"`.
//
// THE SOURCE SCAN STAYS, unioned with the file, and that is not belt-and-braces.
// Eight files have not been migrated yet — Account, ImportPage, StagingPage,
// BinPage, MetadataPage, ReverifyReview, CoverPicker, people — and every dot in
// them is still an English literal. Dropping the scan would take 33 payloads out
// of the budget until somebody remembered to put them back. When the last file
// lands the scan finds nothing, the union is the file, and no test needs editing.
//
// THE WIDENING FOUND FIVE DOTS THAT HAD NEVER BEEN MEASURED — four id fields on a
// film and one quiz slider, 279 to 348 characters. They were written as `hint:` and
// `info:` PROPERTIES of a field table, not as the `hint="…"` attribute the old
// regex looked for, so the extraction had never seen them. All five were trimmed
// when this file was rewritten, which is the whole argument for selecting by key
// rather than by the shape somebody happened to write.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUILTINS } from '../locale-file.js'

// TIPPANI_SRC, not cwd — vitest is launched from web/frontend, see layout-width.
const SRC = process.env.TIPPANI_SRC

export const INFODOT_MAX = 240

const FILES = readdirSync(SRC).filter((f) => f.endsWith('.jsx')).sort()

// ---- the file's dots -------------------------------------------------------

// The four roles a dot's BODY is written under. A dot's title is a heading and is
// budgeted by the five-word label rule, not by this one.
const BODY_ROLE = /\.(?:info|info\.body|hint|blurb)$/

// Every language in the box, not the English alone: a translation overflows the
// same popover. Measured over what each file HAS — design §7, no test may fail
// because a language is incomplete.
function fromFile() {
  const out = []
  for (const [code, file] of BUILTINS) {
    for (const [key, text] of Object.entries(file.keys)) {
      if (BODY_ROLE.test(key)) out.push({ file: `${code}.txt`, title: key, text })
    }
  }
  return out
}

// ---- the literals still in the source --------------------------------------

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
//
// Each BRANCH is measured on its own. A dot whose text is a ternary (a book says
// one thing, a film another) is two alternative payloads and the reader only ever
// sees one, so summing them would penalise a dot that is doing the right thing.
function branches(block) {
  const payload = block.replace(/^<InfoDot\b/, '').replace(/\btitle="[^"]*"/g, '')
  const found = []
  for (const m of payload.matchAll(/"([^"]{12,})"/g)) found.push(m[1])
  for (const m of payload.matchAll(/`([^`]{12,})`/g)) found.push(m[1])
  return found
}

const titleOf = (block) => (block.match(/title="([^"]*)"/) || [, '(untitled)'])[1]

const PROP_RE = /(?:text|info|hint|blurb)="([^"]{12,})"/g
// A module constant is only counted when its name says what it is for; a general
// sweep of every long string in the file would drag in prose that is not a dot.
const CONST_RE = /^const\s+([A-Z][A-Z0-9_]*(?:INFO|HELP|BLURB|COPY))\s*=\s*'([^']{12,})'/gm
// And the shape that hid five over-budget dots for three versions: a payload
// written as a PROPERTY of a field table rather than as a JSX attribute.
const FIELD_RE = /^\s*(?:text|info|hint|blurb):\s*'([^']{12,})'/gm

function payloadsIn(src, file) {
  const out = []
  for (const b of infoDotBlocks(src)) {
    for (const text of branches(b)) out.push({ file, title: titleOf(b), text })
  }
  for (const m of src.matchAll(PROP_RE)) out.push({ file, title: '(prop)', text: m[1] })
  for (const m of src.matchAll(CONST_RE)) out.push({ file, title: m[1], text: m[2] })
  for (const m of src.matchAll(FIELD_RE)) out.push({ file, title: '(field table)', text: m[1] })
  return out
}

const IN_SOURCE = FILES.flatMap((f) => payloadsIn(readFileSync(join(SRC, f), 'utf8'), f))
const IN_FILE = fromFile()
const ALL = [...IN_FILE, ...IN_SOURCE]

describe('InfoDot copy stays within its budget', () => {
  it('found the dots at all, so a passing suite is not an empty one', () => {
    // Every guard here is only as good as the extraction, and an extraction that
    // silently matches nothing turns this whole file into a no-op that reports
    // success. The count is deliberately a floor rather than an exact number.
    expect(ALL.length).toBeGreaterThan(28)
    // And the floor is asserted on the FILE's contribution separately, because the
    // source leftovers alone would satisfy the line above while the namespace
    // filter matched nothing at all.
    expect(IN_FILE.length, 'the key filter selected no dots').toBeGreaterThan(28)
  })

  // A COUNT IS A WEAK GUARD FOR THIS, because the miss it is meant to catch was
  // not "found nothing" — it was "found the short ones". Both of the shapes the
  // long copy is actually written in have to be represented, or the widening
  // above can rot back to the tag-only scan and the number will barely move.
  it('reaches the two shapes the long copy is written in', () => {
    // Named by their opening words rather than by a key or a marker, so this
    // asserts the COPY is reached wherever it now lives — the source today, the
    // locale file once Settings and BinPage are migrated. Both were over a
    // thousand and eight hundred characters and invisible to this file until
    // 1.14.1.
    const reaches = (opening) => ALL.some((d) => d.text.startsWith(opening))
    expect(reaches('One dated, encrypted archive'), 'the backup dot is not measured').toBe(true)
    expect(reaches('Everything you delete waits here'), 'the bin dot is not measured').toBe(true)
  })

  it('names the dots by key once they are in the file', () => {
    // The whole point of selecting by namespace: a dot the migration moved is
    // still measured, and the failure message says which key to cut rather than
    // which file to search.
    const keyed = IN_FILE.filter((d) => d.title.startsWith('settings.'))
    expect(keyed.length).toBeGreaterThan(5)
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
    const wordy = ALL.filter((d) => (d.text.match(/[.!?](\s|$)/g) || []).length > 3).map(
      (d) => `${d.file} [${d.title}]`,
    )
    expect(wordy).toEqual([])
  })
})
