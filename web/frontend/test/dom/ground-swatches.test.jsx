// THE GROUND PICKER, AND WHAT A CHOICE HAS TO LOOK LIKE TO BE ONE.
//
// WHAT IT CAUGHT. Four light grounds were offered and only one was visible: the
// swatch painted itself from `g.bg` while a ground is `{ label, tokens }`, so
// every background resolved to `undefined`. The one ground that could still be
// seen was the selected one, and only because the selection ring is drawn from a
// custom property rather than from the ground. So the control rendered, answered
// to its name, saved the right preference when pressed — and showed the reader
// four blank rectangles, three of them with no border either. Nothing in the
// suite noticed, because every case about grounds was about the PALETTE the
// ground produces and none was about the picker.
//
// WHAT IT KNOWS AND WHY. This file reads the swatch's own background colour,
// which is a thing a test is not normally allowed to know. The exception is
// declared here and it is narrow: a swatch's entire job is to BE the colour it
// selects, so "what does it look like" is not an implementation detail of this
// control, it is the control. There is no accessible-name or text assertion that
// can tell a painted swatch from an unpainted one — which is exactly how three
// invisible buttons passed everything.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { GROUNDS } = await import('../../src/theme.js')
const { t } = await import('../../src/i18n.js')

const USER = { username: 'a', is_admin: false, preferences: {} }

beforeEach(() => {
  cleanup()
})

async function openTheme() {
  render(<Settings user={USER} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await openSettingsSection('Theme')
}

// The light side is what a jsdom render is in: no `prefers-color-scheme`, so the
// screen resolves to light and the picker offers the four light grounds. They are
// found by the accessible name each ground carries rather than by a class, so a
// ground that stops being offered is one fewer here rather than a selector that
// silently matches nothing.
function groundButtons() {
  const names = new Set(Object.values(GROUNDS.light).map((g) => t(g.label).toLowerCase()))
  return screen.getAllByRole('button').filter((b) => {
    const label = (b.getAttribute('aria-label') || '').toLowerCase()
    return b.getAttribute('aria-pressed') !== null && names.has(label)
  })
}

describe('the ground picker offers grounds you can see', () => {
  it('offers one press per light ground', async () => {
    await openTheme()
    expect(groundButtons().length).toBe(Object.keys(GROUNDS.light).length)
  })

  it('paints every one of them', async () => {
    await openTheme()
    for (const b of groundButtons()) {
      // The empty string is what an undefined inline colour leaves behind, and
      // it is the exact state the defect produced.
      expect(b.style.background, `${b.getAttribute('aria-label')} is unpainted`).not.toBe('')
      const stripes = Array.from(b.querySelectorAll('span'))
      expect(stripes.length).toBe(2)
      for (const s of stripes) expect(s.style.background).not.toBe('')
    }
  })

  it('draws no two of them alike', async () => {
    await openTheme()
    // A picker whose choices all look the same is a picker with one choice on
    // it. The triad — desk, furniture, page — is what distinguishes a ground, so
    // all three are part of the fingerprint.
    const seen = groundButtons().map((b) => [b.style.background, ...Array.from(b.querySelectorAll('span')).map((s) => s.style.background)].join('|'))
    expect(new Set(seen).size).toBe(seen.length)
  })
})
