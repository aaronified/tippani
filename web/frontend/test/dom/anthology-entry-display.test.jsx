// WHAT ONE ENTRY SHOWS AND SAYS (0094), as a reader meets it.
//
// The page and the reading view draw the quote's own parts (its note, its translation, its language, its tags, and the
// text around it) under the anthology's switches, with one entry's own choice laid over them. These cases open the
// page and the reading view the way a reader does and read what is on the screen; the entry's dialog is opened from
// its menu and its Save is pressed, and what the server is sent is read back.
//
// WHAT THIS KNOWS, and why nothing observable could serve: the request the dialog makes, because "the library's quote
// is never written" is a claim about what is NOT sent, and only the call list can show an absence.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CALLS, DETAIL

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/anthologies/1') return { ok: true, data: DETAIL }
    if (method === 'GET' && path === '/anthologies/1/removed') return { ok: true, data: { removed: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: AnthologiesPage } = await import('../../src/anthologies.jsx')
const ENTRY_MORE = 'More for this entry'
const noop = () => {}
const open = () => render(<AnthologiesPage openId={1} onOpen={noop} onClose={noop} onOpenBook={noop} onOpenMovie={noop} />)

const entry = (extra = {}) => ({
  kind: 'book', item_id: 1, position: 1, note: '', quote: 'Where the mind is without fear', quote_note: 'My father\'s favourite.',
  translation: 'A mind with no fear in it.', language: 'Bengali', tags: ['hope', 'poems'],
  context_before: 'It is the last poem.', context_after: 'And the head is held high.',
  color: 'yellow', favorite: false, source: 'Gitanjali', credit: 'Tagore', work_id: 1, ...extra,
})

beforeEach(() => {
  CALLS = []
  DETAIL = { anthology: { id: 1, title: 'Poems', intro: '', entries: 1, group_by: '' }, entries: [entry()], sections: [] }
})
afterEach(() => vi.restoreAllMocks())

const page = async () => { await screen.findByText('Where the mind is without fear') }
const text = () => document.body.textContent

describe('the page', () => {
  it('shows the quote\'s own note as it always did, and waits to be asked for the rest', async () => {
    open()
    await page()
    expect(text()).toContain('My father\'s favourite.')
    for (const hidden of ['A mind with no fear in it.', 'hope · poems', 'It is the last poem.', 'And the head is held high.']) {
      expect(text(), `${hidden} showed with no switch on`).not.toContain(hidden)
    }
  })

  it('shows what the anthology switched on, and not the note it switched off', async () => {
    DETAIL.anthology.fields = { translation: true, tags: true, context: true, language: true, note: false }
    open()
    await page()
    for (const shown of ['A mind with no fear in it.', 'hope · poems', 'It is the last poem.', 'And the head is held high.', 'Bengali']) {
      expect(text()).toContain(shown)
    }
    expect(text()).not.toContain('My father\'s favourite.')
  })

  it('lets one entry show what its anthology hides, and hide what it shows', async () => {
    DETAIL.entries = [entry({ fields: { translation: true } }), entry({ item_id: 2, position: 2, quote: 'Second line', translation: 'Another translation.' })]
    open()
    await page()
    expect(text()).toContain('A mind with no fear in it.')
    expect(text()).not.toContain('Another translation.')

    DETAIL.anthology.fields = { translation: true }
    DETAIL.entries = [entry({ fields: { translation: false } }), entry({ item_id: 2, position: 2, quote: 'Second line', translation: 'Another translation.' })]
    document.body.innerHTML = ''
    open()
    await screen.findByText('Second line')
    expect(text()).toContain('Another translation.')
    expect(text()).not.toContain('A mind with no fear in it.')
  })
})

describe('the reading view', () => {
  it('draws the same parts as the page, per entry', async () => {
    DETAIL.anthology.fields = { translation: true, context: true }
    DETAIL.entries = [entry({ fields: { context: false } })]
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Read' }))
    const r = await screen.findByRole('dialog', { name: /Reading Poems/ })
    expect(r.textContent).toContain('A mind with no fear in it.')
    expect(r.textContent).not.toContain('It is the last poem.')
  })
})

describe('the entry\'s own dialog', () => {
  const openDialog = async () => {
    open()
    await page()
    fireEvent.click(screen.getByRole('button', { name: ENTRY_MORE }))
    fireEvent.click(within(await screen.findByRole('menu')).getByText('What it shows and says'))
    return await screen.findByRole('dialog')
  }

  it('sends a restated translation to the entry, and nothing about the quote itself', async () => {
    const d = await openDialog()
    const box = within(d).getByDisplayValue('A mind with no fear in it.')
    fireEvent.change(box, { target: { value: 'A fearless mind.' } })
    fireEvent.click(within(d).getAllByRole('button', { name: /^save/i })[0])
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && /\/entries\/book\/1\/display$/.test(p))).toBe(true))
    const [, path, body] = CALLS.find(([m, p]) => m === 'PUT' && /\/display$/.test(p))
    expect(path).toBe('/anthologies/1/entries/book/1/display')
    expect(body.edits).toEqual({ translation: 'A fearless mind.' })
    expect(CALLS.filter(([m, p]) => m !== 'GET' && !/\/display$/.test(p)), 'something other than the entry was written').toEqual([])
  })

  it('offers the quote\'s own words back after a restatement, and clears it with a null', async () => {
    DETAIL.entries = [entry({ translation: 'A fearless mind.', edits: { translation: 'A fearless mind.' }, originals: { translation: 'A mind with no fear in it.' } })]
    const d = await openDialog()
    fireEvent.click(within(d).getByRole('button', { name: /put the quote's own back/i }))
    fireEvent.click(within(d).getAllByRole('button', { name: /^save/i })[0])
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && /\/display$/.test(p))).toBe(true))
    expect(CALLS.find(([m, p]) => m === 'PUT' && /\/display$/.test(p))[2].edits).toEqual({ translation: null })
  })
})
