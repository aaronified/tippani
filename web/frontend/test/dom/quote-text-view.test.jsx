// WHICH TEXT A TRANSLATED QUOTE SHOWS, and the two other settings the board
// publishes into the screen's ⋯ beside it.
//
// A translated quote is two texts, and until now the board drew both and offered
// no way to say otherwise. These drive the published menu rather than a control
// on the page, because that is where the settings are: the shell renders the ⋯,
// and buildScreenActions is what it calls when the menu opens.

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const ROWS = [
  { id: 1, book_id: 1, quote: 'Call me Ishmael.', translation: 'আমাকে ইসমাইল বলে ডেকো।', color: 'yellow', tags: [], created_at: '2024-01-01 10:00:00' },
  // No translation at all — the case that decides whether "translation only" is
  // a setting or a way to empty half the board.
  { id: 2, book_id: 1, quote: 'The whale.', color: 'blue', tags: [], created_at: '2024-02-01 10:00:00' },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: ROWS } }
    if (path === '/books/1') return { ok: true, data: { id: 1, title: 'Moby-Dick', author: 'Herman Melville', genres: '' } }
    return { ok: true, data: { tags: [], stickers: [], people: [], items: [], annotations: [] } }
  }),
}))

const { default: Library } = await import('../../src/Library.jsx')
const { buildScreenActions } = await import('../../src/ui.jsx')

const board = () =>
  render(<Library openId={1} onOpen={() => {}} onClose={() => {}} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />)

const rows = () => buildScreenActions()
const row = (name) => {
  const it = rows().find((r) => !r.heading && name.test(String(r.label)))
  expect(it, String(name)).toBeTruthy()
  return it
}
const text = () => document.body.textContent

describe('which text a quote shows', () => {
  it('offers the three the pack names, with the original as the resting one', async () => {
    board()
    await waitFor(() => expect(text()).toContain('Call me Ishmael'))
    const labels = rows().filter((r) => r.sub).map((r) => r.label)
    expect(labels).toEqual(['Both', 'Quote only', 'Translation only'])
    // Every one says what it means. The whole difficulty is that most readers do
    // not know a quote here can carry a translation at all.
    expect(row(/^Both$/).sub).toMatch(/translation/i)
    expect(row(/^Both$/).checked).toBe(true)
  })

  it('draws both texts until it is told otherwise', async () => {
    board()
    await waitFor(() => expect(text()).toContain('Call me Ishmael'))
    expect(text()).toContain('আমাকে ইসমাইল বলে ডেকো।')
  })

  it('puts the translation away when the reader asks for the quote alone', async () => {
    board()
    await waitFor(() => expect(text()).toContain('আমাকে ইসমাইল বলে ডেকো।'))
    row(/^Quote only$/).onClick()
    await waitFor(() => expect(text()).not.toContain('আমাকে ইসমাইল বলে ডেকো।'))
    expect(text()).toContain('Call me Ishmael')
  })

  it('promotes the translation into the quote’s own type, without drawing it twice', async () => {
    board()
    await waitFor(() => expect(text()).toContain('Call me Ishmael'))
    row(/^Translation only$/).onClick()
    await waitFor(() => expect(text()).not.toContain('Call me Ishmael'))
    // Once, not once as the words and once as the line under them.
    const hits = text().split('আমাকে ইসমাইল বলে ডেকো।').length - 1
    expect(hits).toBe(1)
  })

  it('falls back to the quote rather than emptying a card with no translation', async () => {
    board()
    await waitFor(() => expect(text()).toContain('The whale.'))
    row(/^Translation only$/).onClick()
    // A setting that blanks every untranslated quote looks like a bug that has
    // eaten the library, which is why quoteBody prefers rather than obeys.
    await waitFor(() => expect(text()).not.toContain('Call me Ishmael'))
    expect(text()).toContain('The whale.')
  })
})

describe('the rest of what the board publishes', () => {
  it('offers all three views, including the one the toggle stopped drawing', async () => {
    board()
    await waitFor(() => expect(text()).toContain('Call me Ishmael'))
    const views = rows().filter((r) => String(r.id).startsWith('view-')).map((r) => r.label)
    expect(views).toEqual(['Tiles', 'List', 'Table'])
    expect(row(/^Tiles$/).checked).toBe(true)
    // And no toggle left in the header spending a third of a row on it.
    expect(screen.queryByRole('tab', { name: /^Table$/i })).toBeNull()
  })

  it('offers a way into selecting that can be found by looking', async () => {
    board()
    await waitFor(() => expect(text()).toContain('Call me Ishmael'))
    const start = row(/^Select quotes$/)
    expect(start).toBeTruthy()
    start.onClick()
    // The mode is up with nothing picked — the bar holds its shape at zero, and
    // the row that started it is gone rather than offering to start it again.
    await waitFor(() => expect(document.querySelector('.hand-card.is-selecting')).toBeTruthy())
    expect(rows().some((r) => /^Select quotes$/.test(String(r.label)))).toBe(false)
  })
})
