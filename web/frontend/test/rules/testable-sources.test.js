// EVERY SUPPLIER ON THE LIST CAN BE TESTED, ASKED OF THE SERVER'S TWO LISTS.
//
// The screen draws a Test on every supplier row, and the server refuses a source
// it cannot test by name (`testableSources` in metadata_sources.go). So the
// server's list has to be every row (`sourceAreas`): a row the server would refuse
// is a button that answers 400 on every press, and a slug it tests that has no row
// is a Test with nothing to draw it on. Neither shows up as a failure anywhere
// else, because each list is right about itself.
//
// IT USED TO COMPARE THE SERVER'S LIST WITH ONE IN THE SCREEN, when only the four
// keyed suppliers could be tested (`TESTABLE` in MetadataSources.jsx). The owner
// asked why the rest could not be ("why can i not test all the metadata
// sources?"), every row became testable, and the screen's copy of the list went:
// the screen now disables a Test only for a row whose state says it cannot be
// asked.
//
// IT READS THE SOURCE rather than holding a list of its own. A list typed here
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

describe('the suppliers a Test can be pressed on', () => {
  it('are every supplier row, no more and no fewer', () => {
    const src = read('..', '..', '..', 'internal', 'httpapi', 'metadata_sources.go')
    const go = goSlice(src, 'testableSources')
    const rows = [...src.matchAll(/\{"([a-z-]+)", \[\]string\{/g)].map((x) => x[1]).sort()
    // AND THE SCANNER IS LOOKING AT SOMETHING. A regex that matched nothing would
    // compare two empty lists and pass for ever.
    expect(rows.length, 'no supplier rows found, so this case is checking nothing').toBeGreaterThan(0)
    expect(go, 'a row the server refuses to test, or a test with no row').toEqual(rows)
  })
})
