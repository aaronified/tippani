// The gesture: right-click and long-press on a card, and what they must NOT do.
//
// Almost every case here is a bail-out, and that is the shape of the feature. The
// menu itself is three lines of wiring; what takes care is the four situations
// where opening it would be wrong:
//
//   - on the card's own buttons, where the long press already means "show me this
//     glyph's label" and a right-click means nothing;
//   - over a text selection, where the browser's own menu has Copy, Look Up,
//     Translate and Search With and ours has none of them;
//   - after a drag, because a press that moved is a scroll;
//   - and the trailing click, which would otherwise open the quote you were
//     long-pressing the moment you let go.
//
// The first two are the ones a person would find and file as a bug. The last two
// are the ones they would feel and never be able to describe.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { Tooltip, useCardMenu } from '../../src/ui.jsx'

const ITEMS = (onClick = vi.fn()) => [
  { id: 'edit', label: 'Edit', onClick },
  { id: 'delete', label: 'Delete', onClick, danger: true },
]

// A card that looks like the app's: a quote, and one of its own tooltip'd buttons.
function Card({ items = ITEMS(), onOpen = () => {} }) {
  const { cardProps, menuClass, menu } = useCardMenu(items)
  return (
    <>
      <div {...cardProps} className={menuClass} onClick={onOpen} data-testid="card">
        <p>The margins are where the reader answers back.</p>
        <Tooltip label="Share this quote">
          <button type="button" aria-label="Share">
            s
          </button>
        </Tooltip>
      </div>
      {menu}
    </>
  )
}

const card = () => screen.getByTestId('card')
const menu = () => screen.queryByRole('menu')

// A touch press, with the timer wound forward by hand.
const press = (target, { x = 50, y = 50 } = {}) => {
  fireEvent.pointerDown(target, { pointerType: 'touch', clientX: x, clientY: y })
}
const wait = async (ms = 500) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

describe('right-click on a card', () => {
  it('opens the menu at the pointer', async () => {
    render(<Card />)
    fireEvent.contextMenu(card(), { clientX: 120, clientY: 90 })
    expect(await screen.findByRole('menu')).toBeTruthy()
    expect(screen.getByText('Edit')).toBeTruthy()
  })

  it('leaves the browser’s own menu alone on the card’s buttons', () => {
    // Right-clicking the share glyph should do nothing — not offer to delete the
    // quote. Tooltip already suppresses contextmenu on every control it wraps,
    // which is why that line is now load-bearing twice.
    render(<Card />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Share' }), { clientX: 10, clientY: 10 })
    expect(menu()).toBeNull()
  })

  it('stands aside when text inside the card is selected', () => {
    // THE ONE THAT MATTERS MOST. Somebody who dragged across a quote and
    // right-clicked wants Copy — and Look Up, and Translate. Taking the browser's
    // menu away from them in a note-keeping app is worse than having no menu.
    render(<Card />)
    const text = screen.getByText(/The margins are where/)
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      anchorNode: text.firstChild,
    })
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    card().dispatchEvent(e)
    expect(menu()).toBeNull()
    // And it did NOT preventDefault, which is what lets the native menu appear.
    expect(e.defaultPrevented).toBe(false)
    window.getSelection.mockRestore()
  })

  it('opens over a selection that is somewhere else entirely', () => {
    // A selection in another card, or in the search box, is not this card's
    // business — so the bail-out is scoped to a selection INSIDE this card.
    render(<Card />)
    const outside = document.createElement('p')
    outside.textContent = 'elsewhere'
    document.body.appendChild(outside)
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      anchorNode: outside.firstChild,
    })
    fireEvent.contextMenu(card(), { clientX: 20, clientY: 20 })
    expect(menu()).not.toBeNull()
    window.getSelection.mockRestore()
  })
})

describe('long-press on a card', () => {
  it('opens the menu after the hold', async () => {
    vi.useFakeTimers()
    render(<Card />)
    press(card())
    await wait()
    expect(menu()).not.toBeNull()
    vi.useRealTimers()
  })

  it('does nothing on the card’s own buttons, where the hold means a label', async () => {
    // The interaction the whole gesture design exists to protect. Bound to the
    // card INCLUDING its buttons, every press on a glyph would race a tooltip
    // against a menu, and the winner would depend on event order.
    vi.useFakeTimers()
    render(<Card />)
    press(screen.getByRole('button', { name: 'Share' }))
    await wait()
    expect(menu()).toBeNull()
    vi.useRealTimers()
  })

  it('is cancelled by a drag, because a press that moved is a scroll', async () => {
    vi.useFakeTimers()
    render(<Card />)
    press(card(), { x: 50, y: 50 })
    fireEvent.pointerMove(card(), { clientX: 50, clientY: 90 }) // past LONG_PRESS_SLOP
    await wait()
    expect(menu()).toBeNull()
    vi.useRealTimers()
  })

  it('survives a wobble smaller than the slop', async () => {
    // The complement: a thumb never holds perfectly still, and a gesture cancelled
    // by three pixels of drift is a gesture that "does not work".
    vi.useFakeTimers()
    render(<Card />)
    press(card(), { x: 50, y: 50 })
    fireEvent.pointerMove(card(), { clientX: 53, clientY: 52 })
    await wait()
    expect(menu()).not.toBeNull()
    vi.useRealTimers()
  })

  it('eats the click that trails the press', async () => {
    // Otherwise letting go opens the quote you were long-pressing, behind the menu
    // you just asked for.
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<Card onOpen={onOpen} />)
    press(card())
    await wait()
    fireEvent.pointerUp(card())
    fireEvent.click(card())
    expect(onOpen).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('lets an ordinary tap through', async () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<Card onOpen={onOpen} />)
    press(card())
    await wait(120) // let go long before the hold fires
    fireEvent.pointerUp(card())
    fireEvent.click(card())
    expect(onOpen).toHaveBeenCalled()
    expect(menu()).toBeNull()
    vi.useRealTimers()
  })
})

describe('the keyboard', () => {
  it('opens on Shift+F10', async () => {
    render(<Card />)
    fireEvent.keyDown(card(), { key: 'F10', shiftKey: true })
    expect(await screen.findByRole('menu')).toBeTruthy()
  })

  it('opens on the Menu key', async () => {
    render(<Card />)
    fireEvent.keyDown(card(), { key: 'ContextMenu' })
    expect(await screen.findByRole('menu')).toBeTruthy()
  })

  it('ignores F10 without shift', () => {
    render(<Card />)
    fireEvent.keyDown(card(), { key: 'F10' })
    expect(menu()).toBeNull()
  })
})

describe('a card with no actions', () => {
  it('wires nothing at all', () => {
    // A read-only surface passes an empty list, and an empty menu that opens on a
    // gesture is worse than no gesture: it teaches the gesture and then refuses it.
    render(<Card items={[]} />)
    fireEvent.contextMenu(card(), { clientX: 10, clientY: 10 })
    expect(menu()).toBeNull()
  })
})
