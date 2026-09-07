// The app's Back and the browser's Back are the same act.
//
// THE BUG, as reported: "on phone, if i use the back button on the top of the
// screen from a work details page of any page, it is not treated as back, but as
// a link. when i go back using the phone controls, it goes back to the work
// details page instead of going back yet further."
//
// Every in-app back arrow — a work detail's, a quote board's, an anthology's, the
// Bin's — called the same `go()` that a tap on a cover calls, and `go` pushes. So
// the arrow appended a third entry, the stack read shelf → book → shelf, and the
// phone's Back landed in the middle of it. The two controls were named the same
// thing and did opposite things to one stack.
//
// WHAT IS ASSERTED HERE IS THE DECISION, not a rendered arrow. Nothing in this
// suite mounts App — its size is the reason — so the history half was cut out into
// src/history.js precisely so it could be put under test without the shell. The
// arrow's own wiring is one line each in App.jsx, and the scan below checks that
// none of them has gone back to calling `go`, which is the mistake that would
// re-introduce this with every function here still passing.
//
// jsdom implements the session history, so these are real pushes and real
// traversals rather than a mocked object. What jsdom does NOT do synchronously is
// the traversal itself: history.back() queues a task and popstate arrives later,
// which is why the cases about landing somewhere await it.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { canGoBack, historyDepth, navigateBack, popIsOverlay, pushRoute, seedRoute } from '../../src/history.js'

// A fresh stack per case. jsdom keeps one history for the whole file, so a case
// that pushes three entries would otherwise hand the next one a depth of three.
// replaceState cannot shorten the stack — nothing can — so the depth is reset on
// the CURRENT entry instead, which is exactly the state a first load is in.
beforeEach(() => {
  window.history.replaceState(null, '', '/library')
})

const popped = () => new Promise((r) => window.addEventListener('popstate', r, { once: true }))

describe('the entry the reader arrived on', () => {
  it('is depth zero, whether or not it carries state', () => {
    expect(historyDepth()).toBe(0)
    expect(canGoBack()).toBe(false)
    seedRoute('/library')
    expect(historyDepth()).toBe(0)
  })

  it('keeps its depth across a seed, which is what survives a reload', () => {
    // The number is the whole reason seedRoute writes on every boot even when the
    // address already matches. A reload of an entry we pushed must still know it
    // has somewhere to go back to; a ref would read zero and the arrow would stop
    // being Back on the one path a reader can most easily trigger.
    pushRoute('/library/book/7')
    expect(historyDepth()).toBe(1)
    seedRoute('/library/book/7')
    expect(historyDepth()).toBe(1)
    expect(canGoBack()).toBe(true)
  })
})

describe('a navigation', () => {
  it('goes one entry deeper', () => {
    seedRoute('/library')
    pushRoute('/library/book/7')
    expect(window.location.pathname).toBe('/library/book/7')
    expect(historyDepth()).toBe(1)
    pushRoute('/quotes')
    expect(historyDepth()).toBe(2)
  })

  it('is not a navigation when it goes where it already is', () => {
    // Otherwise Back lands on the screen it started from and reads as broken.
    seedRoute('/library')
    expect(pushRoute('/library')).toBe(false)
    expect(historyDepth()).toBe(0)
  })
})

describe('the in-app Back arrow', () => {
  it('goes back rather than pushing a third entry — the reported bug', async () => {
    seedRoute('/library')
    pushRoute('/library/book/7')
    const before = window.history.length

    expect(navigateBack('/library'), 'the arrow handled it itself instead of delegating').toBe(true)
    await popped()

    // THE ASSERTION THE BUG WOULD FAIL. The old arrow pushed: the address said
    // /library either way, so only the stack tells them apart.
    expect(window.history.length, 'the arrow added an entry instead of consuming one').toBe(before)
    expect(window.location.pathname).toBe('/library')
    // And we are back on the entry the reader arrived on, so the NEXT press
    // leaves the app instead of returning to the book.
    expect(historyDepth()).toBe(0)
    expect(canGoBack()).toBe(false)
  })

  it('lands one step back, not all the way out, from three deep', async () => {
    seedRoute('/library')
    pushRoute('/quotes')
    pushRoute('/quotes/board/3')
    expect(navigateBack('/quotes')).toBe(true)
    await popped()
    expect(window.location.pathname).toBe('/quotes')
    expect(historyDepth()).toBe(1)
  })

  it('rewrites in place for a reader who arrived on the detail directly', () => {
    // A shared link, a bookmark, a reload, the PWA reopening where it left off.
    // history.back() here would leave the app — to whatever page they were on
    // before, or a blank tab — so the address is REPLACED and the caller sets its
    // own state, because no popstate is coming.
    window.history.replaceState(null, '', '/library/book/7')
    const before = window.history.length

    expect(navigateBack('/library'), 'delegated to the browser with nothing of ours behind it').toBe(false)

    expect(window.location.pathname).toBe('/library')
    expect(window.history.length, 'a replace must not grow the stack').toBe(before)
    // And the second press has nowhere of ours to go, which is correct: the
    // reader is looking at the shelf, and the book is not behind it.
    expect(canGoBack()).toBe(false)
  })
})

describe('every back arrow in App is wired to goBack', () => {
  // The one thing the functions above cannot see. Each arrow is a one-line prop
  // in App.jsx, and `go(tab, null)` is both the mistake and the thing that reads
  // most naturally when adding the next screen — so the shape is asserted from
  // the source, the way features-nav.test.js asserts the tab lists.
  const src = readFileSync(join(process.env.TIPPANI_SRC, 'App.jsx'), 'utf8')

  it('has no onClose that navigates forwards to a list', () => {
    const forwards = [...src.matchAll(/onClose=\{\(\) => go\('([a-z]+)', null\)\}/g)].map((m) => m[1])
    expect(
      forwards,
      'these arrows push a new entry instead of going back — the reported bug, per screen',
    ).toEqual([])
  })

  it('and so is the dock’s, which is the one that had its own', () => {
    // THE SHELL HAS ONE BACK, and the dock's key was the exception. It read
    // `onBack={() => window.history.back()}` while the key beside it is enabled
    // whenever `tpDepth > 0 || !!detail` — so on a page opened DIRECTLY at a
    // detail route (a shared link to a book, a phone reopening the app where it
    // left off) the key was live with no in-app entry behind it and the press
    // walked out of the app or did nothing at all.
    //
    // ASSERTED AS "ONE FUNCTION", not as the absence of a string: the fault is
    // two controls named Back doing different things to one stack, which is this
    // file's whole subject, and `goBack` is the only one that answers both
    // states. A raw traversal anywhere in the shell is that split coming back.
    const backs = [...src.matchAll(/onBack=\{\(\) => ([A-Za-z.]+)\(/g)].map((m) => m[1])
    expect(backs.length, 'no onBack found — the dock has been renamed and this case is stale').toBeGreaterThan(0)
    expect(
      [...new Set(backs)].filter((fn) => fn !== 'goBack'),
      'a Back key that traverses on its own — it is enabled on a detail route with no in-app entry behind it',
    ).toEqual([])
  })

  it('and every close arrow in the file goes through it', () => {
    // THE RULE, NOT A CENSUS. This used to assert the exact five destinations —
    // `['anthologies', 'library', 'movies', 'quotes', 'settings']` — and a count
    // of two for settings, so adding a sixth screen failed a test that had
    // nothing to say about the sixth screen and everything to say about the day
    // the list was written. What matters is that no arrow escapes the rule, and
    // that is what an exception list cannot state.
    // NAVIGATING arrows only. `onClose` is also how a sheet, a drawer and a
    // popover dismiss themselves, and those set local state and go nowhere; the
    // two functions that move the app are `go` and `goBack`.
    const closes = [...src.matchAll(/onClose=\{\(\) => (go|goBack)\(/g)].map((m) => m[1])
    expect(closes.length, 'no navigating onClose found — the pattern has gone stale').toBeGreaterThan(3)
    expect(
      [...new Set(closes)].filter((fn) => fn !== 'goBack'),
      'a close arrow that navigates FORWARDS — the reported bug',
    ).toEqual([])
  })
})

// ---- CLOSING A PANEL IS NOT GOING BACK -------------------------------------
//
// THE OWNER'S REPORT, from their own phone: "when the popup is dismissed, it
// resets the scroll level of the master page. that is unacceptable."
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing about how it was repaired:
//
//  * A panel is an entry in the SAME session history the reader's Back button
//    walks. That is deliberate — the phone's back gesture has to close a sheet —
//    and it means one `popstate` handler sees both events.
//  * A panel does not change the address. A screen does.
//  * A route handler that mistakes a panel's pop for a navigation re-derives the
//    screen it is already on, and anything keyed on the identity of that screen
//    runs again. Here that is the scroll memory, and re-running it on a detail
//    page means the top of the page.
//
// SO THE RULE IS: a pop that did not change the address is not a navigation. It
// is only sound because of the case above — `pushRoute` refuses a path equal to
// the address, so no two adjacent entries can share one — and that is why both
// halves are asserted here rather than only the one that was reported.
describe('a pop that did not change the address', () => {
  // What the panel stack does, spelled out rather than imported, because what is
  // under test is the CONTRACT and not that one caller honours it: two arguments
  // to pushState, so the url is left alone.
  const openAPanel = () => window.history.pushState(
    { ...window.history.state, tpPanelDepth: 1 }, '',
  )

  it('is an overlay closing, not a screen the reader left', async () => {
    seedRoute('/books/32')
    openAPanel()
    expect(window.location.pathname, 'opening a panel changed the address, so it is a navigation and not an overlay')
      .toBe('/books/32')
    const back = popped()
    window.history.back()
    await back
    expect(popIsOverlay('/books/32'),
      'a panel dismissal reads as a navigation, so the screen is rebuilt under the reader and loses its place')
      .toBe(true)
  })

  it('cannot be confused with a real navigation, because no two entries share a path', async () => {
    // The whole rule rests on this. If `pushRoute` ever pushed a duplicate, a
    // genuine Back could land on the same address and be silently ignored — the
    // reader would press Back and nothing would happen.
    seedRoute('/library')
    expect(pushRoute('/library'), 'the app pushed a second entry for the address it was already on').toBe(false)
    pushRoute('/books/32')
    const back = popped()
    window.history.back()
    await back
    expect(window.location.pathname).toBe('/library')
    expect(popIsOverlay('/books/32'),
      'leaving a work page reads as an overlay closing, so the reader is left on a screen the app thinks it is not on')
      .toBe(false)
  })

  it('is decided by the address and never by the entry it landed on', async () => {
    // The trap this fell into once: a popstate carries the DESTINATION entry's
    // state, and the entry a single panel was opened from knows nothing about
    // panels. Asserted by reading that state at the moment of the pop — if a
    // future repair reaches for a marker there, this says what is actually
    // available.
    seedRoute('/quotes/4')
    openAPanel()
    let stateAtPop
    const back = new Promise((r) => window.addEventListener('popstate', (e) => {
      stateAtPop = e.state
      r()
    }, { once: true }))
    window.history.back()
    await back
    expect(stateAtPop?.tpPanelDepth,
      'the popped entry carries a panel depth after all — then the decision could be read from it, and this test is stale')
      .toBeUndefined()
    expect(popIsOverlay('/quotes/4'), 'the address said overlay and the answer disagreed').toBe(true)
  })
})
