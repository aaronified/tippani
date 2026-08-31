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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

// Each entry is a class whose content is a person's name, a character's name, or
// a work's title. Adding one here is how a new name-bearing element joins the
// rule; removing one needs a reason, in the diff.
const NAME_CLASSES = [
  'cast-character',
  'cast-opt-name',
  'name-scroll',
  'trash-label',
  'tp-panel-back-word',
  'tp-panel-title',
]

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
