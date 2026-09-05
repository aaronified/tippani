// A CHIP'S CHOSEN-NESS IS A STATE, AND A CLASS IS NOT ONE.
//
// WHAT THIS GUARDS. `filterChipClass(active)` returns `tp-filter-chip tactile
// active` — which is what the stylesheet paints, and nothing else. A chip drawn
// from it alone tells a screen reader "annotated, button" whether it is the
// chosen scope or not, and tells an automated check nothing at all: `make
// controls` reported the Library's and the Catalogue's "annotated" chip as a
// control that does nothing and does not say so, on a library where every work is
// annotated — the list it filters to was the list already on screen, and no
// attribute moved to say the press had landed.
//
// Both symptoms are one omission, and the app already had the answer twice:
// `ChipSwitches` and `FilterChip` in ui.jsx both carry `aria-pressed`, and
// FilterChip's own comment is that a second answer to a question the app has
// already asked "drifts from the first the day either is touched". Five chips in
// two list screens had been hand-rolled past both.
//
// SCRAPED FROM SOURCE, and deliberately: a rendering test would need each screen
// mounted with the right filters present, and the rule is about every call site
// including the ones nobody has mounted. What is asserted is the RULE — a chip
// whose class carries a state carries the state in ARIA too — not any screen.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const files = readdirSync(SRC).filter((f) => f.endsWith('.jsx') || f.endsWith('.js'))

// Every `<button …>` whose className calls filterChipClass, as source text.
//
// WALKED, NOT MATCHED WITH `[^>]*`, and the first cut of this file was matched
// that way — which quietly missed every chip whose tag holds an arrow function,
// because `=>` contains the `>` the pattern stopped at. Four of the seven chips
// this rule exists for were invisible to it, and it passed. A scan that can fail
// to see the thing it checks is worse than no scan: it reports green over the
// defect and nobody looks again.
const openingTag = (src, at) => {
  let depth = 0
  for (let i = at; i < src.length; i++) {
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return src.slice(at, i + 1)
  }
  return ''
}
const chips = []
for (const f of files) {
  const src = readFileSync(join(SRC, f), 'utf8')
  for (const m of src.matchAll(/<button\b/g)) {
    const tag = openingTag(src, m.index)
    if (!tag.includes('filterChipClass')) continue
    chips.push({ file: f, tag, line: src.slice(0, m.index).split('\n').length })
  }
}

describe('a filter chip', () => {
  it('is drawn somewhere at all, so this file cannot pass by finding nothing', () => {
    // The guard on the guard. A regex that stops matching — a prop reordered, the
    // helper renamed — would turn every case below green while the rule went
    // unchecked, which is the failure mode a source scan has and a render does not.
    expect(chips.length, 'no filter chips found — the scan has gone stale').toBeGreaterThan(4)
  })

  it('says whether it is the chosen one, and not only in a class name', () => {
    const mute = chips.filter((c) => !/aria-pressed|aria-checked|role="radio"/.test(c.tag))
    expect(
      mute.map((c) => `${c.file}:${c.line}`),
      'these chips paint a chosen state that nothing but a stylesheet can read',
    ).toEqual([])
  })

  it('and the state it announces is the same one it paints', () => {
    // A chip that hardcodes `aria-pressed={true}`, or reads a different value than
    // the one it colours, is worse than a silent one: it is confidently wrong.
    for (const c of chips) {
      const painted = c.tag.match(/filterChipClass\(([^)]*)\)/)?.[1]?.trim()
      const said = c.tag.match(/aria-(?:pressed|checked)=\{([^}]*)\}/)?.[1]?.trim()
      if (!painted || !said) continue
      const bare = (x) => x.replace(/^!!/, '').trim()
      expect(bare(said), `${c.file}:${c.line} paints ${painted} and announces ${said}`).toBe(bare(painted))
    }
  })
})
