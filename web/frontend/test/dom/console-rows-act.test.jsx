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

})
