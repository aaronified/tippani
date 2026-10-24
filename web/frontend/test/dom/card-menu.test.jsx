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
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
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

  it('is cancelled by a drag, because a press that moved is a scroll', async () => {
    vi.useFakeTimers()
    render(<Card />)
    press(card(), { x: 50, y: 50 })
    fireEvent.pointerMove(card(), { clientX: 50, clientY: 90 }) // past LONG_PRESS_SLOP
    await wait()
    expect(menu()).toBeNull()
    vi.useRealTimers()
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

