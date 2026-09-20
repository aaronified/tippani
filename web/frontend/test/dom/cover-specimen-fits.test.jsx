// The cover specimen draws as many covers as the room holds, and finds out how
// much room there is.
//
// THERE IS A JOURNEY OVER THIS TOO, AND THE REASON FIRST GIVEN FOR THERE NOT
// BEING ONE WAS WRONG. This header said: the specimen is `aria-hidden`, a journey
// sees the accessibility tree, so there is nothing there to assert. The first half
// is true; the second is not. `see` and `gone` poll `document.body.innerText`
// (test/journeys/harness/screen.mjs), and `aria-hidden` hides an element from
// assistive technology without taking its text out of the rendering — the sample
// prints each work's title, so it was reachable all along.
// `sizing-a-cover-on-a-phone.journey.mjs` and a case in
// `putting-a-section-first.journey.mjs` cover the counts at 390 and 1280.
//
// WHAT IS LEFT FOR THIS FILE is the part a browser cannot be made to show on
// demand: that the component measures AFTER its works arrive, measures AGAIN when
// its box changes, and reads the gap off the element. A journey can see the count
// at the two widths the harness runs; it cannot resize a box mid-test or make the
// shelf arrive late.
//
// WHY NOT THE PURE TEST EITHER. `test/pure/cover-fit.test.js` owns the arithmetic
// — a width, a size and a gap in, a count out — and it passed for the version of
// this component that drew ONE cover on a 954px desk. The defect was in the
// WIRING: a `useRef` plus an empty-dependency `useEffect` never attached, because
// the shelf arrives over the network so the first render has no works and returns
// null, by which time the effect had run and found the ref empty. The measured
// room stayed 0 for ever. That is what this file holds: that the component asks
// for its own width AFTER the works arrive, asks again when the box changes, and
// reads its gap from the element rather than a number typed beside it.
//
// DECLARED EXCEPTION, per this directory's rule. It knows two module paths
// (`Settings.jsx`, `api.js`) the way every file in test/dom does, and it reaches
// for `.cover-specimen-cell` — a class — to count the cells. Nothing observable
// can serve: the cells carry no accessible name by design, which is the first
// paragraph. It stubs `ResizeObserver` and `getBoundingClientRect` because jsdom
// has no layout at all, so a width has to be supplied for there to be anything to
// measure; the real measurements at 1280 and 390 are recorded in the commit that
// added the behaviour.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

const BOOKS = [
  { id: 1, title: 'Moby-Dick', author: 'Melville', cover_path: '' },
  { id: 2, title: 'Dracula', author: 'Stoker', cover_path: '' },
  { id: 3, title: 'Walden', author: 'Thoreau', cover_path: '' },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'PUT') return { ok: true, data: { ok: true } }
    if (path.startsWith('/books')) return { ok: true, data: { books: BOOKS } }
    if (path.startsWith('/movies')) return { ok: true, data: { movies: [] } }
    if (path === '/fonts') return { ok: true, data: { fonts: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

// THE ROOM THE STUB REPORTS, and a hook to change it mid-test the way a rotation
// or a column change would.
let ROOM = 0
let OBSERVERS = []

beforeEach(() => {
  ROOM = 0
  OBSERVERS = []
  window.ResizeObserver = class {
    constructor(cb) { this.cb = cb; OBSERVERS.push(this) }
    observe() {}
    disconnect() {}
  }
  // Only the specimen's own box is given a width; everything else keeps jsdom's
  // zeroes, so nothing else in Settings starts believing it has been laid out.
  Element.prototype.getBoundingClientRect = function () {
    const w = this.classList?.contains('cover-specimen') ? ROOM : 0
    return { width: w, height: 0, top: 0, left: 0, right: w, bottom: 0, x: 0, y: 0, toJSON() {} }
  }
  const real = window.getComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
    const cs = real(el)
    if (el.classList?.contains('cover-specimen')) {
      return new Proxy(cs, { get: (o, k) => (k === 'columnGap' ? '14px' : Reflect.get(o, k)) })
    }
    return cs
  })
})

afterEach(() => { vi.restoreAllMocks() })

const openSections = async () => {
  render(
    <Settings
      user={{ username: 'a', is_admin: false, preferences: {} }}
      onPreferences={() => {}}
      update={null}
      onUpdateInfo={() => {}}
      onStartTour={() => {}}
      onOpenBin={() => {}}
    />,
  )
  await openSettingsSection('Sections')
}

const cellsIn = () => {
  const sp = document.querySelector('.cover-specimen')
  return sp ? sp.querySelectorAll('.cover-specimen-cell').length : 0
}

describe('the cover specimen', () => {
  // THE DEFECT ITSELF. The works arrive after the first render, so a component
  // that measures only on mount measures nothing — and this is the case that
  // caught it: plenty of room, and it drew one.
  it('measures its room after the shelf arrives, not only on the first render', async () => {
    ROOM = 954
    await openSections()
    await waitFor(() => expect(cellsIn()).toBe(3))
  })

  // And the owner's own case: a phone column, where three is wrong.
  it('draws fewer when the room is a phone column', async () => {
    ROOM = 316
    await openSections()
    await waitFor(() => expect(document.querySelector('.cover-specimen')).toBeTruthy())
    // 165 default + 14 gap: one fits 316, two would need 344.
    await waitFor(() => expect(cellsIn()).toBe(1))
  })

  // THE CASE THAT MAKES THE GAP READ LOAD-BEARING. Without one, mutating the
  // component's `getComputedStyle(el).columnGap` to a flat 0 left every case in
  // this file green — the fix was untested by the suite that was written for it.
  // Two 165px cells cost 344 with the 14px gap and 330 without, so a 335px column
  // holds one if the gap was read and two if it was not.
  it('counts the gap it reads off the element, not one it assumed', async () => {
    ROOM = 335
    await openSections()
    await waitFor(() => expect(document.querySelector('.cover-specimen')).toBeTruthy())
    await waitFor(() => expect(cellsIn()).toBe(1))
  })

  // AND A SIZE STORED BEFORE THE SLIDER HAD A STEP IS PUT ON THE LADDER.
  //
  // THE PURE TEST IS NOT ENOUGH FOR THIS, which is the same gap this file already
  // exists to close once: `coverSizeOnLadder` has its own cases in
  // test/pure/cover-fit.test.js, and removing the call to it from `useCoverSize`
  // leaves every one of them green. What has to be pinned is that the HOOK asks.
  // A reader with 123 in storage otherwise sees a handle snapped to 125 by the
  // browser and a readout still saying 123, with no press to blame it on.
  it('puts a size stored before the slider had a step onto the ladder', async () => {
    localStorage.setItem('tippani:size:books', '123')
    ROOM = 954
    await openSections()
    await waitFor(() => expect(screen.getByText('125px')).toBeTruthy())
    expect(screen.queryByText('123px'), 'the readout kept an off-ladder size').toBeNull()
    localStorage.removeItem('tippani:size:books')
  })

  // AND IT ASKS AGAIN WHEN THE BOX CHANGES. The observer is the half a one-shot
  // measurement would miss — a rotation, a column appearing, the panel resizing.
  it('re-counts when its box changes size', async () => {
    ROOM = 316
    await openSections()
    await waitFor(() => expect(cellsIn()).toBe(1))
    ROOM = 954
    OBSERVERS.forEach((o) => o.cb())
    await waitFor(() => expect(cellsIn()).toBe(3))
  })
})
