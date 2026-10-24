// TIMES THE SUBTITLES PROPOSE, a section of Checks.
//
// WHAT THIS KNOWS: the three addresses the section reads and presses, the words on
// screen, and what a person can do. A proposal is shown with what the line has now,
// what the file says and the file's own words; the exact group may be accepted
// together, a fuzzy row only one at a time, and the section draws NOTHING when there
// is nothing to propose.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent = []
let proposals = []
let reply = { applied: 1, stale: 0, skipped: 0 }

vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    if (method === 'GET' && path === '/locators/proposals') {
      const exact = proposals.filter((p) => p.bucket === 'exact').length
      return { ok: true, data: { proposals, counts: { exact, review: proposals.length - exact } } }
    }
    sent.push({ method, path, body })
    return { ok: true, data: reply }
  },
  errText: () => 'nope',
  coverImgURL: () => '',
}))

const { default: LocatorsPage } = await import('../../src/LocatorsPage.jsx')

const P = (over) => ({
  kind: 'dialogue',
  id: 1,
  quote: 'People should not be afraid of their governments.',
  work_id: 7,
  work_title: 'V for Vendetta',
  current: '',
  current_end: '',
  proposed: '00:01:02',
  proposed_end: '00:01:04',
  evidence: 'People should not be afraid of their governments.',
  bucket: 'exact',
  distance: 0,
  ...over,
})

beforeEach(() => {
  cleanup()
  sent.length = 0
  reply = { applied: 1, stale: 0, skipped: 0 }
  proposals = [
    P({}),
    P({ id: 2, quote: 'Governments should be afrad of their people', proposed: '00:02:10', proposed_end: '00:02:12', bucket: 'review', distance: 2, evidence: 'Governments should be afraid of their people.' }),
  ]
})

describe('times from subtitles on Checks', () => {

  it('accepts the exact group together, naming the bucket, with what the reader saw', async () => {
    render(<LocatorsPage embedded />)
    await screen.findByTestId('locators-exact')
    fireEvent.click(screen.getByRole('button', { name: 'Accept all 1' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].path).toBe('/locators/accept')
    expect(sent[0].body.bucket).toBe('exact')
    expect(sent[0].body.items).toEqual([
      { id: 1, proposed: '00:01:02', proposed_end: '00:01:04', current: '', current_end: '' },
    ])
  })

})
