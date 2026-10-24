// The add surface: one panel that asks what you are adding, then becomes that
// form alone.
//
// THE OWNER'S BRIEF: "redesign from ground up... we need to add various types of
// works, and also need to add various types of quotes. and then there is bulk
// imports. all these things need to be in the add surface." And on the forms:
// "each surface needs to only show their specific fields."
//
// `add-fields.test.js` checks the TABLE — which fields each kind claims. This
// checks that the rendered form obeys it, which is the half a table cannot prove:
// a door could offer every field in the table and draw a seventh anyway.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const posted = []
vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    if (method === 'GET' && path === '/books/4') return { ok: true, data: { id: 4, title: 'The Dispossessed', author: 'Le Guin' } }
    if (method === 'GET' && path === '/movies/9') return { ok: true, data: { id: 9, title: 'Stalker', media_type: 'movie', director: 'Tarkovsky' } }
    if (method === 'GET' && path === '/books') return { ok: true, data: { books: [{ id: 4, title: 'The Dispossessed', author: 'Le Guin' }] } }
    if (method === 'GET' && path === '/movies') return { ok: true, data: { movies: [{ id: 9, title: 'Stalker', media_type: 'movie' }] } }
    if (method === 'GET' && path === '/boards') return { ok: true, data: { boards: [{ id: 3, name: 'Others', kind: 'plain' }, { id: 7, name: 'Bengali proverbs', kind: 'proverb' }], total: 2 } }
    if (method === 'GET' && path === '/tags') return { ok: true, data: { tags: [{ name: 'craft' }] } }
    if (method === 'GET' && path === '/stickers') return { ok: true, data: { stickers: [] } }
    if (method === 'GET') return { ok: true, data: {} }
    posted.push({ path, body })
    return { ok: true, data: { id: 1 } }
  },
  errText: () => 'nope',
  upload: async () => ({ ok: true, data: {} }),
  uploadWithProgress: async () => ({ ok: true, data: {} }),
  coverImgURL: () => '',
}))

const { default: AddSurface, QuoteForm } = await import('../../src/AddSurface.jsx')

const SECTIONS = { library: true, movies: true, quotes: true, anthologies: false }
const surface = (props = {}) =>
  render(<AddSurface open sections={SECTIONS} onClose={() => {}} onAdded={() => {}} onCaptured={() => {}} {...props} />)

const form = (door, props = {}) => {
  const state = {}
  render(<QuoteForm door={door} onSaved={() => {}} onSaveState={(s) => Object.assign(state, s)} {...props} />)
  return state
}

beforeEach(() => {
  posted.length = 0
  localStorage.clear()
})

describe('a form shows only its own fields', () => {

  // A SCREEN LINE TAKES SEVERAL SPEAKERS AND A BOOK HIGHLIGHT TAKES ONE, because
  // the two columns differ and both edit forms already agreed on which is which:
  // `annotations.character` holds a person, `dialogues.character` holds a
  // comma-joined list the film page has edited as tokens since it was written.
  //
  // The add surface took ONE name on both, which the owner's audit caught — "both
  // should offer the same entry support for the same fields". A two-speaker
  // exchange could be typed here as "A, B" and stored, but only the edit form
  // helped you do it.
  it('takes several speakers on a screen line, joined the way the column stores them', async () => {
    const state = form('dialogue', { initialTarget: { type: 'movie', id: 9 } })
    await screen.findByLabelText('Quote')
    fireEvent.change(screen.getByLabelText('Quote'), { target: { value: 'a line' } })
    const box = screen.getByLabelText('Character')
    // TokenInput commits a token on Enter, which is how the edit form takes them.
    for (const name of ['Stalker', 'Writer']) {
      fireEvent.change(box, { target: { value: name } })
      fireEvent.keyDown(box, { key: 'Enter' })
    }
    await waitFor(() => expect(state.canSave).toBe(true))
    await state.save()
    expect(posted[posted.length - 1].body.character).toBe('Stalker, Writer')
  })

})

describe('what a form sends', () => {

  it('omits every field the door hard-dropped rather than sending it empty', async () => {
    // A POST here is full-state. A field the form never drew must be ABSENT from
    // the body, not empty in it — otherwise a value that arrived by import is
    // cleared by a reader who was never shown a box for it.
    const state = form('proverb')
    fireEvent.change(await screen.findByLabelText('Quote'), { target: { value: 'a saying' } })
    await waitFor(() => expect(state.canSave).toBe(true))
    await state.save()
    const body = posted[posted.length - 1].body
    for (const gone of ['speaker', 'occasion', 'occasion_date', 'place', 'recipient', 'work_title', 'locator', 'source_author']) {
      expect(body, gone).not.toHaveProperty(gone)
    }
    // And what it did draw is there, including the two it shares with every kind.
    expect(body).toHaveProperty('translation')
    expect(body).toHaveProperty('region')
    expect(body.tags).toEqual([])
  })
})

// THE WORK IS NAMED ONCE, in the header, and the sheet has no second opinion.
//
// The owner, over a phone screenshot of the book sheet: "the header has the work
// name already. Why do we still have the name and changing option? If i change
// there, the header doesn't change and it is confusing. Remove the chooser."
//
// BOTH HALVES OF THAT ARE ONE CAUSE. The header read the SURFACE's `target` and
// the row read the FORM's `draft.target`, so the row could not move the header —
// the repo's own directive against a fact living in two places, with the
// confusing screen as the receipt.
//
// It could never have been the only way to name a work, which is what makes
// removing it a fix rather than a trade: `annotation` and `dialogue` come from
// `doorsFor('work', target)` and from nowhere else, so by the time this sheet
// exists the work is settled and the header is drawing it.

