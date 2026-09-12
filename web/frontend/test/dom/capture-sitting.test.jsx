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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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

const { QuoteForm } = await import('../../src/AddSurface.jsx')

const KEY = 'tippani:lastCapture'

const remember = (over = {}) =>
  localStorage.setItem(
    KEY,
    JSON.stringify({ at: Date.now(), color: 'blue', tags: 'grief, craft', targetKey: 'book:4', ...over }),
  )

beforeEach(() => {
  localStorage.clear()
})

// `door="annotation"` because a sitting is ABOUT the work: the memory that
// matters is which book you are holding, and only the two work-backed doors have
// a work to remember. The colour and the tags are shared with every door.
// THE WORK IS NOT DRAWN ON THIS FORM ANY MORE, and these cases used to read it
// off the "which book" row — a row the owner had removed as a second copy of the
// header's own name. Four of them then passed VACUOUSLY: `queryByText('The
// Dispossessed')` is null on a form that never prints a title, so "it forgot the
// work" and "it never knew one" became the same green.
//
// So the sitting is asserted by its CONSEQUENCE instead: a form with no work
// cannot save, and says so in `why`. That is the thing the memory exists to buy —
// the next quote goes to the same book without being asked again — and unlike a
// label it cannot be satisfied by rendering nothing.
const TARGET_REQUIRED = 'Pick a book, film or show'
const open = () => {
  const state = {}
  render(<QuoteForm door="annotation" onSaved={() => {}} onSaveState={(v) => Object.assign(state, v)} />)
  return state
}
// A quote typed in, so `why` is answering about the WORK rather than about the
// empty words every fresh form has.
const withQuote = async (state) => {
  fireEvent.change(await screen.findByLabelText('Quote'), { target: { value: 'a line' } })
  return state
}
const hasWork = (state) => waitFor(() => expect(state.why).not.toBe(TARGET_REQUIRED))
const hasNoWork = (state) => waitFor(() => expect(state.why).toBe(TARGET_REQUIRED))

describe('a sitting', () => {
  it('starts the next capture on the same work', async () => {
    remember()
    await hasWork(await withQuote(open()))
  })

  it('starts it with the same colour and tags', async () => {
    remember()
    await hasWork(await withQuote(open()))
    // The tag field carries the words, so the next quote is one keystroke from
    // being tagged the same way rather than a re-typing exercise.
    // PILLS, NOT A COMMA BOX. The form took a token input in the add-surface
    // rework, which is what the three edit forms have always used — so the
    // remembered tags come back as two chips rather than one string.
    expect(screen.getByText('grief')).toBeTruthy()
    expect(screen.getByText('craft')).toBeTruthy()
  })

  it('forgets the WORK after half an hour, and keeps the colour and tags', async () => {
    // The mis-filing case. A day later, a pre-filled book is a quote in the wrong
    // place with nothing on screen to say so — while a colour and a tag carry no
    // such risk, and their worst case is visible on the card.
    remember({ at: Date.now() - 31 * 60 * 1000 })
    const state = open()
    await waitFor(() => expect(screen.getByText('grief')).toBeTruthy())
    expect(screen.getByText('craft')).toBeTruthy()
    await hasNoWork(await withQuote(state))
  })

  it('never carries the quote itself', async () => {
    // The words are the one thing that is never the same twice, and a form that
    // came back holding the last quote is a form somebody saves twice by accident.
    remember({ quote: 'the last thing I saved' })
    const state = open()
    expect(screen.queryByDisplayValue('the last thing I saved')).toBeNull()
    // The work still came back — it is the quote alone that is dropped.
    await hasWork(await withQuote(state))
  })

  it('opens cold with nothing remembered', async () => {
    await hasNoWork(await withQuote(open()))
    expect(screen.queryByText('grief')).toBeNull()
  })

  it('survives a note written by a newer version, or by hand', async () => {
    // localStorage is editable and shared across versions of the app. A shape it
    // does not recognise must leave the form empty rather than throwing on mount —
    // this is the capture surface, and it failing to open is losing the quote.
    localStorage.setItem(KEY, '{"nonsense":true}')
    let state
    expect(() => { state = open() }).not.toThrow()
    await hasNoWork(await withQuote(state))
    localStorage.setItem(KEY, 'not json at all')
    expect(() => open()).not.toThrow()
  })

  it('leaves the picker empty when the remembered work is gone', async () => {
    // Deleted in another tab, or by somebody else. The list that lands is the only
    // source of truth for what can be picked.
    remember({ targetKey: 'book:999' })
    await hasNoWork(await withQuote(open()))
  })
})
