// THE HERO PORTRAIT OPENS FULL SCREEN.
//
// THE SPECIFICATION, which is the owner's own report and not a prototype line:
// "the people/detail screen hero picture (the one at the top) should be clickable
// and show the picture in full screen (this behaviour was there in the old picture
// screen)." The last clause is the important half — it is a REGRESSION. The old
// picture screen had a viewer; three sheets lost it when they moved onto a shared
// portrait block, and the block is where it has to live so a fourth cannot lose it
// again ("similar things should act similarly", the repo's own directive).
//
// FIVE THINGS ARE TESTABLE WITHOUT KNOWING HOW ANY OF IT IS WRITTEN:
//
//   THE PICTURE CARRIES A CONTROL. One, over the picture itself and not off to the
//   side, because "clickable" means the reader presses the thing they are looking
//   at.
//
//   PRESSING IT OPENS A FULL-SCREEN VIEW OF THAT PICTURE. Of *that* picture: the
//   block is handed an address that is already resolved, and a viewer that rebuilt
//   one from a stored path would show a different image — or none — for every
//   caller that does not store paths.
//
//   IT CLOSES. An overlay with no way out is worse than no overlay.
//
//   A HERO WITH NO PICTURE HAS NOTHING TO PRESS. A silhouette means "a person,
//   unphotographed"; a press on it would open a viewer onto nothing, and the
//   repo's standing bar is that every control does something.
//
//   AND NEITHER HAS ONE WHOSE PICTURE DID NOT ARRIVE, in one event. A stored path
//   is not a picture. The "in one event" is the part worth stating: a picture that
//   fails, retires the control, and then quietly asks the server for the same
//   missing file a second time has not settled — it has bounced.
//
// WHAT A TEST WRITER NEEDS: those five paragraphs. Nothing about which state hook
// holds the viewer open or what the control is called in the source.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

const { PortraitBlock } = await import('../../src/characterRows.jsx')

const PIC = 'https://example.test/adama.jpg'

// The hero is the one picture at the top of the sheet.
const hero = () => document.querySelector('.cs-portrait img')
// Its control is whatever labelled thing the reader's press lands on, found by
// where it is rather than by what it is called: inside the picture's own box.
const zoom = () => hero()?.closest('span')?.parentElement?.querySelector('button')
    || document.querySelector('.cs-portrait button')
// A full-screen view is a modal dialog over the whole screen — the app's own
// viewer announces itself as one, and that is the only property worth matching.
const viewer = () => document.querySelector('[role="dialog"][aria-modal="true"]')

afterEach(() => cleanup())

describe('the hero portrait', () => {
  it('opens the picture full screen when it is pressed', () => {
    render(<PortraitBlock src={PIC} name="William Adama" />)
    expect(viewer(), 'a viewer was up before anything was pressed').toBeNull()
    fireEvent.click(zoom())
    const up = viewer()
    expect(up, 'the hero pressed and nothing opened').toBeTruthy()
    // THE SAME PICTURE, not one rebuilt from a path. An address the block was
    // handed whole must survive to the viewer unchanged; anything else is a
    // second picture, or none.
    const shown = [...up.querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(shown, `the viewer is showing ${shown} and not the hero's own picture`).toContain(PIC)
  })

})
