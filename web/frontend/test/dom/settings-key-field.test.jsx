// The Metadata sources block's key rows.
//
// Six API keys, each of which used to carry a permanent second line reading
// "•••••••••• saved". That line spends a row of vertical space restating one bit
// of information in a form that cannot be read: the dots are not the key and are
// not even the right number of characters, because a secret here is write-only
// on purpose and the server never sends it back. The badge carries the same bit
// in no space at all.
//
// What is worth testing is not that the dots are gone — deleting a line needs no
// test — but that the bit SURVIVED the deletion. "It is shorter now" and "it no
// longer tells you whether your TMDB key is stored" look identical in a
// screenshot and are not the same change.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

// The card loads its status and its keys on mount, so the module is mocked
// before it is imported. Each case sets KEYS/STATUS and renders.
let KEYS
let STATUS
let PUTS
let PUT_ANSWER

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') { PUTS.push([path, body]); return PUT_ANSWER }
    if (path === '/metadata/status') return { ok: true, data: STATUS }
    if (path === '/admin/metadata-keys') return { ok: true, data: KEYS }
    return { ok: true, data: {} }
  }),
}))

// THE BLOCK, NOT THE PAGE IT USED TO BE ON. These rows were a card on Settings
// and are a section of the Metadata screen now; mounting the block directly is
// what the move makes possible, and it is what the cases were always about — the
// old mount rendered a whole settings page to reach six inputs.
const { MetadataSources } = await import('../../src/MetadataSources.jsx')
const { PROVIDER_MARKS } = await import('../../src/providerMarks.js')

const ADMIN = { username: 'a', is_admin: true, preferences: {} }

beforeEach(() => {
  KEYS = {}
  STATUS = { tmdb: { source: 'builtin' }, books_lookup: { ok: true } }
  PUTS = []
  PUT_ANSWER = { ok: true, data: {} }
})

// EVERY SUPPLIER ON THE LIST, as GET /metadata/status names them.
const EVERY_SOURCE = ['google', 'openlibrary', 'amazon', 'tmdb', 'tvdb', 'imdb', 'letterboxd', 'igdb', 'wikidata', 'google-images', 'wikimedia', 'fandom']

// THE KEY FIELDS OPEN FROM THEIR SUPPLIER'S ROW. They were a card of their own and
// are a tray under each row of "All sources" now, so the mount hands the block the
// rows (unless a case sent its own) and opens every row's setup, which is what a
// reader does to reach them.
const page = async () => {
  if (!STATUS.sources) {
    STATUS = { ...STATUS, sources: EVERY_SOURCE.map((source) => ({ source, state: 'optional', areas: ['books'], fields: 0, works: 0, people: 0 })) }
  }
  render(<MetadataSources user={ADMIN} onPreferences={() => {}} />)
  await screen.findByText('All sources')
  for (const b of await screen.findAllByRole('button', { name: /^Set up / })) fireEvent.click(b)
  await screen.findByText('TMDB key')
}

// WHERE "IS THIS KEY STORED" LIVES NOW. It was a badge — a floppy disc with a
// tick and an aria-label of "<field>: saved" — and it is the COLOUR of the
// supplier's mark: green saved, purple using the built-in key, amber optional and
// unset, red needed and unset. The owner's scheme, and the reason for it was
// width: the badge and a status chip beside it left this row nothing at 390px and
// the label came apart mid-word.
//
// SO THE ASSERTION FOLLOWS THE FACT AND NOT THE PIXELS. A class name would be a
// tautology and a colour is not readable from jsdom, but the mark says its state
// in words in its accessible name, because four hues are one hue to a reader who
// cannot separate them — so the accessible name is both the honest thing to test
// and the thing that would actually break a reader if it went.
const markState = (label) => {
  const el = screen.queryByLabelText(new RegExp(`^Source: ${label} — `, 'i'))
  return el ? el.getAttribute('aria-label').replace(/^Source: .*? — /i, '') : null
}
const badge = (label) => (markState(label) === 'Saved' ? true : null)
const editBtn = (label) => screen.getByRole('button', { name: new RegExp(`(Add|Replace) (a|the) ${label.toLowerCase()}`, 'i') })

describe('a key row', () => {

  it('still saves what you type into it', async () => {
    // The rewrite moved the input out of a branch that always rendered into one
    // that renders only while editing, which is exactly the shape of edit where
    // the control survives and the wiring does not.
    await page()
    fireEvent.click(editBtn('TMDB key'))
    fireEvent.change(screen.getByPlaceholderText(/TMDB v3 key/), { target: { value: 'k123' } })
    fireEvent.click(screen.getByRole('button', { name: /save tmdb key/i }))
    await waitFor(() => expect(PUTS.some(([p, b]) => p === '/admin/metadata-keys' && b.tmdb_key === 'k123')).toBe(true))
  })

})

