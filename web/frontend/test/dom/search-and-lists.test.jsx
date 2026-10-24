import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SearchBox } from '../../src/SearchPage.jsx'
import { readSearchBox } from '../../src/facets.js'
import { AppearanceStrip } from '../../src/characterRows.jsx'
import { actionsFor, bulkActionsFor } from '../../src/actions.jsx'

// The search box's facet dropdown — typing a field name, and the token leaving
// the box.
//
// facets.test.js pins the grammar as functions. This pins the GESTURE, which is
// the part a reader actually meets: type `tag:`, get offered your own tags, pick
// one, and watch the words you typed turn into a chip beneath the box. Each of
// those four steps is a place the wiring can be right in isolation and wrong
// together — a dropdown that opens but never commits, a commit that adds the
// chip and leaves the text behind, a chip that shows the storage word.
describe('search facets', () => {
const VOCAB = {
  tags: ['death', 'stoicism', 'gardening'],
  authors: ['Ursula K. Le Guin', 'Terry Pratchett'],
  colours: [
    { key: 'yellow', name: 'yellow' },
    { key: 'blue', name: 'doubt' },
  ],
}

// A controlled harness, because SearchBox is controlled: the page owns the text
// and the chips, and half of what is under test is what it hands back.
//
// It also owns the DRAFT, which is the shape SearchPage has: one computation of
// "what is being typed and what can be offered for it", handed down, so the
// decision about what to search and the decision about what to offer cannot
// diverge. `freeText` here mirrors the page's, so the test can see the query
// that would actually be sent.
function Harness({ vocabulary = VOCAB, onFirstFocus, initial = '' }) {
  const [q, setQ] = useState(initial)
  const [chips, setChips] = useState([])
  // The PAGE's own function, not a copy of it. A harness that re-implemented
  // this would be testing the harness — which is exactly the two-answers-to-one-
  // question shape that produced the bug the tests below pin.
  const { draft, options, freeText } = readSearchBox(q, vocabulary)
  return (
    <div>
      <SearchBox
        q={q} setQ={setQ} chips={chips} setChips={setChips}
        draft={draft} options={options} onFirstFocus={onFirstFocus}
      />
      <output data-testid="q">{q}</output>
      <output data-testid="free">{freeText}</output>
      <output data-testid="wire">{chips.map((c) => `${c.field}=${c.value}`).join('&')}</output>
    </div>
  )
}

const box = () => screen.getByRole('textbox', { name: 'Search' })
const type = (text) => fireEvent.change(box(), { target: { value: text } })
const options = () => [...document.querySelectorAll('.token-opt')].map((b) => b.textContent)

describe('the dropdown', () => {

  // One test over all six rows rather than six: each was the identical
  // three-step gesture — render the harness, type a string, compare the offered
  // options — over the same default vocabulary, differing only in what was typed
  // and what came back. Row names are the original it() titles, and the whole
  // collection is compared at once so a failure names every menu that was wrong
  // instead of dying on the first. cleanup() runs per row because RTL's
  // auto-cleanup fires between TESTS, not between iterations, and a second
  // mounted box would make box()/options() see two menus.
  //
  // The three tests below that assert the menu does NOT open are deliberately
  // not rows here: they assert the converse, on a different target.
  const TYPED = [
    { name: 'opens on a known field and a colon, offering that field’s vocabulary', typed: 'tag:', want: ['tag:death', 'tag:stoicism', 'tag:gardening'] },
    { name: 'narrows as you type', typed: 'tag:sto', want: ['tag:stoicism'] },
    { name: 'forgives one typo', typed: 'tag:stoicsm', want: ['tag:stoicism'] },
    { name: 'matches a name by any of its words', typed: 'author:guin', want: ['author:Ursula K. Le Guin'] },
    // The 1.7.1 rename reaching all the way to the menu: the reader named this
    // slot "doubt", so "doubt" is what is on offer and what is searched.
    { name: 'offers a colour by the name the reader gave it', typed: 'colour:dou', want: ['colour:doubt'] },
    { name: 'escapes one field without disarming the rest of the box', typed: 'note\\: to self tag:sto', want: ['tag:stoicism'] },
  ]

  it('offers what was typed for, in the order it ranks it', () => {
    const got = TYPED.map(({ name, typed }) => {
      cleanup()
      render(<Harness />)
      type(typed)
      return [name, options()]
    })
    expect(got).toEqual(TYPED.map(({ name, want }) => [name, want]))
  })

})

describe('picking a value lifts the token out of the box', () => {
  it('turns the typed field into a chip and empties the text', () => {
    render(<Harness />)
    type('tag:sto')
    fireEvent.click(screen.getByRole('button', { name: 'tag:stoicism' }))

    expect(screen.getByTestId('q').textContent).toBe('')
    expect(screen.getByTestId('wire').textContent).toBe('tag=stoicism')
    expect(document.querySelector('.token-pill').textContent).toContain('tag:stoicism')
  })

})

describe('a field answered twice', () => {
  // `favourite:yes` and `favourite:no` are not two filters, they are one filter
  // answered twice. Left to accumulate they both render as active while the
  // server takes only the last, so half the chip row asserts a narrowing that
  // never happened.
  it('replaces rather than stacking a contradictory flag', () => {
    render(<Harness />)
    type('favourite:')
    fireEvent.click(screen.getByRole('button', { name: 'favourite:yes' }))
    expect(screen.getByTestId('wire').textContent).toBe('favourite=yes')

    type('favourite:no')
    fireEvent.click(screen.getByRole('button', { name: 'favourite:no' }))
    expect(screen.getByTestId('wire').textContent).toBe('favourite=no')
    expect(document.querySelectorAll('.token-pill')).toHaveLength(1)
  })

})

// ---- the Filters panel, and the paged dropdown (1.16.0) ---------------------
//
// THE FACETS SHIPPED IN 1.10.0 AND NOBODY COULD FIND THEM. The grammar, the
// dropdown, the chips, the vocabulary endpoint and the SQL were all complete;
// the only thing on screen that said so was a placeholder string, gone the
// moment you typed a character. The report was three words long and correct:
// "I do not see search facets yet."
//
// So the panel exists to be the visible door. Its ONE invariant — the one this
// block is really for — is that pressing a value in it produces exactly the chip
// that typing the same facet produces. Two ways in, one chip out. A panel that
// assembled its own query object would be the render-versus-match divergence
// facets.js opens by refusing, moved one file closer.
})

// THE WORKS STRIP IS IN RELEASE ORDER, WHICH IS WHAT IT SAYS IT IS.
//
// THE REPORT, the owner's: "the works say it is release order, and it was. but
// then i rectified a metadata problem in gardens of the moon (which released in
// 1999, not 2009 as my backup suggested). this should have automatically taken it
// to the front. but it didn't."
//
// WHAT IT WAS. `PersonCredits` ordered by role then TITLE, `castWhere` by title
// alone, and neither shape carried a year — so a strip of nine Erikson novels
// opened Deadhouse Gates, Dust of Dreams, Gardens of the Moon under a line
// promising release order. Correcting a year moved nothing because no tile had
// ever been placed by one.
//
// WHAT IS ASSERTED HERE IS THE READER'S ORDER, from the rendered strip rather
// than from the helper: a caller that sorts its own list before handing it over
// would pass a test of the helper and still leave the OTHER caller wrong, which
// is exactly the shape of defect the repo's "similar things should act similarly"
// directive exists to stop.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above; that a tile carries
// `year`, 0 meaning the library does not know; and that a person's strip is two
// concatenated lists (what they played, then what they made), so the order has to
// survive a join it does not control.
describe('release order', () => {
  const tile = (title, year) => ({ key: title, title, year, kind: 'book', badge: null, onOpen: () => {} })

  const titlesOf = (tiles) => {
    const { container } = render(<AppearanceStrip tiles={tiles} hint="the order is the release order" />)
    return [...container.querySelectorAll('.cs-tile-title')].map((n) => n.textContent)
  }

  describe('a works strip', () => {
    it('puts the earliest work first however the list arrives', () => {
      // The owner's own shelf, in the alphabetical order the query handed over.
      expect(titlesOf([
        tile('Deadhouse Gates', 2000),
        tile('Dust of Dreams', 2009),
        tile('Gardens of the Moon', 1999),
      ])).toEqual(['Gardens of the Moon', 'Deadhouse Gates', 'Dust of Dreams'])
    })

  })
})

// WHERE THE READER'S SETTINGS COME FROM, while two preferences exist.
//
// `textOrder` is the blob the per-language table writes. `readLanguages` is the
// preference it replaces — the owner's ruling absorbed the declaration into the
// four states — and an account that has one but has never touched the table is
// migrated from it on read.
//
// THIS IS IN test/dom BECAUSE textOrderFrom SHIPS BESIDE THE PROVIDER, not because
// it renders anything: it is the one function that knows both sources exist, and
// it lives with the context it feeds rather than in the pure module, which knows
// only about states.
//
// EVERY CASE HERE FAILS SILENTLY IF WRONG. Each one still produces a working card;
// what changes is which text is in the big type, across a whole library, on
// somebody's next login.
describe('text order sources', async () => {
  const { textOrderFrom } = await import('../../src/textOrderHost.jsx')

  const DECLARED = JSON.stringify(['german'])

  describe('two sources, and which wins', () => {
    it('the table\'s blob beats the declaration it replaces', async () => {
      // A reader who has used the new table and still has the old preference must
      // see the table's answer, or the feature appears not to save.
      expect(textOrderFrom({
        textOrder: '{"master":"quote-only"}',
        readLanguages: DECLARED,
      })).toEqual({ master: 'quote-only', byLanguage: {} })
    })

    // AN EMPTY BLOB IS NOT SETTINGS. The server stores nothing for a master at the
    // default with no custom rows, so "" is both "never opened the table" and "put
    // everything back" — and both have to fall through, or a reader who reset would
    // find their old declaration resurrected under them.

    // BUT A BROKEN BLOB DOES NOT. Falling back on a parse error would reorder a
    // library's cards on the strength of a syntax mistake — and the reader whose
    // settings failed to load is precisely the one who should see the app's default,
    // not somebody's stale declaration.

  })
})

// The action registry: one list of the things you can do to a quote.
//
// The registry exists to stop a divergence, so the tests are about the
// divergence rather than about any one action. Two surfaces will read this list —
// a card and a bulk bar today, a context menu next — and the failure it prevents
// is silent by construction: a menu that offers Delete beside a bar that does not
// looks completely normal on both screens, and nobody notices until somebody
// wonders why they cannot do to forty what they just did to one.
//
// So: every item action has a selection equivalent or is explicitly marked
// `single`, and the ONLY thing marked single is the one that genuinely does not
// generalise. A test that just listed the expected ids would pass for a registry
// that had quietly dropped one.
describe('actions registry', () => {
const ITEM = { id: 7, quote: 'Only in silence the word' }
// A selection of two. Some actions mean something over a SELECTION and nothing
// over one item that happens to be in one — see the cardinality block at the foot
// of this file — so the length of the list is now load-bearing.
const TWO = [ITEM, { id: 8, quote: 'The unread shelf' }]

// Every callback a screen can own, so nothing is filtered out for being absent.
const full = () => ({
  copy: vi.fn(),
  share: vi.fn(),
  edit: vi.fn(),
  remove: vi.fn(),
  addTags: vi.fn(),
  setFields: vi.fn(),
})

describe('what you can do to one quote', () => {

  // A WORK IS NOT A QUOTE HERE EITHER (1.14.2). This list said copy and share
  // were available on a book for as long as it was quote-only — nothing broke,
  // because no work surface passed the callbacks, and the moment one did it
  // would have offered to put a cover on the clipboard.
  it.each(['book', 'movie'])('%s offers neither copy nor share, because there is nothing to copy', (kind) => {
    const ids = actionsFor(kind, ITEM, full()).map((a) => a.id)
    expect(ids).toEqual(['edit', 'delete'])
  })

})

// ---- two selections, one registry (1.11.1) ---------------------------------
//
// A selection of quotes and a selection of works have almost nothing in common: a
// book has no colour and no tag of its own, a quote has no shelf and nothing to
// look up. That could have been two components; it is one registry and a kind,
// and these are the assertions that keep it honest.

const everything = () => ({
  ...full(),
  setColour: vi.fn(),
  setSticker: vi.fn(),
  favourite: vi.fn(),
  fillGaps: vi.fn(),
  setShelf: vi.fn(),
  setReview: vi.fn(),
})

// ---- where an action sits, and how many it takes (1.12.0) -----------------
//
// The bar became three glyphs and an overflow. Both halves of that are decided
// here rather than in the component that draws them: WHICH three (`where`), and
// WHETHER an action means anything at this count. A component holding the second
// opinion is how a bar and a menu drift, which is the whole reason this file
// exists.

describe('the actions that depend on how many are picked', () => {

  it('drops Edit the moment a second is picked', () => {
    expect(bulkActionsFor('quote', TWO, everything()).map((a) => a.id)).not.toContain('edit')
  })

})
})

// WHEN THE DATABASE DOOR REFUSES, THE READER IS TOLD, NOT SIGNED OUT.
//
// Issue #40's state, seen from the browser: the server's /api door answers 503
// with code TIP-HTTP-002 when no database connection comes free, and the request
// changed nothing. The app used to read that at boot as "no session" and show the
// sign-in form, whose own sign-in the door then refused: about twenty seconds of
// nothing, then the wrong screen. Now any request that meets the refusal puts up
// the busy screen, which steps aside once /healthz answers again.
//
// WHAT IT KNOWS, declared: the server's answers, faked at fetch, because nothing
// on a screen puts a server's database into that state; and that the busy screen
// polls every five seconds, which the fake clock advances. What is asserted is
// what a reader sees.
describe('database busy', async () => {
  const BUSY = { error: "Tippani's database is not answering, so this request changed nothing.", code: 'TIP-HTTP-002' }
  const answer = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  let healthy
  let realLocation
  beforeEach(() => {
    healthy = false
    realLocation = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload: vi.fn(), search: '' } })
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.endsWith('/healthz')) return new Response('', { status: healthy ? 200 : 503 })
      return answer(503, BUSY)
    })
  })
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
    vi.useRealTimers()
  })

  describe('a boot the database door refuses', () => {
    it('shows the busy screen instead of the sign-in form, and reloads once the database answers', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
      const { default: App } = await import('../../src/App.jsx')
      render(<App />)
      const dialog = await screen.findByRole('alertdialog', { name: 'Busy for a moment' })
      expect(dialog.textContent).toMatch(/wasn't saved/)
      expect(dialog.textContent).toMatch(/TIP-HTTP-002/)
      expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()

      await act(async () => { vi.advanceTimersByTime(5000) })
      expect(window.location.reload, 'reloaded while the database was still refusing').not.toHaveBeenCalled()
      healthy = true
      await act(async () => { vi.advanceTimersByTime(5000) })
      expect(window.location.reload).toHaveBeenCalled()
    })
  })
})
