// The Details panel's master save (1.14.2).
//
// The panel is deliberately a stack of self-saving rows: the modal it replaced
// made you re-save a whole record to change one line. That is still the right
// answer for changing one line, and it costs six presses for six lines — so the
// header offers one, and the per-row controls stay exactly as they were.
//
// ONE REQUEST, NOT SIX, is the rule these tests exist for. Every row PUTs the
// FULL record with its own field changed. Six rows saving themselves is six
// full-state writes over the top of each other: run together the last reply
// wins, run in order each still reads the record as it was before the previous
// reply landed. Either way five edits vanish behind five toasts saying they were
// saved — a failure that reports success, which is the kind this repo keeps
// finding. A loop here would pass any test that only checked the final field.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let PUTS, OK, CLOSED

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') {
      PUTS.push({ path, body })
      return OK ? { ok: true, data: { ...ITEM, ...body } } : { ok: false, status: 500, data: {} }
    }
    return { ok: true, data: {} }
  }),
}))

const { WorkDetails } = await import('../../src/WorkDetails.jsx')

const ITEM = {
  id: 7, title: 'Solaris', author: 'Stanisław Lem', translator: '', editor: '',
  isbn: '', asin: '', description: '', published_year: 1961, published_circa: false,
  genres: [], series: '', series_index: 0, favorite: false,
}

beforeEach(() => {
  PUTS = []
  OK = true
  CLOSED = 0
})

const panel = () => render(
  <WorkDetails open kind="book" item={ITEM} onClose={() => { CLOSED += 1 }} onChanged={() => {}} />,
)

// A row is opened by its pencil and typed into by its input.
const openRow = (label) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Edit ${label}`, 'i') }))
}
const typeIn = (label, text) => {
  const box = screen.getByLabelText(new RegExp(`^${label}$`, 'i'))
  fireEvent.change(box, { target: { value: text } })
  return box
}
const masterSave = () => screen.getByLabelText('Save')

describe('the master save', () => {
  // IT IS NEVER GREYED, and it used to be greyed almost always. "Nothing to save"
  // is the state this panel is in for most of the time it is on screen — every row
  // saves itself, so by the time you reach the header the work is usually already
  // done — and a ✓ that is inert whenever you have finished is a ✓ that appears to
  // do nothing. The owner reported exactly that. So it means DONE: commit whatever
  // is open, then leave.
  it('is never disabled, with nothing open or with a row untouched', () => {
    panel()
    expect(masterSave().disabled).toBe(false)
    openRow('Title')
    expect(masterSave().disabled).toBe(false)
  })

  // ...and with nothing to save it writes nothing. "Does something" must not
  // become "writes the record back unchanged": that would stamp updated_at on a
  // row nobody edited, every time somebody closed the panel.
  it('closes without writing when there is nothing to save', async () => {
    panel()
    openRow('Title') // open, unchanged
    fireEvent.click(masterSave())
    await waitFor(() => expect(CLOSED).toBe(1))
    expect(PUTS).toEqual([])
  })

  it('saves what is open AND closes the panel', async () => {
    panel()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    fireEvent.click(masterSave())
    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(PUTS[0].body.title).toBe('Solaris (1961)')
    await waitFor(() => expect(CLOSED).toBe(1))
  })

  it('sends every edited field in ONE request', async () => {
    panel()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    openRow('Author')
    typeIn('Author', 'Stanislaw Lem')

    fireEvent.click(masterSave())

    await waitFor(() => expect(PUTS.length).toBeGreaterThan(0))
    // The count IS the assertion. A loop over the rows would send two, and the
    // second would carry the first field's ORIGINAL value alongside its own.
    expect(PUTS.length).toBe(1)
    expect(PUTS[0].body.title).toBe('Solaris (1961)')
    expect(PUTS[0].body.author).toBe('Stanislaw Lem')
  })

  // Full-state, like every other write here: the fields nobody touched go back
  // exactly as they stand rather than being dropped from the body.
  it('carries the untouched fields through', async () => {
    panel()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    fireEvent.click(masterSave())

    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(PUTS[0].body.author).toBe('Stanisław Lem')
    expect(PUTS[0].body.published_year).toBe(1961)
  })

  // The same rule a single row follows: closing first would be snappier and
  // would throw away what you typed the moment the request failed.
  it('leaves the rows open when the server refuses', async () => {
    OK = false
    panel()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    fireEvent.click(masterSave())

    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(screen.getByDisplayValue('Solaris (1961)')).toBeTruthy()
    // AND THE PANEL STAYS UP. The ✓ closes on success, so the failure path has to
    // be the one thing it does not do — closing over a refused write would take
    // the error message and the drafts off the screen together.
    expect(CLOSED).toBe(0)
  })

  // The per-row ✓ is what the panel is for, and it does not go away.
  it('does not replace the row own save', () => {
    panel()
    openRow('Title')
    expect(screen.getAllByLabelText(/save/i).length).toBeGreaterThan(1)
  })
})
