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
import { act, fireEvent, render, screen } from '@testing-library/react'
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

  it('toggles instead of opening once a selection exists', () => {
    // THE MOMENT THE MEANING CHANGES. It is legible because the bar is up and the
    // cards wear checkboxes; it would be a trap if the mode were invisible.
    render(<Board />)
    fireEvent.click(boxes()[0])
    fireEvent.click(cards()[1])
    expect(count()).toBe(2)
    expect(opened, 'no quote should have opened').toEqual([])
  })

})

// ---- the film-strip frame (1.11.1) -----------------------------------------
//
// A dialogue card is its own component — a lit panel rather than a torn-edged
// card — so its selection wiring is hand-rolled beside the annotation card's, and
// hand-rolled twice is how two cards come to behave differently on the same
// gesture. Asserted separately for that reason.
