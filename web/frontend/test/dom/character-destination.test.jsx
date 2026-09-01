// The character page: every work they are in, and everything a reader can do
// about it from here.
//
// THE OWNER'S BRIEF, VERBATIM: "build the character part of metadata so that i can
// merge them easily or tag them to multiple works (or remove works), see work wise
// images that has been added to them, or actors assigned in different works" and
// "browse, replace, promote artwork… this is the complete character metadata
// destination."
//
// So each claim below is one of those, and the ones worth arguing are:
//
//   A WORK'S PICTURE IS NOT THE RECORD'S. A character record has one face and each
//   work holds its own still, and the two are stored in two places for a reason: a
//   panel that silently substituted the record's picture where a work has none
//   could not then SAY the work has none — which is the state a reader opens this
//   screen to fix.
//
//   REMOVING A WORK IS REFUSED WHILE ITS QUOTES NAME THE CHARACTER, and the
//   refusal is a QUESTION rather than an error. A character named on a work's own
//   line is adopted back onto its cast on the next read, for ever, so a removal
//   that ignores the lines undoes itself. The 409 carries the count because
//   rewriting three lines and rewriting ninety are different decisions.
//
//   THE TAG CARRIES THE RECORD'S ID. `POST /books/{id}/cast` takes a name and
//   resolves it, which on a work already holding a same-named character files the
//   row under a record the reader never chose — silently and permanently.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CHARACTER
let CALLS
let DROP // what DELETE /characters/{id}/works/{cast} answers with

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/characters/3') return { ok: true, data: CHARACTER }
    if (method === 'GET' && path === '/books') {
      return { ok: true, data: { books: [{ id: 1, title: 'The Master and Margarita', cover_path: 'covers/mm.jpg' }, { id: 2, title: 'The White Guard', cover_path: '' }] } }
    }
    if (method === 'GET' && path === '/movies') {
      return { ok: true, data: { movies: [{ id: 5, title: 'The Master and Margarita (2005)', poster_path: 'covers/mm05.jpg', media_type: 'show' }] } }
    }
    if (method === 'DELETE' && path.includes('/works/')) return DROP
    if (method === 'GET' && path.startsWith('/characters/search')) {
      return { ok: true, data: { characters: [{ id: 8, name: 'Woland', works: 4 }] } }
    }
    return { ok: true, data: {} }
  }),
}))

const { characterPanel } = await import('../../src/identity.jsx')
const body = (panel) => panel.render()
const stack = () => ({ push: vi.fn(), open: vi.fn() })

const APPEARANCES = [
  {
    cast_id: 11, kind: 'book', work_id: 1, work_title: 'The Master and Margarita',
    character: 'Woland', actor_id: 0, actor: '', image: '', cover: 'covers/mm.jpg', media_type: '',
  },
  {
    cast_id: 12, kind: 'movie', work_id: 5, work_title: 'The Master and Margarita (2005)',
    character: 'Woland', actor_id: 9, actor: 'Oleg Basilashvili',
    image: 'characters/woland-2005.jpg', cover: 'covers/mm05.jpg', media_type: 'show',
  },
]

beforeEach(() => {
  CALLS = []
  DROP = { ok: true, status: 200, data: { quotes: 0 } }
  CHARACTER = {
    id: 3, name: 'Woland', sort_name: '', description: '', note: '', image_path: '',
    aliases: ['Messire'], appearances: APPEARANCES,
  }
})
afterEach(() => cleanup())

const open = async () => {
  render(body(characterPanel(stack(), { id: 3, name: 'Woland' })))
  await screen.findByText('The Master and Margarita')
}
const card = (title) => screen.getByText(title).closest('.char-work')

describe('every work they are in, as a shelf rather than a list', () => {
  it('draws each work’s own cover, so the row is recognised before it is read', async () => {
    await open()
    const covers = [...document.querySelectorAll('.char-work-cover')]
    expect(covers).toHaveLength(2)
    expect(covers.every((c) => c.tagName === 'IMG' && c.getAttribute('src'))).toBe(true)
  })

  it('says which kind of work each one is', async () => {
    await open()
    // A series is not a film, and the card says so from media_type rather than
    // calling everything on the movies table a film.
    expect(within(card('The Master and Margarita (2005)')).getByText(/show|series/i)).toBeTruthy()
    expect(within(card('The Master and Margarita')).getByText(/book/i)).toBeTruthy()
  })

  it('carries the performer for the work that has one, as a door to their record', async () => {
    const s = stack()
    render(body(characterPanel(s, { id: 3, name: 'Woland' })))
    const who = await screen.findByText('Oleg Basilashvili')
    act(() => who.click())
    expect(s.push).toHaveBeenCalledTimes(1)
  })
})

describe('the picture on each work, and the one that is the record’s', () => {
  it('shows the work’s own still where it has one and an empty slot where it does not', async () => {
    await open()
    // NOT the record's picture substituted in. A panel that fills the gap cannot
    // then say there is a gap.
    expect(within(card('The Master and Margarita (2005)')).getByRole('button', { name: /picture/i })).toBeTruthy()
    const bookFace = within(card('The Master and Margarita')).getByRole('button', { name: /picture/i })
    expect(bookFace.className).toContain('is-empty')
  })

  it('offers promotion only where there is something to promote', async () => {
    await open()
    expect(within(card('The Master and Margarita (2005)')).getByText(/use this one/i)).toBeTruthy()
    // ABSENT, not disabled. There is nothing to promote and a greyed control
    // invites a press that can only fail.
    expect(within(card('The Master and Margarita')).queryByText(/use this one/i)).toBeNull()
  })

  it('promotes a work’s picture to the record by its cast row', async () => {
    await open()
    act(() => within(card('The Master and Margarita (2005)')).getByText(/use this one/i).click())
    await waitFor(() => expect(CALLS.some(([m, p, b]) => m === 'PUT' && p === '/characters/3/image' && b.cast_id === 12)).toBe(true))
  })

  it('marks the work whose picture the record already wears, and stops offering it', async () => {
    CHARACTER = { ...CHARACTER, image_path: 'characters/woland-2005.jpg' }
    await open()
    const c = card('The Master and Margarita (2005)')
    expect(within(c).getByText(/their face/i)).toBeTruthy()
    expect(within(c).queryByText(/use this one/i)).toBeNull()
  })

  it('replaces one work’s picture through the cast row, never the record', async () => {
    await open()
    act(() => within(card('The Master and Margarita (2005)')).getByRole('button', { name: /picture/i }).click())
    const url = await screen.findByPlaceholderText(/https?:|url|address|link/i)
    fireEvent.change(url, { target: { value: 'https://example.test/woland.jpg' } })
    act(() => screen.getByText('Apply').closest('button').click())
    await waitFor(() => expect(CALLS.some(([m, p, b]) => m === 'POST' && p === '/cast/12/image' && b.image_url === 'https://example.test/woland.jpg')).toBe(true))
    // AND NOT the record: the two pictures are two facts and this control only
    // ever touches the work's.
    expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/characters/3/image')).toBe(false)
  })
})

describe('tagging them onto another work', () => {
  it('offers the works they are not already in, and none of the ones they are', async () => {
    await open()
    act(() => screen.getByText('Add to a work').closest('button').click())
    await screen.findByPlaceholderText(/find a book or a film/i)
    const picks = await screen.findAllByRole('button', { name: /The White Guard/ })
    expect(picks.length).toBe(1)
    // Already in both of these, so neither is on offer.
    expect(document.querySelectorAll('.char-pick').length).toBe(1)
  })

  it('sends the character’s id and the work, not a name to be resolved', async () => {
    await open()
    act(() => screen.getByText('Add to a work').closest('button').click())
    const pick = await screen.findByRole('button', { name: /The White Guard/ })
    act(() => pick.click())
    await waitFor(() => expect(
      CALLS.some(([m, p, b]) => m === 'POST' && p === '/characters/3/works' && b.kind === 'book' && b.work_id === 2),
    ).toBe(true))
    // The cast endpoint takes a NAME and would resolve it to whichever record on
    // that work is spelled the same. Never that one.
    expect(CALLS.some(([, p]) => p === '/books/2/cast')).toBe(false)
  })
})

describe('taking them off a work', () => {
  it('asks once, then removes when nothing quotes them', async () => {
    await open()
    act(() => within(card('The Master and Margarita')).getByLabelText(/Take this character off/).click())
    act(() => within(card('The Master and Margarita')).getByText('Remove').closest('button').click())
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/characters/3/works/11')).toBe(true))
  })

  it('turns the server’s refusal into a question that carries the count', async () => {
    DROP = { ok: false, status: 409, data: { quotes: 12 } }
    await open()
    act(() => within(card('The Master and Margarita')).getByLabelText(/Take this character off/).click())
    act(() => within(card('The Master and Margarita')).getByText('Remove').closest('button').click())
    // THE NUMBER IS THE DECISION. Rewriting twelve lines is not the same act as
    // rewriting one, and a bare "conflict" would make the reader guess.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/12 quotes/)).toBeTruthy()
    expect(within(dialog).getByText(/The Master and Margarita/)).toBeTruthy()
  })

  it('replaces the speaker on every quote and then removes', async () => {
    DROP = { ok: false, status: 409, data: { quotes: 2 } }
    await open()
    act(() => within(card('The Master and Margarita')).getByLabelText(/Take this character off/).click())
    act(() => within(card('The Master and Margarita')).getByText('Remove').closest('button').click())
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByPlaceholderText(/another character/i), { target: { value: 'Messire' } })
    DROP = { ok: true, status: 200, data: { quotes: 2 } }
    act(() => within(dialog).getByText(/Rename them and remove/i).click())
    await waitFor(() => expect(
      CALLS.some(([m, p]) => m === 'DELETE' && p === '/characters/3/works/11?quotes=replace&to=Messire'),
    ).toBe(true))
  })

  it('offers clearing the speaker as the other way out', async () => {
    DROP = { ok: false, status: 409, data: { quotes: 2 } }
    await open()
    act(() => within(card('The Master and Margarita')).getByLabelText(/Take this character off/).click())
    act(() => within(card('The Master and Margarita')).getByText('Remove').closest('button').click())
    const dialog = await screen.findByRole('dialog')
    DROP = { ok: true, status: 200, data: { quotes: 2 } }
    act(() => within(dialog).getByText(/no speaker/i).click())
    await waitFor(() => expect(
      CALLS.some(([m, p]) => m === 'DELETE' && p === '/characters/3/works/11?quotes=clear'),
    ).toBe(true))
  })

  it('will not let the reader simply proceed, because proceeding does not work', async () => {
    // There is no third button. A character named on a work's own quotes is put
    // back on its cast the next time the work is opened, so a removal that leaves
    // the lines alone undoes itself — offering it would be offering a no-op.
    DROP = { ok: false, status: 409, data: { quotes: 2 } }
    await open()
    act(() => within(card('The Master and Margarita')).getByLabelText(/Take this character off/).click())
    act(() => within(card('The Master and Margarita')).getByText('Remove').closest('button').click())
    const dialog = await screen.findByRole('dialog')
    const labels = within(dialog).getAllByRole('button').map((b) => b.textContent.toLowerCase())
    expect(labels.some((l) => /remove anyway|proceed|ignore/.test(l))).toBe(false)
  })
})

describe('merging a duplicate in', () => {
  // THE TABLE THIS IS NEEDED ON MOST. The 3.1.0 backfill deliberately makes a
  // character record PER WORK — eight films of one wizard are eight Harry Potters
  // — on the promise that a wrongly-split record is visible and mergeable.
  it('searches the character table and merges through the character endpoint', async () => {
    await open()
    fireEvent.change(screen.getByPlaceholderText('find the other record…'), { target: { value: 'Woland' } })
    const hit = await screen.findByText('4 works')
    expect(hit).toBeTruthy()
    expect(CALLS.some(([m, p]) => m === 'GET' && p.startsWith('/characters/search'))).toBe(true)
    expect(CALLS.some(([, p]) => p.startsWith('/people/search'))).toBe(false)
  })
})
