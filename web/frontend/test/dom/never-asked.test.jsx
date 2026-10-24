// EVERY QUOTE YOU TOLD THE DECK TO SKIP, AND A WAY TO PUT IT BACK.
//
// WHY THE SCREEN EXISTS AT ALL, which is what this file is really asserting.
// Excluding a quote is a decision made one at a time, on a card the reader may
// never open again, and its only trace afterwards is a card that stops coming
// round. A deck that feels thin has either run out of material or been narrowed by
// twenty decisions nobody remembers making, and nothing on any screen could tell
// those apart.
//
// IT UNDOES THROUGH THE ENDPOINT THAT DID IT. review.jsx excludes a card with
// POST /<kind>s/bulk {ids, review:false}; this sends the same call with
// `review: true`. So these cases assert the CALL, not just the disappearance — a
// second writer for one column is how two screens come to disagree about what
// "excluded" means, and 0033's own header records that happening once already.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let POSTS
let EXCLUDED

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'GET' && path === '/review/excluded') {
      return { ok: true, data: EXCLUDED }
    }
    if (method === 'POST' && path.endsWith('/bulk')) {
      POSTS.push([path, body])
      // The screen reloads after a restore, and what it reloads has to be
      // different — a list that never empties would let a broken restore pass.
      EXCLUDED = { groups: [], total: 0 }
      return { ok: true, data: {} }
    }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

// THE WORK IS SHUT WHEN THE LIST ARRIVES, so anything asserting a quote has to
// open it the way a reader would — by pressing the work's own title.
const openWork = async (title) => (await screen.findByRole('button', { name: new RegExp(title, 'i') })).click()

const page = async () => {
  render(<Settings user={{ username: 'a', is_admin: false, preferences: {} }} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await openSettingsSection('Review')
}

beforeEach(() => {
  POSTS = []
  EXCLUDED = {
    total: 2,
    groups: [{
      work_id: 7,
      kind: 'book',
      title: 'A Reference Manual',
      art: 'ref.jpg',
      // A CREDIT IS A NAME AND A PATH, which is what the endpoint sends since the
      // chips got their photographs: a bare string here would be a stub of a
      // server that no longer exists.
      people: [{ name: 'Jean Meeus', image_path: '' }],
      quotes: [
        { id: 11, kind: 'book', text: 'page 41, see appendix' },
        { id: 12, kind: 'book', text: 'table of conversions, inside cover' },
      ],
    }],
  }
  cleanup()
})

describe('never asked about', () => {

  it('puts back a run of quotes chosen across two works in one press', async () => {
    EXCLUDED = {
      total: 2,
      groups: [
        { work_id: 7, kind: 'book', title: 'A Reference Manual', art: '', people: [], quotes: [{ id: 11, kind: 'book', text: 'page 41, see appendix' }] },
        { work_id: 9, kind: 'screen', title: 'Northline', art: '', people: [], quotes: [{ id: 21, kind: 'screen', text: 'the second unit never came back' }] },
      ],
    }
    await page()
    // The work's own box ticks everything under it, which is the press a reader
    // makes when a whole book was skipped by mistake.
    const boxes = await screen.findAllByRole('checkbox', { name: /choose everything skipped/i })
    boxes.forEach((b) => b.click())
    const bulk = await screen.findByRole('button', { name: /put 2 back/i })
    bulk.click()
    // TWO CALLS, NOT ONE. The bulk route is per source table, so a selection
    // spanning a book and a film cannot be one request — and sending the film's
    // ids to /annotations/bulk would silently restore nothing.
    await waitFor(() => expect(POSTS.length).toBe(2))
    expect(POSTS.map(([path, body]) => [path, body.ids])).toEqual([
      ['/annotations/bulk', [11]],
      ['/dialogues/bulk', [21]],
    ])
  })

})
