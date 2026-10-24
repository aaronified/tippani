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
import { fireEvent, render } from '@testing-library/react'

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
  // ── HOME'S TWO SEATS. Home publishes none of its own and is where a session
  // starts, so the dock's last two are the shell's: the sections, and the tools.
  describe('the dock on Home', () => {
    const dockKeys = () => [...document.querySelectorAll('.mobile-dock button')]

    it('offers the sections this reader has switched on, and nothing else', async () => {
      await mount()
      const sections = dockKeys()[3]
      expect(sections.getAttribute('aria-label')).toMatch(/sections/i)
      fireEvent.click(sections)
      const rows = [...document.querySelectorAll('[role=menu] [role=menuitem]')].map((el) => el.textContent)
      // The default preference bag: three sections on, anthologies off — so a
      // menu of three, and the one that is off is not in it.
      expect(rows).toHaveLength(3)
      expect(rows.join(' ')).not.toMatch(/antholog/i)
    })

  })
})

