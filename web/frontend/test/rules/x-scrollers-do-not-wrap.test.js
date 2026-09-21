// A SIDEWAYS SCROLLER THAT WRAPS IS NOT A SCROLLER.
//
// THE DEFECT, AND IT IS SILENT IN EVERY OTHER TIER. `Scroller axis="x"` promises
// a measured edge fade: `useEdgeScroll` writes `data-scroll-x` only when there is
// something past the edge, so the fade never lies. A flex row that WRAPS can
// never overflow horizontally — it grows downwards instead — so the attribute is
// never written, the fade never appears, the drag gesture does nothing, and the
// row silently becomes three lines tall on a phone. Nothing throws. Nothing in
// jsdom can see it either, which is the point of this file: jsdom loads no
// stylesheet, so a dom test asserting `getComputedStyle(el).flexWrap` reads the
// initial value whatever index.css says. One was written that way in
// `people-records.test.jsx` and passed with the rule flipped to `wrap`.
//
// THE PROVIDER CHIPS ARE WHY IT EXISTS. They were drawn behind `{!mobile && …}`
// — five chips wrapping to three lines at 390px, so the row was "fixed" by
// deleting the content below a breakpoint. The repair is the scroller, and the
// scroller is only a scroller if it does not wrap.
//
// IT IS DERIVED FROM THE SOURCE, not from a list. The classes are read off the
// `<Scroller axis="x" className="…">` call sites, so a new sideways scroller is
// covered by being written, not by somebody remembering to add it here.
//
// MUTATION-VERIFIED: change `.provider-chips` to `flex-wrap: wrap` and this fails
// by name.
//
// AND THE FIRST CUT OF THIS GUARD WAS WRONG IN THE EXPENSIVE DIRECTION. It
// demanded an explicit `flex-wrap: nowrap` and named four rules that are
// perfectly correct — `.meta-rail`, `.board-head-chips`, `.skipped-work-people`
// and `.work-hero-credit-row` — because `flex-wrap`'s own initial value IS
// `nowrap`. A guard that asks for a redundant declaration on four working rules
// would have been satisfied by four pointless edits, and the next reader would
// have learned a rule CSS does not have. What is actually forbidden is DECLARING
// the wrap, so that is what is asserted.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { cssRules } from '../css-rules.js'
import { sourcesUnder } from '../src-files.js'

const SRC = process.env.TIPPANI_SRC
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

// Every class handed to a Scroller whose axis is x. The `axis` may come before or
// after `className` on the tag, and the tag may be `<Scroller` or `<Scroller
// as="span"`, so the match is over the whole opening tag rather than a fixed
// attribute order.
function sidewaysClasses() {
  const out = new Set()
  for (const f of sourcesUnder((n) => n.endsWith('.jsx'), 30)) {
    const text = readFileSync(join(SRC, f), 'utf8')
    for (const m of text.matchAll(/<Scroller\b[^>]*>/g)) {
      const tag = m[0]
      if (!/axis="x"/.test(tag)) continue
      const cls = tag.match(/className="([a-z0-9 -]+)"/)
      if (!cls) continue
      for (const c of cls[1].split(/\s+/).filter(Boolean)) out.add('.' + c)
    }
  }
  return [...out]
}

describe('a sideways Scroller', () => {
  it('there are some, so this test is testing something', () => {
    // The sweep's own failure mode: a regex that stops matching asserts nothing
    // about an empty list and passes for ever.
    expect(sidewaysClasses().length).toBeGreaterThan(5)
  })

  it('never wraps, because a row that wraps can never overflow', () => {
    const rules = cssRules(CSS)
    // `flex-wrap: wrap` DECLARED, not `nowrap` missing — nowrap is the initial
    // value, so silence is already correct. `wrap-reverse` is the same defect
    // spelled differently.
    const wrapping = sidewaysClasses().filter((sel) =>
      rules.some((r) => r.sel === sel && /flex-wrap:\s*wrap(-reverse)?\b/.test(r.body)),
    )
    expect(wrapping, 'these are flex rows inside a sideways scroller and may wrap, so their fade can never appear')
      .toEqual([])
  })
})
