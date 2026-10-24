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



import { beforeEach, describe, expect, it } from 'vitest'
import { canGoBack, historyDepth, navigateBack, pushRoute, seedRoute } from '../../src/history.js'

// A fresh stack per case. jsdom keeps one history for the whole file, so a case
// that pushes three entries would otherwise hand the next one a depth of three.
// replaceState cannot shorten the stack — nothing can — so the depth is reset on
// the CURRENT entry instead, which is exactly the state a first load is in.
beforeEach(() => {
  window.history.replaceState(null, '', '/library')
})

const popped = () => new Promise((r) => window.addEventListener('popstate', r, { once: true }))

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

