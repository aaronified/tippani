// THE BACK CRUMB DOES NOT PRINT OVER THE TITLE BESIDE IT.
//
// THE REPORT, the owner's, with a screenshot of a sub-sheet: "the back
// breadcrumbs sometimes do this. ellipsis them". What the picture showed was
// "← V / William Ro" laid across "Change who this is" — two screens' words in
// one line box, neither readable.
//
// THE SPECIFICATION. A panel head is a flex row of three: the way back, the
// title, and whatever the right slot holds. A child of a flex row prints over its
// neighbour when it can neither SHRINK nor CLIP, and the crumb could do neither —
// `flex: none` at a hard `11ch` refused to give up width, and the word inside it
// carried the default `min-width: auto`, so it declined to shrink below its own
// content and simply overflowed the key. Both facts are needed: a key that
// shrinks around a word that will not is the same overflow one level in.
//
// "SOMETIMES" IS WHAT A LAYOUT DEFECT LOOKS LIKE FROM THE OUTSIDE. It happened on
// the parent titles long enough to exceed the slot, on the widths where the slot
// was a third of a narrow bar — which is a phone, which is where it was reported
// from and not where it was built.
//
// AND THE CLIPPED END IS MARKED. That is the owner's ruling and it is an
// exception to the app's own standing rule that a name is never truncated —
// argued at `.tp-panel-back-word` in the stylesheet, and recorded in
// `no-truncated-names.test.js`, which is where the rule lives. It is asserted
// here too, because a clip with nothing to show for it is the failure the rule
// was written about.
//
// WHY THE STYLESHEET AND NOT THE SCREEN. jsdom has no layout: it will report a
// zero-width box overlapping nothing, whatever the CSS says. The browser harness
// sees an overlap only when the fixture happens to supply a long enough parent
// title — the seeded fixture's names are short, which is one reason this reached
// a phone before it reached a test. What can be checked exactly is the pair of
// declarations that decides it.
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

  it('while the title beside it still scrolls its own name in full', () => {
    // The exception is the crumb's alone. The title names what the panel is
    // ABOUT — it is the row that exists to show that name — and the rule stands
    // there untouched.
    expect(decl('.tp-panel-title', 'overflow-x'),
      'the title stopped scrolling, so the panel name it exists to print is now cut too')
      .toBe('auto')
    expect(decl('.tp-panel-title', 'text-overflow'),
      'the title ellipsises the name the panel is named after').toBeNull()
  })
})
