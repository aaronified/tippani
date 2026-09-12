// WHICH TEXT A TRANSLATED QUOTE SHOWS, on the board that has to draw it — and the
// two unrelated settings the board publishes into the screen's ⋯ beside it.
//
// WHERE THE STATE COMES FROM IS NOT THIS FILE'S QUESTION. The precedence is
// textOrder.js's and is tested pure; the table a reader sets it in is tested in
// language-text-order.test.jsx. This file asks the one thing neither of those can:
// does a RENDERED board obey the answer.
//
// THAT GAP IS WHERE THE FEATURE BROKE ONCE ALREADY. The resolver was right and the
// table view simply never asked it, so cards led with the translation while the
// same rows in the table led with the original — with every pure test green.
//
// SO THESE DRIVE THE HOST, NOT A MENU. The ⋯ used to carry three text settings and
// these cases used to click them. That menu is retired — one device-local key
// answering the question the master slider now answers — so the state arrives here
// the way it arrives in the app: out of the reader's preferences, through
// TextOrderHost.

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'

const ROWS = [
  // A LANGUAGE ON THIS ONE AND NOT THE OTHER, so a per-language row and the master
  // can disagree inside one board — which is the whole reason the state resolves
  // per card instead of once for the screen.
  { id: 1, book_id: 1, quote: 'Call me Ishmael.', translation: 'আমাকে ইসমাইল বলে ডেকো।', language: 'Bengali', color: 'yellow', tags: [], created_at: '2024-01-01 10:00:00' },
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
const { Frame } = await import('../../src/Movies.jsx')
const { buildScreenActions } = await import('../../src/ui.jsx')
const { TextOrderHost } = await import('../../src/textOrderHost.jsx')

// `order` is the { master, byLanguage } the shell provides. Omitted, it is `{}` —
// which is what a surface nobody has wrapped gets, and it has to draw as the app
// always drew.
const board = (order) =>
  render(
    <TextOrderHost value={order}>
      <Library openId={1} onOpen={() => {}} onClose={() => {}} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />
    </TextOrderHost>,
  )

const rows = () => buildScreenActions()
const row = (name) => {
  const it = rows().find((r) => !r.heading && name.test(String(r.label)))
  expect(it, String(name)).toBeTruthy()
  return it
}
const text = () => document.body.textContent

describe('which text a quote shows', () => {
  it('draws both texts when nothing has an opinion', async () => {
    board()
    await waitFor(() => expect(text()).toContain('Call me Ishmael'))
    expect(text()).toContain('আমাকে ইসমাইল বলে ডেকো।')
  })

  it('puts the translation away when the state is the quote alone', async () => {
    board({ master: 'quote-only' })
    await waitFor(() => expect(text()).toContain('Call me Ishmael'))
    expect(text()).not.toContain('আমাকে ইসমাইল বলে ডেকো।')
  })

  it('promotes the translation into the quote’s own type, without drawing it twice', async () => {
    board({ master: 'trans-only' })
    await waitFor(() => expect(text()).toContain('আমাকে ইসমাইল বলে ডেকো।'))
    expect(text()).not.toContain('Call me Ishmael')
    // Once, not once as the words and once as the line under them.
    expect(text().split('আমাকে ইসমাইল বলে ডেকো।').length - 1).toBe(1)
  })

  it('falls back to the quote rather than emptying a card with no translation', async () => {
    board({ master: 'trans-only' })
    // A setting that blanks every untranslated quote looks like a bug that has
    // eaten the library, which is why quoteTexts prefers rather than obeys.
    await waitFor(() => expect(text()).toContain('The whale.'))
  })

  // THE CHAIN RESOLVES PER CARD, and this is the case that proves it rather than
  // asserting it. One board, one master, two cards, two different answers — which
  // a screen that read the state once and handed it down could not produce, and
  // which is exactly what the retired menu did.
  it('and a language’s own row outranks the master, card by card', async () => {
    board({ master: 'quote-only', byLanguage: { bengali: 'trans-only' } })
    // The Bengali row obeys its language: the translation, alone.
    await waitFor(() => expect(text()).toContain('আমাকে ইসমাইল বলে ডেকো।'))
    expect(text(), 'the Bengali card kept its original, so its language row lost to the master')
      .not.toContain('Call me Ishmael')
    // The row with no language of its own obeys the master, in the same board.
    expect(text(), 'the card with no language followed the Bengali row instead of the master')
      .toContain('The whale.')
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
    //
    // WAITED FOR ON THE ROW, NOT ON THE CARD, and that is the whole of a failure
    // this case produced exactly once. It waited for `.hand-card.is-selecting` to
    // appear and then read `rows()` in the SAME TICK — two different things
    // re-rendering, asserted as though one implied the other. When the card's
    // class landed first the menu was still the old one and the row was still
    // there, which is a red test over working code: the mode had come up, the
    // assertion just looked too early. Waiting on the thing the case is actually
    // about removes the race rather than outrunning it.
    await waitFor(() => expect(rows().some((r) => /^Select quotes$/.test(String(r.label)))).toBe(false))
    expect(document.querySelector('.hand-card.is-selecting')).toBeTruthy()
  })
})

// AND THE FACE IT IS SET IN REACHES THE RENDERED CARD.
//
// The pure half is text.test.js. This is the half neither a pure test nor a spec
// table can answer — does a card that is actually on screen wear the class — and it
// is the gap this file opens by describing: the resolver was right for a day while
// the table view simply never asked it.
//
// THE TAG FOLLOWS THE QUOTE, NOT THE SLOT. Row 1's language is Bengali, so it is
// `a.quote` that carries the face wherever the four states put it; the translation
// beside it is in a language nothing stores and is never tagged. Row 2 has no
// language at all, which is the case most of a library is in.
describe('the face a quote is drawn in', () => {
  it('sets the quote in its language\u2019s face and leaves the translation alone', async () => {
    board()
    await waitFor(() => expect(text()).toContain('Call me Ishmael'))
    expect(screen.getByText('Call me Ishmael.').closest('.bengali')).toBeTruthy()
    expect(screen.getByText('\u0986\u09AE\u09BE\u0995\u09C7 \u0987\u09B8\u09AE\u09BE\u0987\u09B2 \u09AC\u09B2\u09C7 \u09A1\u09C7\u0995\u09CB\u0964').closest('.bengali')).toBeNull()
  })

  // The state that moves the quote to the SECOND line. A render site working the
  // script out for itself would have tagged the big type here, which is the
  // translation.
  it('follows the quote to the second line when the translation leads', async () => {
    board({ master: 'trans-first' })
    await waitFor(() => expect(text()).toContain('Call me Ishmael'))
    expect(screen.getByText('Call me Ishmael.').closest('.bengali')).toBeTruthy()
    expect(screen.getByText('\u0986\u09AE\u09BE\u0995\u09C7 \u0987\u09B8\u09AE\u09BE\u0987\u09B2 \u09AC\u09B2\u09C7 \u09A1\u09C7\u0995\u09CB\u0964').closest('.bengali')).toBeNull()
  })

  it('tags nothing on a row with no language', async () => {
    board()
    await waitFor(() => expect(text()).toContain('The whale.'))
    expect(screen.getByText('The whale.').closest('.bengali')).toBeNull()
  })

  // THE TABLE TOO, and the three cases above did not reach it — every one of them
  // renders the CARD view, so replacing the table cell's class with '' left the
  // whole DOM suite green. That is the gap this file opens by naming ("the
  // resolver was right and the table view simply never asked it"), reopened one
  // property later: the table does ask which text leads, and until this case it
  // was nobody's job to check that it asks which face too.
  //
  // The view is a persisted preference rather than a prop, so the way to land in
  // the table is the way a returning reader lands there.
  it('reaches the table cell as well as the card', async () => {
    localStorage.setItem('tippani:annview', '"table"')
    board()
    await waitFor(() => expect(document.querySelector('.ann-table')).toBeTruthy())
    expect(screen.getByText('Call me Ishmael.').closest('.bengali')).toBeTruthy()
    expect(screen.getByText('The whale.').closest('.bengali')).toBeNull()
    localStorage.removeItem('tippani:annview')
  })
})

// AND THE FILM FRAME, which is the third of the three sites and was the other one
// no case reached. A dialogue is an annotation with different credits — 0071 gave
// it a `language` column for that reason — so a Bengali film line has exactly as
// much claim on the Bengali face as a Bengali highlight. `Frame` is rendered
// directly here because it is a leaf that takes its row as a prop: nothing about
// this property needs the screen around it, and a test that needed the screen
// would be testing the screen.
describe('the face a film line is drawn in', () => {
  const line = (over = {}) => ({
    id: 1, movie_id: 1, quote: 'Call me Ishmael.', translation: 'আমাকে ইসমাইল বলে ডেকো।',
    language: 'Bengali', color: 'yellow', tags: [], created_at: '2024-01-01 10:00:00', ...over,
  })
  // `within` the frame's own container: the file's earlier cases render a whole
  // board, and a document-wide query would be asking about whichever of them ran
  // last rather than about this frame.
  const frame = (d) => within(render(<Frame d={d} tagMap={{}} seps=",;&" />).container)

  it('sets the line in its language\u2019s face and leaves the translation alone', async () => {
    const f = frame(line())
    expect(f.getByText('Call me Ishmael.').closest('.bengali')).toBeTruthy()
    expect(f.getByText('\u0986\u09AE\u09BE\u0995\u09C7 \u0987\u09B8\u09AE\u09BE\u0987\u09B2 \u09AC\u09B2\u09C7 \u09A1\u09C7\u0995\u09CB\u0964').closest('.bengali')).toBeNull()
  })

  it('tags nothing on a line with no language', async () => {
    const f = frame(line({ quote: 'Here\u2019s looking at you, kid.', translation: '', language: '' }))
    expect(f.getByText('Here\u2019s looking at you, kid.').closest('.bengali')).toBeNull()
  })
})
