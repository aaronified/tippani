// A NAME IS NEVER TRUNCATED — the standing rule, checked against the stylesheet.
//
// The rule's own words: "A shortened name and a short name look alike, so an
// ellipsis on one destroys the thing the row exists to show. It scrolls under the
// fade, or it wraps."
//
// WHY READ THE CSS RATHER THAN THE SCREEN. text-overflow only shows itself when
// the text is actually too long — so a rule added to a name's own class is
// invisible until somebody with a long name opens that screen, and then it looks
// like their name is short. jsdom has no layout and cannot catch it; the browser
// harness (make typescale) catches it only where the fixture happens to overflow.
// The declaration is the defect, and the declaration is greppable.
//
// THIS IS A LIST OF CLASSES THAT HOLD NAMES, not a ban on text-overflow. A count,
// a path, a URL and a piece of prose may all ellipsise — none of them is a thing
// whose whole point is being read exactly.
//
// AND THERE IS ONE EXCEPTION, WHICH IS KEPT HERE RATHER THAN BEING DELETED FROM
// THE LIST. A class the owner has ruled may ellipsise moves to EXCEPTED below,
// with the ruling beside it, and is still required to be a real clip — because
// the way it was failing before the ruling was neither scrolling NOR clipping,
// which is worse than either. A quietly shortened list would have lost both the
// exception and the reason for it.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { stripComments } from '../css-cascade.js'

// COMMENTS ARE STRIPPED BEFORE ANY OF THIS LOOKS AT THE FILE, and that is not
// tidiness — it is the difference between a guard and a guard-shaped thing.
//
// These assertions grep a declaration block for `overflow: hidden` and for
// `text-overflow: ellipsis`. A CSS COMMENT INSIDE THE BLOCK IS PART OF THAT SLICE,
// so a note explaining WHY the rule needs `overflow: hidden` satisfies the check
// for it — and the check then passes with the declaration deleted. That is exactly
// what happened: a comment written to record the owner's ruling made the rule it
// was recording unfalsifiable, and a mutation run is what found it rather than a
// reading.
//
// `stripComments` is test/css-cascade.js's, which the parsed-stylesheet suites
// already share. One implementation of "what is actually declared here".
const css = stripComments(readFileSync(join(process.cwd(), 'src/index.css'), 'utf8'))

// Each entry is a class whose content is a person's name, a character's name, or
// a work's title. Adding one here is how a new name-bearing element joins the
// rule; removing one needs a reason, in the diff.
const NAME_CLASSES = [
  'cast-character',
  'cast-opt-name',
  'name-scroll',
  'trash-label',
]

// The exceptions, each with the ruling that granted it. Both are in the panel's
// HEAD, one slot apart, and both were granted on the same argument: the head is a
// signpost, and the thing it names is printed in full in the panel below it. A
// third entry anywhere else would want arguing.
const EXCEPTED = {
  // The owner, 6 September, over a screenshot of "← V / William Ro" printed
  // across "Change who this is": "the back breadcrumbs sometimes do this.
  // ellipsis them". The crumb is a signpost back to a screen the reader has just
  // come from, whose own header printed that name in full — so it is the one
  // place in the app where a name is not being READ, which is what the rule
  // protects. See `crumb-stays-in-its-slot.test.js` for what it must do instead.
  'tp-panel-back-word': 'the owner, 6 September',
  // The owner, 7 September, over a screenshot of a character sheet whose header
  // read "Mordin / in Mass Effect Legendary Edition": "the title doesn't need to
  // scroll in the header. it can be ellipsis-ed. not a problem." The head is a
  // signpost to what you are looking AT, and the thing itself is named in full
  // inside the panel a finger's width below — which is the same argument the
  // crumb beside it won on.
  //
  // AND THE EXCEPTION PAID FOR SOMETHING. A sideways scroller here is why
  // `.tp-panel-head` could only claim `touch-action: pan-x`, leaving horizontal
  // panning to the browser; every real thumb drag is slightly diagonal, so the
  // browser could take a gesture meant for the sheet. With the scroller gone the
  // head takes the whole gesture. See `sheet-from-the-bottom.test.jsx`.
  'tp-panel-title': 'the owner, 7 September',
  // The owner, 11 September, over a screenshot of the add surface whose header
  // printed "The Armchair Economist" down three lines and pushed the form off the
  // screen: "the header names can get ellipsis. they do not need to have edgemask
  // sidescroll or infinite wrap. one line is enough."
  //
  // THE SAME ARGUMENT AS THE TWO ABOVE, AND IT PAID THE SAME PRICE. The sheet's
  // header is a signpost to what you are adding to, and the thing it names is
  // printed in full in the work picker you just came through and in the fields
  // below. What makes it hold here rather than merely being asserted is the rest of
  // the instruction — "for second line get the author/director whatever in smaller
  // font" — so the slot stopped being one ambiguous name that could not fit and
  // became a name plus the person who made it. A title alone is what a library
  // makes ambiguous; a title and its author is not.
  //
  // THE COMMENT IN THE STYLESHEET SAID THE OPPOSITE and is rewritten rather than
  // deleted: a rule reversed by its author is worth more in the file than a rule
  // that was never argued.
  'mobile-sheet-title': 'the owner, 11 September',
  // The same ruling, the other branch. The add surface draws one header from one
  // pair of variables and renders it twice — a sheet on a phone, a card on a desk —
  // so a clip on one and a wrap on the other would be the repo's own "two things
  // that look the same behave the same" broken down the middle of one component.
  'add-head-title': 'the owner, 11 September',
}

// The subset that is ITSELF the scrolling box. The others are typography classes
// worn alongside one — .trash-label sits on a NameScroll, which supplies the
// overflow — so demanding that each of them declare its own overflow would be
// asking a font-weight rule to be a scroller.
const SCROLLERS = NAME_CLASSES.filter((c) => c !== 'trash-label')

// The declaration block for one class, as written in index.css.
function blockFor(cls) {
  const at = css.indexOf(`.${cls} {`)
  if (at === -1) return null
  return css.slice(at, css.indexOf('}', at))
}

describe('the classes that hold a name', () => {
  it.each(NAME_CLASSES)('%s exists in the stylesheet', (cls) => {
    // A class that has been renamed away silently takes its guard with it.
    expect(blockFor(cls), `.${cls} is not declared in index.css any more`).not.toBeNull()
  })

  it.each(NAME_CLASSES)('%s does not end a name in an ellipsis', (cls) => {
    const block = blockFor(cls)
    expect(block).not.toBeNull()
    expect(block, `.${cls} truncates a name — it must scroll under the fade or wrap`)
      .not.toMatch(/text-overflow\s*:\s*ellipsis/)
  })
})

describe('the one class the owner has excepted', () => {
  it.each(Object.keys(EXCEPTED))('%s is still a real clip, not an overflow', (cls) => {
    // The exception is permission to SHORTEN a name, not permission to print it
    // over whatever is beside it. Before the ruling this class did neither: it
    // declared a scroller with no `min-width: 0`, so the word could not shrink,
    // could not scroll, and simply overflowed its key onto the title.
    const block = blockFor(cls)
    expect(block, `.${cls} is not declared in index.css any more`).not.toBeNull()
    expect(block, `.${cls} ellipsises with nothing to clip it — the rest of the name lands on its neighbour`)
      .toMatch(/overflow\s*:\s*(hidden|clip)/)
    expect(block, `.${cls} keeps its content width, so the clip never happens`)
      .toMatch(/min-width\s*:\s*0/)
  })
})

// THE ELLIPSIS IS ONLY HALF THE RULE. A name that does not ellipsise but also
// cannot be read to its end is worse, not better — at least the ellipsis admitted
// something was missing. The rule gives two ways out and each of these has to take
// one of them.
//
// BOTH ARE ACCEPTED, and .cast-opt-name is why: it WRAPS rather than scrolling,
// because it sits inside a role="option" whose click is its whole purpose, and a
// fade there would promise a drag that must not fire. An assertion demanding a
// scroller would have called that correct decision a defect — which is what it did
// the first time this was written.
describe('a name that does not truncate can still be read to the end', () => {
  it.each(SCROLLERS)('%s either scrolls or wraps', (cls) => {
    const block = blockFor(cls)
    expect(block).not.toBeNull()
    const scrolls = /overflow-x\s*:\s*auto/.test(block)
    const wraps = /white-space\s*:\s*normal/.test(block) || /overflow-wrap|word-break/.test(block)
    expect(
      scrolls || wraps,
      `.${cls} neither scrolls nor wraps — the end of a long name is simply gone, with nothing saying so`,
    ).toBe(true)
  })
})
