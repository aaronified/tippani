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
import { selectionClick, useSelection } from '../../src/selection.jsx'

const ids = (n) => Array.from({ length: n }, (_, i) => i + 1)

describe('picking things', () => {
  it('starts empty and outside the mode', () => {
    const { result } = renderHook(() => useSelection(ids(5)))
    expect(result.current.count).toBe(0)
    expect(result.current.open).toBe(false)
    expect(result.current.active).toBe(false)
    expect(result.current.any).toBe(false)
    expect(result.current.kind).toBeNull()
  })

  it('toggles one on and off, and stays in the mode with nothing picked', () => {
    const { result } = renderHook(() => useSelection(ids(5)))
    act(() => result.current.toggle(2, 'annotation'))
    expect(result.current.ids).toEqual([2])
    expect(result.current.kind).toBe('annotation')
    expect(result.current.isSelected(2)).toBe(true)
    expect(result.current.open).toBe(true)
    act(() => result.current.toggle(2, 'annotation'))
    expect(result.current.count).toBe(0)
    // THE INVERSION. Clicking the last one off used to leave the mode, which took
    // the bar with it — so "these are the wrong four" cost a fresh long press. The
    // mode now ends when you say so, and only then.
    expect(result.current.open).toBe(true)
    expect(result.current.any).toBe(false)
    // And the kind is KEPT, which is what lets the bar hold its shape at zero: an
    // empty selection with kind null would render the quote actions over books,
    // because isWorkKind(null) is false.
    expect(result.current.kind).toBe('annotation')
  })

  it('extends over the VISIBLE order, not the numeric one', () => {
    // The board's `shown` array is the order on screen — sorted, filtered, dealt
    // into columns. Extending over ids would select things between two rows that
    // are not between them on screen.
    const { result } = renderHook(() => useSelection([5, 3, 1, 4, 2]))
    act(() => result.current.toggle(3, 'quote'))
    act(() => result.current.extendTo(4, 'quote'))
    expect(result.current.ids.sort()).toEqual([1, 3, 4])
  })

  it('extends backwards too', () => {
    const { result } = renderHook(() => useSelection([1, 2, 3, 4, 5]))
    act(() => result.current.toggle(4, 'quote'))
    act(() => result.current.extendTo(2, 'quote'))
    expect(result.current.ids.sort()).toEqual([2, 3, 4])
  })

  it('treats a shift-click with nothing selected as an ordinary click', () => {
    const { result } = renderHook(() => useSelection(ids(5)))
    act(() => result.current.extendTo(3, 'quote'))
    expect(result.current.ids).toEqual([3])
  })

  it('selects everything visible, and only that', () => {
    const { result } = renderHook(() => useSelection([7, 8, 9]))
    act(() => result.current.selectAll('book'))
    expect(result.current.ids.sort()).toEqual([7, 8, 9])
    expect(result.current.kind).toBe('book')
  })
})

describe('one kind at a time', () => {
  it('replaces the selection when a different kind is picked', () => {
    // Search shows books and quotes in one view, and a selection spanning both has
    // no coherent action: you cannot set a series on a quote. So the second kind
    // wins outright rather than joining.
    const { result } = renderHook(() => useSelection(ids(9)))
    act(() => result.current.toggle(1, 'book'))
    act(() => result.current.toggle(2, 'book'))
    expect(result.current.count).toBe(2)
    act(() => result.current.toggle(5, 'quote'))
    expect(result.current.ids).toEqual([5])
    expect(result.current.kind).toBe('quote')
  })
})

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

  it('keeps the selection through a plain reload of the same list', () => {
    // The commonest "change": a board refetching itself after a patch. Clearing the
    // whole selection there would make bulk editing impossible — every action
    // reloads, so every action would wipe the selection it just used.
    const { result, rerender } = renderHook(({ list }) => useSelection(list), {
      initialProps: { list: [1, 2, 3] },
    })
    act(() => result.current.toggle(1, 'quote'))
    act(() => result.current.toggle(3, 'quote'))
    rerender({ list: [1, 2, 3] }) // same ids, new array
    expect(result.current.ids.sort()).toEqual([1, 3])
  })

  it('empties, but does not leave the mode, when the last visible id goes away', () => {
    // The count still cannot lie — that rule is untouched, and it is the whole
    // reason the id is dropped. What changed is that emptying the selection no
    // longer tears the controls off the screen: the bar holds, reading "no quotes
    // selected" with every action disabled, and the way out is still one tap.
    const { result, rerender } = renderHook(({ list }) => useSelection(list), {
      initialProps: { list: [1, 2] },
    })
    act(() => result.current.toggle(2, 'quote'))
    rerender({ list: [1] })
    expect(result.current.count).toBe(0)
    expect(result.current.open).toBe(true)
    expect(result.current.any).toBe(false)
    expect(result.current.kind).toBe('quote')
  })
})

describe('leaving the mode', () => {
  it('dismiss ends it, and takes the kind with it', () => {
    const { result } = renderHook(() => useSelection(ids(4)))
    act(() => result.current.selectAll('book'))
    act(() => result.current.dismiss())
    expect(result.current.count).toBe(0)
    expect(result.current.open).toBe(false)
    expect(result.current.kind).toBeNull()
  })

  it('deselectAll empties it and leaves it standing', () => {
    // The distinction the two right-hand controls on the bar are: one is "these
    // are the wrong four", the other is "I am done selecting".
    const { result } = renderHook(() => useSelection(ids(4)))
    act(() => result.current.selectAll('book'))
    act(() => result.current.deselectAll())
    expect(result.current.count).toBe(0)
    expect(result.current.open).toBe(true)
    expect(result.current.kind).toBe('book')
  })

  it('clear is dismiss, because that is what the boards mean by it', () => {
    // Every board calls selection.clear() after a bulk action lands, and the thing
    // forty books were selected for is done — so it must end the mode, not leave an
    // empty bar over a list that just reloaded.
    const { result } = renderHook(() => useSelection(ids(4)))
    act(() => result.current.selectAll('book'))
    act(() => result.current.clear())
    expect(result.current.open).toBe(false)
    expect(result.current.kind).toBeNull()
  })

  it('re-enters cleanly, with a different kind if that is what was picked', () => {
    const { result } = renderHook(() => useSelection(ids(4)))
    act(() => result.current.toggle(1, 'book'))
    act(() => result.current.dismiss())
    act(() => result.current.toggle(2, 'quote'))
    expect(result.current.open).toBe(true)
    expect(result.current.kind).toBe('quote')
    expect(result.current.ids).toEqual([2])
  })

  it('still replaces the selection when a second kind is picked mid-mode', () => {
    // ONE KIND AT A TIME, and this is the rule the removed kind-reset effect was
    // never what enforced: toggle has always handled the mismatch itself.
    const { result } = renderHook(() => useSelection(ids(4)))
    act(() => result.current.toggle(1, 'book'))
    act(() => result.current.toggle(2, 'quote'))
    expect(result.current.kind).toBe('quote')
    expect(result.current.ids).toEqual([2])
  })
})

describe('what a click means', () => {
  it('opens the thing until the mode is entered, then toggles', () => {
    // `active` is the MODE now, so a plain click keeps toggling while the bar is
    // up even with nothing picked. It has to: the board plainly says it is
    // selecting, and a click that opened a book instead would be the surprise.
    expect(selectionClick({}, { active: false })).toBe('open')
    expect(selectionClick({}, { active: true })).toBe('toggle')
  })

  it('always selects with ctrl or cmd, even with nothing selected yet', () => {
    // The gesture every file manager taught, and the one you can find by accident.
    expect(selectionClick({ ctrlKey: true }, { active: false })).toBe('toggle')
    expect(selectionClick({ metaKey: true }, { active: false })).toBe('toggle')
  })

  it('extends with shift', () => {
    expect(selectionClick({ shiftKey: true }, { active: false })).toBe('extend')
    // Shift wins over ctrl, because a shift-ctrl-click is a range in every file
    // manager too, and guessing the other way would make ranges unreachable for
    // anybody who holds both.
    expect(selectionClick({ shiftKey: true, ctrlKey: true }, { active: true })).toBe('extend')
  })
})
