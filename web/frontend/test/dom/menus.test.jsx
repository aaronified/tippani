import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ActionMenu, Tooltip, useCardMenu } from '../../src/ui.jsx'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WorkCard } from '../../src/works.jsx'
import { actionsFor, bulkActionsFor } from '../../src/actions.jsx'
import { useRef } from 'react'

// The menu, and the keyboard behaviour that makes it one.
//
// A dropdown you can only reach with a pointer is not a menu, and the difference
// is invisible in a screenshot. Everything here is about the half that only a
// keyboard user meets: focus landing inside on open, arrows moving between items,
// Escape putting focus back where it came from, and Tab not walking out of an open
// panel and leaving it floating behind the page.
//
// Point anchoring is the other half. A context menu opens where the pointer was,
// and the reason it goes through the same placement code as an element-anchored one
// is that flipping and clamping are exactly what a menu near an edge needs — a
// second placement path is how one of the two ends up off-screen in a corner
// nobody tested.
describe('action menu', () => {
  const ITEMS = (onClick = vi.fn()) => [
    { id: 'copy', label: 'Copy', onClick },
    { id: 'edit', label: 'Edit', onClick },
    { id: 'delete', label: 'Delete', onClick, danger: true },
  ]

  const items = () => screen.getAllByRole('menuitem')
  const focused = () => document.activeElement?.textContent

  describe('the menu is a menu', () => {
    const open = (over = {}) => {
      const onClose = vi.fn()
      const ret = { current: document.createElement('button') }
      document.body.appendChild(ret.current)
      render(<ActionMenu open items={ITEMS()} at={{ x: 40, y: 40 }} onClose={onClose} returnFocusTo={ret} {...over} />)
      return { onClose, ret }
    }

    it('moves with the arrows, and wraps', async () => {
      open()
      const menu = screen.getByRole('menu')
      await waitFor(() => expect(focused()).toContain('Copy'))
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      expect(focused()).toContain('Edit')
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      expect(focused()).toContain('Delete')
      // Wrapping rather than stopping: a three-item menu where the last arrow-down
      // does nothing feels broken, and every native menu wraps.
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      expect(focused()).toContain('Copy')
      fireEvent.keyDown(menu, { key: 'ArrowUp' })
      expect(focused()).toContain('Delete')
    })

    it('closes on Escape and hands focus back', async () => {
      const { onClose, ret } = open()
      await waitFor(() => expect(focused()).toContain('Copy'))
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalled()
      expect(document.activeElement).toBe(ret.current)
    })

  })
})

// A card's context menu: the page holds still, and the card says it is the one.
//
// TWO FAULTS WITH ONE CAUSE. The menu is placed once, in script, at the point
// the press landed — anchored to a COORDINATE rather than to the card. That is
// the right way to place it, and it means two things nobody decided:
//
//   the page scrolls out from under it, so the menu ends up pinned over some
//   other card while its actions still belong to one now off screen; and
//
//   nothing on screen ever said which card it came from, which over a grid of
//   near-identical covers means pressing "delete" on faith.
//
// Both are asserted here through useCardMenu's own contract rather than through
// any one screen, because every card in the app goes through it.
describe('card menu target', () => {
  function Card({ label }) {
    const { cardProps, menuClass, menu } = useCardMenu([
      { label: 'Delete', onClick: () => {} },
    ])
    return (
      <div {...cardProps} className={'hand-card ' + menuClass} data-testid={label}>
        {label}
        {menu}
      </div>
    )
  }

  const openMenuOn = (label) => {
    const card = screen.getByTestId(label)
    fireEvent.contextMenu(card, { clientX: 40, clientY: 40 })
    return card
  }

  describe('the page under an open card menu', () => {
    // Locked rather than re-anchored on scroll: a menu that chases its card is one
    // you can drag around the screen with the wheel, and it still leaves you
    // acting on something you can no longer see.
    it('does not scroll', () => {
      render(<Card label="a" />)
      expect(document.body.style.overflow).toBe('')
      openMenuOn('a')
      expect(document.body.style.overflow).toBe('hidden')
    })

    // NOT TESTED HERE: that a menu opened over an open sheet leaves the page
    // locked when only the menu closes. That is useBodyScrollLock's refcount
    // rather than anything this change added, and the scenario needs two locks
    // held at once — which Escape, being a global dismiss, takes apart in the same
    // event. Asserting it through this hook would pin a situation I could not
    // actually produce, which is worse than leaving it to the lock's own contract.
  })
})

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
describe('card menu', () => {
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
})

// A work's own context menu (1.14.2).
//
// WHAT WAS EMPTY WAS THE REGISTRY, NOT THE GESTURE. WorkCard passed `[]` to
// useCardMenu with a comment saying a menu offering nothing would teach a
// gesture and then refuse it — true, and a fair reading of the state it was
// written in. The state was that `bulkActionsFor` grew a work branch in 1.11.1
// and `actionsFor` stayed quote-only, so the selection bar could skip a book in
// the quiz, fill its gaps, edit it and delete it with exactly ONE thing
// selected, and the tile that one was selected from could do none of them.
//
// So the assertions that matter here are about the pair, not about the menu: the
// bar and the card read one registry and act through one hook, and anything the
// bar can do to a selection of one is on the card it came from.
describe('work card menu', () => {
  const BOOK = { id: 4, title: 'The Chicago Manual of Style', author: 'UCP', annotation_count: 12 }

  // Right-click is the desktop door; long-press and Shift+F10 are the other two,
  // and all three land in useCardMenu, which has its own tests.
  function openMenu(item = BOOK, props = {}) {
    render(<WorkCard kind="book" item={item} onOpen={() => {}} onChanged={() => {}} {...props} />)
    fireEvent.contextMenu(screen.getByTitle(item.title))
  }


  describe('deleting one work from its cover', () => {
    // A TYPED PHRASE, THE BAR'S OWN, and the dialog still has to say what goes with
    // it — a cover gives no hint that twelve quotes are attached, and the phrase
    // says how many BOOKS are going, never how much is going with them.
    //
    // One test over all three counts rather than three: the gesture and the
    // assertion target (the one dialog's text) are identical per row and only the
    // count and the wording it should produce differ, so the aggregate names EVERY
    // count whose sentence came out wrong at once. cleanup() runs per row so
    // getByRole('dialog') still matches exactly one.

    // THE GUARD, AND THAT IT IS A GUARD RATHER THAN A LABEL. The dialog naming a
    // phrase while accepting the button anyway is the failure worth a test: it
    // reads exactly like a working control and destroys the book on one press.
    //
    // The dialog's own presence is what is asserted, not a delete spy — the tile
    // deletes through useBulkOps rather than through a prop, and reaching in to
    // stub that would test the stub. A dialog that is still open did not delete.
    it('will not delete until the phrase is typed', () => {
      openMenu({ ...BOOK, annotation_count: 12 })
      fireEvent.click(screen.getByText('Delete'))
      const dialog = screen.getByRole('dialog')
      expect(dialog.textContent).toContain('delete 1 book')

      const confirm = within(dialog).getByText('Delete it').closest('button')
      expect(confirm.disabled).toBe(true)
      fireEvent.click(confirm)
      expect(screen.queryByRole('dialog')).not.toBeNull()

      // Case and surrounding space are forgiven — the phrase is a speed bump, not
      // a spelling test, and an autocapitalising phone keyboard would otherwise
      // make it unanswerable.
      fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '  Delete 1 Book ' } })
      expect(confirm.disabled).toBe(false)
      fireEvent.click(confirm)
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    // A dialog dismissed and reopened must ask again. It would not if the typed
    // text outlived the close — the second open would arrive already satisfied,
    // which is a typed guard you only ever have to type once.
    
  })

  // THE FILE THESE QUOTES CAME FROM. The card offers to attach one, a game never does
  // (the owner's: "games have no equivalent"), and a show asks which episode first
  // because a subtitle covers one. What is pressed and what the server is sent is
  // what a person does; no function or module is named.
})

// A MENU HANDS FOCUS BACK, WHICHEVER WAY YOU LEAVE IT.
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing about how it was built:
//
//  * A menu is a mode. It takes focus when it opens — the first row, so the arrow
//    keys work immediately — which means it OWES focus back when it closes.
//  * There are four ways out: Escape, Tab, a press somewhere else, and choosing a
//    row. A reader who uses one of them has not chosen to lose their place.
//  * Focus on `<body>` is the floor. From there a keyboard reader has nothing to
//    arrow from and a screen reader has nothing to announce, so the menu has
//    silently ended the reader's session with the page.
//  * A row marked `keepOpen` is not a way out — the menu is still there.
//
// THE DEFECT: two of the four restored focus and two dropped it. Choosing a row,
// which is what the menu is FOR, was one of the two that dropped it.
//
// jsdom does not lay out or scroll, so nothing here can see whether the page moved
// — that is `make overlay-scroll`'s job. What jsdom does have is
// `document.activeElement`, which is the whole of this claim.
describe('menu gives focus back', async () => {
  const { ActionMenu } = await import('../../src/ui.jsx')

  afterEach(() => cleanup())

  // The anchor and the menu as a screen wires them: a button that opens it, and the
  // ref that says where focus came from.
  function Harness({ items, onClose }) {
    const anchor = useRef(null)
    return (
      <div>
        <button type="button" ref={anchor} data-testid="anchor">Open</button>
        <button type="button" data-testid="elsewhere">Something else</button>
        <ActionMenu open items={items} anchorRef={anchor} onClose={onClose} returnFocusTo={anchor} />
      </div>
    )
  }

  const open = (items = [{ id: 'a', label: 'Rename', onClick: () => {} }]) => {
    const closed = []
    const view = render(<Harness items={items} onClose={() => closed.push(1)} />)
    const anchor = view.getByTestId('anchor')
    const menu = document.querySelector('[role=menu]')
    expect(menu, 'the menu did not render, so nothing below is testing a menu').toBeTruthy()
    return { view, anchor, menu, closed }
  }

  const landedOn = () => document.activeElement
  const onTheFloor = () => document.activeElement === document.body || document.activeElement === null

  describe('leaving a menu', () => {
    it('by Escape puts focus back where it came from', () => {
      const { anchor, menu } = open()
      fireEvent.keyDown(menu, { key: 'Escape' })
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onTheFloor(), 'Escape dropped focus onto the document body').toBe(false)
      expect(landedOn(), 'Escape put focus somewhere other than the control that opened the menu').toBe(anchor)
    })

    // THE ONE THE MENU EXISTS FOR, and the one that was broken.
    it('by choosing a row puts focus back where it came from', () => {
      const ran = []
      const { anchor } = open([{ id: 'a', label: 'Rename', onClick: () => ran.push('rename') }])
      fireEvent.click(document.querySelector('[role=menuitem]'))
      expect(ran, 'choosing the row did not run it, so this case is not about choosing a row').toEqual(['rename'])
      expect(onTheFloor(), 'choosing a row dropped focus onto the document body — a keyboard reader has nothing left to arrow from')
        .toBe(false)
      expect(landedOn(), 'choosing a row left focus somewhere other than the control that opened the menu').toBe(anchor)
    })

    // AND A ROW THAT KEEPS THE MENU OPEN IS NOT A WAY OUT. Restoring focus there
    // would take it off the row the reader is standing on, in a menu still on screen.
  })
})
