// WHAT A CONSOLE ROW LETS A READER DO — the three verbs the row redesign added,
// none of which had a test when it shipped.
//
// The rater's finding, and it was right: the commit that added the performer
// pills, the medium glyphs and the row-level delete grew the suite by nothing.
// `role-chips-draw.test.jsx` holds the role marks and stops there. So the owner's
// own spec — "medium and performers (full list of chip with clickable pills)" —
// and a delete that writes to the server were both shipped on the strength of
// having been looked at.
//
// THESE PRESS THINGS. The row is rendered by its own console, from records the
// server would send, and every assertion is something a reader can see or do: a
// name on screen, a press that opens a person, a glyph that is absent. No assertion
// reads a class, a source path or a component's name.
//
// THE DECLARED EXCEPTION, because the header above would otherwise be a claim this
// file breaks in its own setup: it MOCKS `src/api.js` and imports the two consoles
// by path. That is knowing what the code is, and the reason nothing observable
// serves is that a jsdom render has no server to answer it. What it buys is a
// case that can hold the ABSENCE of the delete glyph over a credited row — a state
// the journey fixture would have to be built to contain. The end-to-end half, with
// a real server and a real browser, is `who-played-this-character.journey.mjs`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let PEOPLE
let CHARACTERS
let SENT

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    if (method === 'GET' && path === '/people/records') return { ok: true, data: { people: PEOPLE } }
    if (method === 'GET' && path.startsWith('/characters')) return { ok: true, data: { characters: CHARACTERS } }
    if (method === 'POST' && path === '/people/portrait') return { ok: true, data: { person: null, links: {} } }
    return { ok: true, data: {} }
  }),
}))

const { PeopleConsole, CharactersConsole } = await import('../../src/MetadataPage.jsx')
const { t } = await import('../../src/i18n.js')

const person = (over = {}) => ({
  id: 1, name: 'Frank Herbert', sort_name: '', bio: '', image_path: '', born: '', died: '',
  links: '', source: '', source_id: '', kinds: ['author'], spellings: [],
  works: 0, credits: 0, quotes: 0, works_in: [], ...over,
})

const character = (over = {}) => ({
  id: 1, name: 'Vito Corleone', works: 1, quotes: 0, aliases: [], works_in: [], ...over,
})

beforeEach(() => {
  SENT = []
  PEOPLE = []
  CHARACTERS = []
})
afterEach(() => cleanup())

describe('a character row', () => {
  it('names every performer, and pressing one opens that person', async () => {
    CHARACTERS = [character({
      works_in: [{
        kind: 'movie', id: 9, title: 'The Godfather Part II', media_type: 'movie',
        // BOTH VITOS ON ONE FILM, which is the pair the server used to collapse to
        // whichever had the higher id.
        actors: [{ id: 11, name: 'Robert De Niro' }, { id: 12, name: 'Marlon Brando' }],
      }],
    })]
    const opened = []
    render(<CharactersConsole rows={CHARACTERS} onReload={() => {}} />)
    await screen.findByText('Vito Corleone')

    for (const name of ['Robert De Niro', 'Marlon Brando']) {
      expect(screen.getByText(name), `the row does not name ${name}`).toBeTruthy()
    }
    // A PILL IS A DOOR, which is the reason the server sends an id beside the name.
    fireEvent.click(screen.getByText('Marlon Brando'))
    await waitFor(() => expect(SENT.some((s) => s.path.includes('/people/id/12'))).toBe(true))
  })

  it('calls a television series a show, not a film', async () => {
    CHARACTERS = [character({
      name: 'Geralt',
      works_in: [{ kind: 'movie', id: 4, title: 'The Witcher', media_type: 'show', actors: [] }],
    })]
    render(<CharactersConsole rows={CHARACTERS} onReload={() => {}} />)
    await screen.findByText('Geralt')
    // The glyph is the clapper board either way — there is one in the set and a
    // second would be a picture nobody has seen. The NOUN is what was wrong.
    expect(screen.queryByLabelText(t('unit.show', { count: 1 })), 'a show is not labelled a show').toBeTruthy()
    expect(screen.queryByLabelText(t('unit.film', { count: 1 })), 'a show is labelled a film').toBeNull()
  })

  // ONE DRAWING, HOWEVER MANY MEDIA IT COVERS. A film and a show share the clapper,
  // so a character in both would draw it TWICE side by side, told apart only by a
  // tooltip nobody has hovered — "a lookalike next to the real glyph is two
  // pictures of one thing", and on a row it reads as a rendering fault rather than
  // as a fact. One mark, and its name says what it stands for here.
  it('draws one clapper for a character in a film and a show, naming both', async () => {
    CHARACTERS = [character({
      name: 'Jack Ryan',
      works_in: [
        { kind: 'movie', id: 4, title: 'The Hunt for Red October', media_type: 'movie', actors: [] },
        { kind: 'movie', id: 5, title: 'Tom Clancy’s series', media_type: 'show', actors: [] },
      ],
    })]
    render(<CharactersConsole rows={CHARACTERS} onReload={() => {}} />)
    await screen.findByText('Jack Ryan')

    const both = `${t('unit.film', { count: 1 })} · ${t('unit.show', { count: 1 })}`
    expect(screen.queryAllByLabelText(both), 'the two media are not one mark').toHaveLength(1)
    // And neither medium is also drawn on its own, which is what two marks means.
    expect(screen.queryByLabelText(t('unit.film', { count: 1 }))).toBeNull()
    expect(screen.queryByLabelText(t('unit.show', { count: 1 }))).toBeNull()
  })
})

describe('a person row', () => {
  it('offers a delete on a record nothing credits, and writes it', async () => {
    PEOPLE = [person({ name: 'Bob Peck', works: 1, credits: 0 })]
    render(<PeopleConsole onFlash={() => {}} onReverify={() => {}} onSearch={() => {}} />)
    await screen.findByText('Bob Peck')

    const del = screen.getByLabelText(t('metadata.people.action.delete.aria', { name: 'Bob Peck' }))
    fireEvent.click(del)
    // The confirm is the app's own, so answering it is a press like any other.
    fireEvent.click(await screen.findByText(t('common.action.delete.label')))
    await waitFor(() => expect(SENT.some((s) => s.method === 'DELETE' && s.path === '/people/1')).toBe(true))
  })

  // THE HALF THAT MATTERS MORE, because the other one merely works. `DELETE
  // /people/{id}` REFUSES a record still credited on a work — a 409 naming the
  // count — so a glyph drawn over one is a dead press under a confirm that has
  // just promised the bin. On a real library that is most of the list.
  it('does not offer one on a record a work still credits', async () => {
    PEOPLE = [person({ name: 'Frank Herbert', works: 1, credits: 1 })]
    render(<PeopleConsole onFlash={() => {}} onReverify={() => {}} onSearch={() => {}} />)
    await screen.findByText('Frank Herbert')

    expect(
      screen.queryByLabelText(t('metadata.people.action.delete.aria', { name: 'Frank Herbert' })),
      'the row offers a delete the server would refuse',
    ).toBeNull()
    // And the row is otherwise whole — this is a missing verb, not a missing row.
    expect(screen.getByLabelText(t('metadata.people.row.fetch.aria', { name: 'Frank Herbert' }))).toBeTruthy()
  })
})
