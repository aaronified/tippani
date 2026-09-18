// Holding the dock's Back key offers the screens behind this one, and picking one
// rewinds the real stack rather than navigating afresh.
//
// THE ASK: "the back button long press should give the user the list of last 5
// pages … choosing one there will overwrite the device back history as well."
//
// THE HALF THAT IS EASY TO GET WRONG is the distance. The History API cannot be
// read — no browser will say what is behind the current entry — so the app keeps
// its own list, and the only thing it can act on is `go(-k)`. Every route entry
// already carried `tpDepth`, which looks like the number to subtract and is not:
// panels and overlays push entries of their own and carry the route's depth
// FORWARD unchanged, so two screens three entries apart read one apart in depth.
// A jump computed that way stops short on a panel's entry, the address does not
// change, the shell reads the pop as an overlay dismissal and returns early — and
// the reader's press does nothing at all. `tpSeq` is what counts entries, and the
// overlay case below is the one that tells the two apart.
//
// WHAT THIS FILE KNOWS, declared: the history module's own functions, because
// they are the observable unit. Nothing here mounts the shell — its size is why
// this module was cut out in the first place (see back-in-sync.test.jsx). The
// GESTURE and the MENU are a journey's to press; this is the arithmetic
// underneath, which no amount of pressing can distinguish from a lucky guess.
//
// jsdom implements the session history, so these are real pushes and real
// traversals. The traversal is asynchronous — popstate arrives on a later task —
// which is why the landing cases await it.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  historySeq,
  jumpBack,
  noteRoute,
  pushRoute,
  recentRoutes,
  seedRoute,
  stampPush,
} from '../../src/history.js'

// A fresh stack and a fresh trail per case. jsdom keeps one history for the whole
// file and nothing can shorten it, so the serial is reset on the CURRENT entry —
// which is the state a first load is in.
beforeEach(() => {
  window.history.replaceState(null, '', '/library')
  window.sessionStorage.clear()
})

const popped = () => new Promise((r) => window.addEventListener('popstate', r, { once: true }))

// A screen the reader walked to. The shell does these two things in this order:
// the push moves the address, the note records what the entry is called.
const visit = (path, tab, detail, title) => {
  pushRoute(path)
  noteRoute(tab, detail, title)
}

// An entry that is NOT a screen: a panel, a dialog, anything using
// `useBackToClose`. Pushed with the url argument omitted, exactly as ui.jsx does.
const overlay = () => window.history.pushState(stampPush({ ...window.history.state, tpOverlay: true }), '')

describe('the list a held Back key offers', () => {
  it('is the screens behind this one, nearest first', () => {
    seedRoute('/library')
    noteRoute('library', null, null)
    visit('/quotes', 'boards', null, null)
    visit('/books/7', 'library', { type: 'book', id: 7 }, 'Moby-Dick')
    visit('/metadata', 'metadata', null, null)

    expect(recentRoutes(5).map((e) => e.tab)).toEqual(['library', 'boards', 'library'])
    expect(recentRoutes(5)[0].title).toBe('Moby-Dick')
  })

  it('never offers the screen you are on', () => {
    seedRoute('/library')
    noteRoute('library', null, null)
    visit('/quotes', 'boards', null, null)
    // Two entries recorded, one of them the current one.
    expect(recentRoutes(5)).toHaveLength(1)
    expect(recentRoutes(5)[0].tab).toBe('library')
  })

  it('stops at five however far the reader has walked', () => {
    seedRoute('/')
    noteRoute('home', null, null)
    for (const tab of ['library', 'movies', 'boards', 'metadata', 'checks', 'bin', 'settings']) {
      visit(`/${tab}`, tab, null, null)
    }
    expect(recentRoutes(5)).toHaveLength(5)
    expect(recentRoutes(5)[0].tab).toBe('bin')
  })

  it('remembers the tab rather than a finished label, so it speaks the reader\'s language', () => {
    // A label resolved at record time would be frozen in whichever language the
    // reader was using when they walked past the screen — the defect the top bar's
    // context pill shipped with. What is stored is the route; the words are looked
    // up when the menu opens.
    seedRoute('/library')
    noteRoute('library', null, null)
    visit('/checks', 'checks', null, null)
    expect(recentRoutes(5)[0]).toMatchObject({ tab: 'library', title: null })
  })
})

describe('picking a row', () => {
  it('rewinds the device\'s own stack, so Back walks on from there', async () => {
    seedRoute('/')
    noteRoute('home', null, null)
    visit('/library', 'library', null, null)
    visit('/quotes', 'boards', null, null)
    visit('/metadata', 'metadata', null, null)

    // The third row down: Home, two screens back from here.
    const rows = recentRoutes(5)
    expect(rows.map((e) => e.tab)).toEqual(['boards', 'library', 'home'])

    const land = popped()
    expect(jumpBack(rows[2].seq)).toBe(true)
    await land
    expect(window.location.pathname).toBe('/')

    // AND THE STACK IS GENUINELY WHERE IT SAYS. Everything between is behind us
    // now, not merely hidden: there is nothing of ours left to go back to.
    expect(historySeq()).toBe(0)
    expect(recentRoutes(5)).toEqual([])
  })

  it('counts the panels in between, not just the screens', async () => {
    // THE CASE THE WHOLE DESIGN IS FOR. Two screens with two panel entries wedged
    // between them are four entries apart in the browser's stack and two apart in
    // every other number the app keeps. A jump of two lands on a panel's entry —
    // and a panel's entry carries the address of the screen it opened OVER, so the
    // reader is silently left one screen short of where they pointed.
    //
    // THE PANELS SIT OVER THE MIDDLE SCREEN ON PURPOSE. Over the destination they
    // would share its address, and this case would pass with the serials removed
    // while the arithmetic underneath was wrong.
    seedRoute('/')
    noteRoute('home', null, null)
    visit('/quotes', 'boards', null, null)
    overlay()
    overlay()
    visit('/metadata', 'metadata', null, null)

    const rows = recentRoutes(5)
    expect(rows.map((e) => e.tab)).toEqual(['boards', 'home'])

    const land = popped()
    jumpBack(rows[1].seq)
    await land
    expect(window.location.pathname).toBe('/')
    expect(historySeq()).toBe(rows[1].seq)
  })

  it('declines a row that is not behind us', () => {
    seedRoute('/library')
    noteRoute('library', null, null)
    visit('/quotes', 'boards', null, null)
    // The entry we are standing on, and one that never existed.
    expect(jumpBack(historySeq())).toBe(false)
    expect(jumpBack(historySeq() + 3)).toBe(false)
  })
})

describe('a road not taken', () => {
  it('drops the rows a new navigation abandoned', async () => {
    // THE WEAKER OF THE TWO, and said so here: with only one row abandoned, the
    // upsert below would overwrite it even if nothing trimmed. The case after this
    // one is what actually holds `trimTrail` up.
    seedRoute('/')
    noteRoute('home', null, null)
    visit('/library', 'library', null, null)
    visit('/quotes', 'boards', null, null)

    const land = popped()
    window.history.back()
    await land
    noteRoute('library', null, null)

    // The browser has dropped /quotes' entry as soon as we push somewhere else, so
    // the trail must too — a row pointing at an entry that no longer exists would
    // jump the reader to whatever took its place.
    visit('/metadata', 'metadata', null, null)
    expect(recentRoutes(5).map((e) => e.tab)).toEqual(['library', 'home'])
  })

  it('drops a row whose serial a panel has since taken', async () => {
    // THE CASE THAT HOLDS THE TRIM UP, and it is why the trim belongs to every
    // push rather than to `pushRoute`.
    //
    // A panel opened after a Back takes the abandoned serial and records nothing,
    // so the stale row ends up BELOW the next route's serial — out of reach of a
    // trim that only runs on a route push, and never overwritten, because
    // `noteRoute` only ever writes the serial it is standing on. The menu then
    // offers a screen for an entry that has become somebody's panel, and a panel's
    // entry carries the address it opened OVER: the row goes to the wrong screen,
    // which is worse than a row that goes nowhere.
    seedRoute('/')
    noteRoute('home', null, null)
    visit('/library', 'library', null, null)
    visit('/quotes', 'boards', null, null)
    visit('/metadata', 'metadata', null, null)

    const land = popped()
    window.history.go(-2)
    await land
    noteRoute('library', null, null)

    // A panel over the shelf, taking the serial /quotes used to hold, and then a
    // navigation out of it — which is how a panel's entry gets BURIED rather than
    // popped (see `leaveTo` in ui.jsx for the same cost stated from the other end).
    overlay()
    visit('/checks', 'checks', null, null)

    expect(recentRoutes(5).map((e) => e.tab)).toEqual(['library', 'home'])
  })
})

describe('a name that arrives late', () => {
  it('corrects its own row rather than adding a second', () => {
    // A work's name is published by the screen once its fetch lands, so the first
    // note for a detail route carries no title at all. Keying on the serial is what
    // lets the second note replace the first.
    seedRoute('/library')
    noteRoute('library', null, null)
    visit('/books/7', 'library', { type: 'book', id: 7 }, null)
    noteRoute('library', { type: 'book', id: 7 }, 'Moby-Dick')
    visit('/metadata', 'metadata', null, null)

    const rows = recentRoutes(5)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ kind: 'book', title: 'Moby-Dick' })
  })
})
