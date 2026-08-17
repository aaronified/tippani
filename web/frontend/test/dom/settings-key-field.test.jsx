// The Metadata card's key rows.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// The card loads its status and its keys on mount, so the module is mocked
// before it is imported. Each case sets KEYS/STATUS and renders.
let KEYS
let STATUS
let PUTS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') { PUTS.push([path, body]); return { ok: true, data: {} } }
    if (path === '/metadata/status') return { ok: true, data: STATUS }
    if (path === '/admin/metadata-keys') return { ok: true, data: KEYS }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

const ADMIN = { username: 'a', is_admin: true, preferences: {} }

beforeEach(() => {
  KEYS = {}
  STATUS = { tmdb: { source: 'builtin' }, books_lookup: { ok: true } }
  PUTS = []
})

// The whole page renders, because the card is only reachable through it and the
// point of several of these cases is what is NOT on the page.
const page = async () => {
  render(<Settings user={ADMIN} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await screen.findByText('Metadata sources')
}

const badge = (label) => screen.queryByRole('img', { name: `${label}: saved` })
const editBtn = (label) => screen.getByRole('button', { name: new RegExp(`(Add|Replace) (a|the) ${label.toLowerCase()}`, 'i') })

describe('a key row', () => {
  it('says whether the key is stored, without printing anything that looks like it', async () => {
    KEYS = { tmdb_key_set: true, tvdb_key_set: false }
    await page()
    await waitFor(() => expect(badge('TMDB key')).not.toBeNull())
    // The one that is not set has no badge — absence is the signal, and the
    // edit button's own label already says "Add" rather than "Replace".
    expect(badge('TheTVDB key')).toBeNull()
    // And nothing on the page pretends to show a secret.
    expect(screen.queryByText(/•/)).toBeNull()
  })

  it('costs no vertical space until you ask to change it', async () => {
    KEYS = { tmdb_key_set: true }
    await page()
    await waitFor(() => expect(badge('TMDB key')).not.toBeNull())
    expect(screen.queryByPlaceholderText(/TMDB v3 key/)).toBeNull()
    fireEvent.click(editBtn('TMDB key'))
    expect(screen.getByPlaceholderText(/TMDB v3 key/)).toBeTruthy()
    // While editing, the badge steps aside: the row is showing a save and a
    // cancel, and a third glyph saying "the old one is still stored" beside them
    // is a state that is about to stop being true.
    expect(badge('TMDB key')).toBeNull()
  })

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

  it('shows a value that is not a secret, because hiding it answers nothing', async () => {
    // "Saved" is the whole content of a stored secret. It is not the whole
    // content of www.amazon.de, and a badge there would withhold the only thing
    // the field is for.
    KEYS = { amazon_domain: 'www.amazon.de' }
    await page()
    await waitFor(() => expect(screen.getByText('www.amazon.de')).toBeTruthy())
  })
})

describe('what the card no longer says', () => {
  it('drops the feature descriptions', async () => {
    // Which services back a lookup is a fact about the app, not a setting. It
    // belongs in the info dot; as bold text beside every heading it was three
    // rows of prose on the page you open to change something.
    await page()
    expect(screen.queryByText('Google Books + Open Library')).toBeNull()
    expect(screen.queryByText('Kindle / ASIN')).toBeNull()
    expect(screen.queryByText(/^\+? ?TheTVDB$/)).toBeNull()
  })

  it('drops a chip that says what the row below it says', async () => {
    KEYS = { tmdb_key_set: true, tvdb_key_set: true }
    STATUS = { tmdb: { source: 'custom' }, tvdb: { source: 'custom' }, books_lookup: { ok: true } }
    await page()
    await waitFor(() => expect(badge('TMDB key')).not.toBeNull())
    expect(screen.queryByText('Custom key')).toBeNull()
  })

  it('drops the chip that says everything is fine', async () => {
    // The healthy state is the one state nobody needs told about, and a pill
    // that ONLY appears when there is nothing to do is worse than silent: a
    // reader learns to look there, and it is empty in every case that matters.
    // The default STATUS in this file is a working lookup, so this is the
    // ordinary render, not an edge case.
    //
    // The same render is what pins the built-in key, which is the case a key
    // field is silent about: you have set nothing and lookups work anyway.
    // Deleting the chip along with the redundant one would have removed the
    // answer to "why does this work".
    await page()
    await waitFor(() => expect(screen.getByText('Built-in key')).toBeTruthy())
    expect(screen.queryByText('OK')).toBeNull()
  })

  it('still speaks up when the last lookup failed', async () => {
    // The half of the chip that was carrying its weight. Deleting the success
    // state by widening the condition instead of narrowing it would take this
    // with it and look identical on a healthy instance — which is every
    // instance, until it is not.
    STATUS = { tmdb: { source: 'custom' }, books_lookup: { ok: false, error: 'timed out' } }
    await page()
    await waitFor(() => expect(screen.getByText('Lookup failing')).toBeTruthy())
    expect(screen.getByText(/timed out/)).toBeTruthy()
  })

  it('says nothing at all when no lookup has been tried since the server started', async () => {
    // 1.15.2. `books_lookup.ok` is null until the first lookup of a server's
    // life, so "Untested" greeted every admin on a fresh instance with a word
    // that sounds like a warning, describes no fault, and clears itself the
    // moment anybody uses the app. The row must not render either: an empty flex
    // box under the heading reads as an element that failed to load.
    // source: 'none' is the anchor, not decoration — it renders the TMDB chip,
    // which is the proof that /metadata/status has resolved and the row has been
    // rendered from it. Asserting absence against a fetch that has not landed
    // would pass for the wrong reason, and keep passing if the chip came back.
    STATUS = { tmdb: { source: 'none' }, books_lookup: null }
    await page()
    await waitFor(() => expect(screen.getByText('No key')).toBeTruthy())
    expect(screen.queryByText('Untested')).toBeNull()
    expect(screen.queryByText('Lookup failing')).toBeNull()
  })

  it('says so when there is no key at all', async () => {
    STATUS = { tmdb: { source: 'none' }, books_lookup: { ok: true } }
    await page()
    await waitFor(() => expect(screen.getByText('No key')).toBeTruthy())
  })
})

describe('multi-author credits', () => {
  it('lives inside the metadata card rather than beside it', async () => {
    // Four chips and a label is a footnote to a subject, not a subject. The
    // assertion is containment, not presence: rendering it anywhere on the page
    // would pass a queryByText.
    await page()
    const card = screen.getByText('Metadata sources').closest('.hand-card, [class*="card"]')
    expect(card, 'the metadata card').toBeTruthy()
    expect(card.textContent).toContain('Multi-author credits')
  })

  it('still writes the preference when a separator is toggled', async () => {
    await page()
    fireEvent.click(screen.getByRole('button', { name: 'amp' }))
    await waitFor(() =>
      expect(PUTS.some(([p, b]) => p === '/auth/me/preferences' && typeof b.creditSeparators === 'string')).toBe(true),
    )
  })
})
