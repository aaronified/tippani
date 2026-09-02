// The logged-in shell mounts, and its two phone bars carry what they promise.
//
// NOTHING RENDERED Shell UNTIL THIS FILE. screens-mount.test.jsx covers every
// screen App can route to and the shell is not one of them — it is the frame
// they mount inside — so a shell that threw would take every screen with it and
// no test would say a word. That is not hypothetical: `checkCount` was passed to
// the Drawer as a bare identifier that existed nowhere, the whole app rendered
// its error boundary instead of a page, and the only thing that noticed was a
// screenshot run timing out on a selector fifteen seconds later.
//
// It is deliberately shallow, like screens-mount: that the frame can be put on a
// page, and that the pieces a reader depends on to get anywhere are in it.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor, within } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: false, status: 500, error: 'refused by the mock' })),
  downloadPost: vi.fn(async () => ({ ok: false, status: 500, error: 'refused by the mock' })),
}))

const USER = { id: 1, username: 'aaron', display_name: 'Aaron', is_admin: true, preferences: {}, version: '1.0.0' }
const noop = () => {}

const mount = async () => {
  const { Shell } = await import('../../src/App.jsx')
  // React logs a component stack before rethrowing, which is noise in a suite
  // log for a test that is expected to pass.
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(<Shell user={USER} onLogout={noop} onPreferences={noop} onUser={noop} />)
  } finally {
    quiet.mockRestore()
  }
}

describe('the logged-in shell', () => {
  it('mounts', async () => {
    await mount()
    // The error boundary renders IN PLACE OF the frame, so the frame's own
    // landmark is the proof this is the frame and not the apology for one.
    expect(document.querySelector('.rail')).toBeTruthy()
  })

  it('draws the phone header as a header — the drawer, a title, and the ⋯', async () => {
    await mount()
    const bar = document.querySelector('.mobile-topbar')
    expect(bar, 'no phone header').toBeTruthy()
    expect(bar.querySelector('.mobile-topbar-title')).toBeTruthy()
    // EXACTLY TWO, and the number is the guard. The four glyphs this bar used to
    // carry went to the dock and the drawer, and the room they freed is what the
    // title and its sub-line are made of — so a verb creeping back up here is
    // still the regression. The ⋯ is not a verb: it is the one door to every verb,
    // which is why it costs one seat instead of five.
    const keys = within(bar).getAllByRole('button')
    expect(keys).toHaveLength(2)
    expect(keys[1].getAttribute('aria-haspopup')).toBe('menu')
  })

  it('draws the dock, with the accent ＋ in the middle seat', async () => {
    await mount()
    const dock = document.querySelector('.mobile-dock')
    expect(dock, 'no dock').toBeTruthy()
    const keys = [...dock.querySelectorAll('button')]
    // Back and search are the persistent pair and sit leftmost — they mean the
    // same thing on every screen, so they never move — and ＋ is the middle one
    // of five, which is arithmetic rather than a preference.
    expect(keys.length).toBeGreaterThanOrEqual(3)
    expect(keys[2].className).toContain('is-accent')
  })

  it('draws Back even where it is dead, so search never changes seat', async () => {
    await mount()
    const keys = [...document.querySelectorAll('.mobile-dock button')]
    // Nothing behind it on the first screen of a session: disabled, not absent.
    // Dropping it would slide Search into the seat it holds everywhere else.
    expect(keys[0].disabled).toBe(true)
  })

  // ── THE WAY BACK UP. A work with 128 quotes is a long way down and a phone has
  // no scrollbar to drag and no Home key to press.
  describe('the back-to-top key', () => {
    // The key is drawn at every width and hidden by CSS above the breakpoint, as
    // the dock is — but its scroll listener is gated on the viewport, so these
    // have to be on a phone to arm it.
    const asPhone = () => {
      window.matchMedia = (media) => ({
        matches: /max-width/.test(media), media, onchange: null,
        addEventListener() {}, removeEventListener() {},
        addListener() {}, removeListener() {}, dispatchEvent: () => false,
      })
    }
    const key = () => document.querySelector('.to-top')
    const scrollTo = (y, height) => {
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: height, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
      window.scrollY = y
      fireEvent.scroll(window)
    }

    it('is drawn but away until there is a way back worth offering', async () => {
      asPhone()
      await mount()
      expect(key(), 'no key in the tree').toBeTruthy()
      // Away, not absent: opacity and pointer-events, so nothing can tab into a
      // key that is not on screen.
      expect(key().className).not.toContain('is-on')
      expect(key().tabIndex).toBe(-1)
    })

    it('arrives a quarter of the way down a long page', async () => {
      asPhone()
      await mount()
      // 8000 − 800 = 7200 of travel; a quarter is 1800.
      scrollTo(2000, 8000)
      await waitFor(() => expect(key().className).toContain('is-on'))
      expect(key().tabIndex).toBe(0)
    })

    // THE TWO NEGATIVES ARE ASSERTED AS TRANSITIONS, armed first and then
    // watched to go away. A waitFor on a negative is satisfied by the frame
    // before the measurement lands, so it would pass against any rule at all.
    it('leaves again on a page with nothing to come back from', async () => {
      asPhone()
      await mount()
      scrollTo(2000, 8000)
      await waitFor(() => expect(key().className).toContain('is-on'))
      // MEASURED AGAINST THE SCROLLABLE DISTANCE, not a pixel count: what makes
      // a page long is how far there is to come back, so a short book never
      // grows the key however far down it you are. 1000 − 800 is 200 of travel.
      scrollTo(150, 1000)
      await waitFor(() => expect(key().className).not.toContain('is-on'))
    })

    it('holds off inside the first thumb-length of a barely-scrollable page', async () => {
      asPhone()
      await mount()
      scrollTo(2000, 8000)
      await waitFor(() => expect(key().className).toContain('is-on'))
      // 1400 − 800 = 600 of travel, so a quarter is 150 — under the 200 floor.
      // Without that floor a page you can barely scroll arms the key in its
      // first thumb-length, which is where it is least use and most in the way.
      scrollTo(170, 1400)
      await waitFor(() => expect(key().className).not.toContain('is-on'))
      // And it does arrive once you are past the floor on that same page.
      scrollTo(240, 1400)
      await waitFor(() => expect(key().className).toContain('is-on'))
    })

    it('drops into the dock’s place when the dock leaves', async () => {
      asPhone()
      await mount()
      // "So the corner never holds two things and never sits empty."
      expect(key().getAttribute('data-dock')).toBe('here')
    })
  })

  it('has no hairline after the ＋', async () => {
    await mount()
    // The accent key already separates the shell's fixed seats from the screen's;
    // a divider beside something that loud is a second one doing the first's job.
    expect(document.querySelector('.mobile-dock-rule')).toBeNull()
  })

  // ── HOME'S TWO SEATS. Home publishes none of its own and is where a session
  // starts, so the dock's last two are the shell's: the boards, and the tools.
  describe('the dock on Home', () => {
    const dockKeys = () => [...document.querySelectorAll('.mobile-dock button')]

    it('fills both screen seats, because Home publishes neither', async () => {
      await mount()
      const keys = dockKeys()
      expect(keys).toHaveLength(5)
      // Back, search, ＋ , then the two that open lists.
      expect(keys[3].getAttribute('aria-haspopup')).toBe('menu')
      expect(keys[4].getAttribute('aria-haspopup')).toBe('menu')
    })

    it('offers the boards this reader has switched on, and nothing else', async () => {
      await mount()
      const boards = dockKeys()[3]
      expect(boards.getAttribute('aria-label')).toMatch(/boards/i)
      fireEvent.click(boards)
      const rows = [...document.querySelectorAll('[role=menu] [role=menuitem]')].map((el) => el.textContent)
      // The default preference bag: three sections on, anthologies off — so a
      // menu of three, and the one that is off is not in it.
      expect(rows).toHaveLength(3)
      expect(rows.join(' ')).not.toMatch(/antholog/i)
    })

    it('puts the three screens ABOUT the library behind the second key', async () => {
      await mount()
      const tools = dockKeys()[4]
      expect(tools.getAttribute('aria-label')).toMatch(/tools/i)
      fireEvent.click(tools)
      const rows = [...document.querySelectorAll('[role=menu] [role=menuitem]')].map((el) => el.textContent)
      expect(rows).toHaveLength(3)
      // Tags is deliberately not among them — this key is the settings family,
      // and a fourth row would make it "the rest of the drawer" instead.
      expect(rows.join(' ')).not.toMatch(/tags/i)
    })
  })
})
