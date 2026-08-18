// A gesture clip floated into a help answer — and the two facts that mechanism
// rests on, neither of which the rest of the suite can see.
//
// WHY THIS FILE EXISTS. `HelpRow` draws a clip asset in a different place from
// every other asset: FIRST, before the term, so the sentence that follows wraps
// around it. That order is not a preference. A float shortens the line boxes of
// content that comes AFTER it and nothing else, so an asset left in its old
// position — after the words — would float against empty space and the wrap would
// silently not happen. Nothing about the page would look broken; it would just
// stop being the layout somebody designed, and no assertion anywhere would notice.
//
// The second fact is containment. The float lives inside `.help-row-text`, whose
// `display: flow-root` is what stops a tall clip on a short entry reaching down
// into the next entry's words. It is a formatting context already, by accident of
// being a flex item, so deleting the rule breaks nothing until the day `.help-row`
// stops being `display: flex`.
//
// jsdom lays nothing out, so both are checked the way palette.test.jsx and
// gestures.test.jsx check their CSS/JS agreements: the DOM order from a render, and
// the rules from the stylesheet.

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Gesture, isGestureClip } from '../../src/gestures.jsx'
import { helpGuide } from '../../src/help.jsx'
import { HelpList } from '../../src/ui.jsx'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const css = readFileSync(join(SRC, 'index.css'), 'utf8')

describe('isGestureClip', () => {
  it('answers for a clip and for nothing else', () => {
    expect(isGestureClip(<Gesture kind="long-press" />)).toBe(true)
    // The two shapes a real `asset` takes when it is not a clip: a wide element
    // built here in help.jsx, and no asset at all. A truthy answer for either is
    // a 240px schematic floated into a 12.5px sentence.
    expect(isGestureClip(<div className="help-swatches" />)).toBe(false)
    expect(isGestureClip(undefined)).toBe(false)
    expect(isGestureClip(null)).toBe(false)
  })
})

describe('a clip in a help row', () => {
  const rowOf = (entry) => {
    const { container } = render(<HelpList entries={[entry]} />)
    return container.querySelector('.help-row-text')
  }

  it('draws the clip before the term, because a float only reflows what follows it', () => {
    const text = rowOf({ term: 'Long press', what: 'One sentence.', asset: <Gesture kind="long-press" /> })
    const kids = [...text.children]
    expect(kids[0].className).toContain('help-row-asset')
    expect(kids[0].className).toContain('is-clip')
    // Stated as the ORDER rather than just "the class is there": the class does
    // nothing whatsoever if the element is drawn after the words.
    expect(kids.findIndex((k) => k.tagName === 'DT')).toBe(1)
  })

  it('leaves a wide asset where it was — under the words, not floated', () => {
    const text = rowOf({
      term: 'Colours',
      what: 'One sentence.',
      more: 'Behind the fold.',
      asset: <div className="help-swatches" />,
    })
    const asset = text.querySelector('.help-row-asset')
    expect(asset.className).not.toContain('is-clip')
    // After the sentence and before the fold, which is where every asset sat
    // before clips were floated.
    const kids = [...text.children]
    expect(kids.indexOf(asset)).toBeGreaterThan(kids.findIndex((k) => k.tagName === 'DD'))
    expect(kids.indexOf(asset)).toBeLessThan(kids.findIndex((k) => k.className === 'help-more'))
  })

  it('floats the clips the registry actually carries, not just a fixture', () => {
    // The same asymmetry gestures.test.jsx asserts for the clip library: a
    // mechanism proved only against a hand-made entry is a mechanism that can stop
    // reaching the real help without anything failing.
    const shell = helpGuide(true).find((s) => s.id === 'everywhere')
    const clips = shell.entries.filter((e) => isGestureClip(e.asset))
    expect(clips.length, 'no help entry carries a gesture clip any more').toBeGreaterThan(0)
    for (const e of clips) {
      expect(rowOf(e).children[0].className, e.term).toContain('is-clip')
    }
  })
})

describe('the stylesheet the float depends on', () => {
  it('contains the float in the row, so a tall clip cannot reach the next entry', () => {
    expect(css).toMatch(/\.help-row-text\s*\{[^}]*display:\s*flow-root/)
  })

  it('clears everything after the sentence, so no left-edge mark lands behind the clip', () => {
    // A float shortens LINE boxes and leaves BLOCK boxes at full width, so the
    // `how` list's dash and the fold's ▸ would both draw behind the clip while
    // their text sat to its right. Both are named because the two clip entries in
    // help today have `more` and no `how` — the live case is the one that is easy
    // to leave out.
    const clear = css.slice(css.indexOf('.help-row-asset.is-clip ~'))
    const rule = clear.slice(0, clear.indexOf('}') + 1)
    expect(rule).toContain('.help-how')
    expect(rule).toContain('.help-more')
    expect(rule).toMatch(/clear:\s*left/)
  })

  it('floats the clip left with no top gap, which would read as a misalignment', () => {
    const rule = css.slice(css.indexOf('.help-row-asset.is-clip {'))
    const body = rule.slice(0, rule.indexOf('}'))
    expect(body).toMatch(/float:\s*left/)
    // A shorthand `margin`, so it overrides the base rule's margin-top rather than
    // sitting beside it — the base rule is unlayered too, so the later one wins
    // only because it says all four sides.
    expect(body).toMatch(/margin:\s*\d/)
  })
})
