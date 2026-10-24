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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { Face, PortraitBlock } from '../../src/characterRows.jsx'
import { PersonPortrait } from '../../src/credits.jsx'

afterEach(() => cleanup())

// `url` is the identity function: what is being tested is what happens to the
// element, not how an address is built.
const draw = (props) => render(<Face url={(x) => x} {...props} />).container
const img = (c) => c.querySelector('img')
const glyph = (c) => c.querySelector('svg')

describe('a face whose picture fails to arrive', () => {

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
})
