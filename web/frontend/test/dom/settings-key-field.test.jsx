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

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') { PUTS.push([path, body]); return { ok: true, data: {} } }
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
})

const page = async () => {
  render(<MetadataSources user={ADMIN} onPreferences={() => {}} />)
  await screen.findByText('Metadata sources')
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
  it('says whether the key is stored, without printing anything that looks like it', async () => {
    KEYS = { tmdb_key_set: true, tvdb_key_set: false }
    await page()
    await waitFor(() => expect(badge('TMDB key')).not.toBeNull())
    // AND THE ONE THAT IS NOT SET NOW SAYS SO, which is the half the badge could
    // not do. Absence used to be the whole signal — no badge meant no key — and
    // absence is the one state a reader cannot tell from "I have not looked
    // there yet". The mark is red or amber instead, and says which.
    expect(badge('TheTVDB key')).toBeNull()
    expect(markState('TheTVDB key')).toMatch(/needed|optional/i)
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
    // While editing, the row is showing a save and a cancel; the mark keeps its
    // state, because unlike the badge it is not a third control competing with
    // them — it is the same 24px it always was, and "the old one is still
    // stored" is true right up until the save lands.
    expect(markState('TMDB key')).toBe('Saved')
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
    // content of a marketplace, and a badge there would withhold the only thing
    // the field is for.
    //
    // THE FIELD SPEAKS SUFFIXES AND THE COLUMN KEEPS A HOST. The owner's: "for
    // amazon domain, just use the in, com, au, etc., not the full url". So a
    // stored `www.amazon.de` reads out as `de` — still shown, which is what this
    // case is about, and shown as the part that actually varies. The second
    // assertion is the half that would otherwise pass on the old field: `de` is a
    // substring of `www.amazon.de`, so a row that never changed still contains it.
    KEYS = { amazon_domain: 'www.amazon.de' }
    await page()
    await waitFor(() => expect(screen.getByText('de')).toBeTruthy())
    expect(screen.queryByText('www.amazon.de')).toBeNull()
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

  it('drops every chip that only says things are working', async () => {
    // The healthy state is the one state nobody needs told about, and a pill
    // that ONLY appears when there is nothing to do is worse than silent: a
    // reader learns to look there, and it is empty in every case that matters.
    // The default STATUS in this file is a working lookup, so this is the
    // ordinary render, not an edge case.
    //
    // "Built-in TMDB key" was the last survivor of that class, kept once as the
    // answer to "why does this work when I have set nothing". It went on the
    // owner's ruling — "remove the built in key callouts… infact, remove all
    // callouts" — and the answer it carried did not go with it: the key row's own
    // mark says `Built-in` in its accessible name, one line below, which is where
    // a question about a key is asked.
    await page()
    // THE FLUSH IS THE ANCHOR, and an absence needs one. `json` is mocked as an
    // async function with nothing awaited inside it, so both loads settle in a
    // single microtask drain — this line makes the render below the settled one
    // rather than a fetch that has not landed yet, which would pass for the wrong
    // reason and keep passing if the chip came back.
    await act(async () => {})
    expect(screen.queryByText('Built-in TMDB key')).toBeNull()
    expect(screen.queryByText('Built-in TheTVDB key')).toBeNull()
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

// EVERY ROW WEARS ITS OWN SUPPLIER'S MARK, WHICH IS THE SAME MARK EVERY OTHER
// SURFACE IN THE APP DRAWS FOR IT.
//
// THE OWNER'S QUESTION: "do you think the icons you used in the metadata sources
// are the provider icons I spoke about?" They were not. These rows drew the app's
// own hand-drawn CATEGORY glyphs — a book for Google Books, a film strip for TMDB,
// a television for TheTVDB, a gamepad for IGDB, a carton for Amazon — while the
// vendored marks sat in the repo being used by every links pill, ids row and
// field-source tag beside them. A category glyph has to be decoded; a mark is
// recognised. And the repo's own directive is that two things that look the same
// behave the same, which cuts the other way too: one supplier drawn two ways on
// two screens is two pictures of one thing.
//
// SO THE ASSERTION IS AN IDENTITY, not a shape: whatever this row draws for a
// supplier is byte-for-byte the drawing `providerMarks.js` publishes for that
// supplier. It cannot pass on a lookalike, and it does not care what the element
// or its classes are called.
describe('the mark on each key row', () => {
  // The five suppliers the block names. Each has a mark, so each is checkable;
  // a sixth added tomorrow with no mark falls back to a glyph and is not a
  // failure — see ProviderMark on why an unknown slug is the ordinary case.
  const SUPPLIERS = ['google', 'tmdb', 'tvdb', 'igdb', 'amazon']

  it('is the supplier’s own, not a category glyph standing in for it', async () => {
    await page()
    // Every mask this screen paints, read off the DOM. A masked span IS the
    // picture, so its mask is the whole of what the reader sees.
    const painted = new Set(
      [...document.querySelectorAll('[style*="mask-image"]')]
        .map((el) => el.style.maskImage || el.style.webkitMaskImage)
        // The inline value comes back wrapped in url("…"); the stored mark is the
        // bare data URI.
        .map((v) => v.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')),
    )
    const missing = SUPPLIERS.filter((s) => !painted.has(PROVIDER_MARKS[s]))
    expect(missing, `${missing.join(', ')} draw something other than their own mark on this screen`)
      .toEqual([])
  })

  it('and still says which state its key is in, because the ring rides on the box outside it', async () => {
    // THE MARK MOVED INSIDE A WRAPPER and the state is painted on the wrapper —
    // a mask clips an element's background AND its box-shadow, so a mark filling
    // its box edge to edge would have taken the state ring with it. The state is
    // the owner's own fix for this screen ("an icon or a border on the provider
    // icon") and had to survive the marks arriving.
    STATUS = { tmdb: { source: 'builtin' }, books_lookup: { ok: true } }
    await page()
    const stated = [...document.querySelectorAll('[aria-label]')]
      .map((el) => el.getAttribute('aria-label'))
      .filter((l) => /TMDB key/i.test(l))
    expect(stated.length, 'the TMDB key row no longer announces itself at all').toBeGreaterThan(0)
    expect(stated.join(' | '), 'the row names its supplier but no longer says what state the key is in')
      .toMatch(/built|saved|needed|optional/i)
  })
})
