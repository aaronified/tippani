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
      { kind: 'dialogue', id: 1, proposed: '00:01:02', proposed_end: '00:01:04', current: '', current_end: '' },
    ])
  })

  it('shows a book highlight its place from the file, and presses carry what was seen', async () => {
    proposals = [
      P({
        kind: 'annotation',
        id: 9,
        quote: 'Nobody in the village could remember a night he had missed the lamp.',
        work_id: 3,
        work_title: 'The Keeper',
        current: '',
        current_end: '',
        current_chapter: '',
        proposed: '42%',
        proposed_end: '',
        proposed_chapter: 'Chapter One: Arrival',
        evidence: 'Nobody in the village could remember a night he had missed the lamp.',
      }),
      P({
        kind: 'annotation',
        id: 10,
        quote: 'By morning the boats had gone out',
        work_id: 3,
        work_title: 'The Keeper',
        current: 'p. 12',
        current_end: '',
        current_chapter: '3',
        proposed: '77%',
        proposed_end: '',
        proposed_chapter: '3',
        bucket: 'review',
        distance: 2,
        replaces: true,
        evidence: 'By morning the boats had gone out past the breakwater.',
      }),
    ]
    const opened = []
    render(<LocatorsPage embedded onOpenBook={(id) => opened.push(id)} />)
    const exact = await screen.findByTestId('locators-exact')
    // The place and the chapter are on screen, in the file's words, and the unit is said.
    expect(within(exact).getByText('42% · Chapter One: Arrival')).toBeTruthy()
    expect(within(exact).getByText('no location', { exact: false })).toBeTruthy()
    // The reader's own chapter is not offered back as a change, and their page is shown as it is.
    const review = screen.getByTestId('locators-review')
    expect(within(review).getByText('p. 12', { exact: false })).toBeTruthy()
    expect(within(review).getByText('77%')).toBeTruthy()

    fireEvent.click(within(exact).getByRole('button', { name: 'The Keeper' }))
    expect(opened).toEqual([3])

    fireEvent.click(within(review).getByRole('button', { name: 'Use the location 77% for this highlight' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].path).toBe('/locators/accept')
    expect(sent[0].body.bucket).toBe('review')
    expect(sent[0].body.items).toEqual([
      { kind: 'annotation', id: 10, proposed: '77%', proposed_end: '', current: 'p. 12', current_end: '', current_chapter: '3', proposed_chapter: '3' },
    ])

    fireEvent.click(within(exact).getByRole('button', { name: 'Ignore this suggestion' }))
    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1].path).toBe('/locators/ignore')
    expect(sent[1].body.items[0]).toMatchObject({ kind: 'annotation', id: 9, proposed: '42%', proposed_chapter: 'Chapter One: Arrival' })
  })

})
