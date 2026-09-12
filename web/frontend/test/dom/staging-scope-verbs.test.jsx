// A FILE AND A WORK ARE TWO SCOPES OF ONE QUESTION, AND EACH GETS THE VERB.
//
// THE OWNER'S ASK, in their words: "The import checks need to have file and work
// (identified from the file) level bulk options."
//
// The queue had the two ENDS and nothing in between. The page header approves or
// discards EVERYTHING; the BulkBar approves or discards an arbitrary SELECTION.
// A work group carried a select-all checkbox and no verb at all, and acting on a
// whole file meant four steps — find the filter, choose the file, tick
// select-all-shown, scroll to the bar — for the thing a reader does most often:
// a file landed, it looks right, take it.
//
// WHAT THESE CASES ARE ABOUT is that the two scopes send the right IDS. A control
// that approves the whole queue when you press it on one work is worse than no
// control, and it is invisible in markup: both draw the same words. So every case
// here reads the request body.
//
// AND THE SCOPES SHARE ONE COMPONENT, which is the repo's rule — the verb does
// not change because the scope did — so the last case asserts the two levels put
// the same question in the same words rather than each being separately right.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// Every write the page makes, in order.
let posts = []

vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    if (method === 'GET' && path === '/import/staged') {
      return { ok: true, data: { pending: 4, batches: BATCHES, works: WORKS, quotes: QUOTES } }
    }
    // The verb matters: a discard is DELETE /import/staged, an approve is POST
    // /import/staged/approve, and a case keyed on the path alone would not tell
    // the queue's own GET from its discard.
    posts.push({ method, path, body })
    if (path === '/import/staged/approve') return { ok: true, data: { added: 1, skipped: 0, enriched: 0 } }
    if (method === 'DELETE') return { ok: true, data: { discarded: 1 } }
    return { ok: true, data: {} }
  },
  errText: (r, fallback) => (r.data && r.data.error) || fallback,
  coverImgURL: (p) => (p ? `/covers/${p}` : ''),
}))

// TWO FILES, THREE WORKS, so a file's rows and a work's rows are different sets
// and a control that confused them fails rather than coincidentally passing.
const BATCHES = [
  { id: 1, filename: 'kindle.txt', source: 'kindle', quotes: 3 },
  { id: 2, filename: 'notes.md', source: 'markdown', quotes: 1 },
]
const WORKS = [
  { id: 1, kind: 'book', title: 'Dune', quotes: 2, batch_id: 1, target_id: 42, target_title: 'Dune', target_cover: '' },
  { id: 2, kind: 'book', title: 'Solaris', quotes: 1, batch_id: 1, target_id: 7, target_title: 'Solaris', target_cover: '' },
  { id: 3, kind: 'book', title: 'Ulysses', quotes: 1, batch_id: 2, target_id: 9, target_title: 'Ulysses', target_cover: '' },
]
const q = (id, workId, batch, text) => ({
  id, staged_work_id: workId, batch_id: batch, quote: text,
  chapter: '', chapter_no: 0, location: '', character: '', actor: '',
  season: null, episode: null, timestamp: '', timestamp_end: '', dlc: '', language: '',
  color: 'yellow', favorite: false, tags: [],
})
const QUOTES = [
  q(11, 1, 1, 'The spice must flow.'),
  q(12, 1, 1, 'Fear is the mind-killer.'),
  q(13, 2, 1, 'We do not want other worlds.'),
  q(14, 3, 2, 'Stately, plump Buck Mulligan.'),
]

const { default: StagingPage } = await import('../../src/StagingPage.jsx')

const noop = () => {}
const page = async () => {
  posts = []
  render(<StagingPage embedded onPending={noop} onOpenBook={noop} onOpenMovie={noop} onApproved={noop} />)
  await screen.findByText(/The spice must flow/)
}

// The approve buttons, in document order. The page header's approve-all is a
// primary button with its own words ("Approve 4"/"Approve all"), so the scoped
// ones are told apart by being inside the filter row or a group heading.
const approveIn = (root) =>
  [...root.querySelectorAll('button')].find((b) => /^Approve \d+$/.test(b.textContent.trim()))
const discardIn = (root) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Discard')

const filterRow = () => document.querySelector('.filter-row')
const groupFor = (title) =>
  [...document.querySelectorAll('section')].find((sec) => sec.querySelector('h3')?.textContent.includes(title))

const lastPost = (path) => [...posts].reverse().find((p) => p.path === path)
const lastDelete = () => [...posts].reverse().find((p) => p.method === 'DELETE')

describe('a work’s own verbs', () => {
  it('approve only that work’s rows, not the whole queue', async () => {
    await page()
    const dune = groupFor('Dune')
    expect(dune, 'no group for Dune').toBeTruthy()
    fireEvent.click(approveIn(dune))
    await waitFor(() => expect(lastPost('/import/staged/approve')).toBeTruthy())
    // Dune's two, and neither Solaris's nor Ulysses's.
    expect(lastPost('/import/staged/approve').body).toEqual({ ids: [11, 12] })
  })

  it('and discard asks first, then sends that work’s rows', async () => {
    await page()
    fireEvent.click(discardIn(groupFor('Solaris')))
    // A discard is the one verb here that cannot be undone from this screen, so
    // it is never one press at any scope.
    expect(posts.find((p) => p.method === 'DELETE'), 'discarded without asking').toBeFalsy()
    // The dialog's own confirming button, not the heading verb that opened it.
    // The confirm is portalled to the end of the document, so it is the last one.
    const all = await waitFor(() => {
      const found = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Discard')
      expect(found.length, 'pressing Discard opened no confirm').toBeGreaterThan(1)
      return found
    })
    fireEvent.click(all[all.length - 1])
    await waitFor(() => expect(lastDelete()).toBeTruthy())
    expect(lastDelete().body).toEqual({ ids: [13] })
  })
})

describe('a file’s own verbs', () => {
  it('are drawn only once a file is chosen', async () => {
    await page()
    // Over "all files" they would be the page header's approve-all under a second
    // name, and two controls for one act is the thing this screen avoids.
    expect(approveIn(filterRow())).toBeFalsy()
  })

  it('approve everything that came out of that file, across works', async () => {
    await page()
    const pick = screen.getByLabelText('Import batch')
    fireEvent.click(pick)
    fireEvent.click(await screen.findByRole('option', { name: /kindle\.txt/ }))
    const verb = await waitFor(() => {
      const b = approveIn(filterRow())
      expect(b, 'no approve verb beside the file filter').toBeTruthy()
      return b
    })
    fireEvent.click(verb)
    await waitFor(() => expect(lastPost('/import/staged/approve')).toBeTruthy())
    // kindle.txt brought Dune's two AND Solaris's one; notes.md's row is not its.
    expect(lastPost('/import/staged/approve').body).toEqual({ ids: [11, 12, 13] })
  })
})

describe('the two scopes are one control', () => {
  it('put the same verbs in the same words', async () => {
    await page()
    const pick = screen.getByLabelText('Import batch')
    fireEvent.click(pick)
    fireEvent.click(await screen.findByRole('option', { name: /notes\.md/ }))
    await waitFor(() => expect(approveIn(filterRow())).toBeTruthy())
    // One file, one work, one row — so both scopes cover the same single quote
    // and any difference in wording is the drift this component exists to stop.
    const file = filterRow()
    const work = groupFor('Ulysses')
    expect(approveIn(work).textContent.trim()).toBe(approveIn(file).textContent.trim())
    expect(discardIn(work).textContent.trim()).toBe(discardIn(file).textContent.trim())
  })
})
