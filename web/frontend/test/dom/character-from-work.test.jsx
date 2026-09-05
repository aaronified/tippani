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

describe('the character page, opened from a work', () => {
  const FROM_FILM = { kind: 'movie', id: 5, title: 'The Master and Margarita (2005)', castId: 11 }

  it('is the work it was opened from, and says so in the crumb', async () => {
    await openPage(FROM_FILM)
    // The pack's local sheet does not stack the grains — it IS the narrow one,
    // and the crumb under the name is what says which work. "in <title>", never
    // "<name> · <title>": the sheet is about a character IN a work, and the
    // preposition is the whole of that fact.
    expect(screen.getByText(/^in The Master and Margarita/), 'no crumb naming the work').toBeTruthy()
  })

  it('opens on the row it was given, not the first one on that work', async () => {
    // THE BUG THIS CASE EXISTS FOR, and it survived the rearrangement because it
    // was never about the arrangement: matching on (kind, work_id) alone finds
    // the first billing on the film, so pressing the second row opened the sheet
    // on its sibling — the reader lands on a screen naming a performer they did
    // not press.
    await openPage({ ...FROM_FILM, castId: 31 })
    expect(rowValue('Credited as'), 'opened on the wrong billing').toMatch(/Woland \(voice\)/)
  })

  it('still finds the work when the caller knows no row', async () => {
    // The fallback is not dead code: a caller may know the work and not the row.
    await openPage({ kind: 'movie', id: 5, title: 'The Master and Margarita (2005)' })
    expect(screen.getByText(/^in The Master and Margarita/), 'no sheet without a cast id').toBeTruthy()
  })

  it('offers one door up, carrying how many works the identity spans', async () => {
    await openPage(FROM_FILM)
    // The whole appearance strip, the alias list and the merge control live on
    // char-global now. What stands in their place is this row — and the count
    // beside it is the fact that makes the door worth opening.
    expect(rowValue('Open the global record'), 'no door to the identity').toMatch(/work/)
  })

  it('says what saving here changes, and what saving up there changes', async () => {
    await openPage(FROM_FILM)
    // The note under "The identity" is what stops a reader believing they
    // renamed the character on every work by editing this one.
    // The locale's own sentence for the section note — see character-destination
    // for why this is not a regex over the English.
    expect(screen.getByText(t('identity.section.identity.note')),
      'the identity section explains nothing').toBeTruthy()
    // And the note's opposite, on the row that is this work's alone.
    expect(rowValue('Note'), 'the private note does not say it is per-work').toMatch(/this work only/i)
  })

  it('names the way out for this medium, and reassures about the rest', async () => {
    await openPage(FROM_FILM)
    // THE FIXTURE IS A SHOW, which is the point of reading it rather than the
    // variable name: mediumOf answers from media_type, so the wording follows the
    // record and not the word "film" in this file. A show and a film share the
    // rest of the sheet — identityScope gives both `dubs` and a performer block.
    expect(screen.getByText('Remove from this show'), 'no way out of the one work').toBeTruthy()
    // A film's reassurance carries one clause more than a book's, because a film
    // has people whose records could be thought at risk.
    const kept = t('identity.row.unlink.sub.cast')
    expect(kept.length, 'the removal row reassures about nothing').toBeGreaterThan(3)
    expect(screen.getByText(kept)).toBeTruthy()
  })

  it('draws the performer block on a screen work, with the dubs under it', async () => {
    await openPage(FROM_FILM)
    // Played by / Voiced by is a CONTROL because there are two answers, and an
    // animated feature is a film whose cast is voiced.
    expect(screen.getAllByText('Played by').length, 'no performer heading').toBeGreaterThan(0)
    expect(screen.getByText('Dubbed by'), 'a screen work that cannot credit a dub').toBeTruthy()
  })
})

describe('the same page, opened from the console', () => {
  it('has no work scope at all, and lists every work together', async () => {
    await openPage(undefined)
    // Absent rather than present and empty: there is no work to be on, and a
    // heading claiming otherwise is a heading about nothing.
    // The global sheet HAS a crumb — "1 book · 1 film · 1 game", the pack's own
    // and a better answer than "3 works". What it must not have is the local
    // sheet's, which names one work.
    expect(screen.queryByText(/^in The Master and Margarita/), 'a work crumb with no work to be in').toBeNull()
    // ALL THREE APPEARANCES, ON THE STRIP, including both of the film's two
    // billings — nothing has been lifted, so nothing is missing from the shelf.
    // The grid this replaces is now each tile's own editor; see identityGlobal.jsx.
    const titles = [...document.querySelectorAll('.cs-tile-title')].map((n) => n.textContent)
    expect(titles.filter((ti) => ti === 'The Master and Margarita (2005)')).toHaveLength(2)
    expect(titles).toContain('The Master and Margarita')
    // AND EACH PERFORMER IS NAMED, on the face's own title — the tile carries the
    // fact and the card behind it carries the door.
    const faces = [...document.querySelectorAll('.cs-tile-chip')].map((f) => f.getAttribute('title') || '')
    expect(faces.some((ti) => /Oleg Basilashvili/.test(ti))).toBe(true)
    expect(faces.some((ti) => /Valentin Gaft/.test(ti))).toBe(true)
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
    await screen.findAllByText(/Woland/)

    expect(rowValue('Credited as'), 'opened on the wrong billing').toMatch(/Woland \(voice\)/)
  })
})
