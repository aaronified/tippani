// A selection, and the two rules that keep its count honest.
//
// The bar says "12 selected" and then acts on twelve things. Everything here is
// about that sentence being true — which is not obvious, because a board's visible
// list changes under a selection all the time: a filter flips, a patch reloads the
// list, a search narrows. A selection holding ids that are no longer on screen is a
// number about nothing, and acting on it acts on things nobody could check.
//
// The bin makes that recoverable. It does not make it honest.

import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { selectionClick, useSelection } from '../../src/selection.jsx'

const ids = (n) => Array.from({ length: n }, (_, i) => i + 1)

describe('picking things', () => {
  it('starts empty and inactive', () => {
    const { result } = renderHook(() => useSelection(ids(5)))
    expect(result.current.count).toBe(0)
    expect(result.current.active).toBe(false)
    expect(result.current.kind).toBeNull()
  })

  it('toggles one on and off, and remembers the kind', () => {
    const { result } = renderHook(() => useSelection(ids(5)))
    act(() => result.current.toggle(2, 'annotation'))
    expect(result.current.ids).toEqual([2])
    expect(result.current.kind).toBe('annotation')
    expect(result.current.isSelected(2)).toBe(true)
    act(() => result.current.toggle(2, 'annotation'))
    expect(result.current.count).toBe(0)
    // Clicking the last one off leaves selection mode, which is what makes the mode
    // escapable without a Cancel button.
    expect(result.current.active).toBe(false)
    expect(result.current.kind).toBeNull()
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

  it('leaves selection mode when the last visible id goes away', () => {
    const { result, rerender } = renderHook(({ list }) => useSelection(list), {
      initialProps: { list: [1, 2] },
    })
    act(() => result.current.toggle(2, 'quote'))
    rerender({ list: [1] })
    expect(result.current.count).toBe(0)
    expect(result.current.active).toBe(false)
    expect(result.current.kind).toBeNull()
  })

  it('clears on request', () => {
    const { result } = renderHook(() => useSelection(ids(4)))
    act(() => result.current.selectAll('book'))
    act(() => result.current.clear())
    expect(result.current.count).toBe(0)
    expect(result.current.kind).toBeNull()
  })
})

describe('what a click means', () => {
  it('opens the thing until a selection exists, then toggles', () => {
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
