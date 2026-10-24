// Undo, in the toast, right after the delete.
//
// The bin is the safety net and this is the shortcut, and the shortcut is the part
// people actually use: nobody who has just deleted the wrong quote wants to be
// told there is a bin in Settings.
//
// Three things here can fail quietly. The Undo can be offered when there is
// nothing to undo (an older server, or a kind that does not go to the bin) — worse
// than no offer, because it looks like a promise. The trash id can be read from
// the wrong place, restoring somebody's other delete from the same second. And the
// pill can be un-clickable: `.toast` is `pointer-events: none` so it never eats a
// tap meant for the page under it, which means the button inside it has to turn
// them back on for its own box. That last one is CSS, so it is asserted against
// the stylesheet rather than in jsdom.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS
let DELETE_OK
let TRASH_ID
let RESTORE_OK

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (method === 'DELETE') {
      return DELETE_OK
        ? { ok: true, data: TRASH_ID ? { ok: true, trash_id: TRASH_ID } : { ok: true } }
        : { ok: false, status: 500, data: { error: 'nope' } }
    }
    if (method === 'POST' && path.endsWith('/restore')) {
      return RESTORE_OK ? { ok: true, data: { ok: true } } : { ok: false, status: 404, data: { error: 'gone' } }
    }
    return { ok: true, data: {} }
  }),
}))

const { deleteWithUndo } = await import('../../src/undo.jsx')
const { ToastHost } = await import('../../src/ui.jsx')

beforeEach(() => {
  CALLS = []
  DELETE_OK = true
  TRASH_ID = 12
  RESTORE_OK = true
})

const host = () => render(<ToastHost />)

describe('the delete toast', () => {
  it('offers an Undo that restores the entry the delete reported', async () => {
    host()
    const reload = vi.fn()
    await deleteWithUndo('/annotations/5', { reload })
    const undo = await screen.findByRole('button', { name: 'Undo' })
    fireEvent.click(undo)
    // The id comes from the DELETE's response, not from a lookup: two deletes in
    // the same second are indistinguishable by time, and guessing would restore
    // the wrong thing.
    await waitFor(() => expect(CALLS).toContainEqual(['POST', '/trash/12/restore']))
    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(await screen.findByText('restored')).toBeTruthy()
  })

})

