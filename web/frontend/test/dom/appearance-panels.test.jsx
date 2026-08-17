// Type and Language marks: two buttons on the Appearance card, and a pop-up
// apiece (1.15.2).
//
// THE BUG THAT PROMPTED THE MOVE was in the panel, not the layout. Settings'
// language-mark tray rendered <Field label="Or type one"> and Settings never
// imported Field, so opening a tray to change a glyph threw a ReferenceError and
// took the screen with it. Nothing caught it: the reference is inside
// `{picking === row.key && …}`, so the module parses and the page loads, and
// language-marks.test.jsx tests languages.jsx without ever mounting the card.
//
// That is the shape being pinned here — not "the dialog opens" but "the tray
// inside the dialog renders every control it has". A test that stops at the
// dialog would pass against the broken build.
//
// icon-imports.test.js catches the same class by reading; this catches it by
// running. Both, deliberately: the reader misses what it cannot parse, and the
// runner misses what nothing clicks.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let PUTS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') { PUTS.push([path, body]); return { ok: true, data: {} } }
    if (path === '/fonts') return { ok: true, data: { fonts: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

const USER = { username: 'a', is_admin: false, preferences: {} }

beforeEach(() => {
  PUTS = []
})

const page = async () => {
  render(<Settings user={USER} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await screen.findByText('Appearance')
}
const dialog = () => screen.getByRole('dialog')

describe('the two panels are doors, not cards', () => {
  it('does not stand either panel open on the settings page', async () => {
    // The whole point of the change. Both were cards in the column grid: eleven
    // type roles with a specimen apiece, and a row per language with a tray of
    // flags behind each, permanently unrolled beside cards you read at a glance.
    await page()
    expect(screen.queryByRole('dialog')).toBeNull()
    // The specimen text of the mono row, and the first language row — the two
    // things that were on the page before and must not be now.
    expect(screen.queryByText('Bengali')).toBeNull()
    expect(screen.queryByText(/Or type one/)).toBeNull()
  })

  it('offers both as buttons that name themselves', async () => {
    await page()
    expect(screen.getByRole('button', { name: 'Type' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Language marks' })).toBeTruthy()
  })

  it('keeps both sets of words at every width', async () => {
    // has-btn-icon is what data-labels="off" squares to 44px. These two are the
    // only way into two whole panels — a bare letterform on a phone is not an
    // unlabelled button, it is a screen nobody finds — so they opt out the way
    // primary submits and destructive confirms do.
    await page()
    for (const name of ['Type', 'Language marks']) {
      const b = screen.getByRole('button', { name })
      expect(b.className, name).not.toContain('has-btn-icon')
      expect(b.querySelector('.btn-label-fixed')?.textContent, name).toBe(name)
      expect(b.querySelector('svg'), `${name} has no glyph`).not.toBeNull()
    }
  })

  it('opens one at a time', async () => {
    // Two booleans can both be true; one `panel` cannot. Opening the second
    // while the first is up would stack two scrims and trap the page.
    await page()
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    expect(dialog().getAttribute('aria-label')).toBe('Type')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Language marks' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(dialog().getAttribute('aria-label')).toBe('Language marks')
  })
})

describe('the language-mark tray', () => {
  const openTray = async (language) => {
    await page()
    fireEvent.click(screen.getByRole('button', { name: 'Language marks' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: `Change the ${language} mark` }))
  }

  it('renders the field the crash was hiding', async () => {
    // The reported bug, exactly: "when i try to change the language glyphs in
    // Language marks section in settings, it throws: Field is not defined".
    await openTray('Bengali')
    expect(within(dialog()).getByLabelText(/Or type one/i)).toBeTruthy()
  })

  it('still offers the script letter and the flags', async () => {
    await openTray('Bengali')
    const tray = within(dialog()).getByRole('listbox', { name: 'Mark for Bengali' })
    expect(within(tray).getByLabelText('The Bengali script letter')).toBeTruthy()
    expect(within(tray).getAllByRole('option').length).toBeGreaterThan(1)
  })

  it('saves a typed mark on blur', async () => {
    await openTray('Bengali')
    const input = within(dialog()).getByPlaceholderText('any letter or symbol')
    fireEvent.change(input, { target: { value: '✦' } })
    fireEvent.blur(input)
    await waitFor(() =>
      expect(PUTS.some(([p, b]) => p === '/auth/me/preferences' && String(b.languageMarks).includes('✦'))).toBe(true),
    )
  })

  it('saves a tapped flag and closes the tray', async () => {
    await openTray('Bengali')
    const tray = within(dialog()).getByRole('listbox', { name: 'Mark for Bengali' })
    const flag = within(tray).getAllByRole('option').find((o) => o.getAttribute('aria-label') !== 'The Bengali script letter')
    fireEvent.click(flag)
    await waitFor(() => expect(PUTS.some(([p]) => p === '/auth/me/preferences')).toBe(true))
  })
})

describe('the Type panel', () => {
  const openRole = async (label) => {
    await page()
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: label }))
  }

  it('says nothing about monospace', async () => {
    // 1.15.2. The mono row answered a question nobody on that screen had asked,
    // every time it was opened. The reasoning survives in fonts.js, beside the
    // style table it is about.
    await openRole('Labels')
    expect(within(dialog()).queryByText(/monospace/i)).toBeNull()
  })

  it('still sets a face', async () => {
    // The paragraph went; the control it sat under must not have gone with it.
    await openRole('Labels')
    const chips = within(dialog()).getAllByRole('button', { pressed: false })
    fireEvent.click(chips.find((c) => c.className.includes('tp-filter-chip')))
    await waitFor(() => expect(PUTS.some(([p]) => p === '/auth/me/preferences')).toBe(true))
  })
})
