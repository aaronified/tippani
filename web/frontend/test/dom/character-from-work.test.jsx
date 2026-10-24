// A CHARACTER'S NAME ON A CAST ROW OPENS THE CHARACTER, ON THIS WORK.
//
// THE OWNER'S RULE: "the character should open the character screen (for the
// work). the work and book level character screens should have similar structure,
// but it must be visually distinct to drive home the difference. use short
// infodots and subtext to clarify this."
//
// Two halves, and the second is the one that makes the first worth doing.
//
//   THE DOOR. The character name used to open the row's PICTURE EDITOR — the
//   right answer while a character was flat text with a still attached, and the
//   wrong one since 0056 gave it a record with a page. A reader pressing a
//   character's name is asking who that character is.
//
//   THE ARRIVAL. A character record is library-wide and the page drew it that
//   way: one grid of every work it turns up in. Opened from a film's cast list
//   that is the wrong shape — the reader has already said which work they mean,
//   and the card they want is one of eight. So the work they came from is lifted
//   out, given the first scope, and inked; the grid below is "the others".
//
// WHAT IS ASSERTED HERE IS THE STRUCTURE, not the ink. The colour of a rule is a
// screenshot's business. What a test can hold is that the two grains are separate
// sections, that the card is in exactly one of them, and that each says which
// grain it is — which is what the reader is actually being told apart.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CALLS
let CAST
let CHARACTER

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path.endsWith('/cast')) return { ok: true, data: { cast: CAST, actor_role: 'actor' } }
    if (method === 'GET' && path === '/movies/5') return { ok: true, data: FILM }
    if (method === 'GET' && path === '/characters/3') return { ok: true, data: CHARACTER }
    if (method === 'GET' && path.startsWith('/people')) return { ok: true, data: { people: [] } }
    if (method === 'GET' && path === '/books') return { ok: true, data: { books: [] } }
    if (method === 'GET' && path === '/movies') return { ok: true, data: { movies: [] } }
    return { ok: true, data: {} }
  }),
}))

const { CastSection } = await import('../../src/cast.jsx')
const { characterPanel } = await import('../../src/identity.jsx')
const { workPeoplePanel } = await import('../../src/WorkDetails.jsx')
const { t } = await import('../../src/i18n.js')

const FILM = { id: 5, title: 'The Master and Margarita (2005)', media_type: 'show' }

// ONE ROW LINKED AND ONE NOT, because `work_cast.character_id` is nullable: 0056
// links the pair on demand, and a library that has never been through the
// characters console has rows carrying none. The unlinked row is not an edge case
// to be tidied away — it is most rows on most libraries.
const ROWS = [
  { id: 11, character: 'Woland', actor: 'Oleg Basilashvili', character_id: 3, character_image_url: '', character_image_path: '' },
  { id: 12, character: 'Behemoth', actor: 'Aleksandr Bashirov', character_id: 0, character_image_url: '', character_image_path: '' },
]

const APPEARANCES = [
  {
    cast_id: 11, kind: 'movie', work_id: 5, work_title: 'The Master and Margarita (2005)',
    character: 'Woland', actor_id: 9, actor: 'Oleg Basilashvili', image: '', cover: '',
    media_type: 'show', description: '',
  },
  // THE SAME CHARACTER, THE SAME WORK, A SECOND PERFORMER. Not a contrivance:
  // `idx_work_cast_pair` is unique on (kind, work_id, character_key, actor_key),
  // so a film that bills a part twice — young and old, or a voice beside a face —
  // is two rows on one work, both linked to one `characters` record. The panel has
  // to be told WHICH row, and the case at the foot of this file is why.
  {
    cast_id: 31, kind: 'movie', work_id: 5, work_title: 'The Master and Margarita (2005)',
    character: 'Woland (voice)', actor_id: 14, actor: 'Valentin Gaft', image: '', cover: '',
    media_type: 'show', description: '',
  },
  {
    cast_id: 21, kind: 'book', work_id: 1, work_title: 'The Master and Margarita',
    character: 'the professor', actor_id: 0, actor: '', image: '', cover: '',
    media_type: '', description: '',
  },
]

beforeEach(() => {
  CALLS = []
  CAST = ROWS.map((r) => ({ ...r }))
  CHARACTER = {
    id: 3, name: 'Woland', sort_name: '', description: '', note: '', image_path: '',
    aliases: [], appearances: APPEARANCES, lines: [], shared_lines: 0,
  }
})
afterEach(() => cleanup())

// ---- the door --------------------------------------------------------------

const castList = async (onOpenCharacter) => {
  render(<CastSection kind="movie" item={FILM} onCastChanged={() => {}} onOpenCharacter={onOpenCharacter} />)
  await screen.findByText('Woland')
}

describe('the character name on a cast row', () => {
  it('opens the character, and hands over the row it was pressed on', async () => {
    const open = vi.fn()
    await castList(open)
    fireEvent.click(screen.getByText('Woland'))
    expect(open, 'the name did not open the character').toHaveBeenCalledTimes(1)
    // THE ROW, not just the name. The caller needs `character_id` to know which
    // record to open — a name would have to be resolved, and resolving a name is
    // how a reader lands on somebody else's Woland.
    expect(open.mock.calls[0][0].character_id).toBe(3)
  })

})

// ---- the arrival -----------------------------------------------------------

const stack = () => ({ push: vi.fn(), open: vi.fn() })
// AWAITS THE NAME, NOT THE WORK TITLE. On the pack's local sheet the title is
// inside the crumb ("in The Master and Margarita"), so waiting for it as plain
// text waits for something no longer rendered — which is a timeout dressed up as
// a missing element.
const openPage = async (work) => {
  render(characterPanel(stack(), { id: 3, name: 'Woland', work }).render())
  await screen.findAllByText('Woland')
}
// THE OLD HELPERS WENT WITH THE OLD ARRANGEMENT. `.identity-scope.is-work` was
// a section on a page that stacked three grains at once; the pack's local sheet
// IS the narrow grain, so there is no inked section to look for — the whole
// screen is the answer. What is still worth holding is WHICH ROW it opened on,
// and that is read off the sheet's own rows.
const sheet = () => document.querySelector('.cs-body') || document.body
const rowValue = (label) => {
  const row = [...document.querySelectorAll('.cs-row')]
    .find((r) => (r.textContent || '').includes(label))
  return row ? row.textContent : ''
}

// ---- the wiring between them ------------------------------------------------
//
// THE HALF NEITHER GROUP ABOVE COVERS, and the half the bug was in. The door
// group renders CastSection with a stub opener and asserts what the stub is
// handed; the arrival group renders the panel with a descriptor written by hand.
// Between them sits `workPeoplePanel`, which turns the one into the other — and
// dropping `castId` there broke nothing in either group, because neither of them
// runs it. So this drives the real chain end to end: press the name in the cast
// list, take the descriptor the stack was actually pushed, and render THAT.

