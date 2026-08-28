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
    // NAMED BY SUPPLIER since TheTVDB gained a built-in slot of its own: two
    // chips reading "Built-in key" side by side answer "why does this work"
    // with a question.
    await waitFor(() => expect(screen.getByText('Built-in TMDB key')).toBeTruthy())
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

// ---- the games pair ------------------------------------------------------
//
// THE GAP THIS CLOSES. 1.15.1 shipped games, an IGDB lookup, an endpoint that
// accepts igdb_client_id and igdb_secret, a GET that reports the two halves
// SEPARATELY — with a comment saying it does so "so the Settings card can point
// at the half that is missing" — and an Add sheet that says "no IGDB key
// configured; it needs a Twitch client id and secret". The two rows in Settings
// never landed, so the app named a screen that had no field on it and a game
// lookup 503'd with nowhere to go. Every layer was tested except the one a
// reader touches.
//
// So these assert the rows exist and write the right field names. A test that
// only posted to the endpoint would have passed throughout the release the rows
// were missing.
describe('the IGDB pair', () => {
  it('offers a row for each half', async () => {
    await page()
    expect(editBtn('IGDB client id')).toBeTruthy()
    expect(editBtn('IGDB secret')).toBeTruthy()
  })

  it('says which halves are stored', async () => {
    KEYS = { igdb_client_id_set: true, igdb_secret_set: true }
    await page()
    await waitFor(() => expect(badge('IGDB client id')).not.toBeNull())
    expect(badge('IGDB secret')).not.toBeNull()
  })

  it.each([
    ['igdb_client_id', 'IGDB client id', /Twitch client id/],
    ['igdb_secret', 'IGDB secret', /Twitch client secret/],
  ])('saves %s under the name the server decodes', async (field, label, placeholder) => {
    // The field NAME is the whole of the wiring: the endpoint decodes every key
    // as a pointer, so a misspelt one is silently left alone and the save
    // reports success having stored nothing.
    await page()
    fireEvent.click(editBtn(label))
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: 'v1' } })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`save ${label}`, 'i') }))
    await waitFor(() =>
      expect(PUTS.some(([p, b]) => p === '/admin/metadata-keys' && b[field] === 'v1')).toBe(true),
    )
  })

  it('says nothing when neither half is set', async () => {
    // An instance with no games in it is not misconfigured, and a standing red
    // line about a key nobody needs is the "Untested" chip wearing a new label.
    KEYS = { igdb_client_id_set: false, igdb_secret_set: false }
    await page()
    await waitFor(() => expect(editBtn('IGDB secret')).toBeTruthy())
    expect(screen.queryByText(/IGDB needs both halves/)).toBeNull()
  })

  it.each([
    [{ igdb_client_id_set: true, igdb_secret_set: false }, /the secret is still/],
    [{ igdb_client_id_set: false, igdb_secret_set: true }, /the client id is still/],
  ])('names the missing half when only one is set', async (keys, says) => {
    // Half a pair fails at the Twitch token exchange with "invalid client",
    // which arrives as a lookup failure — so the reader is told games are broken
    // when the truth is that one field is blank. This is the state the split
    // booleans exist for.
    KEYS = keys
    await page()
    await waitFor(() => expect(screen.getByText(says)).toBeTruthy())
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
