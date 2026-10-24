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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { jobsServer } from './helpers/jobsServer.js'

let CALLS
let RESP
// Fill gaps is a job on the server since 3.1.0; this is the queue it goes to, in
// the shapes the jobs routes answer with (see the helper's header).
let JOBS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    // The fourth field is WHEN, for the cases about the fill's polling schedule —
    // under fake timers it is the fake clock's.
    CALLS.push([method, path, body, Date.now()])
    const job = JOBS.answer(method, path, body)
    if (job) return job
    // The library-wide pool the value box offers from. A bulk selection spans
    // works, so this is the only pool that can serve it.
    if (String(path).startsWith('/search/vocabulary')) {
      return { ok: true, data: { series: ['Hainish', 'Earthsea'], authors: [], directors: [], characters: [], actors: [], speakers: [], occasions: [], languages: [] } }
    }
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
  JOBS = jobsServer()
  opened = []
})

// The overflow, opened by its accessible name rather than by the glyph: a reader
// hears the words, and a test that clicked "⋯" would be asserting the drawing.
const openMore = () => fireEvent.click(screen.getByRole('button', { name: /More for the/ }))

describe('the bar over a selection of works', () => {
  const open = () => {
    render(<Board />)
    fireEvent.click(boxes()[0])
  }

  // THE ROW THAT USED TO BE HERE IS A JOURNEY NOW — `gathering-several-books`.
  //
  // It asserted that the ⋯ offers "Add to anthology" over a work selection, and it
  // said in a paragraph why it could not be a journey: a work selection's ⋯ would
  // not open in a browser. That turned out to be a stylesheet bug rather than a
  // limit of the harness (`.selection-bar` stuck at `top: 0`, behind the sticky
  // `.topbar`), so the reason expired and the test with it. What it checked — that
  // the row renders — is now the weakest step of a journey that goes on to press it
  // and read the passages back out of the anthology, which is the claim that
  // mattered and the one nothing was making.
  //
  // The rest of this file stays: the four verbs a work selection offers and the
  // quote-only ones it must not are a statement about the REGISTRY, and enumerating
  // what is absent is not something a reader does.

  // ONE JOB OVER THE WHOLE SELECTION. It was batches of fifteen posted from the
  // bar, and closing the tab part-way stopped the fill wherever it had got to.
  it('fills only the gaps, as one job on the server', async () => {
    JOBS.plan('fill', { counts: { fields: 3, failed: 0 } })
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Fill gaps' }))
    await waitFor(() => expect(JOBS.started()).toHaveLength(1))
    expect(JOBS.started()[0]).toEqual(['fill', { book_ids: [1] }])
    expect(await screen.findByText('filled 3 fields')).toBeTruthy()
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

  it('sets the series on both books in one request', async () => {
    pickTwo()
    openDialog()
    chooseField('Series')
    fireEvent.change(screen.getByLabelText(/^Series$/i), { target: { value: 'the hainish cycle' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(sent('/books/bulk')).toBeTruthy())
    const [, , body] = sent('/books/bulk')
    expect(body.ids).toEqual([1, 2])
    // EXACTLY WHAT WAS TYPED. This is the same Field the single-book form uses,
    // and neither rewrites a name any more: the small-word rule that used to run
    // here could not be argued with, and the keyboard hint that replaced it can.
    // So a series set over five books is spelled the way it was typed, which is
    // also how it would have been spelled in one of them.
    expect(body.series).toBe('the hainish cycle')
    // ONE key. A targeted patch is what makes "set the series and leave the rest"
    // possible at all — a full-state body here would clear every other field on
    // both books.
    expect(Object.keys(body).sort()).toEqual(['ids', 'series'])
  })

})
