// A CACHE IN FRONT OF A PER-USER QUERY BELONGS TO THAT USER.
//
// THE INVARIANT, from CLAUDE.md: "Per-user isolation: every query scoped by
// `user_id`; another user's row is `404`, never `403`." DEVELOPMENT.md calls it a
// security property.
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing about how it was arranged:
//
//  * Signing out of this app does NOT reload the page. The shell is swapped for
//    the login screen in place, so anything a module remembered is still
//    remembered afterwards. (Switch account is different — it sets the address,
//    and the reload takes everything with it.)
//  * Two people share one browser. That is the whole case: sign out, sign in as
//    somebody else, and whatever the first reader's requests filled in is what
//    the second reader is shown.
//  * A cache is not empty just because the thing it holds is gone. An in-flight
//    request started by the previous reader will land in it afterwards.
//
// SO THE RULE IS: when the reader changes, every cache of a per-user response is
// emptied — and the next ask goes to the server. Asserted by asking twice with a
// reader change in between and counting the requests, which is a fact about
// behaviour rather than about any module's internals.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []
// A REQUEST THE TEST CAN HOLD OPEN. Without one, every ask resolves inside the
// same tick and the case that matters — a reader changing while a request is still
// out — cannot be staged at all.
let holdVocab = null

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    calls.push(`${method} ${path}`)
    if (path.startsWith('/search/vocabulary')) {
      const answer = { ok: true, data: { authors: ['Alice'], tags: [] } }
      if (holdVocab) return new Promise((resolve) => { holdVocab = () => resolve(answer) })
      return answer
    }
    if (path.startsWith('/review/daily')) return { ok: true, data: { items: [], pending: 3, streak: 9 } }
    return { ok: true, data: {} }
  }),
}))

const { primeSearchVocabulary } = await import('../../src/SearchPage.jsx')
const { dailyDeck } = await import('../../src/daily.js')
const { forgetSessionCaches, sessionCacheCount } = await import('../../src/sessionCaches.js')

const asked = (re) => calls.filter((c) => re.test(c)).length

beforeEach(() => { calls.length = 0; holdVocab = null; forgetSessionCaches() })
afterEach(() => forgetSessionCaches())

describe('the caches a session leaves behind', () => {
  it('answer the second ask without the server, which is what they are for', async () => {
    await primeSearchVocabulary()
    await primeSearchVocabulary()
    expect(asked(/\/search\/vocabulary/),
      'the vocabulary is fetched on every ask, so this cache is not a cache and the case below proves nothing')
      .toBe(1)
  })

  it('go to the server again once the reader has changed', async () => {
    const first = await primeSearchVocabulary()
    expect(first.authors, 'the vocabulary did not load at all').toEqual(['Alice'])
    expect(asked(/\/search\/vocabulary/)).toBe(1)

    // Somebody else signs in on the same browser, with no reload.
    forgetSessionCaches()

    await primeSearchVocabulary()
    expect(asked(/\/search\/vocabulary/),
      'the second reader was served the first reader\'s authors, performers, tags and shelf names out of a cache nothing emptied')
      .toBe(2)
  })

  it('empty the review deck the same way, which is the one that was noticed', async () => {
    await dailyDeck(0)
    expect(asked(/\/review\/daily/)).toBe(1)
    await dailyDeck(0)
    expect(asked(/\/review\/daily/), 'the deck is not cached at all, so this case is measuring nothing').toBe(1)
    forgetSessionCaches()
    await dailyDeck(0)
    expect(asked(/\/review\/daily/),
      'the second reader was served the first reader\'s deck, pending count and streak')
      .toBe(2)
  })

  // A REQUEST STILL IN THE AIR IS PART OF THE CACHE.
  //
  // The dedupe that makes two components asking in one tick cost one request is
  // the same field that hands the SECOND reader the first reader's answer if it is
  // not dropped: the request is already out, so the next ask is handed the promise
  // rather than making its own, and what lands is the previous account's data.
  // Emptying the stored value and leaving the promise looks like a fix and is not
  // one — a mutation that dropped only the value passed every other case here.
  it('drop a request that is still in the air, not only the answer that landed', async () => {
    holdVocab = () => {} // the next vocabulary ask will hang until released
    const firstReader = primeSearchVocabulary()
    expect(asked(/\/search\/vocabulary/), 'the first ask did not reach the server').toBe(1)

    // Somebody else signs in while that request is still out.
    forgetSessionCaches()
    const release = holdVocab
    holdVocab = null
    release()
    await firstReader

    await primeSearchVocabulary()
    expect(asked(/\/search\/vocabulary/),
      'the second reader was handed the request the first reader started, so what lands in their search box is the previous account\'s library')
      .toBe(2)
  })

  // AND EVERY CACHE IS REACHED BY ONE CALL. The failure this guards is not a
  // cache that leaks — it is a cache nobody remembered to empty, which is how
  // both of the two above happened. A count, so a run where nothing had enrolled
  // could not satisfy the cases above vacuously.
  it('are all reached by the one call, not by a list somebody maintains', () => {
    expect(sessionCacheCount(),
      'fewer than two caches are enrolled, so at least one module is holding a per-user response that signing out does not clear')
      .toBeGreaterThanOrEqual(2)
  })
})
