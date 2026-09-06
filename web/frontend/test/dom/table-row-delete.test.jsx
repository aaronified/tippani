// DELETE ON A TABLE ROW ASKS, LIKE DELETE ON A CARD.
//
// WHAT THIS FILE EXISTS FOR. Both table views — a book's quotes and a film's
// lines — had a Delete key that called a setter bound in its PARENT component.
// `setAsking` has no binding inside `AnnotationTable` or `DialogueTable`, so the
// bundler resolved it as a global and the key threw the moment it was pressed.
// Live, in both screens, until a rater read the diff.
//
// THE SCOPE CHECK (`test/pure/no-free-names.test.js`) catches the NAME. It cannot
// know the button works, and that is the owner's own standard for a test: "is the
// button clickable (for all buttons)?" So this presses it.
//
// AND IT ASKS RATHER THAN DELETES, which is the half that would be easy to get
// wrong while fixing the first half. Both screens bind the prop these rows call
// to `setAsking` — the same question the CARD view puts — so a Delete that
// deleted outright would be a worse defect than the crash it replaced, and one
// nothing else would notice.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the view lives in `localStorage` under
// `tippani:annview` / `tippani:view:dialogues`, so a table is reached by setting
// it before the screen mounts, the way a returning reader reaches it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS

const ANNOTATIONS = [
  { id: 11, book_id: 1, quote: 'Call me Ishmael.', color: 'yellow', tags: [], created_at: '2024-01-01 10:00:00' },
]
const DIALOGUES = [
  { id: 21, movie_id: 1, quote: 'Round up the usual suspects.', character: 'Renault', timestamp: '01:32', color: 'yellow', tags: [], created_at: '2024-01-01 10:00:00' },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: ANNOTATIONS } }
    if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: DIALOGUES } }
    if (path === '/books/1') return { ok: true, data: { id: 1, title: 'Moby-Dick', author: 'Herman Melville', genres: '' } }
    if (path === '/movies/1') return { ok: true, data: { id: 1, title: 'Casablanca', media_type: 'movie' } }
    return { ok: true, data: { tags: [], stickers: [], people: [], items: [], annotations: [], dialogues: [], cast: [] } }
  }),
}))

const { default: Library } = await import('../../src/Library.jsx')
const { default: Movies } = await import('../../src/Movies.jsx')

beforeEach(() => { CALLS = [] })
afterEach(() => { cleanup(); localStorage.clear() })

const inTableView = (key) => localStorage.setItem(key, JSON.stringify('table'))

describe.each([
  ['a book’s quotes', 'tippani:annview', () => (
    <Library openId={1} onOpen={() => {}} onClose={() => {}} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />
  ), 'Call me Ishmael.'],
  ['a film’s lines', 'tippani:view:dialogues', () => (
    <Movies openId={1} onOpen={() => {}} onClose={() => {}} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />
  ), 'Round up the usual suspects.'],
])('Delete on a row of %s', (_what, viewKey, screenOf, line) => {
  it('is pressable at all — it used to throw on the press', async () => {
    inTableView(viewKey)
    render(screenOf())
    await screen.findByText(new RegExp(line.slice(0, 16)))
    const keys = screen.getAllByRole('button', { name: /^Delete$/i })
    expect(keys.length, 'the table row draws no Delete key').toBeGreaterThan(0)
    // A throw inside a React handler does NOT come back out of fireEvent — the
    // synthetic event system reports it to the window and the press returns
    // normally — so pressing alone asserts nothing. Listen for it.
    const thrown = []
    const heard = (e) => thrown.push(e.error?.message || e.message)
    window.addEventListener('error', heard)
    try { fireEvent.click(keys[0]) } finally { window.removeEventListener('error', heard) }
    expect(thrown, 'the press threw').toEqual([])
  })

  it('and asks before it deletes, the way the card view asks', async () => {
    inTableView(viewKey)
    render(screenOf())
    await screen.findByText(new RegExp(line.slice(0, 16)))
    fireEvent.click(screen.getAllByRole('button', { name: /^Delete$/i })[0])
    // The app's own question, not the browser's confirm(): the row's words are
    // shown back so a reader can see which row is under their finger.
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    expect(CALLS.some(([m]) => m === 'DELETE'), 'the row was deleted without asking').toBe(false)
  })
})
