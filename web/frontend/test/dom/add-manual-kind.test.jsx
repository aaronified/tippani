// The "Add manually" popup saves the kind you asked for (1.15.1 fix).
//
// WHAT BROKE. 1.15.1 added Game as a fourth chip on the look-up card and taught
// AddLookup to route the search to IGDB. It did not teach ManualPopup the word.
// Both of that popup's kind maps — the media_type it opens on and its heading —
// were written as a two-way `show ? 'show' : 'movie'` and fell through to the
// film branch, so a game became "Add a film manually" saving media_type 'movie'.
//
// AND THERE IS NO CONTROL ON SCREEN TO PUT THAT RIGHT. ManualPopup deliberately
// renders no MediaTypeToggle — its own header comment says the media type is
// fixed by the kind that opened it — so the fallback is not a wrong default the
// user can correct, it is the saved answer. A game added by hand landed on the
// Catalogue as a film, with a Director where its Studio should be.
//
// IT WAS ALSO THE FIRST THING A GAME SEARCH DID, not a corner. `noKey` probed
// only tmdb.source, so with TMDB configured and IGDB not — the state every
// existing install upgraded into — the Game chip showed no warning, the search
// 503'd, and doSearch's "steer to manual instead of a scary error" opened the
// film form immediately. The IGDB microcopy shipped in the same commit to
// explain that case could never render, because it was gated on the TMDB probe.
//
// So these tests are about the pair: the chip you picked survives into the form
// that opens, and the warning that would have stopped you getting there is the
// one for the supplier that chip actually uses. The first test ENUMERATES KINDS
// rather than spot-checking 'game', because the failure is silent — a fifth kind
// added to the toggle and forgotten here saves as a film and says nothing.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// Every request the card makes, so a save can be read back off the wire: what
// media_type reached POST /movies is the whole question, and it is not visible
// in the DOM.
const CALLS = []
let STATUS = { tmdb: { source: 'custom' }, igdb: { source: 'none' } }

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push({ method, path, body })
    if (path === '/metadata/status') return { ok: true, data: STATUS }
    if (path === '/genres') return { ok: true, data: { genres: [] } }
    // The 503 that starts the whole story: no key for this supplier.
    if (path === '/movies/lookup') return { ok: false, status: 503, data: { error: 'no key' } }
    if (path === '/movies') return { ok: true, data: { id: 1, title: body.title, media_type: body.media_type } }
    return { ok: true, data: {} }
  }),
}))

const { AddLookup, workFromMovie } = await import('../../src/AddSurface.jsx')

// The kind chips, and what each one must produce once the lookup is skipped.
// Keyed by the chip's own value so a chip added to KINDS without a row here is
// a missing key rather than a passing test.
const KIND_EXPECTATIONS = {
  book: { heading: 'Add a book manually' },
  film: { heading: 'Add a film manually', mediaType: 'movie' },
  show: { heading: 'Add a show manually', mediaType: 'show' },
  game: { heading: 'Add a game manually', mediaType: 'game' },
}

// Open the hand-entry popup on `kind` the way the escape hatch does, type a
// title and commit through the header ✓.
async function addByHand(kind, title) {
  CALLS.length = 0
  render(<AddLookup initialKind={kind} onAdded={() => {}} />)
  fireEvent.click(screen.getByText('＋ Skip the lookup — add manually'))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(screen.getByPlaceholderText('Title (required)'), { target: { value: title } })
  fireEvent.click(screen.getByLabelText('Save'))
  return dialog
}

describe('the hand-entry popup', () => {
  // The enumeration. Read the chips out of the component's own source so this
  // cannot drift from the toggle it is guarding.
  it('has a heading and a media type for every kind the toggle offers', async () => {
    const { KINDS } = await import('../../src/AddSurface.jsx')
    for (const [value] of KINDS) {
      expect(KIND_EXPECTATIONS[value], `KINDS offers "${value}" with no expectation here`).toBeDefined()
    }
    expect(Object.keys(KIND_EXPECTATIONS).sort()).toEqual(KINDS.map(([v]) => v).sort())
  })

  for (const [kind, want] of Object.entries(KIND_EXPECTATIONS)) {
    if (!want.mediaType) continue // book goes through the books flow, not /movies
    it(`opens on "${want.heading}" and saves media_type ${want.mediaType} for ${kind}`, async () => {
      await addByHand(kind, 'Disco Elysium')
      expect(screen.getByRole('heading', { name: want.heading })).toBeTruthy()
      await waitFor(() => {
        const post = CALLS.find((c) => c.method === 'POST' && c.path === '/movies')
        expect(post, 'no POST /movies').toBeTruthy()
        expect(post.body.media_type).toBe(want.mediaType)
      })
    })
  }
})

describe('the missing-key warning', () => {
  // The one that would have stopped the user reaching the film form at all.
  //
  // WHAT IT SAYS CHANGED IN 1.16.0 and the assertion changed with it. A game
  // without an IGDB key still SEARCHES now — Wikidata is the fallback — so the
  // old wording ("no IGDB key configured") described a lookup that was off when
  // it is merely thinner, and would have sent somebody to Settings for a
  // credential they may not need. What has to survive is that the message names
  // the GAME supplier rather than the film one, and says what you are getting.
  it('names IGDB on Game when only the game supplier is unconfigured', async () => {
    STATUS = { tmdb: { source: 'custom' }, igdb: { source: 'none' } }
    render(<AddLookup initialKind="game" onAdded={() => {}} />)
    const msg = await screen.findByText(/no IGDB key/)
    expect(msg.textContent).toMatch(/Wikidata/)
    expect(screen.queryByText(/no movie-lookup key configured/)).toBeNull()
  })

  // The converse, so the fix is a routing of two probes and not a second
  // always-on message: a configured IGDB says nothing on Game.
  it('says nothing on Game when IGDB is configured but TMDB is not', async () => {
    STATUS = { tmdb: { source: 'none' }, igdb: { source: 'custom' } }
    render(<AddLookup initialKind="game" onAdded={() => {}} />)
    await waitFor(() => expect(CALLS.some((c) => c.path === '/metadata/status')).toBe(true))
    expect(screen.queryByText(/no IGDB key/)).toBeNull()
    expect(screen.queryByText(/no movie-lookup key configured/)).toBeNull()
  })

  it('still names the movie key on Film', async () => {
    STATUS = { tmdb: { source: 'none' }, igdb: { source: 'custom' } }
    render(<AddLookup initialKind="film" onAdded={() => {}} />)
    expect(await screen.findByText(/no movie-lookup key configured/)).toBeTruthy()
  })
})

describe('a game as a capture target', () => {
  // workFromMovie is how a freshly-added work becomes the thing a quote is filed
  // against. It narrowed to show-or-film, so a game arrived at the picker tagged
  // FILM and carrying media_type 'movie' — the same silent mis-filing one layer
  // further on.
  it('keeps its media type and wears its own tag', () => {
    expect(workFromMovie({ id: 2, title: 'Hades', media_type: 'game' })).toMatchObject({
      kind: 'screen',
      media_type: 'game',
      tag: 'GAME',
    })
  })

  it('still reads a row with no media_type as a film', () => {
    expect(workFromMovie({ id: 3, title: 'Chinatown' })).toMatchObject({ media_type: 'movie', tag: 'FILM' })
  })
})
