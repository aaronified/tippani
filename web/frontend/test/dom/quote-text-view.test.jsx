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
