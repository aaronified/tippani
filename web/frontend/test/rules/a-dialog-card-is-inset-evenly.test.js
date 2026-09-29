// A dialog card's content is inset the same on all four sides.
//
// A SOURCE SCANNER, NOT A TEST, which is why it lives here. The house rule (CLAUDE.md's
// visual guideline: "a card's content is inset the same on all four sides, measured")
// was broken by the same padding in three dialog shells — `'18px 20px 20px'` on
// FormModal, HelpSheet and Settings' PromptFrame — so the restore dialog measured
// 18/20/20/20 at 1280 (#45). A shorthand that names different sides is the whole of
// the defect, and it is visible in the source: this reads every `.hand-card` element's
// inline `padding` and fails when its sides differ.
//
// What it reads: an element whose className names `hand-card`, and the padding given
// within the next six lines of its opening tag (the three shells put it one to three
// lines down): a `padding:` string or number, a side of its own (`paddingTop` and the
// rest), and the Tailwind padding classes beside `hand-card` in the className, resolved
// to four sides the way Tailwind layers them (`p-`, then `px-`/`py-`, then one side).
// An inline side named on its own is flagged whatever its value, since it is how an
// even shorthand becomes an uneven card. A padding from a stylesheet rule is not its
// business; `--card-pad` already answers for those.
import { describe, expect, it } from 'vitest'

import { readSource, sourcesUnder } from '../src-files.js'

// The four sides a CSS padding shorthand of one to four values names.
function sides(v) {
  const p = v.trim().split(/\s+/)
  const [t, r = t, b = t, l = r] = p
  return [t, r, b, l]
}

// Tailwind's padding classes in a className, as four sides, or null when there are none.
// Later layers win: `p-` sets all four, `px-`/`py-` a pair, `pt-` and the rest one side.
const TW_LAYER = { p: 0, x: 1, y: 1, t: 2, r: 2, b: 2, l: 2 }
const TW_SIDES = { p: [0, 1, 2, 3], x: [1, 3], y: [0, 2], t: [0], r: [1], b: [2], l: [3] }
function tailwindSides(className) {
  const found = [...className.matchAll(/(?:^|\s)p([xytrbl]?)-(\[[^\]]+\]|[\d.]+|px)(?=\s|$)/g)]
  if (!found.length) return null
  const out = ['0', '0', '0', '0']
  const byLayer = found.map((m) => ({ key: m[1] || 'p', v: m[2] }))
    .sort((a, b) => TW_LAYER[a.key] - TW_LAYER[b.key])
  for (const { key, v } of byLayer) for (const at of TW_SIDES[key]) out[at] = v
  return { sides: out, names: found.map((m) => m[0].trim()).join(' ') }
}

function unevenCards() {
  const out = []
  for (const file of sourcesUnder((n) => n.endsWith('.jsx'), 60)) {
    const lines = readSource(file).split('\n')
    lines.forEach((line, i) => {
      const cls = /className=\{?["'`]([^"'`]*\bhand-card\b[^"'`]*)/.exec(line)
      if (!cls) return
      const tw = tailwindSides(cls[1])
      if (tw && new Set(tw.sides).size > 1) out.push(`${file}:${i + 1} class '${tw.names}'`)
      const window = lines.slice(i, i + 7).join('\n')
      const own = /\bpadding(?:Top|Right|Bottom|Left|Block|Inline)\w*\s*:/.exec(window)
      if (own) out.push(`${file}:${i + 1} ${own[0].replace(/\s*:$/, '')}`)
      const m = /\bpadding:\s*(?:(["'])([^"']+)\1|(\d+))/.exec(window)
      if (!m || m[3]) return
      const s = sides(m[2])
      if (new Set(s).size > 1) out.push(`${file}:${i + 1} padding '${m[2]}'`)
    })
  }
  return out
}

describe('a dialog card', () => {
  it('names one inset for all four sides', () => {
    expect(unevenCards()).toEqual([])
  })
})
