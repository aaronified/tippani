// The daily deck's request coalescer.
//
// WHY IT NEEDS A TEST RATHER THAN A COMMENT. The thing it does — two callers, one
// request — is invisible when it works and invisible when it breaks: two requests
// look exactly like one to everybody except the person waiting. And the failure it
// must NOT have is worse than the waste it removes: a window long enough to hand a
// remounted quiz card a deck whose cards have already been answered.

import { beforeEach, describe, expect, it, vi } from 'vitest'

let CALLS
let OK

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push(path)
    return OK ? { ok: true, data: { items: [{ id: 1 }], streak: 3 } } : { ok: false, status: 500, data: null }
  }),
}))

const { dailyDeck, forgetDailyDeck } = await import('../../src/daily.js')

beforeEach(() => {
  CALLS = []
  OK = true
  forgetDailyDeck()
})

describe('the coalescer', () => {
  it('serves two callers on one load from one request', async () => {
    // The shell wants two numbers off the deck; Home's card wants the deck. They
    // used to be two computations of the most expensive read in the app.
    const [a, b] = await Promise.all([dailyDeck(0), dailyDeck(0)])
    expect(CALLS).toEqual(['/review/daily?offset=0'])
    expect(a).toBe(b)
    expect(a.data.streak).toBe(3)
  })

  it('goes and asks again once a card has been answered', async () => {
    await dailyDeck(0)
    // An answer grades a card and takes it out of today's list, so the held
    // request is now wrong. THIS is the assertion that keeps it a coalescer rather
    // than a cache.
    forgetDailyDeck()
    await dailyDeck(0)
    expect(CALLS).toHaveLength(2)
  })
})
