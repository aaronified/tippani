// A SHORTCUT IS SPELLED OUT ON THE CONTROL THAT RUNS IT.
//
// THE RULE, in the owner's words and already quoted at the top of
// `test/pure/keys.test.js`: shortcuts "should be intuitive and must always be
// spelled out in the corresponding button's tooltip". A binding no control
// mentions is a shortcut only its author knows about.
//
// WHY THIS FILE EXISTS BESIDE THAT ONE. `keys.test.js` proved the rule by reading
// `App.jsx` and `review.jsx` as text and asserting that certain expressions appear
// in them — `/<Kbd keys=\{shortcutFor\(DRAWER_SHORTCUTS\[row\[0\]\]\)\}/` among
// them. Three things are wrong with that, and the repo's own audit
// (`docs/plans/codebase-audit.md` §2.2) lists all three:
//
//   IT PASSES IF NOTHING IS DRAWN. `Kbd` returning `null` — which it does, by
//   design, on a phone — satisfies every one of those assertions. The thing the
//   rule is about is the cap on screen, and a regex over source cannot see one.
//
//   IT FAILS ON A RENAME THAT CHANGES NOTHING. The map callback binds `row`; call
//   it `dest` and the assertion goes red while the interface is identical. A test
//   that fails on correct changes is a test people learn to edit rather than read.
//
//   IT CANNOT SEE A LEGEND THAT IS WRONG. `shortcutFor(id)` for an unregistered
//   id returns `''`, and a blank cap renders as nothing at all — which is exactly
//   the failure "every listed key is actually wired" was written to stop.
//
// So this file asserts the CONSEQUENCE: the legend a reader can see. It reads the
// drawer's destination table out of the source as DATA — which of the app's screens
// the drawer offers is a fact, not a spelling — and then puts every one of them
// through the real resolver and the real component.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the rule at the top. Nothing about how any of
// it is wired.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Kbd } from '../../src/ui.jsx'
import { Drawer } from '../../src/App.jsx'
import { SHORTCUTS, shortcutFor } from '../../src/keys.js'

const realMatchMedia = window.matchMedia
// A POINTER DEVICE, because a phone deliberately draws none of this and a suite
// that forgot to say so would assert nothing at all. mobile-no-keys.test.jsx owns
// the other direction.
const pointer = () => {
  window.matchMedia = (media) => ({
    matches: false, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}
afterEach(() => { cleanup(); window.matchMedia = realMatchMedia })

// The drawer's destinations, read as data: `home: 'go-home'` and its siblings.
const APP = readFileSync(join(process.env.TIPPANI_SRC, 'App.jsx'), 'utf8')
const drawerActions = () => {
  const block = APP.match(/DRAWER_SHORTCUTS = \{([^}]*)\}/)
  if (!block) return []
  return [...block[1].matchAll(/^\s*(\w+):\s*'([a-z0-9-]+)',/gm)].map((m) => ({ dest: m[1], id: m[2] }))
}

// What a reader would actually read off the cap.
const capText = (keys) => {
  pointer()
  const { container, unmount } = render(<Kbd keys={keys} />)
  const caps = [...container.querySelectorAll('kbd')].map((k) => k.textContent.trim())
  unmount()
  return caps
}

describe("the drawer's destinations", () => {
  const rows = drawerActions()

  it('are there to be checked at all', () => {
    // The extraction's own failure mode: a table that moved, and a sweep that
    // then quietly asserts nothing about an empty list.
    expect(rows.length, 'no drawer destinations found — the extraction has gone stale').toBeGreaterThan(5)
  })

  it('each name a shortcut the app actually has', () => {
    const known = new Set(SHORTCUTS.map((s) => s.id))
    const missing = rows.filter((r) => !known.has(r.id)).map((r) => `${r.dest} → ${r.id}`)
    expect(missing, 'these drawer rows point at actions that are not registered').toEqual([])
  })

  it('each show a key cap a reader can read', () => {
    // THE ASSERTION THE OLD ONE COULD NOT MAKE. This goes through the resolver
    // and the component, so it fails on an unregistered action (blank legend), on
    // a legend that resolves to an empty string, and on a `Kbd` that draws
    // nothing — none of which a source scan can see.
    const blank = rows.filter((r) => capText(shortcutFor(r.id)).join('').length === 0)
      .map((r) => `${r.dest} → ${r.id}`)
    expect(blank, 'these drawer rows draw an empty cap').toEqual([])
  })
})

// EVERY REGISTERED DESTINATION IS SPELLED OUT ON THE DRAWER. The drawer is the one
// surface that lists every place the app can go, so a `go-*` binding whose row
// wears no cap is a shortcut with nowhere to be discovered — the state this feature
// replaced rather than the state it should reach.
//
// THE REAL DRAWER, MOUNTED. Reading the destination table out of the source (as
// the block above does, for a different question) cannot see a row that reaches
// somewhere without going through that table — which is precisely how the account
// row came to be the one destination with no legend on it.
describe('and the other direction', () => {
  const drawer = () => {
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
        sections={{}}
      />,
    )
    const caps = [...document.querySelectorAll('kbd')].map((k) => k.textContent.trim()).join(' ')
    cleanup()
    return caps
  }

  it('every go-somewhere shortcut is printed on it', () => {
    const shown = drawer()
    const orphans = SHORTCUTS
      .filter((s) => s.id.startsWith('go-'))
      .filter((s) => !shortcutFor(s.id).split(/\s+then\s+/).every((k) => shown.includes(k)))
      .map((s) => s.id)
    expect(orphans, 'these reach a screen whose drawer row does not name the key').toEqual([])
  })
})

// ---- and the quiz, where one control has TWO legends --------------------------
//
// Practice and the Daily Quiz share every button and not every key: an action with
// a context in the registry is bound with a modifier in one of the two modes, so a
// button that always printed the daily key would be wrong for half the app.
const { QuizRunner } = await import('../../src/review.jsx')

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: { ok: true } })),
}))

const flipCard = {
  kind: 'book', id: 2, direction: 'flip', quote: 'a scrupulous fidelity',
  title: 'Middlemarch', author: 'Eliot', color: 'blue', options: [], answer: 0,
}

const capsOn = (mode) => {
  pointer()
  render(<QuizRunner mode={mode} cards={[flipCard]} />)
  const caps = [...document.querySelectorAll('kbd')].map((k) => k.textContent.trim())
  cleanup()
  return caps
}

describe("the quiz's own buttons", () => {
  it('wear their keys', () => {
    expect(capsOn('daily').length, 'the daily quiz draws no key legends at all').toBeGreaterThan(0)
    expect(capsOn('practice').length, 'practice draws no key legends at all').toBeGreaterThan(0)
  })

  it("and practice's differ, because its bindings do", () => {
    // Only worth asserting if the registry actually distinguishes the two — read
    // that from the registry rather than assuming it.
    const contextual = SHORTCUTS.filter((s) => s.ctx)
    expect(contextual.length, 'no action is mode-dependent, so this rule has nothing to guard').toBeGreaterThan(0)
    for (const s of contextual) {
      expect(shortcutFor(s.id, true),
        `${s.id} prints the same legend in both modes though its binding differs`)
        .not.toBe(shortcutFor(s.id, false))
    }
    // AND THE BUTTON TAKES THE MODE'S FORM, which is the half a registry check
    // cannot reach: a screen that resolves both legends correctly and then passes
    // the wrong one is exactly the bug.
    expect(capsOn('practice').join(' '), 'practice draws the daily quiz’s legends')
      .not.toBe(capsOn('daily').join(' '))
  })
})

// ---- the sheet that lists them all -------------------------------------------
describe('the shortcut sheet', () => {
  it('draws a cap for every binding it lists', async () => {
    pointer()
    const { ShortcutSheet } = await import('../../src/ui.jsx')
    render(<ShortcutSheet open onClose={() => {}} />)
    const caps = [...document.querySelectorAll('kbd')].map((k) => k.textContent.trim()).filter(Boolean)
    expect(caps.length, 'the sheet lists no keys at all').toBeGreaterThan(5)
    // And every one of them is a key the registry knows, not a hand-typed string.
    // BOTH FORMS, because a review key answers to two decks and the sheet says
    // so — one cap for the daily binding and one for practice's.
    const registry = new Set(SHORTCUTS
      .flatMap((s) => [shortcutFor(s.id), shortcutFor(s.id, true)])
      .flatMap((legend) => legend.split(/\s+/))
      .filter(Boolean))
    // A modifier is a cap of its own — the sheet draws "Shift" beside the key it
    // modifies — so a cap counts as known if it is a whole legend, a word inside
    // one, or a piece of one split on its joining punctuation.
    const parts = new Set([...registry].flatMap((r) => [r, ...r.split(/[-+\s]+/)]).filter(Boolean))
    const strangers = caps.filter((c) => !parts.has(c))
    expect(strangers, 'the sheet prints caps no registered binding produces').toEqual([])
  })

  it('names every binding the registry holds', async () => {
    pointer()
    const { ShortcutSheet } = await import('../../src/ui.jsx')
    render(<ShortcutSheet open onClose={() => {}} />)
    // A two-key sequence renders as two caps with a joining word between them, so
    // the sheet's text is "GthenL" and not "G then L". Compare the KEYS, which is
    // what a reader reads off the caps.
    const text = document.body.textContent
    const unnamed = SHORTCUTS
      .filter((s) => !shortcutFor(s.id).split(/\s+then\s+/).every((k) => text.includes(k)))
      .map((s) => s.id)
    expect(unnamed, 'these bindings are in the registry and not on the sheet').toEqual([])
  })
})
