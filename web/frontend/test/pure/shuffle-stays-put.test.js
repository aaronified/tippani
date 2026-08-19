// A control does not move because you used it.
//
// THE BUG: SerendipityRow picked between two layouts with
// `!today.length && !shuffled` — a centred button when there was nothing to show,
// a left-aligned one with a rule when there was. Pressing Shuffle sets `shuffled`,
// so the press itself flipped the branch and the button jumped from the middle of
// the screen to the left edge, under the reader's own thumb. On a phone that is
// the full width of the viewport away from where they tapped.
//
// The rule this pins: the LAYOUT is a function of what the page loaded with
// (`today`), and `shuffled` may only decide whether a CARD appears. A control that
// relocates as a result of being pressed reads as a miss — the reader's next
// instinct is that they hit the wrong thing.
//
// Asserted against the source rather than a rendered tree because the component is
// not exported and the bug is structural: it lives in which expression chooses the
// branch, and that is exactly what a scrape can see. The repo uses this idiom
// elsewhere for the same reason.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const home = readFileSync(join(SRC, 'Home.jsx'), 'utf8')

// The component, sliced out so a `shuffled` elsewhere in Home cannot make this
// pass or fail for the wrong reason.
const row = (() => {
  const start = home.indexOf('function SerendipityRow(')
  expect(start, 'SerendipityRow has been renamed — this test is now measuring nothing').toBeGreaterThan(-1)
  const end = home.indexOf('\nfunction ', start + 1)
  return home.slice(start, end === -1 ? undefined : end)
})()

describe('the Shuffle button', () => {
  it('picks its layout from the day, not from the click', () => {
    // Every `if (...)` that returns early inside the component.
    const branches = [...row.matchAll(/if \(([^)]*)\)\s*\{/g)].map((m) => m[1])
    const layoutBranch = branches.find((b) => b.includes('today'))
    expect(layoutBranch, 'no branch on `today` — the layout decision has moved').toBeTruthy()
    expect(
      layoutBranch,
      'the layout branch reads `shuffled`, so pressing the button moves it',
    ).not.toContain('shuffled')
  })

  it('still lets the result decide whether a card appears', () => {
    // The other half: `shuffled` must not stop mattering altogether, or the button
    // would produce nothing visible. Both branches render the card.
    const cards = [...row.matchAll(/\{shuffled && <SerendipityCard/g)]
    expect(cards.length, 'the shuffled card is rendered in both layouts').toBe(2)
  })

  it('renders one button, not one per branch', () => {
    // Two copies is how the two layouts drifted apart in the first place: the
    // centred one and the aligned one were separate JSX with separate props.
    expect((row.match(/IconShuffle/g) || []).length).toBe(1)
    expect((row.match(/home\.shuffle\.label/g) || []).length).toBe(1)
  })
})
