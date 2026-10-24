import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuoteReadingFields } from '../../src/Settings.jsx'
import { applyTypeScale } from '../../src/type.js'
import { SRC } from '../src-files.js'
import { QUOTE_TEXT } from '../../src/fonts.js'
import { AnnotationCard } from '../../src/Library.jsx'
import { useSelection } from '../../src/selection.jsx'
import { applyTheme } from '../../src/theme.js'

// THE TWO CONTROLS THEMSELVES, RENDERED.
//
// WHY THIS EXISTS. Everything else about the reading dials is proved without the
// panel: `quote-dials.test.js` does the arithmetic and the defaults,
// `quote-dials-reach-the-page.test.jsx` does the wiring onto <html>, and the Go
// suite does the round trip. None of them opens the thing a reader actually
// touches, so the whole feature could ship with a control that renders a
// placeholder where its label should be and every one of them would stay green.
//
// AND `locale-complete.test.js` DOES NOT COVER IT EITHER, which is the part worth
// writing down. A rater deleted `settings.appearance.quote-leading.loose` from
// en.txt and that suite stayed green: it glob-matches the stem, so a key that is
// missing — or misspelt at the call site — renders a humanised placeholder and
// nothing says so. That is a hole in the catalogue guard rather than in this
// feature (its own task), but it is exactly why the assertions below name the
// RESOLVED WORDS and not the keys: a test that asserted `t('…loose')` was called
// would pass on the placeholder too.
//
// WHAT IT PINS:
//   - both labels and every option resolve to real words, not placeholders
//   - an untouched account shows the leading the app has always drawn, and no
//     measure — the promise that matters most, at the surface a reader sees it
//   - choosing a step sends THAT field and nothing else, and applies before the
//     request returns (§4's rule for every control on this card)
//   - the page answers immediately, so the dial is not waiting on a round trip
describe('quote dials in settings', () => {
// THE CATALOGUE ITSELF, because "does this look like a key" cannot answer the
// question. The first draft of this file asked exactly that — a regex for dots and
// stems — and a mutation that misspelt one step's key sailed through it: the
// catalogue humanises a missing key, so `…quote-leading.looose` renders as
// "Looose", which has no dot, no stem, and looks like a word. The only honest test
// is against the catalogue's own text: what the control DREW must be what en.txt
// says for the key it was supposed to ask for.
const EN = readFileSync(join(SRC, '..', '..', '..', 'internal', 'i18n', 'en.txt'), 'utf8')
function say(key, vars = {}) {
  const m = EN.match(new RegExp(`^${key.replace(/[.]/g, '\\.')} = (.*)$`, 'm'))
  if (!m) throw new Error(`en.txt has no ${key} — the catalogue moved, or this guard did`)
  return m[1].replace(/\{(\w+)\}/g, (_, k) => String(vars[k]))
}

// `Select` is the app's own control, not a native <select>: a trigger button that
// opens a portalled `role="listbox"` of `role="option"` buttons (ui.jsx). So the
// dials are driven the way a reader drives them — press the trigger, press the
// option — which is also what makes this a test of the control rather than of a
// value being passed around.
const triggers = () => [...document.querySelectorAll('.tp-select-trigger')]
const shown = (t) => t.querySelector('span')?.textContent || ''

async function pick(user, trigger, optionText) {
  await user.click(trigger)
  const opt = [...document.querySelectorAll('[role="option"]')]
    .find((o) => (o.textContent || '').trim() === optionText)
  if (!opt) throw new Error(`no option "${optionText}" — saw ${[...document.querySelectorAll('[role="option"]')].map((o) => o.textContent).join(' | ')}`)
  await user.click(opt)
}

let sent
beforeEach(() => {
  sent = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null })
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  applyTypeScale({})
})

describe('the two reading dials, as a reader meets them', () => {
  it('send the one field they are for, and apply it before the server answers', async () => {
    const onPreferences = vi.fn()
    const user = userEvent.setup()
    render(<QuoteReadingFields prefs={{ quoteLeading: 0, quoteMeasure: 0 }} onPreferences={onPreferences} />)

    await pick(user, triggers()[1], say('settings.appearance.quote-measure.chars', { n: 66 }))

    await waitFor(() => expect(sent.length).toBe(1))
    // ONE FIELD. The Appearance card's own hazard, which its comments keep
    // warning about: a preference riding in a full-state object is wiped by an
    // unrelated click. This control writes what it is for and nothing else.
    expect(sent[0].body).toEqual({ quoteMeasure: 66 })
    expect(sent[0].url).toContain('/auth/me/preferences')
    // And the page already answers, without waiting for the round trip.
    expect(document.documentElement.style.getPropertyValue('--quote-measure')).toBe('66ch')
    await waitFor(() => expect(onPreferences).toHaveBeenCalledWith({ quoteMeasure: 66 }))
  })

  it('put the old setting back when the server refuses', async () => {
    // The other half of applying early: a reader must never be left looking at a
    // setting their account does not have.
    applyTypeScale({ quoteLeading: 190 })
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('{"error":"nope"}', { status: 400, headers: { 'content-type': 'application/json' } }),
    )
    const onPreferences = vi.fn()
    const user = userEvent.setup()
    render(<QuoteReadingFields prefs={{ quoteLeading: 190 }} onPreferences={onPreferences} />)

    await pick(user, triggers()[0], say('settings.appearance.quote-leading.tight'))

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--quote-leading'),
        'a refused save left the reader looking at a setting they do not have').toBe('1.9'))
    expect(onPreferences, 'a refused save was reported upward as though it took').not.toHaveBeenCalled()
  })
})
})

// THE TWO DIALS REACH A QUOTE, AND SURVIVE A RELOAD.
//
// docs/plans/access.md's verification row for §6 reads: "Size, leading and measure
// reach the quote surfaces and survive a reload; the defaults are unchanged for a
// reader who sets nothing." (Quoted rather than cited by line: the first draft of
// this header said access.md:138 and the SAME COMMIT moved it, because that commit
// edited access.md too. fonts.js records the rule — a line number in a comment is a
// fact with no guard on it; the quoted words are greppable and never rot.) Size
// already shipped, so the two
// this change adds are leading and measure. quote-dials.test.js proves the
// arithmetic and the defaults without a DOM; this proves the wiring — the
// properties land on <html>, they inherit down to the words, and the slot is
// asking for them rather than for a number of its own.
//
// A RELOAD IS `applyTypeScale(user.preferences)` AND NOTHING ELSE. App.jsx calls
// it once with whatever the server sent (App.jsx:209), so replaying that call
// with a stored preferences object is the reload, faithfully: there is no other
// path by which a saved dial reaches a page.
//
// jsdom DOES NOT RESOLVE var() IN A SHORTHAND, which is why the assertions are
// shaped the way the language-font suites already shaped theirs: the honest pair
// is the custom property reaching the element and the slot deferring to it. A
// test that asked getComputedStyle for a line-height would read the literal
// string "var(--quote-leading)" and pass on a page where the property was never
// written at all.
describe('quote dials reach the page', () => {
// One quote slot, set the way every quote slot in the app is set.
const Quote = () => <p style={{ ...QUOTE_TEXT, fontSize: 'var(--type-display-17)' }}>Der Mensch ist frei</p>

afterEach(() => {
  applyTypeScale({})
  document.documentElement.style.removeProperty('--quote-leading')
  document.documentElement.style.removeProperty('--quote-measure')
})

describe('a reader who has set both dials', () => {
  it('and still has them after a reload', () => {
    // The round trip: a dial is set, the page is thrown away, and the app boots
    // again from what the server stored. Nothing is remembered on the element.
    const stored = { quoteLeading: 130, quoteMeasure: 80 }
    applyTypeScale(stored)
    const { unmount } = render(<Quote />)
    unmount()
    document.documentElement.style.removeProperty('--quote-leading')
    document.documentElement.style.removeProperty('--quote-measure')

    applyTypeScale(stored) // App.jsx:209, with the preferences the server sent
    render(<Quote />)
    const p = screen.getByText(/Der Mensch ist frei/)
    expect(getComputedStyle(p).getPropertyValue('--quote-leading').trim()).toBe('1.3')
    expect(getComputedStyle(p).getPropertyValue('--quote-measure').trim()).toBe('80ch')
  })
})

// ---- and the element it lands on can actually honour it -----------------------
//
// THE DEFECT THIS WAS WRITTEN FOR, found by a rater on the commit that added the
// measure: `max-width` has NO EFFECT on a non-replaced INLINE element (CSS 2.1
// §10.4). `MatchWindow` put QUOTE_TEXT on a bare <span>, so the reading-comfort
// dial reached every quote surface in the app EXCEPT the five search slots — and
// it failed SILENTLY, because the leading went on working and only the width did
// not. The CHANGELOG meanwhile promised it worked "in a search result".
//
// SO THE QUESTION IS ABOUT THE RENDERED ELEMENT, NOT THE STYLE OBJECT. Asserting
// that QUOTE_TEXT carries a maxWidth — which the file above already does — cannot
// see this: the object was right and the element could not obey it. This renders
// each shape a quote is actually drawn in and asks what the browser would do.
//
})

// Selecting quote cards, and the moment a plain click changes meaning.
//
// That change is the risky part of this feature. Before a selection exists a click
// opens the quote; once one does, a click toggles. Get it wrong in one direction and
// selecting is impossible; in the other, every ordinary click starts silently
// picking things. The mode is visible — the bar is up, the cards wear checkboxes and
// a ring — which is what makes the change legible rather than surprising.
//
// The other claim here is that SELECT IS IN THE CARD'S MENU. That is what makes the
// context menu and multiselect one feature instead of two: the gesture that asks
// "what can I do to this" is also how you begin doing it to several.
describe('selection cards', () => {
  const QUOTES = [
    { id: 1, quote: 'the first line', color: 'yellow', tags: [], favorite: false },
    { id: 2, quote: 'the second line', color: 'blue', tags: [], favorite: false },
    { id: 3, quote: 'the third line', color: 'pink', tags: [], favorite: false },
  ]

  let opened

  // A board: three cards over one selection, exactly as the Quotes screen wires it.
  function Board() {
    const selection = useSelection(QUOTES.map((q) => q.id))
    return (
      <div>
        <span data-testid="count">{selection.count}</span>
        <span data-testid="kind">{String(selection.kind)}</span>
        {QUOTES.map((q, i) => (
          <div key={q.id} onClick={() => opened.push(q.id)}>
            <AnnotationCard
              a={q}
              variant={i}
              tagMap={{}}
              editing={false}
              setEditingId={() => {}}
              save={() => {}}
              patch={async () => {}}
              remove={() => {}}
              onCopy={() => {}}
              onShare={() => {}}
              selection={selection}
              selectKind="quote"
              actionsAlwaysVisible
            />
          </div>
        ))}
      </div>
    )
  }

  const cards = () => [...document.querySelectorAll('.hand-card')]
  const count = () => Number(screen.getByTestId('count').textContent)
  const boxes = () => screen.getAllByRole('checkbox')

  beforeEach(() => {
    opened = []
  })

  describe('picking cards', () => {

    it('toggles instead of opening once a selection exists', () => {
      // THE MOMENT THE MEANING CHANGES. It is legible because the bar is up and the
      // cards wear checkboxes; it would be a trap if the mode were invisible.
      render(<Board />)
      fireEvent.click(boxes()[0])
      fireEvent.click(cards()[1])
      expect(count()).toBe(2)
      expect(opened, 'no quote should have opened').toEqual([])
    })

  })

  // ---- the film-strip frame (1.11.1) -----------------------------------------
  //
  // A dialogue card is its own component — a lit panel rather than a torn-edged
  // card — so its selection wiring is hand-rolled beside the annotation card's, and
  // hand-rolled twice is how two cards come to behave differently on the same
  // gesture. Asserted separately for that reason.
})

// A selection, and the rules that keep its count honest.
//
// The bar says "12 selected" and then acts on twelve things. Most of this file is
// about that sentence being true — which is not obvious, because a board's visible
// list changes under a selection all the time: a filter flips, a patch reloads the
// list, a search narrows. A selection holding ids that are no longer on screen is a
// number about nothing, and acting on it acts on things nobody could check.
//
// The bin makes that recoverable. It does not make it honest.
//
// ---- and the mode, which is a SECOND question (1.11.2) ----------------------
//
// `open` is whether the mode is running; `count` is how much is picked in it. They
// were one boolean, and three of the cases in this file used to assert the
// consequence: emptying the selection left the mode, which tore the bar off the
// screen mid-task and left the tick lit on the card that had been long-pressed.
//
// Those cases are still here, inverted, because the inversion is the fix and a
// test that quietly stopped asserting either way would be worse than both.
describe('selection', () => {
  const ids = (n) => Array.from({ length: n }, (_, i) => i + 1)

  describe('the count cannot lie', () => {
    it('drops ids that leave the visible list', () => {
      // A filter change is the case: thirty quotes selected, switch the colour, and
      // the ones that are gone must go with it.
      const { result, rerender } = renderHook(({ list }) => useSelection(list), {
        initialProps: { list: [1, 2, 3, 4] },
      })
      act(() => result.current.toggle(2, 'quote'))
      act(() => result.current.toggle(4, 'quote'))
      expect(result.current.count).toBe(2)
      rerender({ list: [1, 2, 3] }) // 4 filtered away
      expect(result.current.ids).toEqual([2])
    })

  })
})

// theme.js's label resolution — the auto | on | off preference collapsing to
// the concrete data-labels attribute that index.css reads.
//
// This is worth testing rather than eyeballing because every wrong answer is
// silent. Get it backwards and the app still renders: desktop just shows glyphs
// with no words, or a phone shows a row of labelled buttons that overflow off
// the edge. Nothing throws, and neither is visible in a screenshot of the state
// you happened to be in.
//
// theme.js captures matchMedia at MODULE scope, so the viewport has to be
// decided before the import. Every case therefore resets the module registry
// and imports a fresh copy.
describe('labels', async () => {
// installMatchMedia swaps in a matchMedia whose answer depends on the query,
// and hands back the listener registry so a test can fire a viewport change.
// The default setup-dom shim answers `false` to everything, which would make
// the narrow cases untestable — and untestably wrong, since "false to
// everything" is exactly the desktop answer.
function installMatchMedia(narrow) {
  const listeners = new Map()
  window.matchMedia = (media) => ({
    // A getter, not a value. A real MediaQueryList updates .matches live, and
    // theme.js holds ONE object from import time and re-reads it on every
    // change event — so a frozen boolean here would make the listener look
    // broken when it is fine.
    get matches() {
      return media.includes('max-width') ? narrow : false
    },
    media,
    onchange: null,
    addEventListener(_type, fn) {
      if (!listeners.has(media)) listeners.set(media, [])
      listeners.get(media).push(fn)
    },
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
  return {
    // resize() re-answers the width query and fires the change listeners, the
    // way a browser does when a window is dragged across the breakpoint.
    resize(nowNarrow) {
      narrow = nowNarrow
      for (const [media, fns] of listeners) {
        if (media.includes('max-width')) fns.forEach((fn) => fn({ matches: nowNarrow, media }))
      }
    },
  }
}

async function loadTheme({ narrow = false } = {}) {
  vi.resetModules()
  const mm = installMatchMedia(narrow)
  const mod = await import('../../src/theme.js')
  return { ...mod, ...mm }
}

const labels = () => document.documentElement.dataset.labels

beforeEach(() => {
  document.documentElement.removeAttribute('data-labels')
})

afterEach(() => {
  vi.resetModules()
})

describe('applyLabels', () => {

  // One test over all five preference × viewport pairs rather than five: the
  // body was identical per row — load a fresh theme at that width, apply that
  // preference, read the attribute back — and only the three values varied.
  // Every case is still an iteration under its own name, and comparing the
  // collected answers in one go names EVERY wrong pair at once rather than
  // stopping at the first.
  const CASES = [
    { name: "shows labels on a desktop width under 'auto'", narrow: false, pref: 'auto', want: 'on' },
    { name: "hides labels under the mobile breakpoint under 'auto'", narrow: true, pref: 'auto', want: 'off' },
    { name: "'off' wins on a desktop width", narrow: false, pref: 'off', want: 'off' },
    // The explicit preference has to beat the breakpoint in BOTH directions, or
    // the setting is only half a setting.
    { name: "'on' wins under the mobile breakpoint", narrow: true, pref: 'on', want: 'on' },
    { name: 'treats an unrecognised preference as auto', narrow: true, pref: 'yes please', want: 'off' },
  ]

  it('resolves every preference against the viewport', async () => {
    const got = []
    for (const { name, narrow, pref } of CASES) {
      // A fresh loadTheme per row, exactly as each it() did: theme.js captures
      // matchMedia at module scope, so the viewport has to be re-established
      // before the import for every case. Clearing the attribute first means a
      // row cannot pass by inheriting the previous row's answer.
      document.documentElement.removeAttribute('data-labels')
      const { applyLabels } = await loadTheme({ narrow })
      applyLabels(pref)
      got.push([name, labels()])
    }
    expect(got).toEqual(CASES.map(({ name, want }) => [name, want]))
  })
})

// ---- the Settings control ------------------------------------------------
//
// Everything above tests theme.js in isolation. This tests the half that
// actually has to agree with it: the control writes a value, boot reads it back.
//
// The specific trap is JSON. applyLabels() does JSON.parse on the stored string
// and swallows the throw, so a control that wrote a bare `off` instead of `"off"`
// would look correct in Settings, apply correctly for that session, and silently
// revert to auto on the next reload. Nothing errors, and the only symptom is a
// preference that will not stick.
})

// THE SWITCH AND THE OPERATING SYSTEM RESOLVE TO ONE STATE.
//
// docs/plans/access.md names this as the thing to get right and says why: "Two
// independent sources for one visual property is the drift this repo keeps
// writing about." A reader's Settings choice and their machine's
// `prefers-contrast` both answer the same question, so they are answered ONCE,
// in applyContrastNow, before any rule is consulted.
//
// WHAT WOULD GO WRONG WITHOUT IT is not subtle: index.css would carry the
// twenty-three-selector texture block twice, once behind a media query and once
// behind the attribute, and the two copies would drift the way every pair of
// copies in this repo has. The stylesheet already has that lesson written into
// the same block — it shipped in the wrong layer once and did nothing at all.
//
// THE MODULE CAPTURES ITS MediaQueryList AT IMPORT, so each case re-imports
// theme.js against a freshly stubbed matchMedia. Setting the stub after the
// import would change nothing and the case would pass for the wrong reason.
describe('contrast resolves once', () => {
// A machine that either asks for more contrast or says nothing at all. Both
// queries are answered together because index.css asked for both together —
// `prefers-contrast: more` and `prefers-reduced-transparency: reduce` are two
// ways of saying the same thing and the app treats them as one.
function osSays(more) {
  window.matchMedia = (media) => ({
    matches: more && (media.includes('prefers-contrast') ||
      media.includes('prefers-reduced-transparency')),
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}

async function freshTheme(osMore) {
  vi.resetModules()
  osSays(osMore)
  return import('../../src/theme.js')
}

const resolved = () => document.documentElement.dataset.contrast
const raw = () => document.documentElement.dataset.contrastMode

describe('contrast resolves the reader and the machine into one answer', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.contrast
    delete document.documentElement.dataset.contrastMode
  })

  // THE CASE THE PLAN NAMES: "auto + OS-more equals explicit more".
  it('auto on a machine asking for more contrast is the same as choosing more', async () => {
    const auto = await freshTheme(true)
    auto.applyContrast('auto')
    const viaOS = resolved()

    const chosen = await freshTheme(false)
    chosen.applyContrast('more')
    expect(viaOS, 'the OS route and the switch route must land on one value').toBe(resolved())
    expect(resolved()).toBe('more')
  })

})
})

// Choosing a material set has to change what the surfaces are made of.
//
// THE FAILURE MODE IS SILENCE, WHICH IS WHY THIS EXISTS. The set is stored, validated
// on the server, carried across an upgrade by a one-time pass, drawn as seven
// specimens in Settings and written onto <html> — and every one of those can work
// perfectly while the app looks identical, because the only thing that finally matters
// is whether a different tile lands on the page. A preference nothing consumes is a
// setting that appears to work: it saves, it reloads, its card shows a tick, and
// nothing on screen is different. That is the shape this file guards against.
//
// It asserts the resolved custom properties rather than any selector, because the
// stylesheet deliberately no longer knows a material's name — index.css says
// `background-image: var(--tile-card)` and theme.js decides what --tile-card is. So
// the contract between them IS the property, and the property is what gets tested.
describe('material sets', () => {
  const root = () => document.documentElement
  const prop = (name) => root().style.getPropertyValue(name).trim()

  describe('a slot can be overridden off the set', () => {
    // WHY OVERRIDES EXIST AT ALL: two tiles in src/textures/ are named by no set —
    // glass-soft, and whatever a later pack adds — so without a per-slot choice they
    // are files nobody can ever see. And a reader who wants Manuscript with a stone
    // floor has nowhere else to say so.
    it('replaces one material and leaves the other three', () => {
      applyTheme({ materialSet: 'manuscript', theme: 'light', tileGround: 'sandstone' })
      expect(prop('--tile-ground')).toBe('var(--tile-sandstone)')
      expect(prop('--tile-shell')).toBe('var(--tile-paper)')
      expect(prop('--tile-card')).toBe('var(--tile-paper)')
      expect(prop('--tile-cover')).toBe('var(--tile-wood)')
    })
  })
})
