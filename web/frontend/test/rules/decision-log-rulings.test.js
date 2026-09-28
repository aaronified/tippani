// WHAT THE DECISION LOG SAYS ABOUT A §18 ROW'S RULING AGREES WITH THE ROW.
//
// §18 of docs/wiki/Design-decisions.md keeps a table, "Decisions awaiting my
// ruling", of calls made while 3.1.0 was built and put to the owner afterwards.
// A row is ruled when its decision opens "**Ruled," — by the owner, or, where the
// owner left the call to the session ("F2–F6 and F8–F14: decide yourself", 28
// September), by the session, and then its reason cell says "I left this one to
// the session".
//
// THE PAGE SAYS WHAT A RULING IS IN TWO MORE PLACES THAN THE ROWS: its opening,
// which names the table as the one exception to "approved by me" and says how
// long a row's decision waits, and the table's own first line. When the
// delegated rows were ruled, the table's line learned about the session and the
// opening did not, so the page's second paragraph said a row waits until it
// records the owner's ruling while eleven rows said the session had ruled them.
// And an entry in §1 said its reading "waits for my ruling (F13, in §18)" until
// the same commit caught it. Each read as true to somebody who read only it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the table's heading, that a row's first cell
// is F<n>, that a ruled row's decision opens "**Ruled,", that a row the session
// ruled says "I left this one to the session", and that an entry cites a row as
// "(F<n>". All four are the page's own conventions, written in its text.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(process.env.TIPPANI_SRC, '..', '..', '..')
const LOG = readFileSync(join(ROOT, 'docs/wiki/Design-decisions.md'), 'utf8')
const lines = LOG.split('\n')

const heading = lines.indexOf('### Decisions awaiting my ruling')
const end = lines.findIndex((l, i) => i > heading && /^#{2,3} /.test(l))
const section = heading < 0 ? [] : lines.slice(heading + 1, end < 0 ? undefined : end)
const tableLine = (l) => /^\|\s*F\d+\s*\|/.test(l)

// A cell holding a pipe would shift every cell after it, so a row that does not
// split into exactly three cells is reported, never read.
const rows = section.filter(tableLine).map((l) => {
  const cells = l.split('|').slice(1, -1).map((c) => c.trim())
  return { line: l, id: cells[0], decision: cells[1] ?? '', why: cells[2] ?? '', cells: cells.length }
})
const ruled = new Set(rows.filter((r) => r.decision.startsWith('**Ruled,')).map((r) => r.id))
const bySession = rows.filter((r) => r.why.includes('I left this one to the session'))

// Paragraphs as the reader meets them: the page's opening is hard-wrapped, its
// entries are not, so a phrase is looked for with its line breaks folded away.
const paragraphs = (text) => text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim())
const firstEntry = lines.findIndex((l) => l.startsWith('## '))
const opening = paragraphs(lines.slice(0, firstEntry).join('\n'))
  .find((p) => p.includes('*Decisions awaiting my ruling*'))
const tableOpening = section.find((l) => l.trim() !== '')

describe('the decision log on §18’s rulings', () => {
  it('has the table, in the shape this reads', () => {
    expect(heading, 'the heading "### Decisions awaiting my ruling" is gone').toBeGreaterThan(-1)
    expect(rows.length, 'the table under it has no F<n> rows').toBeGreaterThan(0)
    for (const r of rows) expect(r.cells, `a row that does not split into three cells: ${r.line}`).toBe(3)
    expect(opening, 'the page’s opening no longer names the table').toBeTruthy()
    expect(tableOpening, 'the table has no opening line').toBeTruthy()
  })

  it('names the session wherever it says what a ruling is, once the session has ruled a row', () => {
    for (const r of bySession) expect(ruled.has(r.id), `${r.id} says the session had the call but does not open "**Ruled,"`).toBe(true)
    if (bySession.length === 0) return
    const which = bySession.map((r) => r.id).join(', ')
    expect(opening, `the page’s opening says only the owner’s ruling ends a row’s wait, and the session ruled ${which}`)
      .toMatch(/\bthe session\b/)
    expect(tableOpening, `the table’s own line says only the owner rules a row, and the session ruled ${which}`)
      .toMatch(/\bthe session\b/)
  })

  it('says of no ruled row, anywhere else on the page, that it still waits', () => {
    const rest = lines.map((l, i) => (i > heading && i < end && tableLine(l) ? '' : l)).join('\n')
    const stale = []
    for (const p of paragraphs(rest)) {
      for (const m of p.matchAll(/\b(?:waits?|waiting|awaits?|awaiting)\b[^.|]*?\bmy ruling\b[^.|]*?\((F\d+)\b/gi)) {
        if (ruled.has(m[1])) stale.push(`${m[1]}: …${m[0]}…`)
      }
    }
    expect(stale, 'an entry says a row waits for the owner’s ruling after the row was ruled').toEqual([])
  })
})
