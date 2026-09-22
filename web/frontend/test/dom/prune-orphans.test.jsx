// The prune button, and the two things it must not do.
//
// A BULK DELETE THAT DRAWS AT ZERO teaches a reader that pressing it does
// nothing, and then one day it does something. So the button's absence at zero is
// the first assertion here, ahead of anything it does when pressed.
//
// A BULK DELETE THAT SKIPS THE CONFIRM is unrecoverable in the reader's eyes even
// though the records went to the bin: they pressed one thing and a list emptied.
// The second assertion is that the POST does not happen until the dialog is
// answered.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const calls = []
let ORPHANS = { people: [], characters: [] }

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    calls.push(`${method} ${path}`)
    if (path === '/people/orphans') return { ok: true, data: ORPHANS }
    if (path === '/people/prune') {
      return { ok: true, data: { people: ORPHANS.people.length, characters: ORPHANS.characters.length } }
    }
    if (path === '/characters') return { ok: true, data: { characters: [] } }
    if (path === '/people/records') return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  }),
}))

const { CharactersConsole } = await import('../../src/MetadataPage.jsx')

const mount = async () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await act(async () => {
      render(<CharactersConsole />)
    })
  } finally {
    quiet.mockRestore()
  }
}

beforeEach(() => {
  calls.length = 0
  ORPHANS = { people: [], characters: [] }
})

// LOCATED BY ITS NAME, NOT BY A `title` ATTRIBUTE. The button was a GhostButton
// carrying a native `title`, and these cases reached for it through that — which
// is the file reading the app's markup rather than using it. When the row was put
// on one line the control became an `IconButton`, which names itself through the
// accessible name and a `Tooltip` instead, and all three cases went red over a
// button that was plainly still on the screen doing its job.
//
// The name is the better handle anyway: it is what a person hears, what a hold on
// a phone answers with, and what survives the next change of chrome.
describe('the prune button', () => {
  it('does not draw when nothing is stranded', async () => {
    await mount()
    await waitFor(() => expect(calls).toContain('GET /people/orphans'))
    expect(screen.queryByRole('button', { name: /prune/i })).toBeNull()
  })

  it('says how many it would take', async () => {
    ORPHANS = { people: [{ id: 1, name: 'Nobody' }], characters: [{ id: 2, name: 'Woland' }] }
    await mount()
    await waitFor(() => expect(screen.getByRole('button', { name: /prune/i })).toBeTruthy())
    // Two, not one of each and not the character count alone.
    expect(screen.getByRole('button', { name: /prune/i }).textContent).toMatch(/2/)
  })

  it('asks before it sweeps, and names both kinds', async () => {
    ORPHANS = { people: [{ id: 1, name: 'Nobody' }], characters: [{ id: 2, name: 'Woland' }] }
    await mount()
    const btn = await waitFor(() => screen.getByRole('button', { name: /prune/i }))
    await act(async () => { fireEvent.click(btn) })
    // Nothing has been deleted yet — the dialog is open and unanswered.
    expect(calls).not.toContain('POST /people/prune')
    // "1 person and 1 character", so the reader can recognise the number.
    expect(document.body.textContent).toMatch(/1 person/i)
    expect(document.body.textContent).toMatch(/1 character/i)
  })

  it('sweeps once the dialog is answered', async () => {
    ORPHANS = { people: [{ id: 1, name: 'Nobody' }], characters: [] }
    await mount()
    const btn = await waitFor(() => screen.getByRole('button', { name: /prune/i }))
    await act(async () => { fireEvent.click(btn) })
    const confirm = [...document.querySelectorAll('button')].find((b) => /^prune$/i.test(b.textContent.trim()))
    expect(confirm, 'the confirm has a Prune button').toBeTruthy()
    await act(async () => { fireEvent.click(confirm) })
    await waitFor(() => expect(calls).toContain('POST /people/prune'))
    // And it re-reads the count, because the list it was drawn from just changed.
    expect(calls.filter((c) => c === 'GET /people/orphans').length).toBeGreaterThan(1)
  })
})
