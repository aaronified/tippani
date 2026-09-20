// THE STATE A SUPPLIER'S ROW DRAWS, AND THE ONE IT COULD NOT.
//
// WHY THIS FILE EXISTS. The server named the built-in-key state `bundled`; the
// screen's whole vocabulary for it — the stylesheet's `.is-src-builtin`, the
// accessible name's `SRC_STATE_WORD` — is `builtin`. So on an official build
// (the only kind with a key compiled in) TMDB's mark had no colour rule and its
// label read "TMDB — " with the state missing out of the middle. NOTHING FAILED:
// the Go test asserted the word on the wire, the browser journey ran in a world
// with no built-in key, and each was right about its own half. That is the exact
// failure this repo's testing ruling is written against, so the guard belongs at
// the seam rather than on either side of it.
//
// AND THE BUTTON THAT COULD ONLY SAY NOTHING. Pressing Test on a supplier with no
// key recorded nothing and reported nothing. It is not offered now, which is the
// second case here.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

let STATUS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path === '/metadata/status') return { ok: true, data: STATUS }
    if (method === 'GET' && path === '/admin/metadata-keys') return { ok: true, data: {} }
    return { ok: true, data: {} }
  }),
}))

const { MetadataSources } = await import('../../src/MetadataSources.jsx')

const row = (source, state) => ({ source, state, areas: ['films'], records: 0 })

beforeEach(() => {
  cleanup()
  STATUS = { tmdb: { source: 'builtin' }, books_lookup: {}, sources: [] }
})

const page = async () => {
  render(<MetadataSources user={{ username: 'a', is_admin: true }} onPreferences={() => {}} />)
  await waitFor(() => expect(screen.getByText(/who the app can ask/i)).toBeTruthy())
}

describe('a supplier row', () => {
  it('draws every state the server can send, including the built-in one', async () => {
    STATUS.sources = [row('tmdb', 'builtin'), row('igdb', 'needed'), row('google', 'saved'), row('wikimedia', 'optional')]
    await page()
    // THE MARK CARRIES THE STATE AS A CLASS, and the stylesheet has a colour for
    // exactly four spellings. A fifth draws a grey mark that says nothing.
    for (const state of ['builtin', 'needed', 'saved', 'optional']) {
      expect(
        document.querySelector(`.is-src-${state}`),
        `no mark drawn for the ${state} state — the server can send it and the screen cannot paint it`,
      ).toBeTruthy()
    }
    // AND THE STATE IS IN WORDS, not colour alone: a label with the state missing
    // out of its middle is what the wrong spelling produced.
    // The mark is a focusable span carrying its own label, which is what a
    // reader using the accessible name actually meets.
    expect(document.querySelector('[aria-label="Source: TMDB — built in"]')).toBeTruthy()
  })

  it('offers no Test on a supplier that has no key, because there is nothing to ask with', async () => {
    STATUS.sources = [row('tmdb', 'needed'), row('google', 'saved')]
    await page()
    const dead = screen.getByRole('button', { name: /Ask TMDB a test question/i })
    expect(dead.disabled, 'a press that could only report "no key" is offered').toBe(true)
    const live = screen.getByRole('button', { name: /Ask Google Books a test question/i })
    expect(live.disabled, 'the supplier that CAN be asked is not offered either').toBe(false)
  })

  it('says when nothing has asked a supplier yet, rather than leaving the row silent', async () => {
    // Open Library is recorded only when the app actually uses it, so a row with
    // no answer is the ordinary state — and a blank space there is
    // indistinguishable from an answer that failed to render.
    STATUS.sources = [row('openlibrary', 'optional')]
    await page()
    expect(screen.getByText(/nothing has asked it yet/i)).toBeTruthy()
  })
})
