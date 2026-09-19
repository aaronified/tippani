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

  // THE WORDING USED TO BE ASSERTED HERE TOO — "1 changed" and "all default" —
  // because the count was repeated in a second bar under the tabs. That bar is
  // gone: it was a full-width row restating what the tab above it already said.
  // The number lives on the tab and nowhere else, which the three cases above
  // hold.

  it('puts the section\'s info and its Reset on the tab row, not in a bar of their own', async () => {
    page({ srDaily: 12 })
    await openSettingsSection('Review')
    // The pack draws both at the right-hand end of the same row as the tabs,
    // sharing its bottom border. What this can check without knowing a class is
    // that they are in the row the tablist is in.
    // THE SECTION RAIL'S tablist, not any other. Review's own screen draws
    // toggles now — "how hard", "confirm each answer" — and Toggle is a tablist
    // too, so `getByRole('tablist')` stopped being unambiguous the moment those
    // came out from behind the in-depth door. The rail's is the first on the page
    // and the only one whose label names the sections.
    const row = screen.getByRole('tablist', { name: /which settings to change/i }).parentElement
    expect(within(row).getByRole('button', { name: /reset section/i })).toBeTruthy()
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
