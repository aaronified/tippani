// THE BACK CRUMB SAYS WHEN IT HAS CUT A NAME, AND STAYS INSIDE ITS OWN KEY.
//
// THE REPORT, the owner's, over a screenshot of a sub-sheet whose crumb read
// "← V / William Ro": "the back breadcrumbs sometimes do this. ellipsis them".
//
// WHAT "THIS" WAS, MEASURED. The word carried `overflow-x: auto` so a fade could
// hang off it, and a flex item whose overflow is not visible has an automatic
// minimum size of zero — so it shrank, and it clipped, and it clipped SILENTLY.
// The name stopped mid-word with nothing to say it had been cut, which is the one
// failure the app's "never truncate a name" rule exists to prevent, happening
// under a rule written to prevent it. `run-panel-depth.sh` forces a name far
// longer than the key and reads the rectangles at 390: against the old rules the
// crumb clipped with no mark on both heads that draw one.
//
// AN EARLIER VERSION OF THIS FILE SAID IT PRINTED OVER THE TITLE. That was a
// reading of the screenshot rather than a measurement, and the browser probe
// refuted it — the crumb stayed inside its slot. It is corrected here rather than
// quietly dropped, because a test file that states the wrong failure teaches the
// next reader to fix the wrong thing.
//
// SO THERE ARE TWO PROPERTIES, and only the first is the report:
//
//   THE CLIPPED END IS MARKED. The owner's ruling, and an exception to the
//   standing rule — argued at `.tp-panel-back-word` in the stylesheet and
//   recorded in `no-truncated-names.test.js`, which is where the rule lives.
//
//   AND THE KEY CAN GIVE UP WIDTH. `flex: none` at a hard `11ch` cannot, and
//   `.tp-panel-slot` clips nothing, so a slot narrower than the key would leave
//   the key printing outside it. That did not reproduce at 390 on the seeded
//   fixture; it is a hazard the code allows, closed here and labelled as such
//   rather than as the reported defect.
//
// WHY THE STYLESHEET AND NOT THE SCREEN. jsdom has no layout: it will report a
// zero-width box overlapping nothing, whatever the CSS says. What can be checked
// exactly here is the set of declarations that decides it; the rectangles are
// `run-panel-depth.sh`'s, in a real browser at 390.
//
// AND WHY `declaredIn` RATHER THAN `resolveOn`. The cascade resolver decides
// whether a selector COMPETES by its rightmost compound, so `.work-hero-actions
// > *` — a rule about a different row entirely — competes with every class in the
// file and wins `min-width` for all of them. That is right for the questions it
// was written for and wrong for this one: what is asked here is what the crumb's
// own rule declares. `declaredIn` matches the selector exactly, and is still
// immune to the formatting that the byte-matching suites were not.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.

import { describe, expect, it } from 'vitest'

import { declaredIn } from '../css-cascade.js'

// The value `sel`'s own rule gives `prop`, or null when its rule does not
// mention it. Rules are merged in source order, later winning, which is what the
// browser does with two blocks for one selector.
function decl(sel, prop) {
  let out = null
  for (const r of declaredIn(sel)) {
    if (r.decls[prop]) out = String(r.decls[prop].value).trim()
  }
  return out
}

// The touch floor the rest of the app uses, so the crumb shrinking does not
// shrink it out of being pressable.
const TOUCH = 44

describe('the back crumb in a panel head', () => {
  it('can give up width when the head is tight', () => {
    // The hazard, not the report — see the header.
    const flex = decl('.tp-panel-back', 'flex')
    const shrink = decl('.tp-panel-back', 'flex-shrink')
    const canShrink = (flex && !/^(none|0 0)\b/.test(flex.trim())) || (shrink && shrink.trim() !== '0')
    expect(canShrink,
      `the crumb is declared \`flex: ${flex}\`, so it keeps its full width and the overflow lands on the title beside it`)
      .toBe(true)
  })

  it('and stops giving it up while it is still a target you can hit', () => {
    const min = decl('.tp-panel-back', 'min-width')
    expect(min, 'the crumb can shrink to nothing — a key with no width is not a key').toBeTruthy()
    const px = Number((min.match(/(\d+(?:\.\d+)?)px/) || [])[1])
    expect(px, `the crumb's floor is \`${min}\`, which does not name the ${TOUCH}px target`)
      .toBeGreaterThanOrEqual(TOUCH)
  })

  it('and the word inside it shrinks with it', () => {
    // Without this the key shrinks and the WORD overflows the key — the same
    // overlap, one box further in. A flex item's default min-width is its
    // content, which is the whole of why this declaration has to be written out.
    expect(decl('.tp-panel-back-word', 'min-width'),
      'the word keeps its content width, so it overflows the key however narrow the key gets')
      .toBe('0')
  })

  it('and what does not fit is clipped rather than printed over the title', () => {
    const overflow = decl('.tp-panel-back-word', 'overflow')
      || decl('.tp-panel-back-word', 'overflow-x')
    expect(overflow, 'the word declares no overflow at all, so it prints outside its own box').toBeTruthy()
    expect(/hidden|auto|clip|scroll/.test(overflow),
      `the word is \`overflow: ${overflow}\`, which puts the rest of it on top of whatever is next to it`)
      .toBe(true)
  })

  it('and says so, rather than ending mid-name in silence', () => {
    expect(decl('.tp-panel-back-word', 'text-overflow'),
      'the crumb clips with no mark, so a cut name and a short name look alike')
      .toBe('ellipsis')
  })

  it('wears no edge fade, because it no longer scrolls', () => {
    // An edge fade means "there is more this way, drag it" — the app's standing
    // rule. On a box that clips there is nothing to drag, so a fade would be a
    // gesture promised and not delivered.
    const scrolls = decl('.tp-panel-back-word', 'overflow-x')
    expect(scrolls === 'auto' || scrolls === 'scroll',
      'the word both scrolls and ellipsises, which are two different promises about the same edge')
      .toBe(false)
  })

  it('and the title beside it clips rather than overflowing onto it', () => {
    // THE EXCEPTION IS NO LONGER THE CRUMB'S ALONE. This case required the title
    // to keep scrolling — "the exception is the crumb's alone" — and the owner
    // ruled otherwise on 7 September, over a screenshot of a character sheet:
    // "the title doesn't need to scroll in the header. it can be ellipsis-ed. not
    // a problem." Both halves of the head are signposts to what you are looking
    // AT, and the thing itself is named in full inside the panel below.
    //
    // WHAT STILL HOLDS IS THE HALF THIS FILE IS FOR. An ellipsis is permission to
    // SHORTEN a name, not permission to print it over its neighbour — which is
    // how the crumb was failing before its own ruling: neither scrolling NOR
    // clipping. So the title has to really clip, and has to be able to shrink.
    expect(decl('.tp-panel-title', 'overflow'),
      'the title ellipsises with nothing to clip it, so the rest lands on the ✕ beside it')
      .toBe('hidden')
    expect(decl('.tp-panel-title', 'min-width'),
      'the title keeps its content width, so the clip never happens').toBe('0')
  })
})
