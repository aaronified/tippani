// WHERE EACH CAST ROW CAME FROM, on the row.
//
// THE OWNER'S RULE: "the metadata needs to show the source, line wise."
//
// Eleven of the twelve lines already did. Every credit field in the Details panel
// has worn its supplier since 0054 — author from Google Books, director from TMDB,
// the ones you typed in the accent — and the cast list directly beneath them wore
// nothing at all, while `work_cast.origin` has kept the answer in four states
// since 0048 and no screen had ever read the column. So the panel said "line by
// line" for eleven fields and then showed twenty lines with no line on them.
//
// THE FOUR STATES ARE NOT THREE, which is the whole reason this needs a test
// rather than a glance:
//
//   provider    the supplier's, untouched. A refetch may rewrite it wholesale.
//   corrected   the supplier's, edited by the reader. The MARK is still the
//               supplier's — that is where the row came from — and the note says
//               what has happened to it since. A refetch may still update the
//               supplier's own facts on it and may never touch the two names.
//   reader      yours, typed with no provider row underneath. Drawn in the accent,
//               like a field you filled in.
//   removed     a tombstone, and never in this list at all.
//
// Collapsing `corrected` into either neighbour is the failure worth guarding: read
// as `provider` it tells the reader a refetch will overwrite their correction, and
// read as `reader` it hides that there is an upstream row underneath at all.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

let CAST

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path.endsWith('/cast')) return { ok: true, data: { cast: CAST, actor_role: 'actor' } }
    if (method === 'GET' && path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  }),
}))

const { CastSection } = await import('../../src/cast.jsx')

const FILM = { id: 7, title: 'Stalker', media_type: 'movie' }

const ROWS = [
  { id: 11, character: 'the Stalker', actor: 'Aleksandr Kaydanovskiy', origin: 'provider', source: 'tmdb' },
  { id: 12, character: 'the Writer', actor: 'Anatoliy Solonitsyn', origin: 'corrected', source: 'tmdb' },
  { id: 13, character: 'the Professor', actor: 'Nikolay Grinko', origin: 'reader', source: '' },
  // A supplier row whose slug was never stored. Rare, and the honest answer is
  // nothing — "unknown source" on a row is a fact the app does not have.
  { id: 14, character: 'the Wife', actor: 'Alisa Freyndlikh', origin: 'provider', source: '' },
]

beforeEach(() => {
  CAST = ROWS.map((r) => ({ ...r }))
})

const list = async () => {
  render(<CastSection kind="movie" item={FILM} onCastChanged={() => {}} />)
  await screen.findByText('the Stalker')
}
const row = (name) => screen.getByText(name).closest('.cast-row')
const tag = (name) => row(name).querySelector('.field-src')

describe('every cast row says where it came from', () => {
  it('wears the supplier that seeded it', async () => {
    await list()
    expect(tag('the Stalker'), 'a provider row wears nothing').toBeTruthy()
    expect(tag('the Stalker').getAttribute('data-src')).toBe('tmdb')
  })

  it('draws a row you typed as yours, not as an absence', async () => {
    await list()
    // The accent state, which the CSS inks differently — `manual` is a real answer
    // in this app, and the one a reader scans a record for.
    expect(tag('the Professor').getAttribute('data-src')).toBe('manual')
    // The word, twice over on purpose — once for the eye and once for a screen
    // reader — so this counts rather than picking one.
    expect(within(tag('the Professor')).getAllByText(/you/i)).toHaveLength(2)
  })

  it('keeps the supplier’s mark on a row you corrected, and says you corrected it', async () => {
    await list()
    const t = tag('the Writer')
    // STILL THE SUPPLIER'S MARK. The row came from TMDB and a refetch still owns
    // its billing and its ids; what changed is the two names.
    expect(t.getAttribute('data-src')).toBe('tmdb')
    // And the correction is said, not merely implied by an unchanged mark.
    expect(t.getAttribute('title')).toMatch(/corrected/i)
    // A DRAWN MARK CARRIES NO WORD, so the note reaches a screen reader through
    // the sr-only line rather than the visible one — which is the whole reason it
    // is a note and not a second chip on a twenty-row list.
    expect(within(t).getByText(/corrected/i).className).toContain('sr-only')
  })

  it('tells the two apart, which is the whole point of reading the column', async () => {
    await list()
    // Read as `provider`, a corrected row tells the reader a refetch will
    // overwrite their correction. Read as `reader`, it hides the upstream row.
    // So the untouched row must NOT carry the note the corrected one does.
    expect(tag('the Stalker').getAttribute('title')).not.toMatch(/corrected/i)
  })

  it('says nothing where there is nothing true to say', async () => {
    await list()
    // Not "unknown source": the row is a supplier's and the slug is simply not
    // stored, and a tag naming a supplier that was never recorded is worse than no
    // tag — the reader would go looking for it.
    expect(tag('the Wife'), 'invented a source for a row that has none').toBeNull()
  })
})
