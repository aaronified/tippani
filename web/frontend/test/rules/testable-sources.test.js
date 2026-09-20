// WHICH SUPPLIERS CAN BE TESTED, ASKED OF BOTH SIDES OF THE BOUNDARY.
//
// The list lives twice by design: the server refuses a source it cannot test
// (`testableSources` in metadata_sources.go), and the screen does not draw a
// button a reader could only press to be told no (`TESTABLE` in
// MetadataSources.jsx). Two lists that must agree and nothing asking whether they
// do is the exact shape of the defect this directory exists for — `chapter_no`
// answered 400 on every press for months with a green test on each side of it.
//
// A DISAGREEMENT IS INVISIBLE IN BOTH DIRECTIONS, which is why it needs a scanner
// rather than a case. A slug the screen offers and the server refuses is a button
// that 400s; a slug the server would answer and the screen hides is a feature
// nobody can reach — and neither shows up as a failure anywhere else, because each
// side is right about itself.
//
// IT READS BOTH SOURCES rather than holding a list of its own. A list typed here
// would have been typed by whoever got the other two wrong, and would agree with
// them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SRC } from '../src-files.js'

const read = (...p) => readFileSync(join(SRC, ...p), 'utf8')

// A Go slice literal of bare strings, by the name it is declared under.
function goSlice(src, name) {
  const m = new RegExp(String.raw`var\s+${name}\s*=\s*\[\]string\{([^}]*)\}`).exec(src)
  if (!m) throw new Error(`no Go slice named ${name} — it was renamed, and this scanner is now checking nothing`)
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort()
}

// A JS array literal of bare strings, likewise.
function jsArray(src, name) {
  const m = new RegExp(String.raw`const\s+${name}\s*=\s*\[([^\]]*)\]`).exec(src)
  if (!m) throw new Error(`no JS array named ${name} — it was renamed, and this scanner is now checking nothing`)
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
}

describe('the suppliers a Test can be pressed on', () => {
  it('are the same list on the screen and in the server', () => {
    const go = goSlice(read('..', '..', '..', 'internal', 'httpapi', 'metadata_sources.go'), 'testableSources')
    const js = jsArray(read('MetadataSources.jsx'), 'TESTABLE')
    expect(js, 'the screen offers a Test the server refuses, or hides one it would answer').toEqual(go)
    // AND THE SCANNER IS LOOKING AT SOMETHING. A regex that matched nothing would
    // compare two empty lists and pass for ever.
    expect(go.length, 'the Go list came back empty').toBeGreaterThan(0)
  })

  // EVERY TESTABLE SUPPLIER IS ALSO A ROW, because a Test is an action ON a row.
  // A slug in one list and not the other is a button with nothing to draw it on.
  it('each have a row of their own in the list of suppliers', () => {
    const src = read('..', '..', '..', 'internal', 'httpapi', 'metadata_sources.go')
    const go = goSlice(src, 'testableSources')
    const rows = [...src.matchAll(/\{"([a-z-]+)", \[\]string\{/g)].map((x) => x[1])
    expect(rows.length, 'no supplier rows found, so this case is checking nothing').toBeGreaterThan(0)
    expect(go.filter((slug) => !rows.includes(slug)), 'testable, but not a row').toEqual([])
  })
})
