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

describe('the prune button', () => {
  it('does not draw when nothing is stranded', async () => {
    await mount()
    await waitFor(() => expect(calls).toContain('GET /people/orphans'))
    expect(screen.queryByTitle(/no work points at/i)).toBeNull()
  })

  it('says how many it would take', async () => {
    ORPHANS = { people: [{ id: 1, name: 'Nobody' }], characters: [{ id: 2, name: 'Woland' }] }
    await mount()
    await waitFor(() => expect(screen.getByTitle(/no work points at/i)).toBeTruthy())
    // Two, not one of each and not the character count alone.
    expect(screen.getByTitle(/no work points at/i).textContent).toMatch(/2/)
  })

  it('asks before it sweeps, and names both kinds', async () => {
    ORPHANS = { people: [{ id: 1, name: 'Nobody' }], characters: [{ id: 2, name: 'Woland' }] }
    await mount()
    const btn = await waitFor(() => screen.getByTitle(/no work points at/i))
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
    const btn = await waitFor(() => screen.getByTitle(/no work points at/i))
    await act(async () => { fireEvent.click(btn) })
    const confirm = [...document.querySelectorAll('button')].find((b) => /^prune$/i.test(b.textContent.trim()))
    expect(confirm, 'the confirm has a Prune button').toBeTruthy()
    await act(async () => { fireEvent.click(confirm) })
    await waitFor(() => expect(calls).toContain('POST /people/prune'))
    // And it re-reads the count, because the list it was drawn from just changed.
    expect(calls.filter((c) => c === 'GET /people/orphans').length).toBeGreaterThan(1)
  })
})
