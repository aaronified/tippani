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
import { render, within } from '@testing-library/react'

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

  it('draws the phone header as a header — the drawer key and a title, no verbs', async () => {
    await mount()
    const bar = document.querySelector('.mobile-topbar')
    expect(bar, 'no phone header').toBeTruthy()
    expect(bar.querySelector('.mobile-topbar-title')).toBeTruthy()
    // The four glyphs it used to carry went to the dock and the drawer. A verb
    // creeping back up here is the regression this guards, because the room they
    // freed is what the title and its sub-line are made of.
    expect(within(bar).getAllByRole('button')).toHaveLength(1)
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
})
