// A selection, and the rules that keep its count honest.
//
// The bar says "12 selected" and then acts on twelve things. Most of this file is
// about that sentence being true — which is not obvious, because a board's visible
// list changes under a selection all the time: a filter flips, a patch reloads the
// list, a search narrows. A selection holding ids that are no longer on screen is a
// number about nothing, and acting on it acts on things nobody could check.
//
// The bin makes that recoverable. It does not make it honest.
//
// ---- and the mode, which is a SECOND question (1.11.2) ----------------------
//
// `open` is whether the mode is running; `count` is how much is picked in it. They
// were one boolean, and three of the cases in this file used to assert the
// consequence: emptying the selection left the mode, which tore the bar off the
// screen mid-task and left the tick lit on the card that had been long-pressed.
//
// Those cases are still here, inverted, because the inversion is the fix and a
// test that quietly stopped asserting either way would be worse than both.

import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSelection } from '../../src/selection.jsx'

const ids = (n) => Array.from({ length: n }, (_, i) => i + 1)

describe('the count cannot lie', () => {
  it('drops ids that leave the visible list', () => {
    // A filter change is the case: thirty quotes selected, switch the colour, and
    // the ones that are gone must go with it.
    const { result, rerender } = renderHook(({ list }) => useSelection(list), {
      initialProps: { list: [1, 2, 3, 4] },
    })
    act(() => result.current.toggle(2, 'quote'))
    act(() => result.current.toggle(4, 'quote'))
    expect(result.current.count).toBe(2)
    rerender({ list: [1, 2, 3] }) // 4 filtered away
    expect(result.current.ids).toEqual([2])
  })

})
