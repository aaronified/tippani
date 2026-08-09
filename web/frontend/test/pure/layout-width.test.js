// How wide the app is allowed to be, and what it does with the room.
//
// Two tables in two files have to agree, and nothing but this notices when they
// stop. `--container-max` in index.css says how wide the page may get;
// BOARD_COLUMNS in ui.jsx says how many columns fill it. Raise the cap alone and
// the extra width arrives as slack inside cards that were already the right
// size — a quote card 600px across is a worse card on a bigger screen, and the
// page looks like it was stretched rather than laid out. Add a rung alone and
// the columns get narrower with no more room to put them in.
//
// The other half is smaller and nastier: the page body and the top bar both
// read the cap, and the instant they disagree the brand and the avatar stop
// lining up with the gutters of everything underneath them. Written twice as a
// literal — which is how it was — that is one careless edit away, permanently.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BOARD_COLUMNS, QUOTE_COLUMNS } from '../../src/ui.jsx'

// TIPPANI_SRC, not cwd: vitest is launched from web/frontend by `npm test` and
// from the repo root by `npx vitest --root web/frontend`, and both are real.
const CSS = readFileSync(join(process.env.TIPPANI_SRC, 'index.css'), 'utf8')

// The declared cap, as a [minViewport, maxWidthPx] ladder. The base value in
// :root has no media query, so it starts at 0.
function widthSteps() {
  const steps = []
  const base = CSS.match(/--container-max:\s*(\d+)px/)
  expect(base, '--container-max is not declared at all').toBeTruthy()
  steps.push([0, Number(base[1])])
  const re = /@media\s*\(min-width:\s*(\d+)px\)\s*\{\s*:root\s*\{([^}]*)\}/g
  let m
  while ((m = re.exec(CSS))) {
    const v = m[2].match(/--container-max:\s*(\d+)px/)
    if (v) steps.push([Number(m[1]), Number(v[1])])
  }
  return steps.sort((a, b) => a[0] - b[0])
}

const STEPS = widthSteps()
// The cap is a CEILING, not the width. Below it the container is simply the
// viewport less .container-tp's own gutters, which is the case that matters at
// the bottom of every ladder: at 640px the cap is irrelevant and two columns
// are sharing 600px, not 1180.
const GUTTERS = 40 // .container-tp padding: 4px 20px 64px
const capAt = (vw) => STEPS.filter(([min]) => vw >= min).pop()[1]
const containerAt = (vw) => Math.min(capAt(vw), vw - GUTTERS)
// useColumnsAt's own rule, restated so this test does not depend on a hook.
const columnsAt = (ladder, vw) => (ladder.find(([min]) => vw >= min) || [0, 1])[1]

describe('the width cap', () => {
  it('is a token, not a number written twice', () => {
    // .container-tp and .topbar-inner are the two consumers, and a px literal
    // in either is the bug this is here for.
    for (const sel of ['.container-tp', '.topbar-inner']) {
      const rule = CSS.slice(CSS.indexOf(sel + ' {'))
      const body = rule.slice(0, rule.indexOf('}'))
      expect(body, `${sel} max-width`).toMatch(/max-width:\s*var\(--container-max\)/)
    }
    // And nothing anywhere still carries the old literal.
    expect(CSS).not.toContain('max-width: 1180px')
  })

  it('only ever grows', () => {
    // A step that shrinks the page on a wider screen is not a typo anyone spots
    // by reading; it is a screen size where the app suddenly gets narrower.
    for (let i = 1; i < STEPS.length; i++) {
      expect(STEPS[i][1], `step at ${STEPS[i][0]}px`).toBeGreaterThan(STEPS[i - 1][1])
    }
    expect(STEPS.length, 'there is only the base value — nothing widens').toBeGreaterThan(1)
  })

  it('leaves a laptop exactly where it was', () => {
    // 1180 was chosen for a 13" screen and is still right on one. Widening for
    // a 4K monitor must not reflow the machine most of this was built on.
    expect(capAt(1280)).toBe(1180)
    expect(capAt(1366)).toBe(1180)
  })

  it('actually uses a wide screen', () => {
    // The complaint that started this: 1180px of 2560 is 46% of the monitor.
    expect(capAt(1920)).toBeGreaterThan(1600)
  })

  it('leaves no band of desktop widths behind', () => {
    // Written because a mutation that DELETED a step survived everything above.
    // The steps are a staircase, and the tests only checked that it starts low
    // and ends high — a missing tread in the middle is the original complaint
    // again, at a screen size nobody happened to name. 1520px is a common
    // laptop; on the ladder with its middle step removed it kept 1180.
    //
    // The floor is a RATIO rather than a width, because that is what "uses the
    // screen" means, and it stops at 1920: past that the cap is deliberate, and
    // a line of prose spanning a 4K monitor is not a feature.
    for (let vw = 1280; vw <= 1920; vw += 20) {
      expect(containerAt(vw) / vw, `${vw}px viewport`).toBeGreaterThan(0.75)
    }
  })
})

describe('the column ladders', () => {
  const LADDERS = { BOARD_COLUMNS, QUOTE_COLUMNS }

  for (const [name, ladder] of Object.entries(LADDERS)) {
    it(`${name} is ordered the way useColumnsAt reads it`, () => {
      // The hook returns the FIRST rung whose min it clears, so an out-of-order
      // ladder silently returns the wrong count rather than failing.
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i][0], `${name}[${i}] min`).toBeLessThan(ladder[i - 1][0])
        expect(ladder[i][1], `${name}[${i}] cols`).toBeLessThan(ladder[i - 1][1])
      }
    })

    it(`${name} keeps a card roughly one card wide at every rung`, () => {
      // THE JOINT CLAIM, and the only one that catches either table drifting
      // from the other. More room has to buy another column, not a fatter card.
      for (const [min, cols] of ladder) {
        const per = containerAt(min) / cols
        expect(per, `${name}: ${cols} columns at ${min}px viewport`).toBeGreaterThan(280)
        expect(per, `${name}: ${cols} columns at ${min}px viewport`).toBeLessThan(460)
      }
    })

    it(`${name} gains a column wherever the container gains room`, () => {
      // Every width step above the ladder's own floor must land on more columns
      // than the step below it — otherwise that step is pure slack.
      const steps = STEPS.filter(([min]) => min >= ladder[ladder.length - 1][0])
      for (let i = 1; i < steps.length; i++) {
        const before = columnsAt(ladder, steps[i - 1][0])
        const after = columnsAt(ladder, steps[i][0])
        expect(after, `${name} at ${steps[i][0]}px`).toBeGreaterThanOrEqual(before)
      }
      // And the widest screen genuinely gets more than the laptop did.
      expect(columnsAt(ladder, 1920)).toBeGreaterThan(columnsAt(ladder, 1280))
    })
  }

  it('gives a text board its second column later than a cover board', () => {
    // A quote wrapped to 300px is a column of syllables. Covers are happy there.
    const twoAt = (l) => l.find(([, c]) => c === 2)[0]
    expect(twoAt(QUOTE_COLUMNS)).toBeGreaterThan(twoAt(BOARD_COLUMNS))
  })
})
