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

  it('and Enter is a finished edit too, since it is how the last field is left', async () => {
    const b = await openForm()
    fireEvent.change(b.no, { target: { value: '15' } })
    fireEvent.keyDown(b.no, { key: 'Enter' })
    await waitFor(() => expect(b.name.value).toBe('Chowder'))
  })

  // THE OTHER DIRECTION, which the owner reversed the emphasis on: "chapter name
  // from number is more useful" — but both run, and both wait.
  it('does not fill the number while a name is being typed', async () => {
    const b = await openForm()
    for (const v of ['C', 'Ch', 'Cho', 'Chow', 'Chowd', 'Chowde', 'Chowder']) {
      fireEvent.change(b.name, { target: { value: v } })
    }
    expect(b.no.value).toBe('')
    fireEvent.blur(b.name)
    await waitFor(() => expect(b.no.value).toBe('15'))
  })

  it('leaves a number nobody has recorded alone, and offers nothing', async () => {
    const b = await openForm()
    fireEvent.change(b.no, { target: { value: '99' } })
    fireEvent.blur(b.no)
    await waitFor(() => expect(b.no.value).toBe('99'))
    expect(b.name.value).toBe('')
    expect(screen.queryByRole('button', { name: /Loomings|Chowder/ })).toBeNull()
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

  it('and the chip clears itself the moment that box is typed in again', async () => {
    const b = await openForm()
    fireEvent.change(b.no, { target: { value: '1' } })
    fireEvent.blur(b.no)
    await waitFor(() => expect(b.name.value).toBe('Loomings'))
    fireEvent.change(b.no, { target: { value: '15' } })
    fireEvent.blur(b.no)
    await screen.findByRole('button', { name: /Chowder/ })
    // Typing is the reader saying they meant what they typed. No second control
    // needed to dismiss a state that clears itself.
    fireEvent.change(b.no, { target: { value: '16' } })
    expect(screen.queryByRole('button', { name: /Chowder/ })).toBeNull()
  })

  it('says nothing at all when the counterpart already agrees', async () => {
    const b = await openForm()
    fireEvent.change(b.name, { target: { value: 'Chowder' } })
    fireEvent.blur(b.name)
    await waitFor(() => expect(b.no.value).toBe('15'))
    // Committing the number that is already right must not raise a chip about the
    // name that is already right.
    fireEvent.change(b.no, { target: { value: '15' } })
    fireEvent.blur(b.no)
    expect(screen.queryByRole('button', { name: /Chowder/ })).toBeNull()
  })
})

describe('the boxes are comboboxes over the book’s own chapters', () => {
  // The owner's: "tag, character, chapter name, and number will be comboboxes
  // based on the available items." A native datalist opened only after a keystroke
  // in desktop Chrome, so a reader who had typed nothing saw nothing.
  it('opens its list on focus, before anything is typed', async () => {
    const b = await openForm()
    expect(b.name.getAttribute('role')).toBe('combobox')
    expect(b.no.getAttribute('role')).toBe('combobox')
    fireEvent.focus(b.name)
    const list = await screen.findByRole('listbox')
    expect(list.textContent).toContain('Loomings')
    expect(list.textContent).toContain('Chowder')
  })

  // A PICK IS A FINISHED EDIT, so it pairs immediately — no blur needed.
  it('and picking a name pairs its number on the spot', async () => {
    const b = await openForm()
    fireEvent.focus(b.name)
    fireEvent.click(await screen.findByRole('option', { name: /Chowder/ }))
    await waitFor(() => expect(b.name.value).toBe('Chowder'))
    expect(b.no.value).toBe('15')
  })

  // NOTHING IS EVER RESTRICTED TO THE POOL. Every one of these fields is optional
  // free text at the API, so a chapter nobody has recorded has to be typeable or
  // the helper becomes a cage.
  it('and still takes a chapter name the book has never seen', async () => {
    const b = await openForm()
    fireEvent.change(b.name, { target: { value: 'A chapter nobody recorded' } })
    fireEvent.blur(b.name)
    await waitFor(() => expect(b.name.value).toBe('A chapter nobody recorded'))
    expect(b.no.value).toBe('')
  })
})
