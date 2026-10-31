// Two layout faults the new source screens showed on a phone, pinned at the stylesheet because
// jsdom has no layout and nothing else here can see them.
//
// A link is a <button>, and a button centres its text. Metadata > Source files draws a work's
// title as one, so a long title ("A Narrative of the Life and Uncommonly Long Voyages...") sat
// centred while "Gitanjali" beside it sat left. And Checks' section head let the heading and its
// count fill the line, so the info dot after them wrapped alone onto a line of its own.
//
// And an anthology or board tile's name ran under its menu button. The measurement is scripts/screenshots (a phone-width capture); this file keeps the two rules
// from being deleted.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const css = readFileSync(join(SRC, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// The rule whose selector list is exactly this one: `.tp-link` is also the tail of
// `.ann-table .col-actions .tp-link`, whose body is a margin.
function body(selector) {
  const found = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(',').some((s) => s.trim() === selector))
  expect(found.length, `${selector} is in the stylesheet`).toBeGreaterThan(0)
  return found.map((m) => m[2]).join(' ')
}

describe('a link that wraps and a section head that wraps', () => {
  it('a verb button may be narrower than its own words, so it stays inside its card', () => {
    const d = body('.section-index-verbs > .tp-btn')
    expect(d).toMatch(/min-width:\s*0/)
    expect(d).toMatch(/white-space:\s*normal/)
  })

  it('a link that runs onto a second line starts that line at the left', () => {
    expect(body('.tp-link')).toMatch(/text-align:\s*left/)
  })

  it('a tile’s name keeps out from under the menu button over its corner', () => {
    expect(body('.board-tile-tools')).toMatch(/position:\s*absolute/)
    expect(body('.board-tile-name')).toMatch(/padding-right:\s*3[6-9]px|padding-right:\s*[4-9]\dpx/)
  })

  it('a board grid widens its tiles when the type is turned up, so a name is not broken mid-word', () => {
    expect(body('.board-grid')).toMatch(/minmax\(max\(150px,\s*9rem\)/)
  })

  it('a section head lets its heading and count shrink so the control beside them stays on the line', () => {
    const d = body('.section-header > .ph-left')
    expect(d).toMatch(/flex:\s*1 1 14rem/)
    expect(d).toMatch(/min-width:\s*0/)
  })
})
