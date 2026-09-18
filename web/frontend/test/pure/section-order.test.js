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

import { SECTIONS, sectionOrder, visibleTabs } from '../../src/routes.js'

const DECLARED = SECTIONS.map((s) => s.tab)

describe('a stored order that does not know every section', () => {
  // THE CASE THE MUTATION SURVIVED. A stored order naming three of four.
  it('appends the section it has never heard of rather than dropping it', () => {
    const stored = DECLARED.slice(0, -1).join(',')
    const got = sectionOrder({ sectionOrder: stored })
    expect(got).toHaveLength(DECLARED.length)
    expect(got).toContain(DECLARED[DECLARED.length - 1])
  })

  it('keeps the order it was given for the ones it does name', () => {
    const [a, b] = DECLARED
    const got = sectionOrder({ sectionOrder: `${b},${a}` })
    expect(got.slice(0, 2)).toEqual([b, a])
  })

  // The opposite direction: a key from a build one release AHEAD. It is dropped
  // rather than passed through, because a tab this build cannot draw would be a
  // position in the list with nothing in it.
  it('ignores a key this build does not have', () => {
    const got = sectionOrder({ sectionOrder: `dreamscapes,${DECLARED[0]}` })
    expect(got).not.toContain('dreamscapes')
    expect(got).toHaveLength(DECLARED.length)
  })

  it('reads nothing, nonsense and whitespace as the declared order', () => {
    for (const raw of [undefined, '', '   ', ',,,']) {
      expect(sectionOrder({ sectionOrder: raw })).toEqual(DECLARED)
    }
  })

  it('never invents, duplicates or loses a section, whatever it is handed', () => {
    for (const raw of ['', DECLARED[0], `${DECLARED[1]},nonsense`, DECLARED.join(','), 'a,b,c']) {
      const got = sectionOrder({ sectionOrder: raw })
      expect(new Set(got).size, raw).toBe(DECLARED.length)
      expect([...got].sort(), raw).toEqual([...DECLARED].sort())
    }
  })
})

describe('what the nav lists do with it', () => {
  // THE CONSEQUENCE, asserted where a reader would feel it: the rows that reach a
  // nav list are all of them, in the stored order, with the unnamed one still
  // present at the end.
  const rows = DECLARED.map((tab) => [tab, `${tab}.label`])
  const on = Object.fromEntries(DECLARED.map((t) => [t, true]))

  it('orders the rows it is given and keeps every one', () => {
    const [a, b] = DECLARED
    const got = visibleTabs(rows, on, sectionOrder({ sectionOrder: `${b},${a}` }))
    expect(got.map((r) => r[0])).toHaveLength(DECLARED.length)
    expect(got[0][0]).toBe(b)
  })

  it('still carries the section a partial order never named', () => {
    const stored = DECLARED.slice(0, -1).join(',')
    const got = visibleTabs(rows, on, sectionOrder({ sectionOrder: stored }))
    expect(got.map((r) => r[0])).toContain(DECLARED[DECLARED.length - 1])
  })

  // A row the order says nothing about — Home, Search, the utility tabs — passes
  // through untouched, which is what stops Settings being reorderable to the top
  // of the rail.
  it('leaves a row that is not a content section exactly where it was', () => {
    const mixed = [['home', 'home.label'], ...rows, ['settings', 'settings.label']]
    const got = visibleTabs(mixed, { ...on, home: true, settings: true }, sectionOrder({}))
    expect(got[0][0]).toBe('home')
    expect(got[got.length - 1][0]).toBe('settings')
  })
})
