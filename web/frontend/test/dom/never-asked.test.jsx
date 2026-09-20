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
      people: ['Jean Meeus'],
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
    await openWork('A Reference Manual')
    // THE QUOTE'S OWN WORDS. A list of ids, or of "2 quotes", could not be
    // recognised by the reader who skipped them months ago — which is the only
    // reason anybody opens this.
    expect(screen.getByText('page 41, see appendix')).toBeTruthy()
    expect(screen.getByText('table of conversions, inside cover')).toBeTruthy()
  })

  it('says how many, so a thin deck has an explanation', async () => {
    await page()
    // THE TOTAL, NOT A WORK'S OWN COUNT. Each work says how many of its lines
    // are skipped too, and with one work on the shelf the two numbers read the
    // same — so the bar is asked directly, or this case would pass on a screen
    // that had lost the total entirely.
    await screen.findByText('A Reference Manual')
    expect(within(document.querySelector('.skipped-bar')).getByText(/2 skipped/)).toBeTruthy()
  })

  it('shows the work itself — its artwork and who wrote it — not just its title', async () => {
    await page()
    // WHY THIS AND NOT A TITLE ALONE. A reader recognises a book they skipped
    // months ago by its cover and its author; a column of strings asks them to
    // recognise their own library from bibliographic data.
    expect(await screen.findByRole('img', { name: /A Reference Manual/i })).toBeTruthy()
    expect(screen.getByText('Jean Meeus')).toBeTruthy()
  })

  it('keeps the quotes shut until the work is opened', async () => {
    await page()
    expect(await screen.findByText('A Reference Manual')).toBeTruthy()
    expect(screen.queryByText('page 41, see appendix')).toBeNull()
    await openWork('A Reference Manual')
    expect(await screen.findByText('page 41, see appendix')).toBeTruthy()
  })

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

  it('puts one back through the same call that took it out', async () => {
    await page()
    await openWork('A Reference Manual')
    const row = (await screen.findByText('page 41, see appendix')).closest('.skipped-row')
    within(row).getByRole('button').click()
    await waitFor(() => expect(POSTS.length).toBe(1))
    expect(POSTS[0][0]).toBe('/annotations/bulk')
    expect(POSTS[0][1]).toEqual({ ids: [11], review: true })
  })

  it('puts a whole work back in one call, with every quote listed under it', async () => {
    await page()
    await openWork('A Reference Manual')
    const foot = document.querySelector('.skipped-work-foot')
    within(foot).getByRole('button').click()
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
