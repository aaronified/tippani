// A PICTURE THAT DOES NOT ARRIVE IS NOT A PICTURE.
//
// THE REPORT, the owner's, over a photograph of their own phone: "the character
// chip (delia sturridge) on the V for vendetta poster is a missing image glyph
// that looks like server has broke. it should be simply a random person glyph, as
// used in the actual delia sturridge character page."
//
// WHAT WAS WRONG, and it was the same line written six times: every site branched
// on whether a PATH WAS STORED. That is a different question from whether the
// file behind it arrived, and it is the one the reader cannot see — so a portrait
// whose file had gone drew the browser's torn page, which reads as "the server is
// down" rather than as "no picture".
//
// WHY THIS FILE EXISTS AT ALL. The fallback shipped once with no test: deleting
// `onError` left the whole suite green, on the one item of that round the owner
// had photographed. Nothing in the app can see a picture fail except the element
// it fails on, so nothing but a fired `error` can assert it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `Face` takes `{ src, name, className, url }`,
// draws the address `url(src)` builds, and falls back to the app's six hashed
// silhouettes — the same six a row with no picture has always drawn.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { Face, PortraitBlock } from '../../src/characterRows.jsx'

afterEach(() => cleanup())

// `url` is the identity function: what is being tested is what happens to the
// element, not how an address is built.
const draw = (props) => render(<Face url={(x) => x} {...props} />).container
const img = (c) => c.querySelector('img')
const glyph = (c) => c.querySelector('svg')

describe('a face whose picture fails to arrive', () => {
  it('draws the person glyph instead of the browser’s broken-image mark', () => {
    const c = draw({ src: 'gone.jpg', name: 'Delia Surridge' })
    expect(img(c), 'no picture was attempted at all').toBeTruthy()
    expect(glyph(c), 'a stand-in was drawn before anything had failed').toBeNull()
    fireEvent.error(img(c))
    expect(img(c), 'the failed picture is still on the screen, torn mark and all').toBeNull()
    expect(glyph(c), 'nothing replaced the failed picture').toBeTruthy()
  })

  it('and the SAME glyph a row with no picture at all draws', () => {
    // The owner's own words: "a random person glyph, as used in the actual delia
    // sturridge character page". Not any stand-in — the one that record already
    // wears everywhere else, which is hashed from the name so it is stable.
    const none = draw({ src: '', name: 'Delia Surridge' })
    const broke = draw({ src: 'gone.jpg', name: 'Delia Surridge' })
    fireEvent.error(img(broke))
    expect(glyph(broke).innerHTML, 'a broken picture wears a different face from an absent one')
      .toBe(glyph(none).innerHTML)
  })

  it('and is drawn the way a row with no picture is drawn', () => {
    // THE PLATE IS KEYED ON WHAT IS ON THE SCREEN, not on what is stored. Three
    // stylesheets give the stand-in its grey plate, its padding and its colour
    // through `is-empty`, and every one of them was set from the presence of a
    // path — so a broken picture drew an unstyled glyph in a row of styled ones.
    const c = draw({ src: 'gone.jpg', name: 'Delia Surridge', className: 'cast-face' })
    expect(c.firstChild.className, 'the plate is drawn under a picture that is arriving')
      .not.toContain('is-empty')
    fireEvent.error(img(c))
    expect(c.firstChild.className, 'the stand-in is drawn without the plate every other one has')
      .toContain('is-empty')
  })

  it('and the character page the owner named draws it too', () => {
    // NOT A TEST OF `Face` BUT OF THE SITE. `Face` having the fallback says
    // nothing about whether a screen CALLS it — reverting three converted sites
    // once left the whole suite green but for one assertion about a class name.
    // This is the screen the owner named as the model: "as used in the actual
    // delia sturridge character page".
    const { container } = render(<PortraitBlock src="gone.jpg" name="Delia Surridge" px="" from="" actions={null} />)
    const shot = container.querySelector('img')
    expect(shot, 'the portrait block drew no picture at all').toBeTruthy()
    fireEvent.error(shot)
    expect(container.querySelector('img'), 'the failed portrait is still on the screen').toBeNull()
    expect(container.querySelector('svg'), 'nothing stood in for the failed portrait').toBeTruthy()
  })

  it('and a replacement picture gets its own chance', () => {
    // The flag must not outlive the address it was set for: a row that failed
    // once would keep the glyph after the reader uploaded a new photograph,
    // because React reuses the component.
    const { container, rerender } = render(<Face url={(x) => x} src="gone.jpg" name="Delia" />)
    fireEvent.error(container.querySelector('img'))
    expect(container.querySelector('svg'), 'the failure did not take').toBeTruthy()
    rerender(<Face url={(x) => x} src="new.jpg" name="Delia" />)
    expect(container.querySelector('img'), 'a replaced picture stayed hidden behind the old failure')
      .toBeTruthy()
  })
})
