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
// `test/rules/scroll-containment.test.js` sweeps for that; what is checked here is
// that each overlay actually WEARS the class carrying it.
//
// WHY IT IS WORTH A TEST NOW. Nine files wrote the same class list and the same
// four-line handler out in full. Both are shared, and a shared thing that nothing
// presses is a shared thing that can be wrong in nine places at once instead of
// one.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FormModal, SCRIM, backdropClose } from '../../src/ui.jsx'

afterEach(() => cleanup())

// The overlay element itself: the outermost thing wearing the scrim class.
const scrim = () => document.querySelector('.tp-scrim')

describe('the shared handler', () => {

  it('and not on one that started inside the dialog', () => {
    const onClose = vi.fn()
    const card = document.createElement('div')
    const back = document.createElement('div')
    backdropClose(onClose)({ target: card, currentTarget: back })
    expect(onClose, 'a press inside the dialog dismissed it').not.toHaveBeenCalled()
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

})
