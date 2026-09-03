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
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

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

describe('pressing the search box', () => {
  it('offers the fields it can parse, not just the three in the placeholder', async () => {
    fireEvent.focus(box())
    await waitFor(() => expect(menu()).toBeTruthy())
    const text = rows().join(' ')
    // A spread across the list rather than an exact roster: the point is that the
    // grammar is on offer, and pinning all sixteen would make this a test of
    // FACET_FIELDS' order.
    for (const f of ['tag:', 'author:', 'book:', 'character:', 'shelf:']) {
      expect(text, `${f} is not offered`).toContain(f)
    }
  })

  it('leaves out the fields that have no vocabulary to offer', async () => {
    fireEvent.focus(box())
    await waitFor(() => expect(menu()).toBeTruthy())
    // Absent, not listed-and-inert: a row here would open a menu with nothing in
    // it, which is the dead control this project keeps arguing against.
    expect(rows().join(' ')).not.toContain('added_from')
  })

  it('says what each field does to a search', async () => {
    fireEvent.focus(box())
    await waitFor(() => expect(menu()).toBeTruthy())
    // Two tags narrow, two authors widen — the rule facets.js has carried since it
    // landed, finally on the row that teaches the field.
    const tagRow = [...document.querySelectorAll('.token-opt')].find((b) => b.textContent.startsWith('tag:'))
    const authorRow = [...document.querySelectorAll('.token-opt')].find((b) => b.textContent.startsWith('author:'))
    expect(within(tagRow).getByText(/narrow/i)).toBeTruthy()
    expect(within(authorRow).getByText(/widen/i)).toBeTruthy()
  })
})

describe('typing in the search box', () => {
  it('narrows the field list to what is being typed', async () => {
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: 'ta' } })
    await waitFor(() => expect(rows().join(' ')).toContain('tag:'))
    expect(rows().join(' '), 'an unrelated field survived the narrowing').not.toContain('director:')
  })

  it('hands over to the value menu once a field is named', async () => {
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: 'tag:' } })
    // THE HANDOVER, and it is the `draft` guard that enforces it — `fieldOptions`
    // is empty whenever a draft exists, whatever fieldPartial says. Worth naming
    // precisely: fieldPartial ALSO refuses a word carrying a colon, and a mutation
    // run showed that second check changes nothing observable here, because the
    // draft guard has already closed the menu by then. It is kept because
    // replaceFieldPartial calls it and needs it to be right on its own; it is not
    // what makes this case pass.
    await waitFor(() => expect(rows().join(' ')).toContain('tag:grief'))
    expect(rows().join(' '), 'the field list is still up over the values').not.toContain('author:')
  })

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

  it('keeps the free text that came before the field', async () => {
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: 'manuscripts ta' } })
    await waitFor(() => expect(rows().join(' ')).toContain('tag:'))
    fireEvent.click([...document.querySelectorAll('.token-opt')].find((b) => b.textContent.startsWith('tag:')))
    // Only the word under the cursor is being answered — the rest of the box is
    // the reader's question and must survive.
    await waitFor(() => expect(box().value).toBe('manuscripts tag:'))
  })
})
