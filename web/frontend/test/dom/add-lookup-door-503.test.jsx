// A LOOKUP REFUSED AT THE DOOR SAYS SO, rather than opening the manual form.
//
// WHAT BROKE. The add screen read every 503 from a film, show or game lookup as
// "this supplier has no key" and opened the hand-entry form. Since #40 the /api
// door also answers 503, when the database is not answering, and read that way
// it hid the door's "changed nothing" message behind a form whose save the door
// then refused too. A 503 means "no key" only when the metadata status says the
// supplier behind the chip has none.
//
// WHAT IT KNOWS, declared: the two routes the card asks (the metadata status and
// the lookup), answered here, because nothing on a screen puts a server's
// database into #40's state. What is asserted is what the reader sees.

import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const DOOR = "Tippani's database is not answering, so this request changed nothing."
let STATUS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/metadata/status') return { ok: true, data: STATUS }
    if (path === '/genres') return { ok: true, data: { genres: [] } }
    if (path === '/movies/lookup') {
      return STATUS.tmdb.source === 'none'
        ? { ok: false, status: 503, data: { error: 'the supplier has no key' } }
        : { ok: false, status: 503, data: { error: DOOR } }
    }
    return { ok: true, data: {} }
  }),
}))

const { json } = await import('../../src/api.js')
const { AddLookup } = await import('../../src/AddSurface.jsx')

// The card learns which supplier has no key from the metadata status, fetched
// when it opens; a search made before that answer lands would test the race and
// not the rule, so each case waits for it, as a reader looking at the card would.
async function search(title) {
  json.mockClear()
  render(<AddLookup initialKind="film" onAdded={() => {}} />)
  await waitFor(() => expect(json.mock.calls.some((c) => c[1] === '/metadata/status')).toBe(true))
  await act(async () => {})
  const box = await screen.findByRole('textbox', { name: /film|title|search/i })
  fireEvent.change(box, { target: { value: title } })
  fireEvent.submit(box.closest('form'))
}

describe('a film lookup answered 503', () => {
  it('shows the door\'s message when the supplier has a key', async () => {
    STATUS = { tmdb: { source: 'custom' }, igdb: { source: 'custom' } }
    await search('Stalker')
    expect(await screen.findByText(DOOR)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('still opens the manual form when the supplier has no key', async () => {
    STATUS = { tmdb: { source: 'none' }, igdb: { source: 'custom' } }
    await search('Stalker')
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })
})
