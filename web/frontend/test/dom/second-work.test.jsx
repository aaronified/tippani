// A WORK-LEVEL CHARACTER CAN BE GIVEN ANOTHER WORK, AND THAT IS THE PROMOTION.
//
// THE OWNER'S ITEM 3, verbatim: "this character only exist in one work (for
// now), and thus the work-level screen is shown. but there is no easy way to add
// him to another work from here. i will then need to add a separate character
// and then merge. i understand that work-level character cannot gain a new
// character. but we can probably create a gate here where of i add another work
// in work-character, that will get added to the global-character (which should
// in turn enable global character for the character as well)."
//
// And when asked whether it should confirm first: "Automatic. no point gating
// this. because the user can easily remove works as well."
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing about how it was built:
//
//  * A character exists twice over. `characters` is the RECORD — a name, a
//    portrait, aliases. `work_cast` is a CREDIT: this character, in this work,
//    played by this person. One credit means the reader sees the work-level
//    sheet; several means a global sheet exists too.
//  * NOTHING IS PROMOTED. The global screen is not a flag — it is a consequence
//    of how many credits the record has. So the second credit IS the promotion,
//    and anything that writes one has done the whole job. The owner's phrasing
//    suggests two steps; the data model has one, and a test that looked for a
//    promotion step would be testing a thing that does not exist.
//  * A credit can exist with no record behind it. Those have nothing to give a
//    second work to.


import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    calls.push({ method, path, body })
    if (path.startsWith('/characters/') && path.endsWith('/works') && method === 'POST') {
      return { ok: true, data: { ok: true } }
    }
    return { ok: true, data: {} }
  }),
}))

const { CharacterLocal } = await import('../../src/identityLocal.jsx')
const { t } = await import('../../src/i18n.js')

const RECORD = { id: 12, name: 'Evey Hammond', image_path: '', description: '' }
const HERE = { cast_id: 3, character: 'Evey Hammond', actor: 'Natalie Portman', description: '' }
const SCOPE = { local: true, id: 'char-local', medium: 'film', performer: true }

const sheet = (over = {}) =>
  render(
    <CharacterLocal
      record={RECORD}
      work={{ kind: 'screen', id: 4, title: 'V for Vendetta' }}
      here={HERE}
      scope={SCOPE}
      counts={{}}
      works={[{ kind: 'screen', work_id: 4, title: 'V for Vendetta' }]}
      {...over}
    />,
  )

const rowNamed = (key) => {
  const want = t(key)
  for (const el of document.querySelectorAll('button, [role=button]')) {
    if (el.textContent.includes(want)) return el
  }
  return null
}

beforeEach(() => { calls.length = 0 })
afterEach(() => cleanup())

// AND THE DOOR IS ONE DOOR, whichever sheet the reader is standing on.
//
// The repo's directive: "A control drawn by one component on two screens has ONE
// behaviour, and it lives in one function that both screens call — not in a line
// each, which is how one of them goes on being right while the other quietly
// stops." What the reader is promised by that is not a shape in the source: it is
// that the add-work tile on the GLOBAL sheet and the add-work row on the
// WORK-LEVEL sheet open the same chooser, offering the same works. So that is what
// is asserted — by pressing both and comparing what comes up. A test that grepped
// for a handler's name would pass over two identical inline copies that had since
// drifted, which is the defect the directive exists to prevent.

// ---- THE WHOLE ACT, ON THE REAL SHEET --------------------------------------
//
// Every case above hands `CharacterLocal` an `onAddWork` of its own, so all any of
// them can say is that the ROW is drawn and calls what it was given. That is half
// a feature. The other half is whether the screen the reader is actually looking
// at answers the press — and it did not: the chooser was mounted on the global
// branch only, so on a work-level character "Also in another work" set a flag and
// drew nothing. The row was there, the handler ran, and the owner's item 3 did not
// work at all.
//
// SO THIS RENDERS THE SCREEN, presses the row, and asks the reader's question: can
// I now pick a work, and does picking one put this character in it? Nothing here
// knows how the sheet is built or which branch mounts what.
describe('the work-level sheet a reader actually opens', () => {
  const APPEARANCES = [{
    cast_id: 3, kind: 'movie', work_id: 4, work_title: 'V for Vendetta',
    character: 'Evey Hammond', actor: 'Natalie Portman', actor_id: 8,
    image: '', cover: '', media_type: 'movie', description: '',
  }]
  const SHELF = {
    books: [{ id: 9, title: 'Watchmen', cover_path: '' }],
    movies: [{ id: 4, title: 'V for Vendetta', poster_path: '', media_type: 'movie' }],
  }

  let panel
  beforeEach(async () => {
    const api = await import('../../src/api.js')
    api.json.mockImplementation(async (method, path, body) => {
      calls.push({ method, path, body })
      if (method === 'GET' && path === '/characters/12') {
        return { ok: true, data: { ...RECORD, appearances: APPEARANCES, aliases: [], links: [] } }
      }
      if (method === 'GET' && path === '/books') return { ok: true, data: { books: SHELF.books } }
      if (method === 'GET' && path === '/movies') return { ok: true, data: { movies: SHELF.movies } }
      if (method === 'POST' && path === '/characters/12/works') return { ok: true, data: { ok: true } }
      return { ok: true, data: {} }
    })
    const { characterPanel } = await import('../../src/identity.jsx')
    panel = characterPanel({ open: () => {}, push: () => {}, close: () => {} }, {
      id: 12,
      name: RECORD.name,
      work: { kind: 'movie', id: 4, title: 'V for Vendetta', media_type: 'movie', castId: 3 },
    })
  })

  const press = async () => {
    render(panel.render())
    await waitFor(() => expect(rowNamed('identity.row.add-work.label')).toBeTruthy())
    fireEvent.click(rowNamed('identity.row.add-work.label'))
  }

  it('writes the second credit when a work is picked', async () => {
    await press()
    await waitFor(() => expect(document.querySelector('.char-pick')).toBeTruthy())
    fireEvent.click(document.querySelector('.char-pick'))
    await waitFor(() => {
      const wrote = calls.find((c) => c.method === 'POST' && c.path === '/characters/12/works')
      expect(wrote, 'picking a work wrote no credit, so the character is still in one work').toBeTruthy()
      expect(wrote.body, 'the credit does not name the work that was picked')
        .toMatchObject({ kind: 'book', work_id: 9 })
    })
  })
})
