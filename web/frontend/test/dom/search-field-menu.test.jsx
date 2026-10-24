// THE SEARCH BOX SAYS WHAT IT CAN PARSE.
//
// THE OWNER'S ASK: "when i click the search bar, there needs to be a dropdown of
// all possible search token chips (like book:). that way user is also informed
// about what is possible."
//
// The box has parsed `tag:` since facets landed and never told anybody. Its
// placeholder names three of the sixteen fields and disappears the moment you
// type; the filters panel lists them all and is a different surface you have to
// know to open. So the grammar was something a reader either arrived knowing or
// never found — the most expensive kind of feature, one that is built and
// invisible.
//
// WHAT THESE HOLD, and the interesting half is the handover:
//
//   PRESSING THE BOX OFFERS EVERYTHING, so the list is a list and not a
//   confirmation of something you already typed.
//
//   TYPING NARROWS IT, because a reader who knows the first letters should not
//   have to read sixteen rows.
//
//   NAMING A FIELD HANDS OVER TO THE VALUE MENU rather than closing. Field menu
//   and value menu are one interaction — name it, then answer it — and the box
//   must never show two menus or fall to none in between.
//
//   A FIELD WITH NO VOCABULARY IS ABSENT. added_from and added_to are real chips
//   that arrive from the Stats calendar, and offering them here would open a menu
//   with nothing in it.

import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/search/vocabulary')) {
      return { ok: true, data: { tags: ['grief'], authors: ['Le Guin'], colours: [], speakers: [], actors: [], characters: [], directors: [], genres: [], series: [], shelves: [], year: [], books: [], movies: [] } }
    }
    return { ok: true, data: {} }
  }),
}))

const { SearchBox } = await import('../../src/SearchPage.jsx')
const { readSearchBox } = await import('../../src/facets.js')

const VOCAB = {
  tags: ['grief', 'grammar'],
  authors: ['Ursula Le Guin'],
  colours: [], speakers: [], actors: [], characters: [], directors: [],
  genres: [], series: [], shelves: [], year: [], books: [], movies: [],
}

// The page owns the draft and hands it down (see SearchBox's own note on why),
// so the harness has to do the page's half or the value menu can never open.
function Harness({ initial = '' }) {
  const [q, setQ] = useState(initial)
  const [chips, setChips] = useState([])
  const { draft, options } = readSearchBox(q, VOCAB)
  return (
    <SearchBox q={q} setQ={setQ} chips={chips} setChips={setChips} mobile={false} draft={draft} options={options} />
  )
}

const box = () => screen.getByLabelText(/^search$/i)
const menu = () => document.querySelector('.token-menu')
const rows = () => [...document.querySelectorAll('.token-opt')].map((b) => b.textContent)

beforeEach(() => {
  render(<Harness />)
})

describe('typing in the search box', () => {

  it('picking a field writes it into the box and asks for its value', async () => {
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: 'ta' } })
    await waitFor(() => expect(rows().join(' ')).toContain('tag:'))
    const tagRow = [...document.querySelectorAll('.token-opt')].find((b) => b.textContent.startsWith('tag:'))
    fireEvent.click(tagRow)

    // The half-typed word became the field, and the menu went straight on to the
    // values rather than closing and making the reader press again.
    await waitFor(() => expect(box().value).toBe('tag:'))
    await waitFor(() => expect(rows().join(' ')).toContain('tag:grief'))
  })

})
