// WHAT A SECTION'S NUMBER SAYS, AND THAT IT IS THE SECTION'S OWN.
//
// WHY A SCREEN AND NOT ONLY `changedIn`. settings-prefs.test.js proves the
// arithmetic and proves the table accounts for every key the server stores. What
// it cannot prove is that the number reaches the reader: the tab it is drawn on,
// the pill in the section's header, and the Reset that appears beside it only when
// there is something to undo. A count computed correctly and passed to nothing is
// the shape of defect this whole branch keeps finding.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

const page = (preferences = {}) => {
  render(<Settings user={{ username: 'a', is_admin: false, preferences }} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
}
const tab = (name) => screen.getByRole('tab', { name: new RegExp(`^${name}`) })

beforeEach(() => { PUTS = []; cleanup() })

describe('the number on a section', () => {
  it('says nothing on a tab where nothing is set', () => {
    page({})
    // No count at all rather than a nought: a badge reading 0 on all five tabs is
    // five pieces of furniture saying nothing.
    expect(tab('Review').textContent).toBe('Review')
  })

  it('counts what the reader has set, on the tab, without opening it', () => {
    page({ srDaily: 12, srTier: 'hard' })
    expect(tab('Review').textContent).toMatch(/2$/)
  })

  it('gives a section only its own preferences', () => {
    // The bug a single shared counter would produce: every tab wearing the total.
    page({ srDaily: 12, accent: 'clay' })
    expect(tab('Review').textContent).toMatch(/1$/)
    expect(tab('Theme').textContent).toMatch(/1$/)
    expect(tab('Sections').textContent).toBe('Sections')
  })

  it('says so in words in the section you are standing in', async () => {
    page({ srDaily: 12 })
    await openSettingsSection('Review')
    expect(screen.getByText(/1 changed/)).toBeTruthy()
  })

  it('says "all default" rather than a nought', async () => {
    page({})
    await openSettingsSection('Review')
    expect(screen.getByText(/all default/i)).toBeTruthy()
  })
})

describe('putting a section back', () => {
  it('offers no way back where there is nothing to go back from', async () => {
    page({})
    await openSettingsSection('Review')
    expect(screen.queryByRole('button', { name: /reset section/i })).toBeNull()
  })

  it('offers it as soon as one preference is set', async () => {
    page({ srDaily: 12 })
    await openSettingsSection('Review')
    expect(screen.getByRole('button', { name: /reset section/i })).toBeTruthy()
  })

  it('asks before it does it', async () => {
    page({ srDaily: 12 })
    await openSettingsSection('Review')
    fireEvent.click(screen.getByRole('button', { name: /reset section/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(within(screen.getByRole('dialog')).getByText(/every preference in this section/i)).toBeTruthy()
  })
})
