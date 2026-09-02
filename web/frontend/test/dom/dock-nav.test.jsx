// THE DOCK'S LAST TWO SEATS, FROM THE SHELL'S SIDE.
//
// Two rules the owner set, and both are the shell's rather than any screen's:
//
//   "on library, catalogue, replace the phone hamburger menu export with the
//    navigate menu you have made for home (it should be in that same position)."
//
//   "for locations that do not have context menu, just use the home context menu
//    in mobile."
//
// So a board asks for the nav seat by name and the shell fills it, and a screen
// that asks for nothing gets the shell's own two rather than two blanks.
//
// WHY THIS IS NOT IN shell-mount.test.jsx, which is the other file that mounts
// the Shell: its mock refuses every request on purpose, so a screen never gets
// far enough to publish anything and the dock always shows the fallback. Both
// assertions here would pass under it whether or not the code did anything —
// which is exactly what happened when they were written there, and what the
// mutation run caught. This file answers /books, so the Library actually
// publishes its keys and the substitution has something to substitute.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    // ONE BOOK, NOT NONE. An empty Library draws its first-run screen instead of
    // the board, and that screen has no filters and publishes no keys — so an
    // empty fixture would test the fallback twice and the substitution never.
    if (method === 'GET' && path === '/books') {
      return { ok: true, status: 200, data: { books: [{ id: 1, title: 'Moby-Dick', author: 'Melville', annotation_count: 2 }] } }
    }
    if (method === 'GET' && path === '/tags') return { ok: true, status: 200, data: { tags: [] } }
    return { ok: false, status: 500, error: 'refused by the mock' }
  }),
  downloadPost: vi.fn(async () => ({ ok: false, status: 500, error: 'refused by the mock' })),
}))

// The shell reads the route off the URL, and jsdom keeps one history for the
// whole file — so a case that navigated to the Library hands the next one a shell
// that boots there, with the Library's own keys already in the dock and the seat
// this file presses meaning something else entirely.
beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

const USER = { id: 1, username: 'reader', is_admin: false, preferences: {} }
const noop = () => {}

const asPhone = () => {
  window.matchMedia = (media) => ({
    matches: true, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}

const mount = async () => {
  asPhone()
  const { Shell } = await import('../../src/App.jsx')
  // The screens under here fetch on mount and the mock refuses most of it; the
  // console noise is the point of the mock, not a fault to report.
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(<Shell user={USER} onLogout={noop} onPreferences={noop} onUser={noop} />)
  } finally {
    quiet.mockRestore()
  }
  await waitFor(() => expect(dock()).toBeTruthy())
}

const dock = () => [...document.querySelectorAll('.mobile-dock button')]
const screenNow = () => document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label')
const menuRows = () => [...document.querySelectorAll('[role=menu] [role=menuitem]')]

// Travel the way a thumb does: through the dock's own boards key.
const goVia = async (seat, rowText) => {
  fireEvent.click(dock()[seat])
  const row = await waitFor(() => {
    const r = menuRows().find((el) => rowText.test(el.textContent))
    expect(r, `no row matching ${rowText} in the menu`).toBeTruthy()
    return r
  })
  fireEvent.click(row)
  // The screens are lazy chunks, so the label arrives a tick after the tab does.
  await waitFor(() => expect(screenNow()).toBeTruthy(), { timeout: 8000 })
}

// The dock's labels, once they have settled. A screen publishes its keys from an
// effect, so the label lands one flush AFTER the screen itself — reading the dock
// the moment the screen appears reads the seats the screen replaced.
const settledDock = async (want) => {
  await waitFor(() => {
    const labels = dock().map((b) => b.getAttribute('aria-label') || '')
    expect(labels.join(' | ')).toMatch(want)
    return labels
  }, { timeout: 8000 })
  return dock()
}

describe('a board asks for the nav seat and the shell fills it', () => {
  it('gives the Library filter, then the way to the other boards', async () => {
    await mount()
    await waitFor(() => expect(dock()).toHaveLength(5))
    await goVia(3, /^Library$/)
    expect(screenNow(), 'never reached the Library').toBe('library')

    // Seat four is the screen's own filter; seat five is what it asked for by
    // name and could not have built — only the shell knows which sections are
    // switched on and only the shell can change tab.
    const keys = await settledDock(/filter/i)
    expect(keys).toHaveLength(5)
    expect(keys[3].getAttribute('aria-label')).toMatch(/filter/i)
    expect(keys[4].getAttribute('aria-label'), 'the nav placeholder reached the dock unswapped').toMatch(/boards/i)
    expect(keys[4].getAttribute('aria-haspopup')).toBe('menu')

    // And it opens the boards, not a dead control.
    fireEvent.click(keys[4])
    await waitFor(() => expect(menuRows().length).toBeGreaterThan(1))
    expect(menuRows().map((r) => r.textContent).join(' ')).toMatch(/Catalogue/)
  })

  it('no longer spends that seat on Export, which is in the screen’s own ⋯', async () => {
    await mount()
    await waitFor(() => expect(dock()).toHaveLength(5))
    await goVia(3, /^Library$/)
    const labels = (await settledDock(/filter/i)).map((b) => b.getAttribute('aria-label') || '').join(' | ')
    expect(labels).not.toMatch(/export/i)
  })
})

describe('a screen with nothing of its own', () => {
  it('gets the shell’s two keys rather than two blanks', async () => {
    await mount()
    await waitFor(() => expect(dock()).toHaveLength(5))
    // REACHED BY PRESSING, not by booting the shell at /settings. Setting the URL
    // first and mounting looks like the shorter road and does not hold: a popstate
    // lands a few hundred milliseconds later, the shell restores the route from a
    // null history state, and the screen is back on Home before any assertion runs
    // — a drift that makes the case pass whatever the shell does with the seats.
    //
    // Settings publishes its two verbs for an ADMIN only, and this reader is not
    // one — so it publishes nothing, which is exactly the case the rule is about.
    await goVia(4, /^Settings$/)

    // BOTH FACTS AT ONCE, and that is the point of the shape. Read separately,
    // "the dock has five seats" is satisfied by a shell that has wandered back to
    // Home — where the two seats are never in question — and the case passes
    // having tested nothing. On Settings the shell either fills them or it does
    // not, so the screen and the count have to be true in the same breath.
    const keys = await waitFor(() => {
      expect(screenNow(), 'never reached Settings').toBe('settings')
      const k = dock()
      expect(k, 'the shell left the two seats to a screen that has no keys').toHaveLength(5)
      return k
    }, { timeout: 8000 })

    expect(keys[3].getAttribute('aria-label'), 'seat four went blank off Home').toMatch(/boards/i)
    expect(keys[4].getAttribute('aria-label'), 'seat five went blank off Home').toMatch(/tools/i)
    expect(keys[3].getAttribute('aria-haspopup')).toBe('menu')
    expect(keys[4].getAttribute('aria-haspopup')).toBe('menu')
  })
})
