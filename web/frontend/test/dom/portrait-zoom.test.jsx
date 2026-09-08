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
  it('carries one labelled control, in the picture’s own box', () => {
    render(<PortraitBlock src={PIC} name="William Adama" />)
    const img = hero()
    expect(img, 'the hero drew no picture at all').toBeTruthy()
    const controls = [...document.querySelectorAll('.cs-portrait button')]
    expect(controls.length, `the picture wears ${controls.length} controls`).toBe(1)
    // NOT OFF TO THE SIDE. The picture and its control share a box, which is what
    // makes pressing the picture press the control — the caption column beside it
    // is a sibling of that box and not part of it.
    const box = controls[0].parentElement
    expect(box.contains(img), 'the control is not over the picture it opens').toBe(true)
    // AND IT SAYS WHOSE PICTURE IT OPENS. An unlabelled hit area over a portrait
    // is a control a screen reader cannot announce and `make controls` counts as
    // nameless.
    const name = controls[0].getAttribute('aria-label') || controls[0].textContent
    expect(name, 'the control over the hero has no accessible name').toBeTruthy()
    expect(name, 'the control does not say whose picture it opens').toContain('William Adama')
  })

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

  it('and closes again', () => {
    render(<PortraitBlock src={PIC} name="William Adama" />)
    fireEvent.click(zoom())
    const up = viewer()
    expect(up).toBeTruthy()
    // Whatever the way out is called, there is one: a labelled control inside the
    // overlay that puts it away.
    const outs = [...up.querySelectorAll('button')]
    expect(outs.length, 'the viewer offers no control at all').toBeGreaterThan(0)
    fireEvent.click(outs[0])
    expect(viewer(), 'the viewer stayed up after its own button was pressed').toBeNull()
  })

  it('is not pressable when there is no picture', () => {
    render(<PortraitBlock src="" name="William Adama" />)
    expect(hero(), 'a slot with no picture drew one').toBeNull()
    expect(document.querySelector('.cs-portrait'), 'the block did not render').toBeTruthy()
    expect(
      document.querySelector('.cs-portrait button'),
      'a silhouette wears a control that opens a viewer onto nothing',
    ).toBeNull()
  })

  it('and stops being pressable, once, when the picture does not arrive', () => {
    render(<PortraitBlock src={PIC} name="William Adama" />)
    const img = hero()
    expect(img).toBeTruthy()
    // The browser's own answer to a picture that 403s.
    fireEvent.error(img)
    expect(
      document.querySelector('.cs-portrait button'),
      'a picture that failed left its control behind',
    ).toBeNull()
    // ONE EVENT AND SETTLED. A picture element still in the tree at the same
    // address means the failure was forgotten and the file is about to be asked
    // for again.
    expect(hero(), 'the failed picture is still in the tree, so it will be re-requested').toBeNull()
  })

  it('and takes the viewer down with it if it fails while open', () => {
    render(<PortraitBlock src={PIC} name="William Adama" />)
    fireEvent.click(zoom())
    expect(viewer()).toBeTruthy()
    fireEvent.error(hero())
    expect(viewer(), 'a full-screen overlay of a torn-page mark stayed up').toBeNull()
  })
})

// THE SAME BLOCK ON ALL THREE SHEETS, which is what makes one press above cover
// the three screens the owner named — a character's own record, a character in one
// work, and a person's record. The directive is the repo's: "a control drawn by
// one component on two screens has ONE behaviour, and it lives in one function
// that both screens call — not in a line each, which is how one of them goes on
// being right while the other quietly stops."
describe('every hero portrait in the app', () => {
  it('is drawn by the one block, so none of them can lose the viewer alone', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = process.env.TIPPANI_SRC
    // char-global and people-global share a file; char-local has its own. A fourth
    // hero would have to appear in one of them.
    const sheets = ['identityGlobal.jsx', 'identityLocal.jsx']
      .map((f) => readFileSync(join(src, f), 'utf8'))
      .join('\n')
    expect(sheets.split('<PortraitBlock').length - 1,
      'a sheet stopped drawing its hero with the shared block').toBe(3)
  })
})
