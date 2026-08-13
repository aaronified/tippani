// Selecting books, films and shows — and the bar that appears when you do.
//
// A work board is not a quote board, and this file exists because the difference
// is easy to get wrong in a way that looks fine. A book has no colour and no tag
// of its own; a quote has no shelf and nothing to look up. If the bar showed a
// colour picker over a selection of books it would post to an endpoint that
// rejects it, and if it hid Delete over a selection of quotes nobody would notice
// for a release.
//
// So: what appears is asserted per kind, from the registry both surfaces read.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CALLS
let RESP

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    return { ok: true, data: { ...RESP, updated: body?.ids?.length || 0, trash_id: 91 } }
  }),
}))

const { WorkCard } = await import('../../src/works.jsx')
const { SelectionBar } = await import('../../src/SelectionBar.jsx')
const { useSelection } = await import('../../src/selection.jsx')
const { ToastHost } = await import('../../src/ui.jsx')

const BOOKS = [
  { id: 1, title: 'The Dispossessed', author: 'Le Guin', annotation_count: 4 },
  { id: 2, title: 'A Wizard of Earthsea', author: 'Le Guin', annotation_count: 2 },
  { id: 3, title: 'Ficciones', author: 'Borges', annotation_count: 9 },
]

let opened

// A board: three covers over one selection, exactly as the Library wires it.
function Board({ items = BOOKS, kind = 'book' }) {
  const selection = useSelection(items.map((b) => b.id))
  return (
    <div>
      <span data-testid="count">{selection.count}</span>
      <span data-testid="kind">{String(selection.kind)}</span>
      {selection.count > 0 && <SelectionBar selection={selection} rows={items} onDone={() => {}} />}
      {items.map((b, i) => (
        <WorkCard key={b.id} kind={kind} item={b} index={i} onOpen={(id) => opened.push(id)} selection={selection} />
      ))}
      <ToastHost />
    </div>
  )
}

const tiles = () => [...document.querySelectorAll('.work-tile')]
const count = () => Number(screen.getByTestId('count').textContent)
const boxes = () => screen.getAllByRole('checkbox')
const sent = (path) => CALLS.find(([, p]) => p === path)
const press = (el) => fireEvent.pointerDown(el, { pointerType: 'touch', clientX: 30, clientY: 30 })
const hold = async (ms = 500) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  CALLS = []
  RESP = {}
  opened = []
})

describe('picking a cover', () => {
  it('opens the work on a plain click while nothing is selected', () => {
    render(<Board />)
    fireEvent.click(screen.getByTitle('Ficciones'))
    expect(opened).toEqual([3])
    expect(count()).toBe(0)
  })

  it('selects on a long press, which is the phone’s way in', async () => {
    // There is no .card-text on a cover — a poster is a picture, so every press
    // that is not on a control belongs to the card. That is the one real difference
    // from a quote card's gesture.
    vi.useFakeTimers()
    render(<Board />)
    press(screen.getByTitle('The Dispossessed'))
    await hold()
    expect(count()).toBe(1)
    expect(opened, 'the long press must not also open the book').toEqual([])
    vi.useRealTimers()
  })

  it('selects on ctrl-click', () => {
    render(<Board />)
    fireEvent.click(screen.getByTitle('The Dispossessed'), { ctrlKey: true })
    expect(count()).toBe(1)
    expect(opened).toEqual([])
  })

  it('toggles instead of opening once a selection exists', () => {
    render(<Board />)
    fireEvent.click(boxes()[0])
    fireEvent.click(screen.getByTitle('Ficciones'))
    expect(count()).toBe(2)
    expect(opened).toEqual([])
  })

  it('extends with shift over the board’s own order', () => {
    render(<Board />)
    fireEvent.click(boxes()[0])
    fireEvent.click(screen.getByTitle('Ficciones'), { shiftKey: true })
    expect(count()).toBe(3)
  })

  it('wears the tick, and rings the cover that is picked', () => {
    render(<Board />)
    expect(boxes()[0].getAttribute('aria-label')).toBe('Select this book')
    fireEvent.click(boxes()[0])
    expect(boxes()[0].getAttribute('aria-label')).toBe('Deselect this book')
    expect(document.querySelectorAll('.is-picked')).toHaveLength(1)
    // And every tile on the board wears its mark once a selection is running.
    for (const t of tiles()) expect(t.className).toContain('is-selecting')
  })

  it('names a film a film and a show a show', () => {
    render(<Board kind="movie" items={[{ id: 1, title: 'Casablanca' }, { id: 2, title: 'Twin Peaks', media_type: 'show' }]} />)
    const labels = boxes().map((b) => b.getAttribute('aria-label'))
    expect(labels).toEqual(['Select this film', 'Select this show'])
  })

  it('does none of it on a board that passes no selection', () => {
    render(<WorkCard kind="book" item={BOOKS[0]} onOpen={(id) => opened.push(id)} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(document.querySelector('.work-tile')).toBeNull()
    fireEvent.click(screen.getByTitle('The Dispossessed'))
    expect(opened).toEqual([1])
  })
})

describe('the bar over a selection of works', () => {
  const open = () => {
    render(<Board />)
    fireEvent.click(boxes()[0])
  }

  it('says what it is holding, in the right word', () => {
    open()
    expect(screen.getByText('1 book selected')).toBeTruthy()
  })

  it('calls a film a “title”, which is the word the delete phrase uses', () => {
    render(<Board kind="movie" items={[{ id: 1, title: 'Casablanca' }]} />)
    fireEvent.click(boxes()[0])
    expect(screen.getByText('1 title selected')).toBeTruthy()
  })

  it('offers the four a work selection has, and none of the quote ones', () => {
    // The whole point of the split. A colour category is a note about a QUOTE and a
    // book has never had one; a shelf is a fact about a work and a quote has none.
    open()
    for (const name of ['Fill gaps', 'Skip in quiz', 'Delete', 'Clear']) {
      expect(screen.getByRole('button', { name }), name).toBeTruthy()
    }
    expect(screen.getByLabelText(/Move the 1 selected to a shelf/)).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: /Recolour/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add tags' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Seal' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Favourite' })).toBeNull()
  })

  it('moves a shelf through the kind’s own endpoint', async () => {
    open()
    const select = screen.getByLabelText(/Move the 1 selected to a shelf/)
    fireEvent.click(select)
    fireEvent.click(await screen.findByText('Completed'))
    await waitFor(() => expect(sent('/books/bulk/status')).toBeTruthy())
    expect(sent('/books/bulk/status')[2]).toMatchObject({ ids: [1], status: 'completed' })
  })

  it('offers Reading for a book and Watching for a film, never both', async () => {
    // The server refuses the other side's word, so offering it would be a control
    // that only ever errors.
    open()
    fireEvent.click(screen.getByLabelText(/Move the 1 selected to a shelf/))
    expect(await screen.findByText('Reading')).toBeTruthy()
    expect(screen.queryByText('Watching')).toBeNull()
  })

  it('fills only the gaps, in batches the server will accept', async () => {
    RESP = { filled: 1, fields: 3, failed: 0 }
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Fill gaps' }))
    await waitFor(() => expect(sent('/metadata/fill')).toBeTruthy())
    expect(sent('/metadata/fill')[2]).toEqual({ ids: undefined, book_ids: [1] })
    expect(await screen.findByText('filled 3 fields')).toBeTruthy()
  })

  it('says so plainly when there was nothing missing', async () => {
    // The good case. Reported as a failure, people learn to distrust the button.
    RESP = { filled: 0, fields: 0, failed: 0 }
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Fill gaps' }))
    expect(await screen.findByText('nothing was missing')).toBeTruthy()
  })

  it('warns that deleting a work takes its quotes with it', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete 1 book?')).toBeTruthy()
    expect(screen.getByText('delete 1 book')).toBeTruthy()
    expect(screen.getByText(/every quote saved from them/)).toBeTruthy()
    expect(CALLS, 'nothing should have been sent yet').toEqual([])
  })
})

describe('the quiz toggle reads the rows, not a guess', () => {
  // A bar that always said "Skip in quiz" over a selection that is already skipped
  // is a control whose state you cannot read. The word is the ACTION, and it flips.
  function ReviewBoard({ items }) {
    const selection = useSelection(items.map((b) => b.id))
    return (
      <div>
        <SelectionBar selection={selection} rows={items} onDone={() => {}} />
        {items.map((b, i) => (
          <WorkCard key={b.id} kind="book" item={b} index={i} onOpen={() => {}} selection={selection} />
        ))}
      </div>
    )
  }

  it('offers to skip a selection that is in the quiz', async () => {
    render(<ReviewBoard items={[{ id: 1, title: 'a', review_excluded: false }]} />)
    fireEvent.click(boxes()[0])
    fireEvent.click(screen.getByRole('button', { name: 'Skip in quiz' }))
    await waitFor(() => expect(sent('/books/bulk')).toBeTruthy())
    expect(sent('/books/bulk')[2].review).toBe(false)
  })

  it('offers to add back a selection that is already skipped', async () => {
    render(<ReviewBoard items={[{ id: 1, title: 'a', review_excluded: true }]} />)
    fireEvent.click(boxes()[0])
    fireEvent.click(screen.getByRole('button', { name: 'Add to quiz' }))
    await waitFor(() => expect(sent('/books/bulk')).toBeTruthy())
    expect(sent('/books/bulk')[2].review).toBe(true)
  })

  it('offers to skip a MIXED selection, because that is what changes something', async () => {
    // every-not-some. Over one skipped and one not, "skip these" changes one of
    // them; "add these back" would change nothing for the other.
    render(
      <ReviewBoard
        items={[
          { id: 1, title: 'a', review_excluded: true },
          { id: 2, title: 'b', review_excluded: false },
        ]}
      />,
    )
    fireEvent.click(boxes()[0])
    fireEvent.click(boxes()[1])
    expect(screen.getByRole('button', { name: 'Skip in quiz' })).toBeTruthy()
  })
})
