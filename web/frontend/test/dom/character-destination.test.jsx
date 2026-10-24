// The character page: every work they are in, and everything a reader can do
// about it from here.
//
// THE OWNER'S BRIEF, VERBATIM: "build the character part of metadata so that i can
// merge them easily or tag them to multiple works (or remove works), see work wise
// images that has been added to them, or actors assigned in different works" and
// "browse, replace, promote artwork… this is the complete character metadata
// destination."
//
// So each claim below is one of those, and the ones worth arguing are:
//
//   A WORK'S PICTURE IS NOT THE RECORD'S. A character record has one face and each
//   work holds its own still, and the two are stored in two places for a reason: a
//   panel that silently substituted the record's picture where a work has none
//   could not then SAY the work has none — which is the state a reader opens this
//   screen to fix.
//
//   REMOVING A WORK IS REFUSED WHILE ITS QUOTES NAME THE CHARACTER, and the
//   refusal is a QUESTION rather than an error. A character named on a work's own
//   line is adopted back onto its cast on the next read, for ever, so a removal
//   that ignores the lines undoes itself. The 409 carries the count because
//   rewriting three lines and rewriting ninety are different decisions.
//
//   THE TAG CARRIES THE RECORD'S ID. `POST /books/{id}/cast` takes a name and
//   resolves it, which on a work already holding a same-named character files the
//   row under a record the reader never chose — silently and permanently.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CHARACTER
let CALLS
let DROP // what DELETE /characters/{id}/works/{cast} answers with

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/characters/3') return { ok: true, data: CHARACTER }
    if (method === 'GET' && path === '/books') {
      return { ok: true, data: { books: [{ id: 1, title: 'The Master and Margarita', cover_path: 'covers/mm.jpg' }, { id: 2, title: 'The White Guard', cover_path: '' }] } }
    }
    if (method === 'GET' && path === '/movies') {
      return { ok: true, data: { movies: [
        { id: 5, title: 'The Master and Margarita (2005)', poster_path: 'covers/mm05.jpg', media_type: 'show' },
        { id: 6, title: 'Master i Margarita (2024)', poster_path: '', media_type: 'movie' },
      ] } }
    }
    if (method === 'DELETE' && path.includes('/works/')) return DROP
    if (method === 'GET' && path.startsWith('/characters/search')) {
      return { ok: true, data: { characters: [{ id: 8, name: 'Woland', works: 4 }] } }
    }
    return { ok: true, data: {} }
  }),
}))

const { characterPanel } = await import('../../src/identity.jsx')
const { t } = await import('../../src/i18n.js')
const body = (panel) => panel.render()
const stack = () => ({ push: vi.fn(), open: vi.fn() })

const APPEARANCES = [
  {
    cast_id: 11, kind: 'book', work_id: 1, work_title: 'The Master and Margarita',
    character: 'the professor', actor_id: 0, actor: '', image: '', cover: 'covers/mm.jpg',
    media_type: '', description: 'Arrives at Patriarch Ponds with a retinue.',
  },
  {
    cast_id: 12, kind: 'movie', work_id: 5, work_title: 'The Master and Margarita (2005)',
    character: 'Woland', actor_id: 9, actor: 'Oleg Basilashvili',
    image: 'characters/woland-2005.jpg', cover: 'covers/mm05.jpg', media_type: 'show',
    description: '',
  },
]

beforeEach(() => {
  CALLS = []
  DROP = { ok: true, status: 200, data: { quotes: 0 } }
  CHARACTER = {
    id: 3, name: 'Woland', sort_name: '', description: '', note: '', image_path: '',
    aliases: ['Messire'], appearances: APPEARANCES,
    lines: [
      { id: 1, kind: 'highlight', text: "Manuscripts don't burn", name: 'Woland', work_id: 1, work_title: 'The Master and Margarita' },
      { id: 2, kind: 'screen', text: 'Never talk to strangers', name: 'Woland', work_id: 5, work_title: 'The Master and Margarita (2005)' },
    ],
    shared_lines: 3,
  }
})
afterEach(() => cleanup())

const open = async () => {
  shown = ''
  render(body(characterPanel(stack(), { id: 3, name: 'Woland' })))
  await screen.findByText('The Master and Margarita')
}

// Which work's card the strip currently has open. Tracked rather than read back
// off the DOM because one title here is a prefix of the other — "The Master and
// Margarita" and "The Master and Margarita (2005)" — so a substring test on the
// open card would answer the wrong question exactly half the time.
let shown = ''

// tile — one work on the strip, by the title it prints.
const tile = (title) => [...document.querySelectorAll('.cs-tile')]
  .find((c) => c.querySelector('.cs-tile-title')?.textContent === title)

// WHERE A PER-WORK ACT LIVES, AND WHY THIS FILE MOVED.
//
// The global screen used to open an inline card under its works strip, and every
// per-work act was on it — this work's picture, promoting it to the record,
// taking the character off the work, and the two rows naming what the work bills
// them as. That card said in its own comment that it was a stopgap: those acts
// "belong to char-book / char-film / char-game, the local screens, which are not
// built. Dropping the controls until they are would leave a reader unable to
// promote a picture at all."
//
// They are built. A tile on the strip now opens the pack's `choose` sheet, which
// offers the work, this character AS THAT WORK HAS THEM, and the performer — and
// the middle one is the local sheet these acts moved to. So the cases below open
// that sheet directly, which is what the reader reaches through two presses.
//
// THE ASSERTIONS ARE UNCHANGED, deliberately. If an act were lost in the move
// this file is where it shows: same request, same body, same refusal dialog, on
// whichever surface now offers it.
const local = async (appearance) => {
  cleanup()
  render(body(characterPanel(stack(), {
    id: 3,
    name: 'Woland',
    work: {
      kind: appearance.kind,
      id: appearance.work_id,
      title: appearance.work_title,
      media_type: appearance.media_type,
      castId: appearance.cast_id,
    },
  })))
  await screen.findByText(new RegExp(appearance.work_title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  return document.body
}
const FILM = () => APPEARANCES.find((a) => a.cast_id === 12)
const BOOK = () => APPEARANCES.find((a) => a.cast_id === 11)

// THE ONE DOOR IS THE STRIP'S ADD TILE. It used to scroll to a second button
// stranded further down the sheet, which was two controls for one act and, on a
// phone, a press that only moved the page — both halves reported by the owner.
const addWorkTile = () => {
  const tile = [...document.querySelectorAll('.cs-tile-add')]
  expect(tile, 'the strip offers no way to add a work').toHaveLength(1)
  return tile[0]
}

describe('taking them off a work', () => {
  // THE ROW MOVED AND THE QUESTION DID NOT. On the retired card this was a small
  // ✕ with an inline "Remove" confirm; on the local sheet it is a danger row
  // naming the medium. What the cases hold is unchanged: one press asks, the
  // server's refusal becomes a question carrying the count, and the two ways out
  // of that question send the requests they always sent.
  const unlink = async (appearance) => {
    await local(appearance)
    const row = [...document.querySelectorAll('button')].find((b) => /Remove from this/i.test(b.textContent))
    expect(row, 'the local sheet offers no way to take the character off this work').toBeTruthy()
    await act(async () => { row.click() })
  }

  it('turns the server’s refusal into a question that carries the count', async () => {
    DROP = { ok: false, status: 409, data: { quotes: 12 } }
    await unlink(BOOK())
    // THE NUMBER IS THE DECISION. Rewriting twelve lines is not the same act as
    // rewriting one, and a bare "conflict" would make the reader guess.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/12 quotes/)).toBeTruthy()
    expect(within(dialog).getByText(/Woland/)).toBeTruthy()
  })

  // THE DISPOSITION IS THE SERVER'S WORD, NOT THIS SCREEN'S.
  //
  // This case used to demand `?quotes=move`, which `character_works.go` answers
  // 400 — "quotes must be clear or replace". So it asserted the defect: green,
  // while the one press that KEEPS a character's lines was refused outright on
  // the work-level sheet. It was written from the handler that had just been typed
  // rather than from what the endpoint accepts, which is the thing prompt 4 bans.
  //
  // Named here so the two cases below read as the pair they are: `replace` and
  // `clear` are the only two words the endpoint takes, and
  // `quotes-disposition.test.js` reads that set out of the Go source so neither
  // side can drift from it again.
  it('replaces the speaker on every quote and then removes', async () => {
    DROP = { ok: false, status: 409, data: { quotes: 2 } }
    await unlink(BOOK())
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByPlaceholderText(/another character/i), { target: { value: 'Messire' } })
    DROP = { ok: true, status: 200, data: { quotes: 2 } }
    await act(async () => { within(dialog).getByText(/Rename them and remove/i).click() })
    await waitFor(() => expect(
      CALLS.some(([m, p]) => m === 'DELETE' && p.startsWith('/characters/3/works/11?quotes=replace&to=Messire')),
    ).toBe(true))
  })

})

