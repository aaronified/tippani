// DUPLICATE OPENS THE ADD FORM ON A COPY, and writes nothing on the way there.
//
// The pack's own words: "Everything is carried over except the words, and the
// form says so in its title — the one thing that must never be ambiguous here is
// which record Save is going to write. Nothing is created until Save: a duplicate
// you abandon is a duplicate that never existed."
//
// So the claim under test is a NEGATIVE as much as a positive: pressing the row
// must reach the shell's Add surface with a seeded draft, and must not POST.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const ROW = {
  id: 1,
  book_id: 1,
  quote: 'Manuscripts don’t burn.',
  note: 'Woland, to the Master.',
  chapter: 'Chapter Twenty-Four',
  chapter_no: 24,
  location: 'p.402',
  color: 'blue',
  tags: ['craft'],
  created_at: '2024-01-01 10:00:00',
}

const writes = []
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method !== 'GET') writes.push(`${method} ${path}`)
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: [ROW] } }
    if (path === '/books/1') return { ok: true, data: { id: 1, title: 'Moby-Dick', author: 'Herman Melville', genres: '' } }
    return { ok: true, data: { tags: [], stickers: [], people: [], items: [], annotations: [] } }
  }),
}))

const { default: Library } = await import('../../src/Library.jsx')

const opened = []
const board = () =>
  render(
    <Library
      openId={1}
      onOpen={() => {}}
      onClose={() => {}}
      creditSeparators=",;&"
      onAdd={(...args) => opened.push(args)}
      onSearch={() => {}}
      dataNonce={0}
    />,
  )

// The card's ⋯ . Scoped to the card rather than the page: the screen's own ⋯ is
// in the shell, which this test does not mount, but a bare "more" query would
// still find whichever trigger came first.
const cardMenu = async () => {
  const card = await waitFor(() => {
    const el = document.querySelector('.hand-card')
    expect(el).toBeTruthy()
    return el
  })
  const trigger = [...card.querySelectorAll('button')].find((b) => /more/i.test(b.getAttribute('aria-label') || ''))
  expect(trigger, 'the card has no ⋯').toBeTruthy()
  fireEvent.click(trigger)
}

describe('duplicating a quote', () => {

  it('opens the Add surface on this book with the quote seeded, and writes nothing', async () => {
    opened.length = 0
    writes.length = 0
    board()
    await cardMenu()
    fireEvent.click(await screen.findByRole('menuitem', { name: /Duplicate/ }))

    await waitFor(() => expect(opened.length).toBe(1))
    const [section, target, seed] = opened[0]
    expect(section).toBe('quote')
    // The book you are standing on IS the answer to "which work".
    expect(target).toEqual({ type: 'book', id: 1 })
    expect(seed.quote).toBe('Manuscripts don’t burn.')
    expect(seed.note).toBe('Woland, to the Master.')
    expect(seed.color).toBe('blue')
    expect(seed.location).toBe('p.402')
    // AN ARRAY, AND IT WAS A COMMA STRING. The old capture card kept tags in a
    // comma box so `duplicateSeed` joined them; the add-surface rework replaced
    // that box with the token input the edit forms have always used, which takes
    // the array the row already carries. One conversion fewer.
    expect(seed.tags).toEqual(['craft'])
    // And the three boxes the rework added are seeded now — a duplicate that
    // dropped the translation would be a copy whose meaning has to be retyped.
    expect(seed.translation).toBe('')
    expect(seed.language).toBe('')
    expect(seed.sticker_id).toBe(null)

    // NOTHING IS CREATED UNTIL SAVE. A duplicate you abandon is a duplicate that
    // never existed, so reaching the form must not have written a row.
    expect(writes).toEqual([])
  })
})

// ── AND THE SURFACE OPENS ON THE COPY. The half above proves the seed is sent;
// this proves the form arrives holding it, which is where a reader finds out
// whether they are editing the original.
const { default: AddSurface } = await import('../../src/AddSurface.jsx')

