// SECTIONS AND GROUPING ON AN ANTHOLOGY'S PAGE.
//
// A section is a heading the reader writes among the passages; it shares their order, so a passage
// moves past it in one step and it moves past a passage. Grouping is a display setting: one header
// per run of passages with the same work, person or character, and a section ends a run.

import { beforeEach, describe, expect, it, vi } from 'vitest'
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
const noop = () => {}
const open = () => render(<AnthologiesPage openId={1} onOpen={noop} onClose={noop} onOpenBook={noop} onOpenMovie={noop} />)

const entry = (itemID, position, quote, over = {}) => ({
  kind: 'book', item_id: itemID, position, note: '', quote, quote_note: '', color: 'yellow', favorite: false,
  source: 'Walden', credit: 'Thoreau', work_id: 1, ...over,
})

beforeEach(() => {
  CALLS = []
  DETAIL = {
    anthology: { id: 1, title: 'Parts', intro: '', entries: 3, group_by: '' },
    entries: [entry(1, 1, 'First passage.'), entry(2, 3, 'Second passage.'), entry(3, 4, 'Third passage.', { source: 'Dune', work_id: 2, credit: 'Herbert' })],
    sections: [{ id: 7, position: 2, title: 'Part two', prose: 'Where it turns.' }],
  }
})

const order = () => [...document.querySelectorAll('.anthology-quote, [data-testid="anthology-section"] h2')].map((n) => n.textContent)

describe('an anthology with sections', () => {
  it('draws a heading and its text between the passages it was placed among', async () => {
    open()
    await screen.findByText('First passage.')
    expect(order()).toEqual(['First passage.', 'Part two', 'Second passage.', 'Third passage.'])
    expect(screen.getByText('Where it turns.')).toBeTruthy()
  })

  it('adds a section at the end with the heading and the text that were typed', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Add a section' }))
    fireEvent.change(await screen.findByLabelText(/Heading/), { target: { value: 'Epilogue' } })
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Text under it/ }), { target: { value: 'After all.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Save/ }))
    await waitFor(() => expect(CALLS).toContainEqual(['POST', '/anthologies/1/sections', { title: 'Epilogue', prose: 'After all.' }]))
  })

  it('moves a passage past a heading by naming the heading as the slot to follow', async () => {
    open()
    await screen.findByText('First passage.')
    const card = screen.getByText('First passage.').closest('.tp-card') || screen.getByText('First passage.').parentElement.parentElement
    fireEvent.click(within(card).getByRole('button', { name: /more for this entry/i }))
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Move down'))
    await waitFor(() => expect(CALLS.some(([, p]) => p === '/anthologies/1/order')).toBe(true))
    expect(CALLS.find(([, p]) => p === '/anthologies/1/order')[2]).toEqual({
      kind: 'book', item_id: 1, after: { kind: 'section', item_id: 7 },
    })
  })

  it('moves a heading through the same route, as a slot of its own kind', async () => {
    open()
    const block = (await screen.findByText('Part two')).closest('[data-testid="anthology-section"]')
    fireEvent.click(within(block).getByRole('button', { name: /section actions/i }))
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Move down'))
    await waitFor(() => expect(CALLS.some(([, p]) => p === '/anthologies/1/order')).toBe(true))
    expect(CALLS.find(([, p]) => p === '/anthologies/1/order')[2]).toEqual({
      kind: 'section', item_id: 7, after: { kind: 'book', item_id: 2 },
    })
  })

  it('deletes a heading only after saying that the passages stay', async () => {
    open()
    const block = (await screen.findByText('Part two')).closest('[data-testid="anthology-section"]')
    fireEvent.click(within(block).getByRole('button', { name: /section actions/i }))
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Delete'))
    expect(await screen.findByText(/The passages under it stay where they are/)).toBeTruthy()
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(CALLS).toContainEqual(['DELETE', '/anthologies/1/sections/7', undefined]))
  })
})

describe('grouping the passages', () => {
  it('asks the server to group, with the way that was picked', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Group by/ }))
    fireEvent.click(await screen.findByRole('option', { name: 'Work' }))
    await waitFor(() => expect(CALLS).toContainEqual(['PUT', '/anthologies/1/grouping', { group_by: 'work' }]))
  })

  it('draws one header per run of one work, and a section ends the run', async () => {
    DETAIL.anthology.group_by = 'work'
    open()
    await screen.findByText('First passage.')
    // Walden, [Part two], Walden again, Dune: the heading splits Walden into two runs.
    expect(screen.getAllByTestId('anthology-group').map((n) => n.textContent)).toEqual(['Walden', 'Walden', 'Dune'])
  })

  it('draws no group headers when the anthology is not grouped', async () => {
    open()
    await screen.findByText('First passage.')
    expect(screen.queryAllByTestId('anthology-group')).toHaveLength(0)
  })
})
