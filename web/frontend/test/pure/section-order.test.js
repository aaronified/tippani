// THE ORDER THE SECTIONS COME IN, and the one rule nothing was testing.
//
// WHY THIS FILE EXISTS. A rater mutated `sectionOrder` to
// `return named.length ? named : declared` — dropping the append-the-unknown half
// of it — and the whole pure and dom suite passed, 313 files and 3,738 tests. The
// journey tier cannot reach it either: the Sections card always writes a COMPLETE
// order, so the only way to produce a partial one is to have stored it before a
// section existed, which is a state no test was constructing.
//
// WHAT THE MUTATION WOULD HAVE COST. A reader who reordered their sections in one
// release, and then upgraded to a release that added a fifth, would find that
// fifth section missing from the rail, the drawer, the dock and the ＋ menu — with
// nothing on screen saying why, and no way to get it back except reordering again.
//
// AND IT IS THE REASON THE SERVER DOES NOT VALIDATE THIS FIELD.
// `auth_handlers.go` declines to check the stored order against the tabs it knows,
// on the stated grounds that the client keeps what it recognises and appends the
// rest. That comment is only true while this function is.
import { describe, expect, it } from 'vitest'

import { SECTIONS, sectionOrder } from '../../src/routes.js'

const DECLARED = SECTIONS.map((s) => s.tab)

describe('a stored order that does not know every section', () => {
  // THE CASE THE MUTATION SURVIVED. A stored order naming three of four.
  it('appends the section it has never heard of rather than dropping it', () => {
    const stored = DECLARED.slice(0, -1).join(',')
    const got = sectionOrder({ sectionOrder: stored })
    expect(got).toHaveLength(DECLARED.length)
    expect(got).toContain(DECLARED[DECLARED.length - 1])
  })
})
