// AN EDGE FADE MEANS IT SCROLLS — SO IT MAY NOT BE PAINTED BY THE RULE ITSELF.
//
// THE REPO'S STANDING RULE: "An edge fade means it scrolls; a button at the fade
// opens the full set. Use `Scroller` or `useEdgeScroll` — never bare `overflow`,
// which gives no signal and no mouse gesture. **The fade is measured**, so a row
// that fits wears none."
//
// THE DEFECT THIS PINS, found in the recall panel's own stylesheet before it
// shipped. A `mask-image: linear-gradient(...)` typed straight into a scroller's
// rule fades whether or not there is anything past the edge. On a three-answer
// history that is a fade over rows that do not exist — a promise of more, made by
// a gradient nothing measured — which is the exact lie `useEdgeScroll` writes
// `data-scroll-x` / `data-scroll-v` to avoid. Nothing throws. It looks right on a
// long list, which is the list an author fills in while building it, and wrong on
// the short one a reader meets.
//
// AND WHY A STYLESHEET SWEEP. jsdom lays nothing out, so no rendered test can
// tell a fade that was measured from one that was typed — `scrollHeight` and
// `clientHeight` are both 0 there and the attribute is never written either way.
// What is checkable everywhere is the DECLARATION, and the declaration is the
// defect. Its two siblings sweep the same file for the other halves of the same
// omission: `scroll-containment.test.js` for a scroller that chains its scroll
// into the page, `scroller-boxes.test.js` for a box asked to scroll that never
// declares an overflow to scroll in.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { cssRules } from '../css-rules.js'

const SRC = process.env.TIPPANI_SRC
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

// `cssRules` RATHER THAN THE SPLIT ITS SIBLINGS USE. Both of them take
// `m[1].split('\n').pop()` — the last line of the selector list — so a selector
// with anything after it on the list is invisible to them. This sweep asks
// whether a fade hangs off the MEASURED attribute, and a rule it cannot see is a
// rule it passes: exactly the failure it was written to catch, one level up. See
// `test/css-rules.js`, which a rater found by sliding a selector into the middle
// of a list and watching every test stay green.
const rules = () => cssRules(CSS)

// A fade, as opposed to any other mask. `url(...)` masks are pictures — the
// paper grain is one — and they are not claims about scrolling.
const FADE = /mask-image:\s*[^;]*linear-gradient/i
// What `useEdgeScroll` writes when, and only when, there really is content past
// an edge. A selector that names one of these is measured by construction.
const MEASURED = /\[data-scroll-(x|v)\b/

describe('every edge fade', () => {
  // PER SELECTOR, NOT PER RULE, and the difference is a hole this file had for
  // one commit. Asking whether the rule's whole selector LIST mentions a measured
  // attribute passes `[data-scroll-v="end"], .recall-log { mask-image: … }`: the
  // list contains a measured selector, so the test was satisfied, while
  // `.recall-log` got an unconditional fade — the exact defect AQ6 recorded,
  // re-typed and waved through. Every selector sharing a fade has to carry the
  // attribute itself, because a fade lands on each of them independently.
  it('hangs off the attribute the hook measures, never off the rule', () => {
    const typed = []
    for (const r of rules()) {
      if (!FADE.test(r.body)) continue
      for (const one of r.sel.split(',').map((x) => x.trim()).filter(Boolean)) {
        if (!MEASURED.test(one)) typed.push(one)
      }
    }
    expect([...new Set(typed)],
      'these paint a fade whichever way the content falls, so a list that fits wears an edge promising rows that are not there — attach useEdgeScroll and let the fade hang off data-scroll-x / data-scroll-v')
      .toEqual([])
  })

  // The claim above is only worth having if the app really does fade this way,
  // so the other direction is asserted too: a run where nobody uses the measured
  // attribute would pass the sweep vacuously.
  it('is how the app fades at all — the attribute is in real use', () => {
    const measured = rules().filter((r) => FADE.test(r.body) && MEASURED.test(r.sel))
    expect(measured.length,
      'no rule fades off data-scroll-x / data-scroll-v, so the sweep above is passing over an app that does not do this')
      .toBeGreaterThan(2)
  })
})
