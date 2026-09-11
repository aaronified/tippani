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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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
  it('is a sheet with a grip, not the desktop dialog', async () => {
    surface({ initialSection: 'standalone' })
    await screen.findByRole('button', { name: 'A board' })
    expect(sheet()).toBeTruthy()
    // The grip is what says the sheet moves; `useSheetDrag` reads it as the
    // handle, so its absence is a drag with nothing to start from.
    expect(sheet().querySelector('.tp-sheet-grip')).toBeTruthy()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  // THE DEFECT THE OWNER REPORTED: "there are two back buttons now, both doing
  // different things." The sheet's leading slot drew an arrow that CLOSED while
  // the surface drew its own arrow beside it that STEPPED.
  it('draws exactly one way back, and it steps rather than closing', async () => {
    const onClose = vi.fn()
    surface({ initialSection: 'standalone', onClose })
    fireEvent.click(await screen.findByRole('button', { name: 'A board' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Others' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Proverb' }))
    await screen.findByLabelText('Quote')
    const backs = screen.getAllByLabelText('Back to the list')
    expect(backs).toHaveLength(1)
    fireEvent.click(backs[0])
    // It stepped to the first screen and did NOT take the surface down with it.
    expect(await screen.findByText('What kind of quote')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  // THE STANDING PAIR — "a tick confirms, a cross discards", and "the cross is
  // red wherever there is a pair for it to be half of". Handing the leading slot
  // to Back took the ✕ off the form entirely, so an armed ✓ had no discarding
  // half at all.
  it('keeps the tick and the cross together on the form, with the cross red', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'A board' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Others' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Proverb' }))
    await screen.findByLabelText('Quote')
    const cross = screen.getByLabelText('Close')
    expect(cross).toBeTruthy()
    expect(cross.style.color).toBe('var(--error)')
    // And the arrow is never red: stepping back discards nothing.
    expect(screen.getByLabelText('Back to the list').style.color).toBe('')
  })

  it('draws a plain way out where no form is registered', async () => {
    // The first screen has nothing to save, so its ✕ is a plain exit — painting
    // that one red would warn about closing a list of choices.
    surface({ initialSection: 'standalone' })
    const cross = await screen.findByLabelText('Close')
    expect(cross.style.color).toBe('')
    expect(screen.queryByLabelText('Back to the list')).toBeNull()
  })

  // A STEP IS NOT A DISMISSAL — the owner: "the back animations are finnicky."
  // The arrow ran `slideOut`, the hook's exit: the card animated fully off the
  // bottom over 160ms, sat there 60ms behind a still-lit scrim, snapped back in
  // one frame with no entrance to undo it, and only then swapped its contents —
  // after which the new screen's height sprang for another 220ms. Four movements
  // for a press that dismisses nothing.
  it('steps without animating the sheet away, and does it on the press', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'A board' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Others' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Proverb' }))
    await screen.findByLabelText('Quote')
    fireEvent.click(screen.getByLabelText('Back to the list'))
    // ON THE FRAME OF THE PRESS. `slideOut` defers its verb to a 220ms timer, so
    // asserting the content is already back is what separates the two paths —
    // with the old code this findBy would have to outwait the animation.
    expect(screen.getByText('What kind of quote')).toBeTruthy()
    // And the card never went anywhere: a positive translateY is the exit.
    expect(sheet().style.transform || '').not.toMatch(/translateY\(\s*[1-9]/)
  })

  // THE OTHER HALF, and without it the case above is satisfiable by deleting
  // `slideOut` from the sheet altogether — which would throw away the exit
  // animation the owner asked for in the same breath as the popup.
  it('but a close still slides the sheet away before it goes', async () => {
    const onClose = vi.fn()
    surface({ initialSection: 'standalone', onClose })
    await screen.findByRole('button', { name: 'A board' })
    fireEvent.click(screen.getByLabelText('Close'))
    // The verb waits on the animation; the card is on its way out meanwhile.
    expect(onClose).not.toHaveBeenCalled()
    expect(sheet().style.transform || '').toMatch(/translateY\(\s*[1-9]/)
  })

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
  it('names who made the work under its title', async () => {
    // Straight to the form with the work already chosen, the way a ＋ pressed on a
    // book's own page arrives — which is also the render in the owner's screenshot.
    surface({ initialSection: 'quote', initialTarget: { type: 'book', id: 4 } })
    // TWICE, AND THAT IS THE FIX RATHER THAN AN INCONVENIENCE: the form's own work
    // chip printed it and the header printed an empty string, because an opening
    // target arrives as {type,id} and the header wanted a row. `findByText` throwing
    // on two matches is how this case first noticed.
    const title = await waitFor(() => {
      const el = document.querySelector('.mobile-sheet-title')
      expect(el?.textContent, 'the header does not name the work the ＋ was pressed on').toBe('The Dispossessed')
      return el
    })
    expect(title).toBeTruthy()
    const sub = await waitFor(() => {
      const el = document.querySelector('.mobile-sheet-sub')
      expect(el, 'the header has no second line at all').toBeTruthy()
      return el
    })
    expect(sub.textContent, 'the author is not under the title').toBe('Le Guin')
  })

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
  it('and names who made a film under its title too', async () => {
    surface({ initialSection: 'quote', initialTarget: { type: 'movie', id: 9 } })
    await waitFor(() => {
      const el = document.querySelector('.mobile-sheet-title')
      expect(el?.textContent, 'the header does not name the film the ＋ was pressed on').toBe('Stalker')
    })
    const sub = document.querySelector('.mobile-sheet-sub')
    expect(sub, 'a film gets no second line at all, so only the book half was built').toBeTruthy()
    expect(sub.textContent, 'the director is not under the title').toBe('Tarkovsky')
  })

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
  it('has no mode menu, because Back is the way to the other modes', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'A board' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Others' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Proverb' }))
    await screen.findByLabelText('Quote')
    expect(screen.queryByLabelText('Change what you are adding'), 'the mode menu came back').toBeNull()
    // Back, twice, reaches the chooser the menu used to list.
    fireEvent.click(screen.getByLabelText('Back to the list'))
    // AND THE FIRST SCREEN IS WHERE THE MENU'S ROWS LIVE. It holds step 1 and step
    // 2 together — the modes and, under them, which work or board — so one Back
    // from the form lands on the list the dropdown was a copy of. That is the whole
    // of the owner's "we have the back button already", and asserting the mode is
    // REACHABLE is what keeps this from being a test that only deletes something.
    expect(await screen.findByText('What kind of quote')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Files' }), 'the modes are not on the screen Back returns to').toBeTruthy()
  })
})
