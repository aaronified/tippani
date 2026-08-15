// Themed practice — "quiz me on this book / tag / colour / person".
//
// The server side is tested in review_theme_test.go. What is worth pinning HERE
// is the seam between a screen and the round it opens, because every failure in
// it is silent: a theme that never reaches the query string produces a perfectly
// good round over the whole library, and nobody can tell by looking that the
// book they pressed had nothing to do with it.
//
// So: the theme travels, the empty case says so rather than showing an empty
// card, and the confirm-step preference reaches a round nobody handed it to.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let SENT
let POOL

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    if (path.startsWith('/review/practice')) return { ok: true, data: { items: POOL, pool: POOL.length } }
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: { ok: true, result: 'got', stability: 7, status: 'remembered' } }
  }),
}))

const { ThemedPracticeDialog, applyReviewPrefs, themeQuery } = await import('../../src/review.jsx')

const card = (over = {}) => ({
  kind: 'book', id: 1, direction: 'source', quote: 'the only way out is through',
  title: 'Persuasion', author: 'Austen', color: 'yellow',
  options: ['Persuasion', 'Emma', 'Villette'], answer: 0, ...over,
})

const asked = () => SENT.filter((s) => s.path.startsWith('/review/practice'))

beforeEach(() => {
  SENT = []
  POOL = [card()]
  applyReviewPrefs({})
})

describe('the theme reaches the server', () => {
  it('sends only the fields the theme actually names', () => {
    expect(themeQuery({ book: 12, label: 'Persuasion' })).toBe('book=12')
    expect(themeQuery({ tag: 'grief' })).toBe('tag=grief')
    expect(themeQuery({ color: 'blue' })).toBe('color=blue')
    expect(themeQuery({ person: 'Austen' })).toBe('person=Austen')
    expect(themeQuery({ movie: 3 })).toBe('movie=3')
  })

  // An empty field must be OMITTED, not sent blank. `tag=` is a theme the server
  // reads as "no tag" — which is what the untheme round already means, so the
  // bug would be invisible: a themed round quietly serving the whole library.
  it('omits empty fields rather than sending them blank', () => {
    expect(themeQuery({ book: 0, tag: '', color: null, person: undefined })).toBe('')
    expect(themeQuery({})).toBe('')
    expect(themeQuery(null)).toBe('')
  })

  it('a label is not a filter', () => {
    // The label says what to CALL the round. It is the caller's words, and the
    // server has no parameter for it.
    expect(themeQuery({ person: 'Austen', label: 'Jane Austen' })).toBe('person=Austen')
  })

  it('asks for the themed pool, not the whole one', async () => {
    render(<ThemedPracticeDialog theme={{ tag: 'grief', label: 'grief' }} onClose={() => {}} />)
    await waitFor(() => expect(asked().length).toBe(1))
    expect(asked()[0].path).toBe('/review/practice?tag=grief')
  })

  it('names the round after the theme', async () => {
    render(<ThemedPracticeDialog theme={{ book: 4, label: 'Persuasion' }} onClose={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Persuasion').length).toBeGreaterThan(0))
  })
})

describe('a theme with nothing behind it', () => {
  // Not an error, and not an empty card. A book you have not quoted yet, or a
  // colour you stopped using, is the ordinary case.
  it('says so and offers the way out', async () => {
    POOL = []
    const onClose = vi.fn()
    render(<ThemedPracticeDialog theme={{ book: 9, label: 'Villette' }} onClose={onClose} />)
    await waitFor(() => expect(screen.getByText(/no quotes here to practise/i)).toBeTruthy())
    // By its TEXT, not by role+name: the dialog's own × is also called Close,
    // and the point of this button is that the way out is stated in the body
    // rather than left to the corner glyph.
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('the confirm step reaches a round nobody handed it to', () => {
  // THE PREFERENCE HAS NO PROP PATH HERE. A themed round opens from a work tile
  // or a tag card, neither of which knows anything about the reader — so the
  // value comes from the module App pushes it into. If that wire breaks, the
  // misclick guard silently stops applying on exactly the rounds started from
  // outside Home, and every other test still passes.
  it('is off by default: one tap grades the card', async () => {
    render(<ThemedPracticeDialog theme={{ tag: 'grief' }} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('Emma')).toBeTruthy())
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(SENT.some((s) => s.path === '/review/answer')).toBe(true))
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
  })

  it('is on when the preference is: a tap selects and Submit commits', async () => {
    applyReviewPrefs({ srSubmit: true })
    render(<ThemedPracticeDialog theme={{ tag: 'grief' }} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('Emma')).toBeTruthy())
    fireEvent.click(screen.getByText('Emma'))
    // Chosen, and nothing has left the browser.
    expect(SENT.some((s) => s.path === '/review/answer')).toBe(false)
    const submit = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(submit)
    await waitFor(() => expect(SENT.some((s) => s.path === '/review/answer')).toBe(true))
  })
})

describe('another round', () => {
  it('re-asks the server rather than replaying the same deck', async () => {
    render(<ThemedPracticeDialog theme={{ tag: 'grief' }} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('Emma')).toBeTruthy())
    fireEvent.click(screen.getByText('Persuasion')) // the answer
    await waitFor(() => expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /another round/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /another round/i }))
    await waitFor(() => expect(asked().length).toBe(2))
    // And the same theme, not a full-library round on the second pass.
    expect(asked()[1].path).toBe('/review/practice?tag=grief')
  })
})
