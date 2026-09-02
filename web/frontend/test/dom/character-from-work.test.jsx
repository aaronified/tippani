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

  it('still opens the picture editor on a row with no record behind it', async () => {
    const open = vi.fn()
    await castList(open)
    const name = screen.getByText('Behemoth')
    fireEvent.click(name)
    // A link to a page that does not exist is worse than the affordance it
    // replaced, so this row keeps the old door rather than getting a dead one.
    expect(open, 'a row with no character_id opened a record that is not there').not.toHaveBeenCalled()
    expect(name.getAttribute('aria-expanded')).toBe('true')
  })

  it('does not claim to be a menu on the rows that do open a record', async () => {
    await castList(vi.fn())
    // aria-expanded on a control that navigates is a lie to a screen reader:
    // nothing expands, and the reader is told to look for what opened.
    expect(screen.getByText('Woland').getAttribute('aria-expanded')).toBeNull()
  })
})

// ---- the arrival -----------------------------------------------------------

const stack = () => ({ push: vi.fn(), open: vi.fn() })
const openPage = async (work) => {
  render(characterPanel(stack(), { id: 3, name: 'Woland', work }).render())
  await screen.findByText('The Master and Margarita')
}
const scope = (tone) => document.querySelector(`.identity-scope.is-${tone}`)
const card = (title) => screen.getByText(title).closest('.char-work')

describe('the character page, opened from a work', () => {
  const FROM_FILM = { kind: 'movie', id: 5, title: 'The Master and Margarita (2005)', castId: 11 }

  it('leads with that work, in a scope of its own', async () => {
    await openPage(FROM_FILM)
    const here = scope('work')
    expect(here, 'no work scope, so the page opened library-wide').toBeTruthy()
    expect(within(here).getByText('The Master and Margarita (2005)')).toBeTruthy()
  })

  it('does not draw the row it lifted twice', async () => {
    await openPage(FROM_FILM)
    // A card in both sections invites the reader to edit the wrong one, and the
    // two edit the same row. Counted by the BILLING rather than the work title,
    // because the sibling row is on the same film and legitimately still listed
    // below — it is a different cast row and a different thing to edit.
    expect(screen.getAllByText('Oleg Basilashvili')).toHaveLength(1)
    expect(within(scope('library')).queryByText('Oleg Basilashvili')).toBeNull()
    expect(within(scope('library')).getByText('The Master and Margarita')).toBeTruthy()
  })

  it('lifts the row it was given, not the first one on that work', async () => {
    // THE BUG THIS CASE EXISTS FOR. Matching on (kind, work_id) alone finds the
    // first billing on the film, so pressing the second row opened the panel on
    // its sibling — the reader lands on a card naming a performer they did not
    // press, with the one they did press listed below as another work.
    await openPage({ ...FROM_FILM, castId: 31 })
    const here = scope('work')
    expect(within(here).getByText('Woland (voice)'), 'lifted the wrong billing').toBeTruthy()
    expect(within(here).queryByText('Oleg Basilashvili'), 'lifted the sibling row').toBeNull()
    // And the one that was not pressed is still reachable, below.
    expect(within(scope('library')).getByText('Oleg Basilashvili')).toBeTruthy()
  })

  it('still finds the work when the caller knows no row', async () => {
    // The fallback is not dead code: a caller may know the work and not the row.
    await openPage({ kind: 'movie', id: 5, title: 'The Master and Margarita (2005)' })
    expect(scope('work'), 'no work scope without a cast id').toBeTruthy()
  })

  it('counts what is left below it, rather than the whole record', async () => {
    await openPage(FROM_FILM)
    // "in 2 works" over a grid of one is a heading that contradicts what is under
    // it. The record's own total is on the head above, where it belongs.
    expect(within(scope('library')).getByText(/other work/i)).toBeTruthy()
  })

  it('says what each grain is, in a dot rather than a paragraph', async () => {
    await openPage(FROM_FILM)
    // The subtext under each heading says what saving there CHANGES; the dot says
    // what the section IS. Both, because a reader who has not worked out that a
    // character exists twice cannot read the first one correctly.
    for (const tone of ['work', 'library', 'record']) {
      expect(
        within(scope(tone)).getByRole('button', { name: /more|info|about/i }),
        `the ${tone} scope has no dot explaining which grain it is`,
      ).toBeTruthy()
    }
  })

  it('marks only the narrow scope, so the ink means narrow and not important', async () => {
    await openPage(FROM_FILM)
    expect(scope('work')).toBeTruthy()
    expect(scope('library').className).not.toMatch(/is-work/)
    expect(scope('record').className).not.toMatch(/is-work/)
  })
})

describe('the same page, opened from the console', () => {
  it('has no work scope at all, and lists every work together', async () => {
    await openPage(undefined)
    // Absent rather than present and empty: there is no work to be on, and a
    // heading claiming otherwise is a heading about nothing.
    expect(scope('work'), 'a work scope with no work to scope to').toBeNull()
    // ALL THREE APPEARANCES, including both of the film's two billings — nothing
    // has been lifted, so nothing is missing from the grid.
    const lib = within(scope('library'))
    expect(lib.getAllByText('The Master and Margarita (2005)')).toHaveLength(2)
    expect(lib.getByText('Oleg Basilashvili')).toBeTruthy()
    expect(lib.getByText('Valentin Gaft')).toBeTruthy()
    expect(lib.getByText('The Master and Margarita')).toBeTruthy()
  })
})

// ---- the wiring between them ------------------------------------------------
//
// THE HALF NEITHER GROUP ABOVE COVERS, and the half the bug was in. The door
// group renders CastSection with a stub opener and asserts what the stub is
// handed; the arrival group renders the panel with a descriptor written by hand.
// Between them sits `workPeoplePanel`, which turns the one into the other — and
// dropping `castId` there broke nothing in either group, because neither of them
// runs it. So this drives the real chain end to end: press the name in the cast
// list, take the descriptor the stack was actually pushed, and render THAT.

describe('pressing a character in a work’s People panel', () => {
  it('opens the panel on the row that was pressed', async () => {
    // A second billing of Woland, so "the row that was pressed" is a question
    // with two possible answers and the wrong one is reachable.
    CAST = [
      ...ROWS,
      { id: 31, character: 'Woland (voice)', actor: 'Valentin Gaft', character_id: 3, character_image_url: '', character_image_path: '' },
    ]
    const s = stack()
    render(workPeoplePanel(s, {
      kind: 'movie', item: FILM, creditSpecs: [], mediaType: 'show', onChanged: () => {},
    }).render())
    const second = await screen.findByText('Woland (voice)')
    fireEvent.click(second)

    expect(s.push, 'the People panel pushed nothing').toHaveBeenCalledTimes(1)
    cleanup()
    render(s.push.mock.calls[0][0].render())
    await screen.findByText('The Master and Margarita')

    const here = scope('work')
    expect(here, 'the pushed panel had no work scope, so no row was named').toBeTruthy()
    expect(within(here).getByText('Woland (voice)'), 'opened on the wrong billing').toBeTruthy()
    expect(within(here).queryByText('Oleg Basilashvili')).toBeNull()
  })
})
