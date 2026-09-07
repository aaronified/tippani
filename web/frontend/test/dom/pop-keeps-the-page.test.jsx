// CLOSING AN OVERLAY DOES NOT MOVE THE PAGE, AND THE SHELL IS WHAT PROMISES IT.
//
// THE OWNER'S REPORT, from their own phone: "when the popup is dismissed, it
// resets the scroll level of the master page. that is unacceptable."
//
// WHY THIS FILE EXISTS SEPARATELY FROM `back-in-sync.test.jsx`. That file asks
// whether the RULE is right — a pop that did not change the address is an overlay
// closing — and it can, because the rule is a pure function. What it cannot ask is
// whether the shell OBEYS the rule: deleting the call from `App.jsx` left all
// thirteen of its cases green, and the only thing that noticed was a browser probe
// nothing runs automatically. A fix defended by a hand-run probe is a fix that
// comes back.
//
// SO THIS MOUNTS THE WHOLE APP, which nothing else in this suite does. That was a
// deliberate omission — App is large and pulls in every screen — and it is the
// right call for testing a screen. It is the wrong call for testing the shell's
// own routing, because the routing IS App: there is nothing smaller to render.
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing about how it was repaired:
//
//  * A panel lives in the same session history the reader's Back button walks, so
//    one handler sees both a dismissal and a navigation.
//  * A panel does not change the address; a screen does.
//  * The shell remembers where each list was scrolled to and puts it back. A
//    DETAIL page has no remembered position, so anything that makes the shell
//    think it has just arrived on one sends the reader to the top.
//
// jsdom does not scroll, so `window.scrollTo` is watched rather than the offset:
// what is asserted is that the shell does not ASK to be moved.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'

const USER = { id: 1, username: 'aro', preferences: {}, is_admin: true }

// App boots on a bare `globalThis.fetch` for /auth/me, before any of its screens
// ask for anything through the api helper.
const okJSON = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/auth/me') return { ok: true, data: USER }
    // THE LIST SHAPES, because a bare `{}` leaves screens reading `.length` off
    // undefined and the failure arrives as an unhandled rejection AFTER the case
    // that caused it — noise that would mask a real one.
    return {
      ok: true,
      data: {
        books: [], movies: [], annotations: [], dialogues: [], utterances: [],
        people: [], characters: [], tags: [], stickers: [], anthologies: [],
        items: [], batches: [], works: [], quotes: [], fonts: [], locales: [],
      },
    }
  }),
}))

const { default: App } = await import('../../src/App.jsx')

let scrolls
beforeEach(() => {
  scrolls = []
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url)
    if (u.includes('/auth/me')) return okJSON(USER)
    if (u.includes('/auth/status')) return okJSON({ needs_onboarding: false })
    return okJSON({})
  }))
  window.scrollTo = (...args) => scrolls.push(args[0])
  window.history.replaceState(null, '', '/books/32')
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const mount = async () => {
  render(<App />)
  await act(async () => {})
  await act(async () => {})
}

// The pop a panel's dismissal produces: an entry pushed with pushState's url
// argument omitted, then traversed. Spelled out rather than driven through the
// panel stack, because what is under test is the shell's reading of the event.
const popAtTheSameAddress = async () => {
  scrolls.length = 0
  await act(async () => {
    window.dispatchEvent(new PopStateEvent('popstate', { state: { tpDepth: 1 } }))
  })
  await act(async () => {})
}

const popToAnotherAddress = async (path) => {
  scrolls.length = 0
  window.history.replaceState({ tpDepth: 0 }, '', path)
  await act(async () => {
    window.dispatchEvent(new PopStateEvent('popstate', { state: { tpDepth: 0 } }))
  })
  await act(async () => {})
}

const wentToTheTop = () => scrolls.some((s) => s && s.top === 0)

describe('the shell, on a pop that did not change the address', () => {
  it('does not send the page back to the top', async () => {
    await mount()
    await popAtTheSameAddress()
    expect(wentToTheTop(),
      'closing an overlay asked the page to scroll to the top — the reader loses their place on the screen they were reading')
      .toBe(false)
  })

  it('still handles a pop that DID change the address, or the guard is too wide', async () => {
    // The other direction, and the reason it matters: an early-out that fired on
    // every pop would fix the symptom by breaking Back. Leaving a work page for the
    // shelf has no remembered position for that shelf yet, so the shell is
    // expected to start it at the top — which is the one case where asking to
    // scroll is correct.
    await mount()
    await popToAnotherAddress('/library')
    expect(scrolls.length,
      'a real Back was ignored, so the shell is now showing a screen the address disagrees with')
      .toBeGreaterThan(0)
  })
})
