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
      {/* `open`, not `count`, exactly as the boards wire it — the bar has to be
          able to stand over an empty selection or none of the mode cases below
          are testing what the app does. */}
      {selection.open && <SelectionBar selection={selection} rows={items} onDone={() => {}} />}
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

// The overflow, opened by its accessible name rather than by the glyph: a reader
// hears the words, and a test that clicked "⋯" would be asserting the drawing.
const openMore = () => fireEvent.click(screen.getByRole('button', { name: /More for the/ }))

describe('the bar over a selection of works', () => {
  const open = () => {
    render(<Board />)
    fireEvent.click(boxes()[0])
  }

  // The count is the badge on the deselect button now; the phrase lives in its
  // accessible name, which is what a screen reader gets once the words are clipped.
  it('says what it is holding, in the right word', () => {
    open()
    expect(screen.getByRole('button', { name: /1 book selected/ })).toBeTruthy()
  })

  it('calls a film a “title”, which is the word the delete phrase uses', () => {
    render(<Board kind="movie" items={[{ id: 1, title: 'Casablanca' }]} />)
    fireEvent.click(boxes()[0])
    expect(screen.getByRole('button', { name: /1 title selected/ })).toBeTruthy()
  })

  it('offers the four a work selection has, and none of the quote ones', () => {
    // The whole point of the split. A colour category is a note about a QUOTE and a
    // book has never had one; a shelf is a fact about a work and a quote has none.
    open()
    // `Clear` is `Deselect all` since 1.11.2, and it no longer takes the bar down
    // with it — `Dismiss the selection` is the control that does.
    for (const name of ['Fill gaps', 'Skip in quiz', 'Dismiss the selection']) {
      expect(screen.getByRole('button', { name }), name).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: /Deselect all/ })).toBeTruthy()
    expect(screen.getByLabelText(/Move the 1 selected to a shelf/)).toBeTruthy()
    // Delete folded behind the ⋯ in 1.12.0, along with everything else that needs
    // something more from you before it can run.
    openMore()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: /Recolour/ })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Add tags' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Seal' })).toBeNull()
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
    // One in-progress word per selection, and it is the books side here. Not
    // because the server refuses the other one — normalizeBulkStatus takes
    // 'reading' for a book and either catalogue word for a title, and
    // resolveActiveStatus settles each row from its own media_type — but because
    // two words for one shelf state in one dropdown is a choice with no meaning.
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
    openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
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

// ---- the mode outlives the picks (1.11.2) -----------------------------------
//
// The bug, as reported: long-press a book, then deselect everything — the bar
// disappeared, and the tick stayed lit on the book that had been long-pressed
// until the screen was reloaded. Two halves of one wrong idea, that "the mode is
// running" and "something is picked" are the same question.
//
// The bar now holds until it is dismissed, and dismissing is what puts every mark
// away. What is asserted here is the pairing, because that is the rule a person
// can hold: the ticks are up while the bar is up.

describe('the bar holds until it is dismissed', () => {
  const openMode = () => {
    render(<Board />)
    fireEvent.click(boxes()[0])
  }
  const bar = () => document.querySelector('.selection-bar')

  it('stands with nothing picked, and says so in words rather than a zero', () => {
    openMode()
    fireEvent.click(boxes()[0]) // off again
    expect(count()).toBe(0)
    expect(bar(), 'the bar went with the last pick').toBeTruthy()
    expect(screen.getByRole('button', { name: 'no books selected' })).toBeTruthy()
  })

  it('keeps the kind, so the empty bar is still a BOOK bar', () => {
    // With the kind dropped at zero the bar would render the quote actions over a
    // selection of books, because isWorkKind(null) is false. That is invisible
    // until somebody taps Seal on a book.
    openMode()
    fireEvent.click(boxes()[0])
    expect(screen.getByRole('button', { name: 'Fill gaps' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Seal' })).toBeNull()
  })

  it('disables every action while nothing is picked', () => {
    // An enabled Delete over zero rows is a button whose only possible outcome is
    // an error from the server.
    openMode()
    fireEvent.click(boxes()[0])
    for (const name of ['Fill gaps', 'Skip in quiz']) {
      expect(screen.getByRole('button', { name }).disabled, name).toBe(true)
    }
    // The count badge IS the deselect control, and at zero it has nothing to clear,
    // so it is disabled and named for the state rather than for the action.
    expect(screen.getByRole('button', { name: 'no books selected' }).disabled).toBe(true)
    expect(screen.getByLabelText(/Move the 0 selected to a shelf/).disabled).toBe(true)
    // The overflow holds Delete, so disabling the ⋯ is what disables Delete.
    expect(screen.getByRole('button', { name: /More for the/ }).disabled).toBe(true)
    // The way out is never disabled. A mode you cannot leave is the worse bug.
    expect(screen.getByRole('button', { name: 'Dismiss the selection' }).disabled).toBe(false)
  })

  it('re-enables them the moment something is picked again', () => {
    openMode()
    fireEvent.click(boxes()[0])
    fireEvent.click(boxes()[2])
    expect(screen.getByRole('button', { name: /More for the/ }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: /1 book selected/ })).toBeTruthy()
  })

  it('Deselect all empties it and leaves the bar standing', () => {
    openMode()
    fireEvent.click(boxes()[1])
    expect(count()).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: /Deselect all/ }))
    expect(count()).toBe(0)
    expect(bar()).toBeTruthy()
  })

  it('Dismiss takes the bar down and every tick with it', () => {
    openMode()
    expect(tiles()[0].className).toContain('is-selecting')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss the selection' }))
    expect(bar()).toBeNull()
    expect(count()).toBe(0)
    // THE MARK THAT WAS LEFT LIT. `.is-selecting` is what stands the ticks up on
    // every card of the board, and it has to come off all three of them together —
    // the un-picked cards are half the answer to "what am I about to act on", so a
    // board that keeps saying it mid-nothing is a board lying about its own state.
    for (const t of tiles()) expect(t.className).not.toContain('is-selecting')
    expect(document.querySelector('.is-picked')).toBeNull()
    for (const b of boxes()) expect(b.checked).toBe(false)
  })

  it('leaves on Escape, because a mode needs a keyboard way out', () => {
    openMode()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(bar()).toBeNull()
    expect(count()).toBe(0)
  })

  it('hands plain clicks back to opening once it is dismissed', () => {
    openMode()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss the selection' }))
    fireEvent.click(tiles()[2].querySelector('button'))
    expect(opened).toEqual([3])
  })
})

// ---- the shelf dropdown says what the ROWS are (games) -----------------------
//
// The Catalogue board deals films, shows and games out of one movies table, so
// SHELF_CHOICES keying the in-progress word off the board's kind offered
// "Watching" over a selection of games.
//
// THE VALUE WAS NEVER THE BUG, which is why this is asserted on the word and on
// the body in the same test: normalizeBulkStatus accepts either catalogue word
// and resolveActiveStatus translates it per row against that row's media_type
// (internal/httpapi/shelf.go), so the request lands correctly either way and only
// the label was wrong. A pure test of the label alone would not notice the day
// somebody "fixed" it by sending a word the server has to guess at.
describe('the shelf dropdown over a catalogue selection', () => {
  const shelf = (n) => screen.getByLabelText(new RegExp(`Move the ${n} selected to a shelf`))

  it('offers Playing when every selected row is a game', async () => {
    render(
      <Board
        kind="movie"
        items={[
          { id: 1, title: 'Outer Wilds', media_type: 'game' },
          { id: 2, title: 'Disco Elysium', media_type: 'game' },
        ]}
      />,
    )
    fireEvent.click(boxes()[0])
    fireEvent.click(boxes()[1])
    fireEvent.click(shelf(2))
    expect(await screen.findByText('Playing')).toBeTruthy()
    expect(screen.queryByText('Watching')).toBeNull()
    fireEvent.click(screen.getByText('Playing'))
    await waitFor(() => expect(sent('/movies/bulk/status')).toBeTruthy())
    expect(sent('/movies/bulk/status')[2]).toMatchObject({ ids: [1, 2], status: 'playing' })
  })

  it('keeps the film word over a MIXED selection of films and games', async () => {
    // Every-not-some, and honestly: there is no one word for a pick holding both,
    // so the board's own word stands and the server sorts each row out.
    render(
      <Board
        kind="movie"
        items={[
          { id: 1, title: 'Casablanca' },
          { id: 2, title: 'Outer Wilds', media_type: 'game' },
        ]}
      />,
    )
    fireEvent.click(boxes()[0])
    fireEvent.click(boxes()[1])
    fireEvent.click(shelf(2))
    expect(await screen.findByText('Watching')).toBeTruthy()
    expect(screen.queryByText('Playing')).toBeNull()
  })

  it('leaves a selection of films alone', async () => {
    render(<Board kind="movie" items={[{ id: 1, title: 'Casablanca' }]} />)
    fireEvent.click(boxes()[0])
    fireEvent.click(shelf(1))
    expect(await screen.findByText('Watching')).toBeTruthy()
    expect(screen.queryByText('Playing')).toBeNull()
  })
})

// Setting one field across a whole selection (1.16.0, wired 2.2.3).
//
// WHY THIS BLOCK EXISTS. The action was in the registry, the field tables and the
// overwrite warning were in bulkOps.jsx, and the server took every field — and
// none of it did anything, because SelectionBar never passed `setFields`. The
// action's `available` reads `!!ctx.setFields`, so the menu item simply was not
// there: no error, no log, no failing test. The owner reported it as "I am unable
// to bulk edit works".
//
// So the assertions go all the way to the REQUEST. A test that found the menu item
// would have passed on the day the callback was added and said nothing about
// whether the dialog sends anything.
describe('setting one field over a selection', () => {
  const pickTwo = () => {
    render(<Board />)
    fireEvent.click(boxes()[0])
    fireEvent.click(boxes()[1])
  }

  // Select is this app's own dropdown, not a native <select>: it opens a panel and
  // the options are clicked. Driving it with fireEvent.change silently does
  // nothing, which is a test that passes while asserting the default.
  const chooseField = (label) => {
    fireEvent.click(screen.getByLabelText('Which field to set'))
    fireEvent.click(screen.getByText(label))
  }
  const openDialog = () => {
    openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set fields' }))
  }

  it('is not offered over a single work', () => {
    // The work's own form is strictly better for one row, which is the registry's
    // rule — asserted here because this is the surface that shows it.
    render(<Board />)
    fireEvent.click(boxes()[0])
    openMore()
    expect(screen.queryByRole('menuitem', { name: 'Set fields' })).toBeNull()
  })

  it('is offered over several', () => {
    pickTwo()
    openMore()
    expect(screen.getByRole('menuitem', { name: 'Set fields' })).toBeTruthy()
  })

  it('sets the series on both books in one request', async () => {
    pickTwo()
    openDialog()
    chooseField('Series')
    fireEvent.change(screen.getByLabelText(/^Series$/i), { target: { value: 'the hainish cycle' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(sent('/books/bulk')).toBeTruthy())
    const [, , body] = sent('/books/bulk')
    expect(body.ids).toEqual([1, 2])
    // As-you-type capitalisation, and the small-word rule with it: this is the
    // same Field the single-book form uses, so a series set over five books is
    // spelled the way it would have been spelled in one of them.
    expect(body.series).toBe('The Hainish Cycle')
    // ONE key. A targeted patch is what makes "set the series and leave the rest"
    // possible at all — a full-state body here would clear every other field on
    // both books.
    expect(Object.keys(body).sort()).toEqual(['ids', 'series'])
  })

  it('sends a number for a numeric field, not a string', async () => {
    pickTwo()
    openDialog()
    chooseField('Year')
    fireEvent.change(screen.getByLabelText(/^Year$/i), { target: { value: '1974' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(sent('/books/bulk')).toBeTruthy())
    // A string in a *int is a 400, and the failure would be a red toast nobody
    // could act on.
    expect(sent('/books/bulk')[2].published_year).toBe(1974)
  })

  it('warns about what it would overwrite, and only about that', () => {
    pickTwo()
    openDialog()
    // Author is the first field, and both selected books already have one —
    // the same one, so the warning quotes it.
    expect(document.querySelector('.tp-warn')?.textContent).toMatch(/Le Guin/)
    // Neither has a series, so filling that blank is not a loss and says nothing.
    chooseField('Series')
    expect(document.querySelector('.tp-warn')).toBeNull()
  })

  it('forgets a value typed for the previous field', () => {
    pickTwo()
    openDialog()
    fireEvent.change(screen.getByLabelText(/^Author$/i), { target: { value: 'Borges' } })
    chooseField('Series')
    // Carrying it over would offer "Borges" as a series with the Apply button
    // already live beside it.
    expect(screen.getByLabelText(/^Series$/i).value).toBe('')
  })
})

// ---- a field whose column has no empty --------------------------------------
//
// media_type is NOT NULL and the server maps "" onto 'movie'. Offering a blank
// answer under a hint reading "Empty clears the field" therefore did not clear
// anything: it turned every selected show and game into a film — the loudest
// possible edit made by the quietest possible control, and the overwrite warning
// is not an answer to it because the sentence beside it was false.
describe('setting a field that cannot be cleared', () => {
  const openTypeField = () => {
    render(<Board kind="movie" items={[
      { id: 1, title: 'The Wire', media_type: 'show' },
      { id: 2, title: 'Deadwood', media_type: 'show' },
    ]} />)
    fireEvent.click(boxes()[0])
    fireEvent.click(boxes()[1])
    openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set fields' }))
    fireEvent.click(screen.getByLabelText('Which field to set'))
    fireEvent.click(screen.getByText('Type'))
  }

  it('offers no blank answer, and does not promise a clear', () => {
    openTypeField()
    fireEvent.click(screen.getByLabelText('The value to set'))
    expect(screen.queryByText('(none)'), 'a blank answer that would convert every show to a film').toBeNull()
    expect(screen.queryByText('Empty clears the field.'), 'a promise the server does not keep').toBeNull()
  })

  it('will not apply until a real value is picked', () => {
    openTypeField()
    expect(screen.getByRole('button', { name: 'Apply' }).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('The value to set'))
    fireEvent.click(screen.getByText('Film'))
    expect(screen.getByRole('button', { name: 'Apply' }).disabled).toBe(false)
  })

  it('still offers the blank for a field that really does clear', () => {
    render(<Board />)
    fireEvent.click(boxes()[0])
    fireEvent.click(boxes()[1])
    openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set fields' }))
    expect(screen.getByText('Empty clears the field.')).toBeTruthy()
  })

  it('trims what it sends', async () => {
    // A trailing space stored across a whole selection is a value that looks
    // right, sorts right, and never matches the one you type next time.
    render(<Board />)
    fireEvent.click(boxes()[0])
    fireEvent.click(boxes()[1])
    openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set fields' }))
    fireEvent.click(screen.getByLabelText('Which field to set'))
    fireEvent.click(screen.getByText('Series'))
    fireEvent.change(screen.getByLabelText(/^Series$/i), { target: { value: '  The Hainish Cycle  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(sent('/books/bulk')).toBeTruthy())
    expect(sent('/books/bulk')[2].series).toBe('The Hainish Cycle')
  })
})
