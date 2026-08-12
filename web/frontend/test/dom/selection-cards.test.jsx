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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { AnnotationCard } from '../../src/Library.jsx'
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
