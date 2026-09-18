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
      quotes: [
        { id: 11, kind: 'book', text: 'page 41, see appendix' },
        { id: 12, kind: 'book', text: 'table of conversions, inside cover' },
      ],
    }],
  }
  cleanup()
})

describe('never asked about', () => {
  it('lists the skipped quotes under the work they came from', async () => {
    await page()
    expect(await screen.findByText('A Reference Manual')).toBeTruthy()
    // THE QUOTE'S OWN WORDS. A list of ids, or of "2 quotes", could not be
    // recognised by the reader who skipped them months ago — which is the only
    // reason anybody opens this.
    expect(screen.getByText('page 41, see appendix')).toBeTruthy()
    expect(screen.getByText('table of conversions, inside cover')).toBeTruthy()
  })

  it('says how many, so a thin deck has an explanation', async () => {
    await page()
    expect(await screen.findByText(/2 skipped/)).toBeTruthy()
  })

  it('puts one back through the same call that took it out', async () => {
    await page()
    const row = (await screen.findByText('page 41, see appendix')).closest('.skipped-row')
    within(row).getByRole('button').click()
    await waitFor(() => expect(POSTS.length).toBe(1))
    expect(POSTS[0][0]).toBe('/annotations/bulk')
    expect(POSTS[0][1]).toEqual({ ids: [11], review: true })
  })

  it('puts a whole work back in one call, with every quote listed under it', async () => {
    await page()
    const head = (await screen.findByText('A Reference Manual')).closest('.skipped-group-head')
    within(head).getByRole('button').click()
    await waitFor(() => expect(POSTS.length).toBe(1))
    expect(POSTS[0][1]).toEqual({ ids: [11, 12], review: true })
  })

  it('says so plainly when nothing is skipped', async () => {
    EXCLUDED = { groups: [], total: 0 }
    await page()
    // Not an empty space: a reader who came here looking for something they
    // skipped needs to be told they skipped nothing, or they go on looking.
    expect(await screen.findByText(/nothing skipped/i)).toBeTruthy()
  })
})
