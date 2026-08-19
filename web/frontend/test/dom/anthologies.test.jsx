// The anthologies screen, mounted and clicked.
//
// screens-mount.test.jsx already proves it survives a server that says no. These
// are the claims that a mounting test cannot make, and every one of them is a
// silent failure rather than a crash:
//
//   - THE ORDER IS THE ANTHOLOGY. Entries are rendered in the order the server sent
//     them, never re-sorted here. A client that sorted by item_id, or by kind, or
//     that iterated an object rather than the array, would look completely normal
//     with three entries and be a different document from the export.
//   - THE NOTE READS ABOVE THE QUOTE. That is the shape of an anthology and the
//     shape of the export; a card that put the commentary underneath would be a
//     footnote instead of an introduction, and no assertion about presence catches
//     it.
//   - MOVE UP/DOWN SEND NEIGHBOURS, NOT POSITIONS. The server computes the number
//     and may renumber the whole anthology while doing it, so a client that sent a
//     position would be inventing one. `after` is the entry the moved one should
//     FOLLOW, and null means first — off by one in either direction is a move that
//     silently does nothing or jumps two.
//   - THE ENDS HAVE NO MOVE PAST THEM. ActionMenu has no disabled state, so an item
//     at an end must be absent rather than dead.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CALLS, LIST, DETAIL

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/anthologies') return { ok: true, data: { anthologies: LIST } }
    if (method === 'GET' && /^\/anthologies\/\d+$/.test(path)) return { ok: true, data: DETAIL }
    return { ok: true, data: {} }
  }),
}))

const { default: AnthologiesPage } = await import('../../src/anthologies.jsx')

const entry = (kind, itemID, position, note, quote, over = {}) => ({
  kind,
  item_id: itemID,
  position,
  note,
  quote,
  quote_note: '',
  color: 'yellow',
  favorite: false,
  source: 'The Wide Margin',
  credit: 'A. Whitfield',
  work_id: 1,
  ...over,
})

beforeEach(() => {
  CALLS = []
  LIST = [
    { id: 1, title: 'On keeping quiet', intro: 'Three people, one idea.', entries: 3, created_at: '', updated_at: '' },
    { id: 2, title: 'Beginnings', intro: '', entries: 0, created_at: '', updated_at: '' },
  ]
  DETAIL = {
    anthology: { id: 1, title: 'On keeping quiet', intro: 'Three people, one idea.', entries: 3 },
    // Deliberately NOT in item_id order, and deliberately across all three kinds:
    // the order runs across kinds, and a client that sorted by anything of its own
    // would reorder exactly this list.
    entries: [
      entry('screen', 9, 1, 'The middle one, placed first.', 'We remember light.'),
      entry('book', 2, 2, 'Then the plain statement.', 'Quiet is the presence of attention.'),
      entry('utterance', 4, 3, 'And the shortest.', 'Least said, soonest mended.', {
        source: '',
        credit: '',
        work_id: undefined,
      }),
    ],
  }
})

const noop = () => {}

const list = (props = {}) =>
  render(<AnthologiesPage openId={null} onOpen={noop} onClose={noop} onOpenBook={noop} onOpenMovie={noop} {...props} />)
const open = (props = {}) =>
  render(<AnthologiesPage openId={1} onOpen={noop} onClose={noop} onOpenBook={noop} onOpenMovie={noop} {...props} />)

// The ⋯ for one entry, found through the quote it belongs to rather than by index,
// so a reordering bug cannot make this helper agree with it.
const menuFor = async (quote) => {
  const card = screen.getByText(quote).closest('.tp-card') || screen.getByText(quote).parentElement.parentElement
  fireEvent.click(within(card).getByRole('button', { name: /more for this entry/i }))
  return await screen.findByRole('menu')
}

describe('the anthology list', () => {
  it('names every anthology and how long each one is', async () => {
    list()
    expect(await screen.findByText('On keeping quiet')).toBeTruthy()
    expect(screen.getByText('3 entries')).toBeTruthy()
    // The empty one is the state the count exists to report, and it must not be
    // folded away: somebody who made an anthology and has not filled it needs to
    // find it again.
    expect(screen.getByText('Beginnings')).toBeTruthy()
    expect(screen.getByText('0 entries')).toBeTruthy()
  })

  it('creates one in a pop-up form, sending every field', async () => {
    list()
    await screen.findByText('On keeping quiet')
    fireEvent.click(screen.getByText('New anthology'))
    // A POP-UP FORM, not an inline tile: adds and edits both open in a FormModal in
    // this app, and the fields being findable at all is what says the modal opened.
    fireEvent.change(await screen.findByPlaceholderText('On grief'), { target: { value: '  On silence  ' } })
    fireEvent.change(screen.getByPlaceholderText('Why these lines, and in this order.'), {
      target: { value: 'Because I keep finding it.' },
    })
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/anthologies')).toBe(true))
    const post = CALLS.find(([m, p]) => m === 'POST' && p === '/anthologies')
    // The title is trimmed and EVERY OTHER FIELD RIDES ALONG even when it is not
    // the one that changed — the PUT is full-state, so a form that sent a subset
    // would clear the rest. That is why the six field switches (0045) are in here
    // too: send the title alone and all six reset to their defaults, which reads to
    // the owner as a setting reverting by itself.
    //
    // Asserted with toEqual rather than toMatchObject on purpose. A seventh switch
    // added to the form and not to the submit body is exactly the bug this catches,
    // and toMatchObject would pass through it.
    expect(post[2]).toEqual({
      title: 'On silence',
      intro: 'Because I keep finding it.',
      hide_credit: false,
      hide_source: false,
      hide_commentary: false,
      hide_colour: false,
      show_locator: false,
      show_date: false,
    })
  })

  it('offers the six field switches, and sends what they are set to', async () => {
    // The switches read POSITIVELY — Hide / Show — whatever the stored column is
    // spelled, which is the same rule the Settings Features card follows. So
    // "Who said it" starts on (hide_credit is false) and pressing Hide stores true;
    // "The day you saved it" starts off (show_date is false) and pressing Show
    // stores true. Getting that inversion backwards is a 200 that saves the reverse
    // of what was pressed, which is the failure this test exists for.
    list()
    await screen.findByText('On keeping quiet')
    fireEvent.click(screen.getByText('New anthology'))
    fireEvent.change(await screen.findByPlaceholderText('On grief'), { target: { value: 'Passages' } })

    const row = (label) => screen.getByLabelText(label).closest('div')
    // Hide the credit: stored as hide_credit = true.
    fireEvent.click(within(row('Who said it')).getByText('Hide'))
    // Show the date: stored as show_date = true.
    fireEvent.click(within(row('The day you saved it')).getByText('Show'))

    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/anthologies')).toBe(true))
    const body = CALLS.find(([m, p]) => m === 'POST' && p === '/anthologies')[2]
    expect(body.hide_credit).toBe(true)
    expect(body.show_date).toBe(true)
    // And pressing two switches did not move the other four.
    expect(body.hide_source).toBe(false)
    expect(body.hide_commentary).toBe(false)
    expect(body.hide_colour).toBe(false)
    expect(body.show_locator).toBe(false)
  })

  it('does not offer a way to add a quote from here, and says where the way in is', async () => {
    // The empty state names the SELECTION BAR, because that is the only door: the
    // add route wants (kind, item_id) pairs and only a screen holding quotes has
    // them. An empty state that just said "nothing here" would leave somebody
    // hunting this screen for a control that is on three others.
    LIST = []
    list()
    expect(await screen.findByText(/No anthologies yet/)).toBeTruthy()
    expect(screen.getByText(/Add to anthology/)).toBeTruthy()
  })
})

describe('an anthology being read', () => {
  it('renders its entries in the order the server sent them', async () => {
    open()
    await screen.findByText('We remember light.')
    const quotes = [...document.querySelectorAll('.anthology-quote')].map((q) => q.textContent)
    expect(quotes).toEqual(['We remember light.', 'Quiet is the presence of attention.', 'Least said, soonest mended.'])
  })

  it('puts the reader’s note above the quote it introduces', async () => {
    open()
    const note = await screen.findByText('Then the plain statement.')
    const quote = screen.getByText('Quiet is the presence of attention.')
    // DOCUMENT_POSITION_FOLLOWING: the quote comes after its note.
    expect(note.compareDocumentPosition(quote) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the introduction, and the credit for an entry that has one', async () => {
    open()
    expect(await screen.findByText('Three people, one idea.')).toBeTruthy()
    expect(screen.getAllByText(/A. Whitfield/).length).toBeGreaterThan(0)
    // A standalone quote with no speaker and no occasion says so rather than
    // rendering a stray separator.
    expect(screen.getByText('unattributed')).toBeTruthy()
  })

  it('moves an entry down by naming the entry it should follow', async () => {
    open()
    await screen.findByText('We remember light.')
    fireEvent.click(within(await menuFor('We remember light.')).getByText('Move down'))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/anthologies/1/order')).toBe(true))
    const post = CALLS.find(([, p]) => p === '/anthologies/1/order')
    // Down one = follow the next entry. NO POSITION IS SENT: the server computes it.
    expect(post[2]).toEqual({ kind: 'screen', item_id: 9, after: { kind: 'book', item_id: 2 } })
  })

  it('moves the second entry up by asking for first place, not for position 0', async () => {
    open()
    await screen.findByText('Quiet is the presence of attention.')
    fireEvent.click(within(await menuFor('Quiet is the presence of attention.')).getByText('Move up'))
    await waitFor(() => expect(CALLS.some(([, p]) => p === '/anthologies/1/order')).toBe(true))
    const post = CALLS.find(([, p]) => p === '/anthologies/1/order')
    // `after: null` IS "make it first" — the one case an off-by-one would turn into
    // a move that does nothing, since there is no entry two places back.
    expect(post[2]).toEqual({ kind: 'book', item_id: 2, after: null })
  })

  it('offers no move past either end', async () => {
    open()
    await screen.findByText('We remember light.')
    const first = await menuFor('We remember light.')
    expect(within(first).queryByText('Move up'), 'the first entry offers Move up').toBeNull()
    expect(within(first).getByText('Move down')).toBeTruthy()
    fireEvent.keyDown(first, { key: 'Escape' })
    const last = await menuFor('Least said, soonest mended.')
    expect(within(last).queryByText('Move down'), 'the last entry offers Move down').toBeNull()
    expect(within(last).getByText('Move up')).toBeTruthy()
  })

  it('removes an entry by kind and id in the path, with no body', async () => {
    open()
    await screen.findByText('Least said, soonest mended.')
    fireEvent.click(within(await menuFor('Least said, soonest mended.')).getByText('Remove'))
    await waitFor(() => expect(CALLS.some(([m]) => m === 'DELETE')).toBe(true))
    const del = CALLS.find(([m]) => m === 'DELETE')
    // (anthology, kind, item) IS the entry's identity — there is no entry id, which
    // is why this is a path and not a body.
    expect(del[1]).toBe('/anthologies/1/entries/utterance/4')
    expect(del[2]).toBeUndefined()
  })

  it('saves one entry’s note on its own endpoint', async () => {
    open()
    await screen.findByText('Then the plain statement.')
    fireEvent.click(within(await menuFor('Quiet is the presence of attention.')).getByText('Edit note'))
    const box = await screen.findByPlaceholderText('The turn this line makes.')
    fireEvent.change(box, { target: { value: 'Rewritten.' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/anthologies/1/entries')).toBe(true))
    const put = CALLS.find(([m, p]) => m === 'PUT' && p === '/anthologies/1/entries')
    // The reference plus the note and nothing else: writing about one entry must not
    // resend the other twenty-nine.
    expect(put[2]).toEqual({ kind: 'book', item_id: 2, note: 'Rewritten.' })
  })
})
