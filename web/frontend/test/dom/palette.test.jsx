// The four highlight colours exist twice, and the two copies must agree.
//
// index.css holds --hl-1..4 because most of the palette is drawn by CSS: the
// colour dots, the tag chips, the left bar on a card. ui.jsx holds
// ANNOTATION_HEX because two consumers genuinely cannot read a custom property
// — quoteImage.js paints the share card on a canvas, and ctx.fillStyle cannot
// parse var() or color-mix(); and an inline borderLeft needs a real value.
//
// So the duplication is forced, and the only question is whether anything
// notices when the two drift. Until 1.6.0 nothing did, and there were FOUR
// copies rather than two: ui.jsx, StagingPage's COLOR_HEX, StatsPage's HL, and
// the CSS. Three of those are gone; this pins what is left.
//
// The failure mode is worth stating because it is not a crash. Change --hl-2 and
// forget ANNOTATION_HEX, and every blue quote on screen is the new blue while
// every blue quote you SHARE is the old one — the image is the artefact that
// leaves the app, so the wrong copy is the one other people see. It is also the
// only one nobody looks at twice.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ANNOTATION_COLORS, ANNOTATION_HEX } from '../../src/ui.jsx'
import { CATEGORY_SLOTS } from '../../src/theme.js'

// TIPPANI_SRC is set by vitest.config.js, which is the only place that knows the
// answer for certain: under jsdom `import.meta.url` is an http URL, and
// process.cwd() differs between `npm test` (web/frontend) and
// `npx vitest --root web/frontend` (the repo root). Both are real invocations.
const SRC = process.env.TIPPANI_SRC

const css = readFileSync(join(SRC, 'index.css'), 'utf8')
// Counting occurrences means counting DECLARATIONS. A comment is allowed to say
// "#FFF9EC appeared verbatim in eleven places" — that sentence is the reason the
// token exists, and a test that forbade it would forbid explaining itself.
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '')

// The slot order is a contract in its own right, and an APPEND-ONLY one: slot N
// is --hl-N, so reordering would silently recolour every quote in the library,
// and slot 1 is the token an import writes when a source gave no colour at all.
//
// Derived from theme.js rather than restated, because this list was written out
// here when there were four and had to be found and edited when there were six —
// which is the drift this whole file exists to catch, reproduced inside it.
const SLOTS = CATEGORY_SLOTS
// The first four, pinned by value. Everything after them may be appended; these
// four may not move, because they predate the ability to add any.
const ORIGINAL_FOUR = ['yellow', 'blue', 'pink', 'orange']

const tokenHex = (n) => {
  const m = rules.match(new RegExp(`--hl-${n}:\\s*(#[0-9A-Fa-f]{3,8})\\s*;`))
  return m && m[1].toUpperCase()
}

describe('--hl-1..4 and ANNOTATION_HEX', () => {
  it.each(SLOTS.map((c, i) => [i + 1, c]))('slot %i is %s in both', (slot, colour) => {
    expect(tokenHex(slot)).toBe(ANNOTATION_HEX[colour].toUpperCase())
  })

  it('the slot order has not moved', () => {
    // ANNOTATION_COLORS drives the swatch row, the filter dots and the Stats
    // breakdown. Slot 1 must stay yellow: it is what an import writes when the
    // source named no colour, so a reorder recolours history.
    expect(ANNOTATION_COLORS).toEqual(SLOTS)
    expect(SLOTS.slice(0, 4)).toEqual(ORIGINAL_FOUR)
  })

  it('only ever grows at the end', () => {
    // Adding a colour is a MIGRATION, not a code change — each value is gated by
    // a CHECK on four tables that SQLite cannot alter. Whatever is appended, the
    // original four keep their slots.
    expect(SLOTS.length).toBeGreaterThanOrEqual(ORIGINAL_FOUR.length)
    expect(new Set(SLOTS).size).toBe(SLOTS.length)
  })

  it('every slot is defined on both sides', () => {
    for (let n = 1; n <= SLOTS.length; n++) expect(tokenHex(n), `--hl-${n} is missing`).toBeTruthy()
    expect(Object.keys(ANNOTATION_HEX).sort()).toEqual([...SLOTS].sort())
  })
})

describe('no stray copies of the palette', () => {
  // The hexes must appear in index.css exactly once each — in the token
  // definition. Anywhere else is a fifth copy waiting to disagree.
  it.each(SLOTS.map((c, i) => [c, i + 1]))('%s is written once in the stylesheet', (colour, slot) => {
    const hex = ANNOTATION_HEX[colour]
    const uses = rules.split(new RegExp(hex, 'i')).length - 1
    expect(uses, `${hex} appears ${uses}× in index.css`).toBe(1)
    expect(css).toContain(`--hl-${slot}: ${hex}`)
  })
})

describe('--on-accent', () => {
  // The same pair of inks used to be restated at every accent-filled control:
  // eleven copies of one cream and four of one near-black, all agreeing by
  // coincidence rather than by construction.
  it('is a token, and the raw values are gone from the rules', () => {
    for (const [name, hex] of [['--on-accent', '#FFF9EC'], ['--on-accent-dark', '#15100C']]) {
      expect(css).toContain(`${name}: ${hex}`)
      const uses = rules.split(new RegExp(hex, 'i')).length - 1
      expect(uses, `${hex} appears ${uses}× in index.css`).toBe(1)
    }
  })

  it('is actually used', () => {
    expect(css).toMatch(/color:\s*var\(--on-accent\)/)
  })
})
