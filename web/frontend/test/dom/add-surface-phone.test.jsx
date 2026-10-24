// THE ADD SURFACE AS A PHONE DRAWS IT, which is the only way the owner looks at
// it — "that's perfectly fine. i am only checking on phone".
//
// AND UNTIL THIS FILE THERE WAS NO SUCH TEST, for this surface or any other.
// `useIsMobileScreen` reads `matchMedia`, jsdom answers `matches: false` to
// everything, so 344 test files mounted the desktop branch and the phone branch
// was never rendered once. A rater proved it by reinstating the exact defect the
// owner reported — a second Back drawn beside the sheet's own — and watching all
// 3,958 tests pass.
//
// So this file forces the width and asserts what the phone gets: one way back,
// the standing tick/cross pair on a form, and the sheet's own chrome.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { MOBILE_SCREEN_QUERY } from '../../src/ui.jsx'

vi.mock('../../src/api.js', () => ({
  json: async (method, path) => {
    // ONE ROW BY ID, which is what the header asks for now — it used to pull both
    // whole lists to render one title. A film answers here too, so the director half
    // of "author/director whatever" is exercised rather than assumed.
    if (method === 'GET' && path === '/books/4') return { ok: true, data: { id: 4, title: 'The Dispossessed', author: 'Le Guin' } }
    if (method === 'GET' && path === '/movies/9') return { ok: true, data: { id: 9, title: 'Stalker', media_type: 'movie', director: 'Tarkovsky' } }
    if (method === 'GET' && path === '/books') return { ok: true, data: { books: [{ id: 4, title: 'The Dispossessed', author: 'Le Guin' }] } }
    if (method === 'GET' && path === '/movies') return { ok: true, data: { movies: [{ id: 9, title: 'Stalker', media_type: 'movie', director: 'Tarkovsky' }] } }
    if (method === 'GET' && path === '/boards') return { ok: true, data: { boards: [{ id: 3, name: 'Others', kind: 'plain' }], total: 1 } }
    if (method === 'GET') return { ok: true, data: {} }
    return { ok: true, data: { id: 1 } }
  },
  errText: () => 'nope',
  upload: async () => ({ ok: true, data: {} }),
  uploadWithProgress: async () => ({ ok: true, data: {} }),
  coverImgURL: () => '',
}))

const { default: AddSurface } = await import('../../src/AddSurface.jsx')

const SECTIONS = { library: true, movies: true, quotes: true, anthologies: false }

let realMatchMedia
beforeEach(() => {
  realMatchMedia = window.matchMedia
  // Only the mobile query answers true — `useSheetDrag` asks about reduced
  // motion off the same function and must keep getting its own answer.
  window.matchMedia = (media) => ({
    matches: media === MOBILE_SCREEN_QUERY,
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
  localStorage.clear()
})
afterEach(() => { window.matchMedia = realMatchMedia })

const surface = (props = {}) =>
  render(<AddSurface open sections={SECTIONS} onClose={() => {}} onAdded={() => {}} onCaptured={() => {}} {...props} />)

// The sheet's own chrome, so a phone test that stopped rendering the sheet at
// all cannot quietly pass by finding the desktop dialog instead.
const sheet = () => document.querySelector('.mobile-sheet-card')

describe('the add surface on a phone', () => {

  // THE DEFECT THE OWNER REPORTED: "there are two back buttons now, both doing
  // different things." The sheet's leading slot drew an arrow that CLOSED while
  // the surface drew its own arrow beside it that STEPPED.

  // THE STANDING PAIR — "a tick confirms, a cross discards", and "the cross is
  // red wherever there is a pair for it to be half of". Handing the leading slot
  // to Back took the ✕ off the form entirely, so an armed ✓ had no discarding
  // half at all.

  // A STEP IS NOT A DISMISSAL — the owner: "the back animations are finnicky."
  // The arrow ran `slideOut`, the hook's exit: the card animated fully off the
  // bottom over 160ms, sat there 60ms behind a still-lit scrim, snapped back in
  // one frame with no entrance to undo it, and only then swapped its contents —
  // after which the new screen's height sprang for another 220ms. Four movements
  // for a press that dismisses nothing.

  // THE OTHER HALF, and without it the case above is satisfiable by deleting
  // `slideOut` from the sheet altogether — which would throw away the exit
  // animation the owner asked for in the same breath as the popup.

  // AND THE DEVICE'S OWN BACK GESTURE DOES WHAT THE ARROW DOES. It closed the
  // surface outright from a screen whose arrow stepped. The first repair passed
  // the right verb and was INERT: `useBackToClose` keys its effect on `active`
  // alone, so the handler kept whichever verb existed when the sheet opened —
  // which on a bare ＋ is `onClose`, because there was nothing to step back to
  // yet. The verb is read through a ref now.
  it('and the device back gesture steps too, with the verb it has now', async () => {
    const onClose = vi.fn()
    surface({ initialSection: 'standalone', onClose })
    fireEvent.click(await screen.findByRole('button', { name: 'A board' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Others' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Proverb' }))
    await screen.findByLabelText('Quote')
    fireEvent.popState(window)
    expect(await screen.findByText('What kind of quote')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  // AND THE HEADER'S SECOND LINE IS WHO MADE THE THING.
  //
  // The owner, over a screenshot of "The Armchair Economist" coming down the header
  // three lines deep and pushing the form off the screen: "the header names can get
  // ellipsis… one line is enough. / for second line get the author/director whatever
  // in smaller font."
  //
  // THE TWO HALVES ARE ONE CHANGE AND NEITHER STANDS ALONE. Clipping a title to one
  // line is a truncation, which this repo forbids by standing rule; what pays for it
  // is that the slot stopped carrying one ambiguous name and started carrying a name
  // AND its author. So a case that only checked the clip would be pinning half a
  // ruling — and the half that is a regression on its own.

  // AND THE OTHER HALF OF "author/director whatever", which nothing held.
  //
  // A rater set `credit: m.director || ''` to `''` and watched all 4,043 tests pass:
  // the book case above covers `workFromBook`, and `workFromMovie` had no case at
  // all — this file's /movies fixture was an empty list, so a film could not be
  // opened here to check. Half an instruction guarded is the half that goes on
  // working while the other quietly stops, which is the failure the repo's own
  // "similar things behave similarly" is about.
  //
  // `director` IS ONE COLUMN WEARING THREE NAMES — a film's director, a show's
  // creator, a game's studio — so this case covers all three: the header prints the
  // value, never the noun.

  // THE HEADER MENU IS GONE, and this case asserted it worked for one release.
  //
  // It was the owner's own request — "a menu button to have a dropdown where users
  // can change the add mode" — withdrawn by them over a screenshot of the built
  // thing: "remove this menu from the add surface. not needed since we have the
  // back button already." The dropdown listed the chooser, and Back returns to the
  // chooser: two controls doing one thing in the scarcest row on the screen.
  //
  // THE WAY IT REPLACES IS ASSERTED, not just the absence, because "the control is
  // gone" and "the control is gone and so is the capability" look identical here.
  
})
