// A person's page says who added each link and who supplied the portrait: the
// pack's §1.3, chosen by the owner as "Links auto/you + portrait source". Each
// link wears "auto" (the app found it) or "you" (the reader pasted it), and the
// portrait the supplier's tag; a link or a picture with nothing recorded says
// nothing.
//
// THE PAGE ITSELF IS RENDERED, from the record GET /people/id/{id} returns: the
// first draft rendered the pill row and the portrait block on their own, handed
// props written by the test, so the page's own wiring (link_sources into the
// pills, image_source into the portrait) could break with the test green.
//
// DECLARED EXCEPTION: the record is mocked at the API, and this knows its
// `links`, `link_sources`, `image_path` and `image_source` fields. The offline
// journey world has no supplier, so nothing in it can fetch a link or a portrait
// for the "auto" half; the server's half is people_sources_test.go.
//
// THE MUTATIONS, built and run and put back: linkPills ignoring the sources
// (identityGlobal.jsx) reddens the first case; PersonGlobal not passing
// image_source to the portrait reddens the second.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

let PERSON

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path.startsWith('/people/id/')) return { ok: true, data: PERSON }
    return { ok: true, data: {} }
  }),
}))

const { personPanel } = await import('../../src/identity.jsx')

const LINKS = ['https://openlibrary.org/authors/OL1A', 'https://ursulakleguin.com', 'https://example.org/review']

beforeEach(() => {
  PERSON = {
    id: 7, name: 'Ursula K. Le Guin', sort_name: '', born: '1929', died: '2018', note: '',
    aliases: [], credits: [], roles: [], lines: [], shared_lines: 0,
    links: LINKS.join('\n'),
    link_sources: { [LINKS[0]]: 'openlibrary', [LINKS[1]]: 'manual' },
    image_path: 'leguin.jpg', image_source: 'wikimedia',
  }
})
afterEach(() => cleanup())

const open = () => render(personPanel({ push: vi.fn(), open: vi.fn() }, { id: 7, name: 'Ursula K. Le Guin' }).render())

describe("a person's page", () => {
  it('marks each link auto or you, and leaves an unrecorded one unmarked', async () => {
    open()
    const pill = async (name) => (await screen.findByRole('link', { name: new RegExp(name) })).textContent
    expect(await pill('Open Library')).toMatch(/auto$/)
    expect(await pill('ursulakleguin.com')).toMatch(/you$/)
    expect(await pill('example.org')).not.toMatch(/(auto|you)$/)
    expect(screen.getByTitle('Found by the app, from Open Library')).toBeTruthy()
  })

  it('tags the portrait with whoever supplied it, and says nothing when nobody is recorded', async () => {
    open()
    expect(await screen.findByText(/wikimedia/i)).toBeTruthy()
    cleanup()
    PERSON = { ...PERSON, image_source: '' }
    open()
    await screen.findByRole('link', { name: /Open Library/ })
    expect(document.body.textContent).not.toMatch(/wikimedia/i)
  })
})
