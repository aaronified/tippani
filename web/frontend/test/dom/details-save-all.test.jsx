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

let PUTS, OK

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
})

const panel = () => render(
  <WorkDetails open kind="book" item={ITEM} onClose={() => {}} onChanged={() => {}} />,
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
  // An open row you have not changed is not unsaved work. Pressing ✓ then would
  // have to either do nothing or write the record back unchanged, and both are
  // worse than the button not being offered.
  it('is disabled until a row actually changes', async () => {
    panel()
    expect(masterSave().disabled).toBe(true)
    openRow('Title')
    expect(masterSave().disabled).toBe(true)
    typeIn('Title', 'Solaris (1961)')
    await waitFor(() => expect(masterSave().disabled).toBe(false))
  })

  it('sends every edited field in ONE request', async () => {
    panel()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    openRow('Author')
    typeIn('Author', 'Stanislaw Lem')

    await waitFor(() => expect(masterSave().disabled).toBe(false))
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
    await waitFor(() => expect(masterSave().disabled).toBe(false))
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
    await waitFor(() => expect(masterSave().disabled).toBe(false))
    fireEvent.click(masterSave())

    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(screen.getByDisplayValue('Solaris (1961)')).toBeTruthy()
  })

  // The per-row ✓ is what the panel is for, and it does not go away.
  it('does not replace the row own save', () => {
    panel()
    openRow('Title')
    expect(screen.getAllByLabelText(/save/i).length).toBeGreaterThan(1)
  })
})
