// PRESSING THE DARKNESS AROUND A DIALOG CLOSES IT. PRESSING THE DIALOG DOES NOT.
//
// THE RULE. Every overlay in this app sits on a full-viewport scrim, and the
// scrim is a way out: a press that lands on it dismisses the thing it is behind.
// A press that lands on the dialog — or one that STARTS on the dialog and drifts
// onto the scrim, which is what selecting a line of text looks like — must not.
// That second half is the whole reason the check is `e.target === e.currentTarget`
// and not "did this press land inside the scrim's box".
//
// AND THE SCRIM CONTAINS ITS OWN SCROLL. `.tp-scrim` carries
// `overscroll-behavior: contain`, so a wheel that runs past the end of a dialog
// stops there instead of moving the page behind it — the page you cannot see,
// moving under the thing you are reading, and still moved when you close it.
// `test/pure/scroll-containment.test.js` sweeps for that; what is checked here is
// that each overlay actually WEARS the class carrying it.
//
// WHY IT IS WORTH A TEST NOW. Nine files wrote the same class list and the same
// four-line handler out in full. Both are shared, and a shared thing that nothing
// presses is a shared thing that can be wrong in nine places at once instead of
// one.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfirmDialog, FormModal, HelpSheet, SCRIM, SCRIM_CENTERED, backdropClose } from '../../src/ui.jsx'

afterEach(() => cleanup())

// The overlay element itself: the outermost thing wearing the scrim class.
const scrim = () => document.querySelector('.tp-scrim')

describe('the shared handler', () => {
  it('closes on a press that lands on the backdrop', () => {
    const onClose = vi.fn()
    const el = document.createElement('div')
    backdropClose(onClose)({ target: el, currentTarget: el })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('and not on one that started inside the dialog', () => {
    const onClose = vi.fn()
    const card = document.createElement('div')
    const back = document.createElement('div')
    backdropClose(onClose)({ target: card, currentTarget: back })
    expect(onClose, 'a press inside the dialog dismissed it').not.toHaveBeenCalled()
  })

  it('and holds off while the caller says to', () => {
    const onClose = vi.fn()
    const el = document.createElement('div')
    backdropClose(onClose, false)({ target: el, currentTarget: el })
    expect(onClose, 'a dialog mid-save was dismissed out from under the request').not.toHaveBeenCalled()
  })

  it('survives a caller with nothing to call', () => {
    const el = document.createElement('div')
    expect(() => backdropClose(undefined)({ target: el, currentTarget: el })).not.toThrow()
  })
})

describe('the class every overlay wears', () => {
  it('names the one thing that stops the scroll chaining', () => {
    // Not the whole string: what matters is that `.tp-scrim` is on it, because
    // that is the class the stylesheet gives `overscroll-behavior`.
    for (const [name, cls] of [['SCRIM', SCRIM], ['SCRIM_CENTERED', SCRIM_CENTERED]]) {
      expect(cls.split(/\s+/), `${name} does not wear .tp-scrim`).toContain('tp-scrim')
      expect(cls, `${name} is not a scroll container, so a tall dialog is unreachable`)
        .toMatch(/overflow-y-auto/)
    }
  })

  it('and the centred form only adds the centring', () => {
    expect(SCRIM_CENTERED.startsWith(SCRIM),
      'the two scrims have drifted apart — one can now lose a rule the other keeps').toBe(true)
  })
})

describe('a dialog on that scrim', () => {
  it('closes when the darkness around it is pressed', () => {
    const onClose = vi.fn()
    render(<FormModal open title="Edit" onClose={onClose}><p>body</p></FormModal>)
    const back = scrim()
    expect(back, 'the dialog draws no scrim at all').toBeTruthy()
    fireEvent.mouseDown(back)
    expect(onClose, 'pressing the backdrop did not close the dialog').toHaveBeenCalled()
  })

  it('stays open when its own body is pressed', () => {
    const onClose = vi.fn()
    render(<FormModal open title="Edit" onClose={onClose}><p>body</p></FormModal>)
    fireEvent.mouseDown(screen.getByText('body'))
    expect(onClose, 'pressing the dialog closed the dialog').not.toHaveBeenCalled()
  })

  it('is the same bargain on a help sheet', () => {
    const onClose = vi.fn()
    render(<HelpSheet open title="What this is" onClose={onClose}><p>prose</p></HelpSheet>)
    const back = scrim()
    if (!back) return // a phone draws a MobileSheet instead; mobile-sheet tests own that
    fireEvent.mouseDown(screen.getByText('prose'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(back)
    expect(onClose, 'a help sheet cannot be dismissed by pressing around it').toHaveBeenCalled()
  })

  it('and on a question box, which is the one that is centred rather than scrolled', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open title="Delete?" body="gone for good" confirmLabel="Yes" onConfirm={() => {}} onCancel={onCancel} />)
    const back = scrim()
    expect(back).toBeTruthy()
    fireEvent.mouseDown(screen.getByText('gone for good'))
    expect(onCancel, 'pressing the question dismissed it as a "no"').not.toHaveBeenCalled()
    fireEvent.mouseDown(back)
    expect(onCancel).toHaveBeenCalled()
  })
})
