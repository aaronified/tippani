// NO SHADOW ON TEXT, AND WHATEVER WEARS ONE, ITS ICON WEARS TOO.
//
// THE OWNER'S, over a screenshot of the active Settings row: "the shadow on the text makes it
// harder to read. and if you must add shadow, that should be the same on the icon as well. same
// principle everywhere."
//
// Nine active-state rules (the nav toggle, the rail, the drawer, the dock, the filter chips, the
// user chip, the select and toggle highlights) each laid a dark blur under their light label. On
// a coloured fill that blur is what made the letters soft, and it was on the TEXT only: the
// glyph beside it, which is an svg drawn in currentColor, never had one, so a row read as a
// crisp icon beside a smudged word. One principle fixes both: the label carries no shadow, so
// the two match.
//
// This is a ban rather than a ratchet because the count is zero and the replacement is nothing.
// If a surface ever genuinely needs a shadow, it must put the SAME one on the glyph
// (`filter: drop-shadow(...)` with the same offsets and colour) and be named in
// ALLOWED below with the reason, so the pairing is a decision somebody wrote down.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const ALLOWED = []

describe('shadows on text', () => {
  it('are not drawn, so a label and its icon read the same', () => {
    const css = readFileSync(join(SRC, 'index.css'), 'utf8')
    const hits = []
    css.split('\n').forEach((line, i) => {
      if (/\btext-shadow\s*:/.test(line) && !ALLOWED.some((a) => line.includes(a))) hits.push(`index.css:${i + 1}  ${line.trim()}`)
    })
    expect(hits, 'text-shadow is back: a label with a shadow beside an icon without one').toEqual([])
  })
})
