// The bar a selection puts up.
//
// Two things are being asserted. That it acts on the ids it says it is holding —
// with the right endpoint per kind, since a standalone quote's URL is not an
// annotation's — and that the one destructive action in it cannot happen by
// accident: it asks, it names the count and the kind, and the button stays greyed
// until the phrase is typed.
//
// The phrase is checked on the SERVER too. It is written here as well because a
// client that could not compose it could not show it, and showing it is the whole
// affordance.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CALLS
let OK

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    return OK
      ? { ok: true, data: { deleted: body?.ids?.length || 0, trash_id: 77, updated: body?.ids?.length || 0 } }
      : { ok: false, status: 400, data: { error: 'nope' } }
  }),
}))

const { SelectionBar, deletePhrase } = await import('../../src/SelectionBar.jsx')
const { ToastHost } = await import('../../src/ui.jsx')

const selection = (over = {}) => ({
  kind: 'quote',
  ids: [1, 2, 3],
  count: 3,
  isSelected: () => false,
  toggle: vi.fn(),
  extendTo: vi.fn(),
  selectAll: vi.fn(),
  clear: vi.fn(),
  ...over,
})

const bar = (sel = selection(), onDone = vi.fn()) => {
  render(
    <>
      <SelectionBar selection={sel} onDone={onDone} tagSuggestions={['grief', 'craft']} />
      <ToastHost />
    </>,
  )
  return onDone
}

beforeEach(() => {
  CALLS = []
  OK = true
})

const sent = (path) => CALLS.find(([, p]) => p === path)

describe('what the bar says', () => {
  it('names the count and the kind', () => {
    bar()
    expect(screen.getByText('3 quotes selected')).toBeTruthy()
  })

  it('says it in the singular for one', () => {
    bar(selection({ ids: [1], count: 1 }))
    expect(screen.getByText('1 quote selected')).toBeTruthy()
  })

  it('renders nothing at all with nothing selected', () => {
    const { container } = render(<SelectionBar selection={selection({ ids: [], count: 0 })} />)
    expect(container.textContent).toBe('')
  })
})

describe('acting on the selection', () => {
  it('recolours through the kind’s own endpoint', async () => {
    const onDone = bar()
    // The swatches are a radiogroup, and each swatch is named by the reader's own
    // category name — so this picks the SECOND slot rather than a colour word,
    // which is exactly how the app talks about colours since 1.7.1.
    const group = screen.getByRole('radiogroup', { name: /Recolour the 3 selected/ })
    fireEvent.click(within(group).getAllByRole('radio')[1])
    await waitFor(() => expect(sent('/quotes/bulk')).toBeTruthy())
    const [, , body] = sent('/quotes/bulk')
    expect(body.ids).toEqual([1, 2, 3])
    expect(body.color).toBe('blue')
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('uses the annotation endpoint for highlights', async () => {
    bar(selection({ kind: 'annotation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Favourite' }))
    await waitFor(() => expect(sent('/annotations/bulk')).toBeTruthy())
    expect(sent('/annotations/bulk')[2].favorite).toBe(true)
  })

  it('will not post an empty tag list', async () => {
    bar()
    // The button is greyed rather than refusing after the click — the rule every
    // Save in this app follows.
    expect(screen.getByRole('button', { name: 'Add tags' }).disabled).toBe(true)
    expect(CALLS).toEqual([])
  })
})

describe('deleting a selection', () => {
  it('asks first, and names what it will do', () => {
    bar()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete 3 quotes?')).toBeTruthy()
    expect(screen.getByText('delete 3 quotes')).toBeTruthy()
    expect(CALLS, 'nothing should have been sent yet').toEqual([])
  })

  it('keeps the button greyed until the phrase is typed', () => {
    bar()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const go = screen.getByRole('button', { name: 'Delete them' })
    expect(go.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Type the confirmation phrase'), { target: { value: 'delete 3' } })
    expect(screen.getByRole('button', { name: 'Delete them' }).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Type the confirmation phrase'), { target: { value: 'delete 3 quotes' } })
    expect(screen.getByRole('button', { name: 'Delete them' }).disabled).toBe(false)
  })

  it('posts the phrase with the ids, and offers one Undo for the lot', async () => {
    const onDone = bar()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.change(screen.getByLabelText('Type the confirmation phrase'), { target: { value: 'delete 3 quotes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete them' }))
    await waitFor(() => expect(sent('/quotes/bulk/delete')).toBeTruthy())
    const [, , body] = sent('/quotes/bulk/delete')
    expect(body.ids).toEqual([1, 2, 3])
    expect(body.confirm).toBe('delete 3 quotes')
    // ONE Undo for the whole selection, because the server writes one bin entry.
    const undo = await screen.findByRole('button', { name: 'Undo' })
    fireEvent.click(undo)
    await waitFor(() => expect(sent('/trash/77/restore')).toBeTruthy())
    expect(onDone).toHaveBeenCalled()
  })

  it('phrases it per kind, because a highlight is not a “quote” on a book’s page', () => {
    expect(deletePhrase('quote', 3)).toBe('delete 3 quotes')
    expect(deletePhrase('annotation', 3)).toBe('delete 3 highlights')
    expect(deletePhrase('annotation', 1)).toBe('delete 1 highlight')
    expect(deletePhrase('dialogue', 2)).toBe('delete 2 film lines')
  })

  it('says so when the server refuses, and claims nothing', async () => {
    OK = false
    bar()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.change(screen.getByLabelText('Type the confirmation phrase'), { target: { value: 'delete 3 quotes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete them' }))
    expect(await screen.findByText('nope')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })
})
