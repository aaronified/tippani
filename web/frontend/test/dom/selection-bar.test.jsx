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

describe('what the bar says', () => {
  // THE COUNT IS A BADGE, not a sentence. It sits in the glyph slot of the
  // deselect button, so what is on screen is the number — and the phrase moved to
  // the accessible name, which is where it has to be: with the words clipped on a
  // phone the badge alone would announce as "Deselect all" and drop the one fact it
  // is drawn to show.
  it('shows the count as the badge', () => {
    bar()
    expect(screen.getByRole('button', { name: /3 quotes selected/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /3 quotes selected/ }).textContent).toContain('3')
  })

  it('says it in the singular for one', () => {
    bar(selection({ ids: [1], count: 1 }))
    expect(screen.getByRole('button', { name: /1 quote selected/ })).toBeTruthy()
  })

  // The badge carries the ACTION as well as the count, because it is a button: it
  // empties the picks and leaves the bar standing.
  it('names the action too, not only the count', () => {
    bar()
    expect(screen.getByRole('button', { name: /Deselect all/ })).toBeTruthy()
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
    // One trigger rather than six dots: in a strip of glyphs the swatches were
    // the one control wide enough to push the others off a phone.
    fireEvent.click(screen.getByRole('button', { name: /Recolour the 3 selected/ }))
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
    openMore()
    fireEvent.click(item('Add tags'))
    // The button is greyed rather than refusing after the click — the rule every
    // Save in this app follows.
    expect(screen.getByRole('button', { name: 'Add tags' }).disabled).toBe(true)
    expect(CALLS).toEqual([])
  })

  it('adds the tags typed in its dialog, and only on Add', async () => {
    // The tag field used to stand open in the bar, where it was the widest control
    // in the strip and one stray tap from a keyboard on a phone. It asks now.
    bar()
    openMore()
    fireEvent.click(item('Add tags'))
    const field = screen.getByLabelText('Tags to add to the selection')
    fireEvent.change(field, { target: { value: 'grief' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(CALLS, 'typing is not applying').toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Add tags' }))
    await waitFor(() => expect(sent('/quotes/bulk')).toBeTruthy())
    expect(sent('/quotes/bulk')[2].add_tags).toEqual(['grief'])
  })
})

describe('deleting a selection', () => {
  it('asks first, and names what it will do', () => {
    bar()
    openMore()
    fireEvent.click(item('Delete'))
    expect(screen.getByText('Delete 3 quotes?')).toBeTruthy()
    expect(screen.getByText('delete 3 quotes')).toBeTruthy()
    expect(CALLS, 'nothing should have been sent yet').toEqual([])
  })

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

  it('phrases it per kind, because a highlight is not a “quote” on a book’s page', () => {
    expect(deletePhrase('quote', 3)).toBe('delete 3 quotes')
    expect(deletePhrase('annotation', 3)).toBe('delete 3 highlights')
    expect(deletePhrase('annotation', 1)).toBe('delete 1 highlight')
    expect(deletePhrase('dialogue', 2)).toBe('delete 2 film lines')
  })

  it('says so when the server refuses, and claims nothing', async () => {
    OK = false
    bar()
    openMore()
    fireEvent.click(item('Delete'))
    fireEvent.change(screen.getByLabelText('Type the confirmation phrase'), { target: { value: 'delete 3 quotes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete them' }))
    expect(await screen.findByText('nope')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
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

describe('the shape of the bar', () => {
  it('stands three controls in the row and folds the rest', () => {
    bar()
    // The three, by their accessible names. Colour is a trigger that opens six
    // dots; the other two run on the press.
    expect(screen.getByRole('button', { name: /Recolour the 3 selected/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Favourite' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip in quiz' })).toBeTruthy()
    // And nothing else is reachable without opening the overflow.
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Seal' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  })

  it('keeps Delete behind the ⋯, where it cannot be hit by aiming at Favourite', () => {
    bar()
    openMore()
    expect(item('Add tags')).toBeTruthy()
    expect(item('Seal')).toBeTruthy()
    expect(item('Delete')).toBeTruthy()
  })

  it('names the quiz toggle by what it will do, so the glyph never has to', () => {
    // With no words on screen the accessible name IS the state, and a bar that
    // always said one of the two would be unreadable in either direction.
    const rows = [{ id: 1, review_excluded: 1 }]
    bar(selection({ ids: [1], count: 1, isSelected: () => true }), vi.fn(), { rows })
    expect(screen.getByRole('button', { name: 'Add to quiz' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Skip in quiz' })).toBeNull()
  })

  it('disables every control while nothing is picked, rather than hiding the bar', () => {
    bar(selection({ ids: [], count: 0, open: true }))
    // Still SAID rather than shown as a bare zero — the badge reads 0 and is
    // disabled, and the name is what tells you why.
    expect(screen.getByRole('button', { name: 'no quotes selected' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Favourite' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /More for the/ }).disabled).toBe(true)
  })
})

describe('editing the one', () => {
  it('offers Edit when exactly one is picked, and hands back its id', () => {
    const onEdit = vi.fn()
    bar(selection({ ids: [9], count: 1 }), vi.fn(), { onEdit })
    openMore()
    fireEvent.click(item('Edit'))
    expect(onEdit).toHaveBeenCalledWith(9)
  })

  it('does not offer it over two, because that is a different act with its own form', () => {
    bar(selection({ ids: [9, 10], count: 2 }), vi.fn(), { onEdit: vi.fn() })
    openMore()
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull()
  })

  it('does not offer it at all where the screen has no form for one row', () => {
    // An action whose callback is absent is absent — the registry's rule, and the
    // reason one bar serves five kinds without a prop that says which.
    bar(selection({ ids: [9], count: 1 }))
    openMore()
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull()
  })
})

// THE REGRESSION TEST FOR "Show icon labels does nothing here".
//
// The bar shipped built entirely from glyph-only controls — IconButton and
// MoreMenu, neither of which rendered a .btn-label span. So `Button labels: Show`
// had no name to reveal and `Hide` had none to clip: the one row in the app that
// ignored the setting in both directions, on the surface with the least room,
// where the preference matters most.
//
// Nothing failed. The bar looked correct on a desktop, which is where it was built,
// and the setting silently did not apply. What is asserted here is the MECHANISM
// rather than the appearance: the words are in the DOM, in the span the stylesheet
// clips, on a button carrying the class that squares it. Whether they are visible
// is then CSS and the user's choice, neither of which a jsdom test can see.
describe('following the Button labels preference', () => {
  const labelOf = (btn) => btn.querySelector('.btn-label')?.textContent

  it('renders every row action’s word in the span the stylesheet clips', () => {
    bar()
    for (const name of ['Favourite', 'Skip in quiz']) {
      const btn = screen.getByRole('button', { name })
      expect(labelOf(btn), `${name} has no .btn-label, so Show cannot reveal it`).toBe(name)
      // has-btn-icon is what collapses the button back to 44px under
      // data-labels="off". Without it the words clip and leave a wide empty pill.
      expect(btn.className, name).toContain('has-btn-icon')
    }
  })

  it('gives the count badge the action as its word', () => {
    bar()
    const badge = screen.getByRole('button', { name: /Deselect all/ })
    expect(labelOf(badge)).toBe('Deselect all')
    // And the number is the glyph, so the badge still says how many with the words
    // clipped away on a phone.
    expect(badge.querySelector('.btn-icon').textContent).toBe('3')
  })

  it('leaves the ⋯ nameless on purpose', () => {
    // The overflow trigger is the one control whose job is to have no name — a
    // "More" label beside three dots is the same thing said twice. It is reachable
    // by its accessible name either way, which the assertion above relies on.
    bar()
    const more = screen.getByRole('button', { name: /More for the/ })
    expect(more.querySelector('.btn-label')).toBeNull()
  })
})
