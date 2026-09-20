// THE NUMBER ON A DOOR IS THE NUMBER BEHIND IT.
//
// WHAT THIS GUARDS. One door survives in Settings — the material physics dials —
// and its row says how many sliders are back there, because "a door with four
// presses behind it costs more than the rows it hides" cuts both ways: a reader
// deciding whether to press deserves to know what they would get. The count moves
// with the material set, since a set's four slots may name three distinct
// materials or four, and with the true-glass toggle, which brings six more.
//
// A COUNT IS THE EASIEST THING IN AN INTERFACE TO GET QUIETLY WRONG. It is
// computed in one place and drawn in another, nothing throws when they disagree,
// and the only reader who would notice is one who pressed the door and counted.
// `physDialCount` and `MaterialPhysics` share their two dial tables for exactly
// that reason — this is the case that proves they still do.
//
// IT COUNTS WHAT A PERSON WOULD COUNT: the sliders on the screen after the press,
// against the digits on the row before it. Neither side is read out of the source.
//
// MUTATION-VERIFIED: drop one entry from PHYS_DIALS' use in the panel — or count
// the slots without de-duplicating them — and the two numbers part.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { applyTheme } = await import('../../src/theme.js')
const { t } = await import('../../src/i18n.js')

const noop = () => {}

// THE SET IS APPLIED, NOT HANDED IN AS A PREFERENCE, and the difference is the
// reason the first draft of this file passed while measuring nothing. The Theme
// card reads the APPLIED theme off <html> rather than the preferences prop —
// deliberately, so a control cannot be a render behind what the reader is looking
// at — so `preferences: { materialSet: 'quarry' }` left every case on the default
// set, and two cases that meant to compare different sets compared one set twice.
// They agreed, because they were the same number.
//
// `trueGlass` IS a preference the card reads directly, so that one stays a prop.
const openTheme = async ({ set = 'manuscript', glass = false } = {}) => {
  applyTheme({ materialSet: set, theme: 'light' })
  render(
    <Settings
      user={{ username: 'a', is_admin: false, preferences: { trueGlass: glass } }}
      onPreferences={noop}
      update={null}
      onUpdateInfo={noop}
      onStartTour={noop}
    />,
  )
  await openSettingsSection('Theme')
}

// The digits on the door's row. Read off the screen rather than recomputed, so a
// row that printed the wrong number could not pass by being asked the same
// question twice.
const promised = () => {
  const row = screen.getByText(t('settings.appearance.phys.title')).closest('.pref-row')
  const m = (row?.textContent || '').match(/(\d+)\s*dials?/i)
  expect(m, 'the door should say how many dials are behind it').toBeTruthy()
  return Number(m[1])
}

const openDoor = () => fireEvent.click(screen.getByText(t('settings.appearance.phys.open.label')))

beforeEach(cleanup)

describe('the one door left in Settings', () => {
  it('says how many dials are behind it, and that is how many there are', async () => {
    await openTheme({ set: 'quarry' })
    const said = promised()
    expect(said, 'a set with materials should have dials behind the door').toBeGreaterThan(0)
    openDoor()
    expect(screen.getAllByRole('slider').length, 'the door promised a different number than it holds')
      .toBe(said)
  })

  it('counts a set that repeats a material once, not twice', async () => {
    // Manuscript puts paper on two of its four slots, and two identical rows
    // would be one control drawn twice — so the panel de-duplicates and the count
    // has to as well. This is the case that fails if either side forgets.
    await openTheme({ set: 'manuscript' })
    const said = promised()
    openDoor()
    expect(screen.getAllByRole('slider').length).toBe(said)
    // AND IT IS FEWER THAN QUARRY'S, which is what says the de-duplication
    // happened at all rather than both sides being wrong together: every set has
    // four slots, Quarry names four distinct materials and Manuscript three, so a
    // count that ignored the repeat would make these two equal.
    //
    // (This line first read `promised.FOUR_MATERIALS ?? 16` — a property that
    // function has never had, so the comparison was against a hard-coded 16 with
    // a `??` dressed around it to look derived. It passed, which is the point:
    // a number typed into an assertion proves whatever it was typed to prove.)
    cleanup()
    await openTheme({ set: 'quarry' })
    expect(said, 'a set naming one material twice should count it once')
      .toBeLessThan(promised())
  })

  it('brings the lens’s own dials into the count when the lens is on', async () => {
    await openTheme({ set: 'quarry' })
    const dark = promised()
    cleanup()
    await openTheme({ set: 'quarry', glass: true })
    const lit = promised()
    expect(lit, 'the glass dials should join the count with the lens on').toBeGreaterThan(dark)
    openDoor()
    expect(screen.getAllByRole('slider').length).toBe(lit)
  })
})
