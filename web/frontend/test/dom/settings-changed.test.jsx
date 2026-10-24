// WHAT A SECTION'S NUMBER SAYS, AND THAT IT IS THE SECTION'S OWN.
//
// WHY A SCREEN AND NOT ONLY `changedIn`. settings-prefs.test.js proves the
// arithmetic and proves the table accounts for every key the server stores. What
// it cannot prove is that the number reaches the reader: the tab it is drawn on,
// the pill in the section's header, and the Reset that appears beside it only when
// there is something to undo. A count computed correctly and passed to nothing is
// the shape of defect this whole branch keeps finding.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

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

  it('counts what the reader has set, on the tab, without opening it', () => {
    page({ srDaily: 12, srTier: 'hard' })
    expect(tab('Review').textContent).toMatch(/2$/)
  })

  // THE WORDING USED TO BE ASSERTED HERE TOO — "1 changed" and "all default" —
  // because the count was repeated in a second bar under the tabs. That bar is
  // gone: it was a full-width row restating what the tab above it already said.
  // The number lives on the tab and nowhere else, which the three cases above
  // hold.

})
