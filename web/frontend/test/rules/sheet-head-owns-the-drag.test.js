// THE SHEET'S DRAG SURFACE MUST OWN THE WHOLE GESTURE.
//
// THE OWNER, THREE REPORTS RUNNING, and the last two are the diagnosis: "the tiny
// top bar works as well in people popups. but the header behaves as if i am
// scrolling the content (does not scroll it either). so header is basically trying
// to vertically scroll itself" — then "header should not even have any scrollable
// part."
//
// WHAT IT WAS. The SCOPED panel title was a `NameScroll`, whose `overflow-x: auto`
// makes it a scroll container — and CSS computes the other axis to `auto` beside a
// scrolling partner, so the header held a VERTICAL scroller with one line of nowrap
// text in it. Nothing to scroll, and a rubber-band for trying.
//
// AND WHAT IT WAS NOT, because the first version of this file asserted it and a
// rater took it apart: descendants of the head were NOT dangerously on
// `touch-action: auto`. Effective touch-action is the intersection of an element
// and its ancestors, and `.tp-panel-head { touch-action: none }` has been in the
// stylesheet since f1bbf183 — so everything inside was already covered.
// `getComputedStyle` reports the DECLARED value per element, which is why a
// measurement of `auto` looked like a finding and was not. A guard requiring a
// `.tp-panel-head *` rule went in on that reasoning; both the rule and the guard
// are withdrawn.
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

import { rulesNaming } from '../css-rules.js'

const CSS = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
const UI = readFileSync(join(process.cwd(), 'src/ui.jsx'), 'utf8')

// Every rule whose selector NAMES the head, with its body.
//
// THIS WENT THROUGH `css-rules.js` AFTER IT READ A COMMENT AS A DECLARATION. The
// hand-rolled `/([^{}]+)\{([^{}]*)\}/g` this used kept comments in the body it
// handed back, so a note explaining WHY the head carries `touch-action: none`
// was scanned as a rule that carries something else — the value capture ran past
// the prose to the next semicolon — and the file failed the very declaration it
// had just been extended to bless. `cssRules` strips comments first and tracks
// braces, and its own header records a rater finding the same class of bug in
// three other sweeps.
const rulesFor = (cls) => rulesNaming(CSS, cls.replace(/^\./, ''))
  .map((r) => ({ sel: r.sel.trim().replace(/\s+/g, ' '), body: r.body }))

// BOTH HEADS, BECAUSE BOTH TAKE THE HOOK. This file was written about
// `.tp-panel-head` when that was the app's only draggable head. `MobileSheet`
// took `useSheetDrag` too and its head shipped WITHOUT the declaration — so the
// owner got a sheet whose whole header was wired to drag in JS and neutered in
// CSS, and reported it as "the drag target is too small when i am adding a quote".
// The guard that would have caught it was this one, scoped to one selector.
//
// A head in this list owes the declaration; a head not in it is unguarded, which
// is how the second one came to be missing.
const DRAG_HEADS = ['.tp-panel-head', '.mobile-sheet-header']

describe.each(DRAG_HEADS)('%s claims the drag', (HEAD) => {
  it('declares touch-action: none for the head itself', () => {
    // ONE DECLARATION IS ENOUGH, and asserting more than that was the error this
    // file was rewritten to remove. Effective touch-action intersects with every
    // ancestor, so `none` here covers the head's whole subtree — a rule per
    // descendant adds nothing, and `touch-action` does not even apply to the
    // non-replaced inline elements most of those children are.
    const head = rulesFor(HEAD)
      .filter((r) => r.sel === HEAD || /touch-action/.test(r.body))
    const claims = head.filter((r) => [...r.body.matchAll(/touch-action\s*:\s*([^;}]+)/g)]
      .some((m) => m[1].trim() === 'none'))
    expect(claims.length, `nothing claims the gesture for ${HEAD}`)
      .toBeGreaterThan(0)
  })

  it('and hands no part of itself back to the browser', () => {
    // THE VALUE IS READ, NOT PATTERN-MATCHED AROUND. The first cut of this was
    // `/touch-action:\s*(?!none)/`, which matches `touch-action: none` — `\s*`
    // backtracks to zero and the lookahead then sits on " none", which does not
    // begin with "none". It failed the very rule it was written to bless.
    //
    // `pan-x` is the value this forbids, and the note on `.tp-panel-title` says
    // why: it leaves horizontal panning to the browser, and "every real thumb drag
    // is slightly diagonal".
    const loose = rulesFor(HEAD)
      .filter((r) => [...r.body.matchAll(/touch-action\s*:\s*([^;}]+)/g)]
        .some((m) => m[1].trim() !== 'none'))
      .map((r) => r.sel)
    expect(loose, `a rule under ${HEAD} hands the browser a pan to claim`).toEqual([])
  })
})

// AND THE LIST HAS TO KEEP UP WITH THE HOOK. `sheet-drag-wiring.test.js` names
// every surface that takes `useSheetDrag` and checks the stylesheet SIZES it;
// this checks the stylesheet lets it be GRABBED. Both halves are per-surface, so
// a third sheet must appear in both lists or it is half-guarded — which is
// exactly the state MobileSheet shipped in.
describe('every draggable head is on the list', () => {
  it('one head per surface that takes the hook', () => {
    expect(DRAG_HEADS.length, 'a surface takes useSheetDrag and its head is not guarded here')
      .toBe([...UI.matchAll(/=\s*useSheetDrag\(\{/g)].length)
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

  it('and the crumb beside it names its vertical axis', () => {
    // THE CRUMB STILL SCROLLS SIDEWAYS, deliberately: truncating it made a THIRD
    // exception to "never truncate a name", undocumented and unguarded, and it was
    // not needed — the head claims `touch-action: none`, so no scroller in there is
    // pannable by a thumb. What had to go is the axis nobody declared.
    const crumb = rulesFor('.tp-panel-crumb').map((r) => r.body).join('\n')
    expect(crumb, 'the crumb stopped scrolling, which is a truncation exception nobody argued')
      .toMatch(/overflow-x:\s*auto/)
    expect(crumb, 'the crumb leaves its vertical axis to be computed, so it is a vertical scroller')
      .toMatch(/overflow-y:\s*hidden/)
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
