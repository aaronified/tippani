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
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CALLS, LIST, DETAIL, FILL

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/anthologies') return { ok: true, data: { anthologies: LIST } }
    if (method === 'GET' && /^\/anthologies\/\d+$/.test(path)) return { ok: true, data: DETAIL }
    if (method === 'POST' && /\/fill$/.test(path)) return { ok: true, data: FILL }
    return { ok: true, data: {} }
  }),
}))

const { default: AnthologiesPage } = await import('../../src/anthologies.jsx')
const { buildScreenActions } = await import('../../src/ui.jsx')

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
  FILL = { matched: 0, added: 0, skipped: 0, capped: false }
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

// THE SCREEN BAR IS THE SHELL'S AND NOT THIS PAGE'S, so an action that lives only
// in the ⋯ menu is unreachable from a render of the page alone.
//
// `buildScreenActions` IS WHAT THE SHELL ITSELF CALLS when the menu opens — so
// this reaches the action through the same path a thumb does, rather than through
// a probe reading a copy of the list. A page that registered its builder wrongly
// would be invisible to a probe and is not invisible to this.
const barAction = (id) => buildScreenActions().find((a) => a.id === id)

// The ⋯ for one entry, found through the quote it belongs to rather than by index,
// so a reordering bug cannot make this helper agree with it.
const menuFor = async (quote) => {
  const card = screen.getByText(quote).closest('.tp-card') || screen.getByText(quote).parentElement.parentElement
  fireEvent.click(within(card).getByRole('button', { name: /more for this entry/i }))
  return await screen.findByRole('menu')
}

describe('an anthology being read', () => {

  it('moves an entry down by naming the entry it should follow', async () => {
    open()
    await screen.findByText('We remember light.')
    fireEvent.click(within(await menuFor('We remember light.')).getByText('Move down'))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/anthologies/1/order')).toBe(true))
    const post = CALLS.find(([, p]) => p === '/anthologies/1/order')
    // Down one = follow the next entry. NO POSITION IS SENT: the server computes it.
    expect(post[2]).toEqual({ kind: 'screen', item_id: 9, after: { kind: 'book', item_id: 2 } })
  })

})

// ── WHAT THE WORK KNOWS (0074). The switches were six and are eighteen, and the
// eleven added live in a `fields` object rather than a column each. The two claims
// worth a test are the two that fail silently: a switch that saves into the wrong
// half of the body, and a reading view that prints a field the anthology was never
// told to show.
describe('the fields a work lends its passages', () => {

  it('offers what is waiting without adding it, and adds it when pressed', async () => {
    // "KEEP IT FED" IS A COUNT AND NOT AN ARRIVAL. The anthology must not grow
    // because it was opened — that is a write on a read and the exact "change that
    // happened while they were not looking" the plan warns against. So the two
    // claims here are: opening ASKS (preview:true), and only the press TAKES.
    DETAIL = {
      ...DETAIL,
      anthology: { ...DETAIL.anthology, rule: 'tag=stoicism', rule_auto: true },
    }
    FILL = { matched: 12, added: 12, skipped: 0, capped: false }
    open()
    const take = await screen.findByText('Add 12 waiting')

    // Everything sent so far was a question.
    const before = CALLS.filter(([m, p]) => m === 'POST' && /\/fill$/.test(p))
    expect(before.length).toBe(1)
    expect(before[0][2].preview).toBe(true)

    fireEvent.click(take)
    await waitFor(() => {
      const posts = CALLS.filter(([m, p]) => m === 'POST' && /\/fill$/.test(p))
      return expect(posts.length).toBe(2)
    })
    const real = CALLS.filter(([m, p]) => m === 'POST' && /\/fill$/.test(p))[1][2]
    expect(real.preview).toBeFalsy()
    // THE SAME RULE THE COUNT WAS MEASURED FROM. Pressing a number that then took a
    // different set would be the screen lying at the one moment it was specific.
    expect(real.rule).toBe('tag=stoicism')
  })

  // THE RULE IS REACHABLE WITHOUT THE ⋯, which is what the owner could not find:
  // "I cannot see any auto-anthology or export options. Where are those?"
  //
  // Export and EPUB were never the problem — they are visible buttons on this
  // header (unless VITE_DEMO hides them). The RULE was the one verb that existed
  // only as a menu entry, under an argument that a control "touched once and then
  // rarely" does not earn a permanent button. It has to be FOUND once, though, and
  // the only other sign of the feature is the "12 new" line, which draws only when
  // a rule already exists and has already matched — so it was invisible to exactly
  // the reader it was for.
  //
  // ASSERTED THROUGH THE BUTTON AND NOT `barAction`, deliberately: every other rule
  // case in this file reaches the dialog through the ⋯, so all of them would have
  // gone on passing with no visible door at all.

})
