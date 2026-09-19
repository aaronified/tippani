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
// WHAT IT KNOWS AND WHY. This file reads the swatch's own background colour AND
// the class name `.ground-swatch` that finds it — two things a test is not
// normally allowed to know, declared here because this directory's rule is that
// an exception is named in the file's own header.
//
// The colour: a swatch's entire job is to BE the colour it selects, so "what does
// it look like" is not an implementation detail of this control, it is the
// control. There is no accessible-name or text assertion that can tell a painted
// swatch from an unpainted one — which is exactly how three invisible buttons
// passed everything.
//
// The class: a choice now carries its NAME as well as its colour, so the button's
// text is the ground's name and the paint is on a child. Nothing observable
// distinguishes that child from the name beside it, and this file's whole subject
// is the paint.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

// THE GROUNDS ARE BEHIND A DOOR NOW, which is what the pack draws and what the
// row's own sub-line has always said: "Light ground · dark ground · accent. Each
// one opens its own options." So each case opens the door for the side it is
// about — and BOTH sides are reachable, where the row used to offer only the mode
// the screen happened to be in.
async function openGrounds(side = 'light') {
  await openTheme()
  const door = screen.getAllByRole('button').find((b) =>
    (b.getAttribute('aria-label') || '').startsWith(t(`settings.appearance.colours.${side}.title`)))
  expect(door, `no ${side} ground door`).toBeTruthy()
  fireEvent.click(door)
  // THE OPTIONS OPEN IN THE ROW, not over the page — the pack's own shape — so
  // there is no dialog to wait for. What says the panel is open is the heading it
  // carries, which is the same string the door is named for.
  await screen.findByText(t(`settings.appearance.colours.${side}.title`))
}

// Found by the name each ground carries rather than by a class, so a ground that
// stops being offered is one fewer here rather than a selector that silently
// matches nothing.
function groundButtons(side = 'light') {
  const names = new Set(Object.values(GROUNDS[side]).map((g) => t(g.label).toLowerCase()))
  return screen.getAllByRole('button').filter((b) => {
    const text = (b.textContent || '').trim().toLowerCase()
    return b.getAttribute('aria-pressed') !== null && names.has(text)
  })
}

describe('the ground picker offers grounds you can see', () => {
  it('offers one press per light ground', async () => {
    await openGrounds('light')
    expect(groundButtons().length).toBe(Object.keys(GROUNDS.light).length)
  })

  // THE OTHER SIDE, WHICH USED TO BE UNREACHABLE. The row offered the grounds of
  // whichever mode was on screen, so a reader on a dark screen could not set their
  // day look without switching the whole app to daylight first.
  it('and one press per dark ground, without changing the app to find them', async () => {
    await openGrounds('dark')
    expect(groundButtons('dark').length).toBe(Object.keys(GROUNDS.dark).length)
  })

  it('paints every one of them', async () => {
    await openGrounds('light')
    for (const b of groundButtons()) {
      // THE SWATCH IS INSIDE THE CHOICE NOW, because a choice carries its name as
      // well as its colour — which is the other half of what this file is about:
      // "Sepia" and "Tobacco" are recognisable words and unrecognisable squares.
      const swatch = b.querySelector('.ground-swatch')
      expect(swatch, `${b.textContent} has no swatch`).toBeTruthy()
      // The empty string is what an undefined inline colour leaves behind, and it
      // is the exact state the defect this file exists for produced.
      expect(swatch.style.background, `${b.textContent} is unpainted`).not.toBe('')
      const stripes = Array.from(swatch.querySelectorAll('span'))
      expect(stripes.length).toBe(2)
      for (const s of stripes) expect(s.style.background).not.toBe('')
    }
  })

  it('draws no two of them alike', async () => {
    await openGrounds('light')
    // A picker whose choices all look the same is a picker with one choice on
    // it. The triad — desk, furniture, page — is what distinguishes a ground, so
    // all three are part of the fingerprint.
    const seen = groundButtons().map((b) => {
      const swatch = b.querySelector('.ground-swatch')
      return [swatch.style.background, ...Array.from(swatch.querySelectorAll('span')).map((s) => s.style.background)].join('|')
    })
    expect(new Set(seen).size).toBe(seen.length)
  })
})
