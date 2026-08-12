// What a capture leaves behind for the next one.
//
// Six quotes off one page used to be six full re-entries: pick the work, pick the
// colour, retype the tags. So a capture writes down what it used and the next one
// starts from it.
//
// THE WINDOW IS THE WHOLE DESIGN, and it exists because this feature is in direct
// tension with a rule the surface already had: no default work when opened cold,
// because a silently pre-filled work invites mis-filed quotes. Within half an hour
// you are still holding the same book and the picker SHOWS what it chose. Tomorrow
// you are not, and a stale target would file tomorrow's quote under yesterday's
// book with no signal at all. Both cases are asserted, because keeping only the
// first one is how this becomes a mis-filing bug.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const BOOKS = { books: [{ id: 4, title: 'The Dispossessed', author: 'Le Guin' }] }
const MOVIES = { movies: [{ id: 9, title: 'Casablanca', media_type: 'movie' }] }

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/books') return { ok: true, data: BOOKS }
    if (path === '/movies') return { ok: true, data: MOVIES }
    if (path === '/tags') return { ok: true, data: { tags: [] } }
    return { ok: true, data: {} }
  }),
}))

const { CaptureQuote } = await import('../../src/AddSurface.jsx')

const KEY = 'tippani:lastCapture'

const remember = (over = {}) =>
  localStorage.setItem(
    KEY,
    JSON.stringify({ at: Date.now(), color: 'blue', tags: 'grief, craft', targetKey: 'book:4', ...over }),
  )

beforeEach(() => {
  localStorage.clear()
})

const open = () => render(<CaptureQuote onCaptured={() => {}} />)

describe('a sitting', () => {
  it('starts the next capture on the same work', async () => {
    remember()
    open()
    // The picker shows what it chose, which is what keeps it from being silent.
    expect(await screen.findByText('The Dispossessed')).toBeTruthy()
  })

  it('starts it with the same colour and tags', async () => {
    remember()
    open()
    await screen.findByText('The Dispossessed')
    // The tag field carries the words, so the next quote is one keystroke from
    // being tagged the same way rather than a re-typing exercise.
    expect(screen.getByDisplayValue('grief, craft')).toBeTruthy()
  })

  it('forgets the WORK after half an hour, and keeps the colour and tags', async () => {
    // The mis-filing case. A day later, a pre-filled book is a quote in the wrong
    // place with nothing on screen to say so — while a colour and a tag carry no
    // such risk, and their worst case is visible on the card.
    remember({ at: Date.now() - 31 * 60 * 1000 })
    open()
    await waitFor(() => expect(screen.getByDisplayValue('grief, craft')).toBeTruthy())
    expect(screen.queryByText('The Dispossessed')).toBeNull()
  })

  it('never carries the quote itself', async () => {
    // The words are the one thing that is never the same twice, and a form that
    // came back holding the last quote is a form somebody saves twice by accident.
    remember({ quote: 'the last thing I saved' })
    open()
    await screen.findByText('The Dispossessed')
    expect(screen.queryByDisplayValue('the last thing I saved')).toBeNull()
  })

  it('opens cold with nothing remembered', async () => {
    open()
    await waitFor(() => expect(screen.queryByText('The Dispossessed')).toBeNull())
    expect(screen.queryByDisplayValue('grief, craft')).toBeNull()
  })

  it('survives a note written by a newer version, or by hand', async () => {
    // localStorage is editable and shared across versions of the app. A shape it
    // does not recognise must leave the form empty rather than throwing on mount —
    // this is the capture surface, and it failing to open is losing the quote.
    localStorage.setItem(KEY, '{"nonsense":true}')
    expect(() => open()).not.toThrow()
    await waitFor(() => expect(screen.queryByText('The Dispossessed')).toBeNull())
    localStorage.setItem(KEY, 'not json at all')
    expect(() => open()).not.toThrow()
  })

  it('leaves the picker empty when the remembered work is gone', async () => {
    // Deleted in another tab, or by somebody else. The list that lands is the only
    // source of truth for what can be picked.
    remember({ targetKey: 'book:999' })
    open()
    await waitFor(() => expect(screen.queryByText('The Dispossessed')).toBeNull())
  })
})
