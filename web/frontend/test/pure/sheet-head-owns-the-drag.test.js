// THE SHEET'S DRAG SURFACE MUST OWN THE WHOLE GESTURE.
//
// THE OWNER, THREE REPORTS RUNNING, and the last two are the diagnosis: "the tiny
// top bar works as well in people popups. but the header behaves as if i am
// scrolling the content (does not scroll it either). so header is basically trying
// to vertically scroll itself" — then "header should not even have any scrollable
// part."
//
// WHAT IT WAS. `.tp-panel-head` claimed `touch-action: none` and every child of it
// computed `auto`, which is most of the 50px a thumb can land on: `touch-action` is
// not inherited in the way that matters, so a descendant declaring `auto`
// re-enables the browser's own panning for a gesture starting on it. The browser
// then claims the drag, and per `claim` in ui.jsx a claimed gesture is one
// `useSheetDrag` stops receiving. On top of that the SCOPED panel title was a
// `NameScroll`, whose `overflow-x: auto` makes it a scroll container — and CSS
// computes the other axis to `auto` beside a scrolling partner, so the header held
// a vertical scroller with one line of nowrap text in it. Nothing to scroll, and a
// rubber-band for trying.
//
// WHY THIS IS A STYLESHEET READ AND NOT A GESTURE. A drag cannot be had in jsdom,
// and the browser probe that CAN have one drags with Puppeteer's mouse —
// `touch-action` governs touch panning rather than mouse events, so a header no
// finger could drag passed every case in `sheet-drag.mjs` for three rounds. The
// declarations are the only part of this a test without a thumb can hold.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that the unscoped
// title has always been a plain `h2` — which is exactly why the owner calls the
// Details panel "totally fine, as before".

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CSS = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
const UI = readFileSync(join(process.cwd(), 'src/ui.jsx'), 'utf8')

// Every rule whose selector mentions the head, with its body.
const rulesFor = (needle) => [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => m[1].includes(needle))
  .map((m) => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }))

describe('the panel header claims the drag', () => {
  it('declares touch-action: none for itself AND its descendants', () => {
    const claims = rulesFor('.tp-panel-head').filter((r) => /touch-action/.test(r.body))
    expect(claims.length, 'no rule claims the gesture for the panel header at all')
      .toBeGreaterThan(0)
    // A rule naming only the head leaves every child on `auto`, which is the defect.
    const covers = claims.some((r) => /\.tp-panel-head\s*\*/.test(r.sel) && /touch-action:\s*none/.test(r.body))
    expect(covers, `the header claims the gesture only for itself: ${claims.map((r) => r.sel).join(' | ')}`)
      .toBe(true)
  })

  it('and leaves no descendant a pan of its own', () => {
    // `pan-x` was the previous state of this and is not enough: the note on
    // `.tp-panel-title` says why — "every real thumb drag is slightly diagonal, so
    // the browser could take a gesture meant for the sheet".
    // THE VALUE IS READ, NOT PATTERN-MATCHED AROUND. The first cut of this was
    // `/touch-action:\s*(?!none)/`, which matches `touch-action: none` — `\s*`
    // backtracks to zero and the lookahead then sits on " none", which does not
    // begin with "none". It failed the very rule it was written to bless.
    const loose = rulesFor('.tp-panel-head')
      .filter((r) => [...r.body.matchAll(/touch-action\s*:\s*([^;}]+)/g)]
        .some((m) => m[1].trim() !== 'none'))
      .map((r) => r.sel)
    expect(loose, 'a rule under the panel header hands the browser a pan to claim').toEqual([])
  })
})

describe('nothing in the header is a scroll container', () => {
  it('the scoped panel title is a plain heading, not a scroller', () => {
    // THE ONE LINE THAT CARRIED THE DEFECT. The owner excepted this title from the
    // never-truncate rule on 7 September — "the title doesn't need to scroll in the
    // header. it can be ellipsis-ed. not a problem" — and `.tp-panel-title` has
    // carried `text-overflow: ellipsis` ever since while the element stayed a
    // `NameScroll` that overrode it.
    const scoped = UI.match(/<[A-Za-z]+[^>]*className="tp-panel-title is-scoped"/)
    expect(scoped, 'the scoped panel title is gone or renamed, so this guard is scanning for nothing').toBeTruthy()
    expect(scoped[0], 'the scoped panel title is a scroller again, which hands the browser the drag')
      .toMatch(/^<h2/)
  })

  it('and the title says so in the stylesheet too', () => {
    const title = rulesFor('.tp-panel-title').map((r) => r.body).join('\n')
    expect(title, 'the title neither ellipsises nor hides its overflow').toMatch(/text-overflow:\s*ellipsis/)
  })

  it('and the crumb beside it ellipsises rather than scrolling', () => {
    const crumb = rulesFor('.tp-panel-crumb').map((r) => r.body).join('\n')
    expect(crumb, 'the crumb scrolls, so a thumb on it pans instead of dragging the sheet')
      .not.toMatch(/overflow-x:\s*(auto|scroll)/)
  })
})

// AND THE GENERAL BUG UNDER THE PARTICULAR ONE. `.name-scroll` is used in six
// places; every one of them was a vertical scroll container nobody asked for.
describe('a one-line scroller names both its axes', () => {
  it('.name-scroll does not leave the other axis to be computed', () => {
    const body = rulesFor('.name-scroll').map((r) => r.body).join('\n')
    expect(body, '.name-scroll has no horizontal scroll any more, so this guard is stale')
      .toMatch(/overflow-x:\s*auto/)
    // `overflow-x: auto` with `overflow-y: visible` is not a state CSS has — the
    // spec computes the visible axis to `auto` — so an unnamed axis is a scroller.
    expect(body, 'the vertical axis is left to be computed, which makes this a vertical scroller')
      .toMatch(/overflow-y:\s*hidden/)
  })
})
