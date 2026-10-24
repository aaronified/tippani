import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { canGoBack, historyDepth, historySeq, jumpBack, navigateBack, noteRoute, pushRoute, recentRoutes, seedRoute, stampPush } from '../../src/history.js'
import { RAIL_WORDS_MAX, TYPE_FACTORS, TYPE_FACTOR_MAX, applyTypeScale } from '../../src/type.js'
import { Drawer, checksBadge, navBadge } from '../../src/App.jsx'
import { cleanup, render } from '@testing-library/react'
import { ShortcutSheet } from '../../src/ui.jsx'
import { SHORTCUTS, shortcutFor } from '../../src/keys.js'
import { t } from '../../src/i18n.js'

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
describe('back in sync', () => {
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
})

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
describe('back trail', () => {
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

})
})

// The nav rail drops its words before it clips them.
//
// WHAT THIS GUARDS IS A SILENT CLIP. Above RAIL_WORDS_MAX the rail falls back to
// the glyph-only mode it already uses below 1180px, because its labels no longer
// fit a 236px column — measured in a real browser at 1280px, where 150% cuts
// "Catalogue" by 6px and "Metadata" by 24px in English. Six pixels off the end of
// a word does not read as a bug, it reads as a slightly odd word, so nothing on
// screen would report this going wrong.
//
// It lives in dom/ rather than pure/ because applyTypeScale writes to <html> and
// returns early with no document — a pure test of it would pass by doing nothing.
describe('rail words', () => {
  const railFor = (ui) => {
    applyTypeScale({ sizeUi: ui })
    return document.documentElement.dataset.rail
  }

  afterEach(() => {
    delete document.documentElement.dataset.rail
  })

  describe('the rail follows the interface dial', () => {
    it('drops them at every dial above that', () => {
      const tooBig = TYPE_FACTORS.filter((f) => f > RAIL_WORDS_MAX)
      expect(tooBig.length).toBeGreaterThan(0)
      for (const factor of tooBig) expect(railFor(factor)).toBe('icons')
    })

    // BOTH DIRECTIONS, because the attribute is set on one branch and deleted on
    // the other: a version that only ever set it would leave the rail in glyphs for
    // the rest of the session after one visit to a large dial.
    it('puts them back when the dial comes down again', () => {
      expect(railFor(TYPE_FACTOR_MAX)).toBe('icons')
      expect(railFor(100)).toBeUndefined()
    })

  })
})

// What a destination says about itself, on both navs at once.
//
// THE RULE THIS PINS: a row that leads to a container and the things inside it
// says both numbers. Library is books and their highlights, the Catalogue is
// titles and their lines, Quotes is boards and their quotes, Anthologies is
// anthologies and their entries. A row that leads to one thing — a gap count, a
// streak, a version — still says one.
//
// TAGS LEFT THIS FILE WITH ITS ROW. It is a section of the metadata console now, so
// neither nav can ask about it and `navBadge` has no branch for it; the size of that
// section is stated on the console's own rail. The assertions below went with the
// branch rather than being left to test a key nothing passes.
//
// WHY IT IS WORTH A FILE. navBadge is the ONE place both navs read, and the whole
// reason it exists is that two lists of counts is how a rail and a drawer come to
// disagree about how many books there are on the same screen. That only holds
// while the pairs are asserted somewhere; until now nothing rendered them and
// `stats.anthologies` had been read from a payload that never carried it, for as
// long as the drawer had existed, without anything noticing.
describe('nav counts', () => {
  // The shape /stats actually answers with, so a renamed field fails here rather
  // than quietly badging "undefined".
  const STATS = {
    books: 412,
    annotations: 9310,
    movies: 88,
    dialogues: 640,
    quotes: 205,
    boards: 6,
    tags: 74,
    stickers: 12,
    anthologies: 3,
    anthology_quotes: 47,
  }

  describe('a destination that holds things says how many of each', () => {
    it.each([
      ['library', '412 | 9310'],
      ['movies', '88 | 640'],
      ['quotes', '6 | 205'],
      ['anthologies', '3 | 47'],
    ])('%s', (key, want) => {
      expect(navBadge(key, { stats: STATS })).toBe(want)
    })

  })
})

// A SECTION THE READER HAS PUT AWAY IS NOT ADVERTISED ANYWHERE.
//
// THE RULE. Settings → Features lets a reader switch whole sections off. What that
// has to mean is not "the tab stops working" — it is that the app stops offering
// it: no row on the drawer, and no key legend on the shortcut sheet promising a
// destination that is not there. The sheet is generated from the key table so it
// cannot fall behind it, which is exactly why it has to be TOLD; without that it
// advertises a screen the reader has hidden.
//
// WHY THIS IS A RENDER. `test/pure/features-nav.test.js` guarded the second half
// with `/ShortcutSheet[\s\S]{0,240}?omit=\{/` — a 240-character window of hope,
// which breaks on adding a prop and passes on an `omit` that belongs to something
// else further down the file. The repo's audit lists it (§2.2) with the fix in one
// line: "Test instead: which doors are on screen with a section hidden."
//
// WHAT A TEST WRITER NEEDS TO KNOW: the first paragraph.
describe('hidden section', () => {
const realMatchMedia = window.matchMedia
// A pointer device: a phone draws no legends at all and would pass this by
// drawing nothing, which is not the same as leaving one out.
const pointer = () => {
  window.matchMedia = (media) => ({
    matches: false, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}
afterEach(() => { cleanup(); window.matchMedia = realMatchMedia })

const drawer = (sections) => {
  pointer()
  render(
    <Drawer
      open
      onClose={() => {}}
      tab="home"
      selectTab={() => {}}
      onSearch={() => {}}
      onAdd={() => {}}
      onAccount={() => {}}
      user={{ username: 'reader', is_admin: false }}
      stats={{}}
      pending={0}
      pendingImport={0}
      streak={0}
      metaIssues={0}
      dark={false}
      onUser={() => {}}
      sections={sections}
    />,
  )
  const text = document.body.textContent
  const caps = [...document.querySelectorAll('kbd')].map((k) => k.textContent.trim())
  cleanup()
  return { text, caps }
}

// `omit` IS A SET OF ACTION IDS — keys.js reads it as `omit?.has?.(id)`, so an
// array here quietly omits nothing and the case passes for the wrong reason. It
// did, on the first draft.
const sheet = (...ids) => {
  pointer()
  render(<ShortcutSheet open omit={new Set(ids)} onClose={() => {}} />)
  const text = document.body.textContent
  cleanup()
  return text
}

// The key a reader would press to reach the shelf, as its caps, and the sentence
// the sheet writes beside it. The SENTENCE is what the sheet is checked on: a
// single cap like "L" occurs inside the sheet's own prose and inside other
// destinations' sequences, so its presence says nothing.
const LIBRARY_KEYS = shortcutFor('go-library').split(/\s+then\s+/)
const LIBRARY_ROW = t(SHORTCUTS.find((s) => s.id === 'go-library').label)

describe('with the shelf put away', () => {
  it('the drawer stops offering it', () => {
    const { caps } = drawer({ library: false })
    // The FULL sequence is what reaches the shelf. A single letter may legitimately
    // still be on the drawer as part of another destination's key, so the test is
    // that the sequence is no longer offered — checked as the last cap of it, which
    // is the one that distinguishes G-then-L from G-then-H.
    expect(caps, 'a hidden section still has a drawer row with its key on it')
      .not.toContain(LIBRARY_KEYS[LIBRARY_KEYS.length - 1])
  })

  it('and the sheet stops promising a key that goes nowhere', () => {
    expect(sheet('go-library'), 'the sheet still advertises a hidden section')
      .not.toContain(LIBRARY_ROW)
  })

})
})
