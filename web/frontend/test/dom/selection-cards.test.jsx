// Selecting quote cards, and the moment a plain click changes meaning.
//
// That change is the risky part of this feature. Before a selection exists a click
// opens the quote; once one does, a click toggles. Get it wrong in one direction and
// selecting is impossible; in the other, every ordinary click starts silently
// picking things. The mode is visible — the bar is up, the cards wear checkboxes and
// a ring — which is what makes the change legible rather than surprising.
//
// The other claim here is that SELECT IS IN THE CARD'S MENU. That is what makes the
// context menu and multiselect one feature instead of two: the gesture that asks
// "what can I do to this" is also how you begin doing it to several.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { AnnotationCard } from '../../src/Library.jsx'
import { Frame } from '../../src/Movies.jsx'
import { useSelection } from '../../src/selection.jsx'

const QUOTES = [
  { id: 1, quote: 'the first line', color: 'yellow', tags: [], favorite: false },
  { id: 2, quote: 'the second line', color: 'blue', tags: [], favorite: false },
  { id: 3, quote: 'the third line', color: 'pink', tags: [], favorite: false },
]

let opened

// A board: three cards over one selection, exactly as the Quotes screen wires it.
function Board() {
  const selection = useSelection(QUOTES.map((q) => q.id))
  return (
    <div>
      <span data-testid="count">{selection.count}</span>
      <span data-testid="kind">{String(selection.kind)}</span>
      {QUOTES.map((q, i) => (
        <div key={q.id} onClick={() => opened.push(q.id)}>
          <AnnotationCard
            a={q}
            variant={i}
            tagMap={{}}
            editing={false}
            setEditingId={() => {}}
            save={() => {}}
            patch={async () => {}}
            remove={() => {}}
            onCopy={() => {}}
            onShare={() => {}}
            selection={selection}
            selectKind="quote"
            actionsAlwaysVisible
          />
        </div>
      ))}
    </div>
  )
}

const cards = () => [...document.querySelectorAll('.hand-card')]
const count = () => Number(screen.getByTestId('count').textContent)
const boxes = () => screen.getAllByRole('checkbox')

beforeEach(() => {
  opened = []
})

describe('picking cards', () => {
  it('offers a checkbox on every card', () => {
    render(<Board />)
    expect(boxes()).toHaveLength(3)
    expect(boxes()[0].getAttribute('aria-label')).toBe('Select this quote')
  })

  it('picks one with the checkbox, and rings the card', () => {
    render(<Board />)
    fireEvent.click(boxes()[1])
    expect(count()).toBe(1)
    expect(boxes()[1].checked).toBe(true)
    expect(cards()[1].className).toContain('is-picked')
    expect(cards()[0].className).not.toContain('is-picked')
    // The label flips, so a screen reader is told what the control will do next
    // rather than what it did.
    expect(boxes()[1].getAttribute('aria-label')).toBe('Deselect this quote')
  })

  it('picks with ctrl-click before any selection exists', () => {
    // The gesture from every file manager, and the reason selection does not need a
    // mode button to get into.
    render(<Board />)
    fireEvent.click(cards()[0], { ctrlKey: true })
    expect(count()).toBe(1)
    expect(opened, 'a ctrl-click must not also open the quote').toEqual([])
  })

  it('opens the quote on a plain click while nothing is selected', () => {
    render(<Board />)
    fireEvent.click(cards()[2])
    expect(count()).toBe(0)
    expect(opened).toEqual([3])
  })

  it('toggles instead of opening once a selection exists', () => {
    // THE MOMENT THE MEANING CHANGES. It is legible because the bar is up and the
    // cards wear checkboxes; it would be a trap if the mode were invisible.
    render(<Board />)
    fireEvent.click(boxes()[0])
    fireEvent.click(cards()[1])
    expect(count()).toBe(2)
    expect(opened, 'no quote should have opened').toEqual([])
  })

  it('leaves selection mode when the last one is clicked off', () => {
    render(<Board />)
    fireEvent.click(boxes()[0])
    fireEvent.click(cards()[0])
    expect(count()).toBe(0)
    // And an ordinary click opens again, without any Cancel button in between.
    fireEvent.click(cards()[2])
    expect(opened).toEqual([3])
  })

  it('extends with shift over the board’s own order', () => {
    render(<Board />)
    fireEvent.click(boxes()[0])
    fireEvent.click(cards()[2], { shiftKey: true })
    expect(count()).toBe(3)
  })
})

describe('the tickmark', () => {
  it('is a drawn tick over a real checkbox, not a bare box', () => {
    // The control stays a checkbox — role, checked state, label, tab order — and
    // the tick is what you see. A div with an onClick would look identical and
    // announce nothing.
    render(<Board />)
    const mark = document.querySelectorAll('.card-pick-mark')
    expect(mark).toHaveLength(3)
    expect(mark[0].querySelector('svg'), 'the tick is a glyph').toBeTruthy()
    expect(boxes()[0].type).toBe('checkbox')
  })

  it('stands on every card of a board that has a selection running', () => {
    // Not only on the picked ones. The cards you have NOT picked are half the
    // answer to "what am I about to act on", and on a phone there is no hover to
    // reveal them with.
    render(<Board />)
    expect(cards()[2].className).not.toContain('is-selecting')
    fireEvent.click(boxes()[0])
    for (const c of cards()) expect(c.className).toContain('is-selecting')
  })
})

describe('a long press', () => {
  const press = (el) => fireEvent.pointerDown(el, { pointerType: 'touch', clientX: 40, clientY: 40 })
  const hold = async (ms = 500) => {
    await act(async () => {
      vi.advanceTimersByTime(ms)
    })
  }

  it('selects the card when it lands anywhere but the quote', async () => {
    // The phone's way in. Every photo grid and file manager on both platforms
    // enters multiselect exactly this way; the plan's toolbar toggle was a thing
    // you had to be told about.
    vi.useFakeTimers()
    render(<Board />)
    press(cards()[1])
    await hold()
    expect(count()).toBe(1)
    expect(cards()[1].className).toContain('is-picked')
    vi.useRealTimers()
  })

  it('leaves the quote itself to the browser, so a thumb can still copy a phrase', async () => {
    // THE REASON THE PRESS SPLITS AT ALL. A note-keeping app where you cannot
    // select half a sentence with a finger has spent the gesture badly.
    vi.useFakeTimers()
    render(<Board />)
    press(screen.getByText('the second line'))
    await hold()
    expect(count()).toBe(0)
    vi.useRealTimers()
  })

  it('does not then undo itself on the click that trails it', async () => {
    vi.useFakeTimers()
    render(<Board />)
    press(cards()[0])
    await hold()
    fireEvent.pointerUp(cards()[0])
    fireEvent.click(cards()[0])
    expect(count()).toBe(1)
    expect(opened, 'and it must not open the quote either').toEqual([])
    vi.useRealTimers()
  })
})

describe('the card menu', () => {
  it('offers Select first, so the gesture starts a selection', () => {
    render(<Board />)
    fireEvent.contextMenu(cards()[0], { clientX: 10, clientY: 10 })
    const labels = within(screen.getByRole('menu')).getAllByRole('menuitem').map((b) => b.textContent)
    expect(labels[0]).toBe('Select')
    expect(labels).toEqual(['Select', 'Copy', 'Share', 'Edit', 'Delete'])
  })

  it('says Deselect for one already picked', () => {
    render(<Board />)
    fireEvent.click(boxes()[1])
    fireEvent.contextMenu(cards()[1], { clientX: 10, clientY: 10 })
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem')[0].textContent).toBe('Deselect')
  })

  it('selects from the menu', () => {
    render(<Board />)
    fireEvent.contextMenu(cards()[2], { clientX: 10, clientY: 10 })
    fireEvent.click(within(screen.getByRole('menu')).getByText('Select'))
    expect(count()).toBe(1)
  })
})

describe('a board with no selection at all', () => {
  it('has no checkboxes and no Select in the menu', () => {
    // A surface that does not support selecting (the search quote modal, a Home
    // tile) passes nothing, and gains nothing.
    render(
      <AnnotationCard
        a={QUOTES[0]}
        variant={0}
        tagMap={{}}
        editing={false}
        setEditingId={() => {}}
        save={() => {}}
        patch={async () => {}}
        remove={() => {}}
        onCopy={() => {}}
        onShare={() => {}}
        actionsAlwaysVisible
      />,
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.contextMenu(document.querySelector('.card-menu-host'), { clientX: 5, clientY: 5 })
    expect(within(screen.getByRole('menu')).queryByText('Select')).toBeNull()
  })
})

// ---- the film-strip frame (1.11.1) -----------------------------------------
//
// A dialogue card is its own component — a lit panel rather than a torn-edged
// card — so its selection wiring is hand-rolled beside the annotation card's, and
// hand-rolled twice is how two cards come to behave differently on the same
// gesture. Asserted separately for that reason.

describe('a dialogue frame', () => {
  const LINES = [
    { id: 11, quote: "here's looking at you, kid", color: 'yellow', tags: [] },
    { id: 12, quote: 'round up the usual suspects', color: 'blue', tags: [] },
  ]

  function Strip() {
    const selection = useSelection(LINES.map((d) => d.id))
    return (
      <div>
        <span data-testid="count">{selection.count}</span>
        {LINES.map((d) => (
          <Frame
            key={d.id}
            d={d}
            tagMap={{}}
            editing={false}
            onEdit={() => {}}
            onCancelEdit={() => {}}
            onSave={() => {}}
            onPatch={() => {}}
            onDelete={() => {}}
            onCopy={() => {}}
            onShare={() => {}}
            selection={selection}
            actionsAlwaysVisible
          />
        ))}
      </div>
    )
  }

  const frames = () => [...document.querySelectorAll('.film-frame')]

  it('wears the same tick as every other card', () => {
    render(<Strip />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getAllByRole('checkbox')[0].getAttribute('aria-label')).toBe('Select this line')
  })

  it('selects on a long press over the whitespace, and rings the frame', async () => {
    vi.useFakeTimers()
    render(<Strip />)
    fireEvent.pointerDown(frames()[0], { pointerType: 'touch', clientX: 20, clientY: 20 })
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(Number(screen.getByTestId('count').textContent)).toBe(1)
    expect(frames()[0].className).toContain('is-picked')
    vi.useRealTimers()
  })

  it('leaves the line itself to the browser', async () => {
    vi.useFakeTimers()
    render(<Strip />)
    fireEvent.pointerDown(screen.getByText('round up the usual suspects'), {
      pointerType: 'touch',
      clientX: 20,
      clientY: 20,
    })
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(Number(screen.getByTestId('count').textContent)).toBe(0)
    vi.useRealTimers()
  })

  it('offers Select first in its menu, like the annotation card', () => {
    render(<Strip />)
    fireEvent.contextMenu(frames()[0], { clientX: 10, clientY: 10 })
    const labels = within(screen.getByRole('menu')).getAllByRole('menuitem').map((b) => b.textContent)
    expect(labels[0]).toBe('Select')
  })
})
