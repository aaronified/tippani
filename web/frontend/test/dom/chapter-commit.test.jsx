// The chapter boxes: WHEN the pairing runs, which is the half a pure test cannot
// see.
//
// THE OWNER FOUND THIS BY TYPING A TWO-DIGIT CHAPTER: "if i am at chapter 15, the
// chapter name is assigned at typing 1 and then no rewrites :) / should it not be
// assigned when the edit is complete (the typing cursor is moved)?"
//
// `chapter-pair.test.js` proves the RULE — what the pairing answers for a given
// number, and what it offers when the counterpart disagrees. It cannot catch this
// defect, because the rule was right every time it was asked and it was asked at
// the wrong moment. That is what this file is for: a keystroke must change the
// text and nothing else; a finished edit is what pairs.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// The pool the owner's case needs: chapter 1 and chapter 15 both exist, so the
// intermediate value of typing "15" is itself a real chapter with a real name.
const CHAPTERS = [
  { no: 1, name: 'Loomings', count: 9 },
  { no: 15, name: 'Chowder', count: 4 },
]

vi.mock('../../src/api.js', () => ({
  json: async (method, path) => {
    if (method === 'GET' && path === '/books') return { ok: true, data: { books: [{ id: 4, title: 'Moby-Dick', author: 'Melville' }] } }
    if (method === 'GET' && path === '/movies') return { ok: true, data: { movies: [] } }
    if (method === 'GET' && path === '/boards') return { ok: true, data: { boards: [], total: 0 } }
    if (method === 'GET' && path === '/tags') return { ok: true, data: { tags: [] } }
    if (method === 'GET' && path === '/books/4/chapters') return { ok: true, data: { chapters: CHAPTERS } }
    if (method === 'GET' && path === '/books/4/cast') return { ok: true, data: { cast: [] } }
    if (method === 'GET') return { ok: true, data: {} }
    return { ok: true, data: { id: 1 } }
  },
  errText: () => 'nope',
  upload: async () => ({ ok: true, data: {} }),
  uploadWithProgress: async () => ({ ok: true, data: {} }),
  coverImgURL: () => '',
}))

const { QuoteForm } = await import('../../src/AddSurface.jsx')

const TARGET = { kind: 'book', type: 'book', id: 4, title: 'Moby-Dick', sub: 'Melville' }

const boxes = () => ({
  no: screen.getByLabelText('Chapter #'),
  name: screen.getByLabelText('Chapter name'),
})

// The chapter pool arrives by fetch, so every case waits for it — a form that
// paired against an empty pool would pass every assertion below by doing nothing.
async function openForm() {
  render(<QuoteForm door="annotation" initialTarget={TARGET} onSaved={() => {}} />)
  await waitFor(() => expect(screen.getByLabelText('Chapter #')).toBeTruthy())
  return boxes()
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('the chapter pairing waits for the edit to finish', () => {
  it('does not fill the name while a two-digit number is being typed', async () => {
    const b = await openForm()
    // Keystroke by keystroke, exactly as a person types 15.
    fireEvent.change(b.no, { target: { value: '1' } })
    expect(b.name.value, 'chapter one’s name was assigned mid-word').toBe('')
    fireEvent.change(b.no, { target: { value: '15' } })
    expect(b.name.value).toBe('')
  })

  it('and fills it from the finished number when focus leaves the box', async () => {
    const b = await openForm()
    fireEvent.change(b.no, { target: { value: '1' } })
    fireEvent.change(b.no, { target: { value: '15' } })
    fireEvent.blur(b.no)
    await waitFor(() => expect(b.name.value).toBe('Chowder'))
  })

})

describe('the offer, when the pool disagrees with what is already there', () => {
  // The residual case, and the reason "no rewrites" needed a way back: commit 1,
  // come back, edit to 15. The name is the app's own earlier answer and it is now
  // wrong, and never-clobber on its own would strand it there forever.
  it('never overwrites the name, and offers the right one instead', async () => {
    const b = await openForm()
    fireEvent.change(b.no, { target: { value: '1' } })
    fireEvent.blur(b.no)
    await waitFor(() => expect(b.name.value).toBe('Loomings'))

    fireEvent.change(b.no, { target: { value: '15' } })
    fireEvent.blur(b.no)
    // Nothing was written over what is in the box.
    await waitFor(() => expect(b.no.value).toBe('15'))
    expect(b.name.value).toBe('Loomings')
    // And the way out is one tap.
    const chip = await screen.findByRole('button', { name: /Chowder/ })
    fireEvent.click(chip)
    await waitFor(() => expect(b.name.value).toBe('Chowder'))
    expect(screen.queryByRole('button', { name: /Chowder/ })).toBeNull()
  })

})

