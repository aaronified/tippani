// A reader gives the cards a material of their own, and nothing else they do in Settings takes it away.
//
// WHAT THIS GUARDS. The browser journey proves the door, the picker and the reload. Two things here were only ever
// visible on the surface itself:
//
//   1. THE CHOICE SURVIVES THE NEXT SETTING. The shell re-applies the account's preferences whenever any one of them is
//      reported, so a setting that did not report itself (the dials, true glass) was put back to its sign-in value on
//      screen by choosing a surface's material afterwards. That is the third case, and the one that failed first.
//   2. THE APPLIED APPEARANCE CARRIES THE OVERRIDES BY THEIR STORED NAMES, so a caller that spreads it into
//      `applyTheme` to change one other thing does not drop them. The last block asks the function directly.
//
// WHAT IS NOT PROVED HERE: that the picker applies the theme itself. The shell re-applies the merged preferences right
// after, as the stand-in below does, so removing the picker's own call changes nothing a test can see; it only saves a
// render. The journey's label and reload checks are what show the choice reached the server.
//
// WHAT THIS KNOWS, and why nothing observable could serve: the appearance that is applied lives in module state
// (`getResolvedTheme`, which Settings' own controls read to mirror the screen), and "what the cards wear" is only
// readable there in jsdom. It hands Settings an `onPreferences` that stands in for the shell: it merges what it is told
// into a held copy and re-applies it, which is the shell's whole behaviour for this purpose.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let PUTS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') { PUTS.push([path, body]); return { ok: true, data: {} } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { applyTheme, getResolvedTheme } = await import('../../src/theme.js')

let HELD
const shell = (patch) => {
  HELD = { ...HELD, ...patch }
  applyTheme(HELD)
}

beforeEach(() => {
  PUTS = []
  HELD = { materialSet: 'manuscript' }
  applyTheme(HELD)
})

const open = async () => {
  render(<Settings user={{ username: 'a', is_admin: false, preferences: HELD }} onPreferences={shell} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await openSettingsSection('Theme')
  fireEvent.click(await screen.findByRole('button', { name: /open the materials/i }))
}

const pickCards = async (name) => {
  fireEvent.click(await screen.findByRole('button', { name: /^cards$/i }))
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(`^${name}$`, 'i') }))
}

describe('choosing a material for the cards', () => {
  it('is applied as it is chosen, and saved under the preference the server keeps', async () => {
    await open()
    await pickCards('Granite')
    expect(getResolvedTheme().tiles).toEqual(['', '', 'granite', ''])
    expect(PUTS).toContainEqual(['/auth/me/preferences', { tileCard: 'granite' }])
  })

  it('stays when a dial is turned afterwards', async () => {
    await open()
    await pickCards('Granite')
    // the dials are another door on the same screen; what matters is what the shell is told and re-applies
    shell({ texTweak: JSON.stringify({ paper: { hard: 90 } }) })
    expect(getResolvedTheme().tiles).toEqual(['', '', 'granite', ''])
    expect(getResolvedTheme().texTweak.paper.hard).toBe(90)
  })

  it('does not put true glass back when it is made afterwards', async () => {
    await open()
    await pickCards('Granite')
    fireEvent.click((await screen.findAllByText(/^on$/i)).at(-1))
    await waitFor(() => expect(PUTS).toContainEqual(['/auth/me/preferences', { trueGlass: true }]))
    expect(HELD.trueGlass, 'Settings did not tell the shell glass was switched on').toBe(true)
    expect(getResolvedTheme().tiles).toEqual(['', '', 'granite', ''])
    // and the other way round: a surface chosen after the glass is on does not switch it off
    await pickCards('Marble')
    expect(HELD.trueGlass).toBe(true)
  })
})

describe('the applied appearance', () => {
  it('carries each surface\'s own material under the name the server stores it by', () => {
    applyTheme({ materialSet: 'quarry', tileGround: 'pine', tileCover: 'walnut' })
    expect(getResolvedTheme()).toMatchObject({ tileGround: 'pine', tileShell: '', tileCard: '', tileCover: 'walnut' })
    // spread back into applyTheme for an unrelated change, nothing is lost
    applyTheme({ ...getResolvedTheme(), texTweak: '{}' })
    expect(getResolvedTheme().tiles).toEqual(['pine', '', '', 'walnut'])
  })
})
