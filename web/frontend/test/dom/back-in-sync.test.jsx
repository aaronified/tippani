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
import { canGoBack, historyDepth, navigateBack, pushRoute, seedRoute } from '../../src/history.js'

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

  it('and covers the five screens that have one', () => {
    const back = [...src.matchAll(/goBack\('([a-z]+)'\)/g)].map((m) => m[1]).sort()
    expect(back).toEqual(['anthologies', 'library', 'movies', 'quotes', 'settings'])
  })
})
