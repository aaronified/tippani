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
//
// A BAR OF GLYPHS (1.12.0). Three actions stand in the row and the rest fold
// behind a ⋯, so most of what follows reaches its button through `openMore()`.
// That indirection is the test earning its keep: the placement is decided in
// actions.jsx, and a test that clicked buttons by their words would have gone on
// passing while every one of them moved.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS
let OK

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    // The language field is a combobox and leads with the library's own
    // languages; a mock with no vocabulary would test the ninety-one, not the
    // offer that makes a bulk edit spell a language the same way twice.
    if (path === '/search/vocabulary') return { ok: true, data: { languages: ['Bengali'] } }
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

const bar = (sel = selection(), onDone = vi.fn(), extra = {}) => {
  render(
    <>
      <SelectionBar selection={sel} onDone={onDone} tagSuggestions={['grief', 'craft']} {...extra} />
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

// The three that fold away. Named by the bar's own aria-label rather than by "⋯",
// because the glyph is not text and a reader hears the words.
const openMore = () => fireEvent.click(screen.getByRole('button', { name: /More for the/ }))
const item = (name) => screen.getByRole('menuitem', { name })

describe('deleting a selection', () => {

  it('keeps the button greyed until the phrase is typed', () => {
    bar()
    openMore()
    fireEvent.click(item('Delete'))
    const go = screen.getByRole('button', { name: 'Delete them' })
    expect(go.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Type the confirmation phrase'), { target: { value: 'delete 3' } })
    expect(screen.getByRole('button', { name: 'Delete them' }).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Type the confirmation phrase'), { target: { value: 'delete 3 quotes' } })
    expect(screen.getByRole('button', { name: 'Delete them' }).disabled).toBe(false)
  })

  it('posts the phrase with the ids, and offers one Undo for the lot', async () => {
    const onDone = bar()
    openMore()
    fireEvent.click(item('Delete'))
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

})

// ---- three in the row, the rest behind the ⋯ (1.12.0) ---------------------
//
// The bar grew one word-button per release and had run out of strip: colour dots,
// a tag field, a tag button, Seal, Favourite, a shelf dropdown, Fill gaps, Skip in
// quiz, Delete, Deselect all, ✕. What is asserted here is the SHAPE — three
// controls in the row and everything else folded — rather than which three, since
// which three is a decision in actions.jsx and this file should not hold a second
// opinion about it.
