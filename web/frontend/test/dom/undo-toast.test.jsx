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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

  it('dismisses itself when the offer is taken', async () => {
    host()
    await deleteWithUndo('/annotations/5', {})
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    // The pill has nothing left to say, and leaving it up invites a second click
    // that would 404 against a spent entry.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull())
  })

  it('offers nothing when the server did not report an entry', async () => {
    // An older server, or a kind that does not go to the bin. An Undo that cannot
    // work is worse than none: it reads as a promise.
    TRASH_ID = null
    host()
    await deleteWithUndo('/tags/3', { label: 'deleted' })
    expect(await screen.findByText('deleted')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('says so when the undo itself fails, and does not claim a restore', async () => {
    RESTORE_OK = false
    host()
    await deleteWithUndo('/annotations/5', {})
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(await screen.findByText(/gone|could not undo/)).toBeTruthy()
    expect(screen.queryByText('restored')).toBeNull()
  })

  it('offers no undo for a failed delete', async () => {
    DELETE_OK = false
    host()
    const r = await deleteWithUndo('/annotations/5', {})
    expect(r.ok).toBe(false)
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    // And no toast either: the caller reports the failure its own way (an inline
    // error), so a pill here would be the second voice saying it.
    expect(screen.queryByText('deleted')).toBeNull()
  })
})

describe('the pill can actually be clicked', () => {
  const css = readFileSync(join(process.env.TIPPANI_SRC, 'index.css'), 'utf8')

  it('keeps the pill itself out of the way and opens a hole for the action', () => {
    // `.toast` is pointer-events: none on purpose — it floats over the bottom of
    // the screen, where a tap belongs to the page underneath. That makes an
    // interactive child impossible unless the child turns them back on, and this
    // is exactly the kind of thing that is only discovered by a human tapping it.
    expect(css).toMatch(/\.toast\s*\{[^}]*pointer-events:\s*none/)
    expect(css).toMatch(/\.toast-action\s*\{[^}]*pointer-events:\s*auto/)
  })

  it('gives the action a focus ring, since it is reachable by keyboard', () => {
    expect(css).toMatch(/\.toast-action:focus-visible\s*\{[^}]*outline/)
  })
})
