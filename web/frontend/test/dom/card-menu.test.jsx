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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

// ---- where the press lands (1.11.1) ----------------------------------------
//
// The plan this feature came from said "long-press always means menu, with no
// exceptions". That cost the thumb the only gesture a phone has for reaching into
// text: with the callout suppressed and a menu on the hold, you could not select
// half a sentence out of a quote in a note-keeping app. And it spent the gesture
// every photo grid and file manager uses for multiselect on a menu that already
// had a ⋯ button two inches away.
//
// So the press now splits by where it lands, and these are the three landings.

// A card on a board that can select: the quote is marked .card-text, and the rest
// of the card is not.
function SelectableCard({ onLongPress = vi.fn(), items = ITEMS(), onOpen = () => {} }) {
  const { cardProps, menuClass, menu } = useCardMenu(items, { onLongPress })
  return (
    <>
      <div
        {...cardProps}
        className={menuClass}
        data-testid="card"
        onClickCapture={(e) => {
          if (cardProps.onClickCapture?.(e)) return
          onOpen(e)
        }}
      >
        <p className="card-text">The margins are where the reader answers back.</p>
        <p data-testid="meta">CH. 4 · P.112</p>
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

describe('a long press on a board that can select', () => {
  it('selects the card when it lands on whitespace', async () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    render(<SelectableCard onLongPress={onLongPress} />)
    press(screen.getByTestId('meta'))
    await wait()
    expect(onLongPress).toHaveBeenCalled()
    // And NOT the menu — two things happening on one gesture is the failure this
    // whole split exists to avoid.
    expect(menu()).toBeNull()
    vi.useRealTimers()
  })

  it('leaves the quote itself to the browser', async () => {
    // THE ONE THE FEATURE IS FOR. A hold over the words must raise the platform's
    // own selection handles, which means this hook does nothing at all: no
    // preventDefault, no selection, no menu.
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    render(<SelectableCard onLongPress={onLongPress} />)
    press(screen.getByText(/The margins are where/))
    await wait()
    expect(onLongPress).not.toHaveBeenCalled()
    expect(menu()).toBeNull()
    vi.useRealTimers()
  })

  it('still leaves the card’s own buttons to their tooltips', async () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    render(<SelectableCard onLongPress={onLongPress} />)
    press(screen.getByRole('button', { name: 'Share' }))
    await wait()
    expect(onLongPress).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('is still cancelled by a drag', async () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    render(<SelectableCard onLongPress={onLongPress} />)
    press(screen.getByTestId('meta'), { x: 50, y: 50 })
    fireEvent.pointerMove(card(), { clientX: 50, clientY: 90 })
    await wait()
    expect(onLongPress).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('eats the trailing click, so the press does not immediately undo itself', async () => {
    // Without this the hold selects and the click that follows deselects, and the
    // gesture reads as doing nothing whatsoever.
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    const onOpen = vi.fn()
    render(<SelectableCard onLongPress={onLongPress} onOpen={onOpen} />)
    press(screen.getByTestId('meta'))
    await wait()
    fireEvent.pointerUp(card())
    fireEvent.click(card())
    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('lets an ordinary tap through to the card', async () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<SelectableCard onOpen={onOpen} />)
    press(screen.getByTestId('meta'))
    await wait(120)
    fireEvent.pointerUp(card())
    fireEvent.click(card())
    expect(onOpen).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('keeps the menu on right-click and Shift+F10', async () => {
    // The menu did not go away; it lost ONE of its three triggers, and the two it
    // keeps are the two a pointer and a keyboard use.
    render(<SelectableCard />)
    fireEvent.contextMenu(screen.getByTestId('meta'), { clientX: 30, clientY: 30 })
    expect(await screen.findByRole('menu')).toBeTruthy()
    fireEvent.keyDown(card(), { key: 'Escape' })
    fireEvent.keyDown(card(), { key: 'F10', shiftKey: true })
    expect(await screen.findByRole('menu')).toBeTruthy()
  })
})

// ---- the highlight the press used to leave behind (1.11.2) -------------------
//
// The 500ms hold means two things to two systems and both are right: to this hook
// it is the gesture, to the browser it is the start of a text selection. So a
// press on a card's whitespace fired correctly AND came up with a stray word
// highlighted under the menu. Nothing was broken and it looked broken.
//
// Two mechanisms, because they fail on opposite hardware. The stylesheet takes
// `user-select` away behind `(hover: none) and (pointer: coarse)`, which stops the
// highlight ever being drawn on a phone or tablet; the hook drops any range that
// exists at the moment the press fires, which is what covers a hybrid laptop
// (`hover: hover`, so the CSS never applies) and any browser that latches a word
// before the timer.
//
// The bail-outs are asserted harder than the action, as everywhere else in this
// file: a clear that runs on a tap or on a press over the quote would be eating a
// selection somebody made deliberately, which is a worse bug than the one being
// fixed.

// withSelection installs a non-collapsed selection and hands back the spy that
// says whether it was cleared. anchorNode is inside the card, which is what the
// contextmenu bail-out reads — the same fake serves both.
function withSelection(node) {
  const removeAllRanges = vi.fn()
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false,
    rangeCount: 1,
    anchorNode: node ?? document.body,
    removeAllRanges,
  })
  return removeAllRanges
}

describe('a long press does not leave a text selection behind it', () => {
  afterEach(() => {
    window.getSelection.mockRestore?.()
    vi.useRealTimers()
  })

  it('drops the range when the press opens the menu', async () => {
    vi.useFakeTimers()
    render(<Card />)
    const cleared = withSelection(card())
    press(card())
    await wait()
    expect(menu()).not.toBeNull()
    expect(cleared).toHaveBeenCalled()
  })

  it('drops it when the press selects the card instead', async () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    render(<SelectableCard onLongPress={onLongPress} />)
    const cleared = withSelection(screen.getByTestId('meta'))
    press(screen.getByTestId('meta'))
    await wait()
    expect(onLongPress).toHaveBeenCalled()
    expect(cleared).toHaveBeenCalled()
  })

  it('leaves a selection alone when the press lands on the quote', async () => {
    // The press does not even arm a timer there, so there is nothing to clear —
    // and this is the case where a clear would destroy the very thing the split
    // was built to allow.
    vi.useFakeTimers()
    render(<SelectableCard />)
    const text = screen.getByText(/The margins are where/)
    const cleared = withSelection(text)
    press(text)
    await wait()
    expect(cleared).not.toHaveBeenCalled()
  })

  it('leaves it alone on an ordinary tap', async () => {
    vi.useFakeTimers()
    render(<SelectableCard />)
    const cleared = withSelection(screen.getByTestId('meta'))
    press(screen.getByTestId('meta'))
    await wait(120) // let go before the hold fires
    fireEvent.pointerUp(card())
    expect(cleared).not.toHaveBeenCalled()
  })

  it('leaves it alone after a drag, because the press was a scroll', async () => {
    vi.useFakeTimers()
    render(<SelectableCard />)
    const cleared = withSelection(screen.getByTestId('meta'))
    press(screen.getByTestId('meta'), { x: 50, y: 50 })
    fireEvent.pointerMove(card(), { clientX: 50, clientY: 90 })
    await wait()
    expect(cleared).not.toHaveBeenCalled()
  })

  it('leaves it alone on a right-click, where it is the reason we stand aside', async () => {
    // Somebody who dragged across a quote and right-clicked wants Copy. Clearing
    // their selection on the way to declining the menu would be the worst of both.
    render(<Card />)
    const cleared = withSelection(card())
    fireEvent.contextMenu(card(), { clientX: 10, clientY: 10 })
    expect(menu()).toBeNull()
    expect(cleared).not.toHaveBeenCalled()
  })
})

describe('the stylesheet half of the same rule', () => {
  const css = readFileSync(join(process.env.TIPPANI_SRC, 'index.css'), 'utf8')

  it('takes user-select off the card body behind a pointer query', () => {
    // Gated on the POINTER, not the width: a tablet at 900px has the gesture and
    // a narrow desktop window does not, so `max-width` is the wrong question —
    // and the answer must not change when somebody drags a window.
    const block = css.match(/@media \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?\n {2}\}/g) || []
    const host = block.find((b) => b.includes('.card-menu-host'))
    expect(host, 'no pointer-gated .card-menu-host block').toBeTruthy()
    expect(host).toMatch(/user-select:\s*none/)
    // Not behind a width query, which is the mistake this replaces.
    expect(css).not.toMatch(/@media \(max-width[^)]*\)\s*\{[^@]*\.card-menu-host\s*\{[^}]*user-select:\s*none/)
  })

  it('keeps the quote itself selectable, at a specificity that wins', () => {
    // `.card-menu-host .card-text` is two classes to the host rule's one, so it
    // wins wherever it sits in the file — but only while it is still there.
    expect(css).toMatch(/\.card-menu-host \.card-text \{[^}]*user-select:\s*text/)
  })
})
