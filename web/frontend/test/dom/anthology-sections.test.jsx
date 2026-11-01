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

  it('moves a heading past the whole of the next chapter, as a slot of its own kind', async () => {
    // e1, [Part two] e2, [Part three] e3: the heading steps past e2's chapter and lands after e3.
    DETAIL.entries = [entry(1, 1, 'First passage.'), entry(2, 3, 'Second passage.'), entry(3, 5, 'Third passage.')]
    DETAIL.sections = [
      { id: 7, position: 2, title: 'Part two', prose: '' },
      { id: 8, position: 4, title: 'Part three', prose: '' },
    ]
    open()
    const block = (await screen.findByText('Part two')).closest('[data-testid="anthology-section"]')
    fireEvent.click(within(block).getByRole('button', { name: /section actions/i }))
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Move down'))
    await waitFor(() => expect(CALLS.some(([, p]) => p === '/anthologies/1/order')).toBe(true))
    expect(CALLS.find(([, p]) => p === '/anthologies/1/order')[2]).toEqual({
      kind: 'section', item_id: 7, after: { kind: 'book', item_id: 3 },
    })
  })

  it('has no step down for the last heading, because there is no chapter to pass', async () => {
    open()
    const block = (await screen.findByText('Part two')).closest('[data-testid="anthology-section"]')
    fireEvent.click(within(block).getByRole('button', { name: /section actions/i }))
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Move down'))
    await new Promise((r) => setTimeout(r, 50))
    expect(CALLS.some(([, p]) => p === '/anthologies/1/order')).toBe(false)
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

// DRAGGING, THE ARROW KEYS AND "MOVE TO…" are one move: each works out the slot to follow and sends
// the same request.
describe('moving by drag, by key and by number', () => {
  // jsdom has no layout, so each slot gets a rectangle: 100px tall, stacked.
  const layout = () => {
    document.querySelectorAll('[data-row-index]').forEach((el) => {
      const i = Number(el.dataset.rowIndex)
      el.getBoundingClientRect = () => ({ top: i * 100, bottom: i * 100 + 100, height: 100, left: 0, right: 300, width: 300 })
    })
  }
  const grips = () => screen.getAllByRole('button', { name: /Drag to move this/ })
  const posted = () => CALLS.filter(([m, p]) => m === 'POST' && p === '/anthologies/1/order').map((c) => c[2])

  it('drops a passage after the slot it was dragged to', async () => {
    open()
    await screen.findByText('First passage.')
    layout()
    // slots: First(0) Part two(1) Second(2) Third(3). Drag First down onto Second (its row spans 200 to 300).
    fireEvent.pointerDown(grips()[0], { button: 0, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(grips()[0], { clientY: 200, pointerId: 1 })
    fireEvent.pointerUp(grips()[0], { clientY: 200, pointerId: 1 })
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0]).toEqual({ kind: 'book', item_id: 1, after: { kind: 'book', item_id: 2 } })
  })

  it('drops a heading at the top with no slot to follow', async () => {
    open()
    await screen.findByText('First passage.')
    layout()
    fireEvent.pointerDown(grips()[1], { button: 0, clientY: 150, pointerId: 1 })
    fireEvent.pointerMove(grips()[1], { clientY: 10, pointerId: 1 })
    fireEvent.pointerUp(grips()[1], { clientY: 10, pointerId: 1 })
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0]).toEqual({ kind: 'section', item_id: 7, after: null })
  })

  it('refuses to drop a heading among the passages that move with it', async () => {
    open()
    await screen.findByText('First passage.')
    layout()
    fireEvent.pointerDown(grips()[1], { button: 0, clientY: 150, pointerId: 1 })
    fireEvent.pointerMove(grips()[1], { clientY: 370, pointerId: 1 })
    fireEvent.pointerUp(grips()[1], { clientY: 370, pointerId: 1 })
    await new Promise((r) => setTimeout(r, 50))
    expect(posted()).toHaveLength(0)
  })

  it('steps a passage a place with the arrow keys, sending the same request the menu sends', async () => {
    open()
    await screen.findByText('First passage.')
    fireEvent.keyDown(grips()[0], { key: 'ArrowDown' })
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0]).toEqual({ kind: 'book', item_id: 1, after: { kind: 'section', item_id: 7 } })
  })

  it('moves to a numbered passage, headings not counted, landing right after the one before it', async () => {
    open()
    await screen.findByText('First passage.')
    const card = screen.getByText('First passage.').closest('.tp-card') || screen.getByText('First passage.').parentElement.parentElement
    fireEvent.click(within(card).getByRole('button', { name: /more for this entry/i }))
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Move to…'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '3' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Save|Move/ }))
    await waitFor(() => expect(posted()).toHaveLength(1))
    // Passage 3 of 3 is the last: it follows the passage that is now second.
    expect(posted()[0]).toEqual({ kind: 'book', item_id: 1, after: { kind: 'book', item_id: 3 } })
  })
})
