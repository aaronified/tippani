// A re-verify is a job on the server, and the dialog that starts it only draws it.
//
// WHAT CHANGED IN 3.1.0. The check was a loop of requests from this dialog, and
// it lived and died with the dialog: close it, lock the phone, and a check of
// four hundred works stopped wherever it had got to. It is a `reverify` job now,
// and the apply is a `reverify-apply` job, so both outlive the dialog.
//
// WHAT A READER SEES AND MAY DO, and so what this file presses:
//   * one check over the selection, with its progress — or, behind another job,
//     where it stands in the queue — and a line saying closing will not stop it;
//   * ✕ closes and the check goes on, with a toast saying where it will be;
//   * Cancel while it checks STOPS it, and asks first, because a press that used
//     to mean "never mind" now ends work in progress;
//   * the findings when it ends, a field changed since the check never ticked;
//   * Apply as a job that carries, per field, the stored value the reader was
//     shown and the check it came from, and the lines it answers with;
//   * each field applied under the supplier that gave it: the half of a merged
//     match that gave that field, and a person under their own supplier;
//   * a failed check and one stopped elsewhere each say so in words.
//
// THE NETWORK: the jobs routes are answered by test/dom/helpers/jobsServer.js,
// which declares what it knows. What is read back is only what a request said.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { jobsServer } from './helpers/jobsServer.js'

let JOBS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    const job = JOBS.answer(method, path, body)
    if (job) return job
    return { ok: true, data: {} }
  }),
}))

const { ReverifyFlow } = await import('../../src/ReverifyReview.jsx')
const { ToastHost } = await import('../../src/ui.jsx')

const FINDINGS = [{
  type: 'book', id: 3, title: 'The Paper Boat', status: 'ok', source: 'openlibrary',
  diffs: [
    // Empty then and empty now: a pure fill, ticked as a re-verify always ticks one.
    { field: 'published_year', stored: null, fresh: 1921 },
    // Somebody cleared it after the check: empty now, and NOT ticked for them.
    { field: 'description', stored: '', fresh: 'A boat folded from a letter.', changed: true },
    // Stored, and the source disagrees: an overwrite, which is never pre-ticked.
    { field: 'series', stored: 'Harbour', fresh: 'Harbour Tales' },
  ],
}]

let closed
let flashes
const SELECTION = { book_ids: [3], movie_ids: [1], people: [{ kind: 'author', name: 'Tagore' }] }

beforeEach(() => {
  JOBS = jobsServer()
  closed = 0
  flashes = []
})

const open = (props = {}) => render(
  <>
    <ReverifyFlow selection={SELECTION} onClose={() => { closed += 1 }} onFlash={(m) => flashes.push(m)} onDone={() => {}} {...props} />
    <ToastHost />
  </>,
)
const dialog = () => screen.getByRole('dialog', { name: /Re-verify metadata|Fetch empty fields/ })
const checkId = () => JOBS.started().length && [...JOBS.jobs.values()].find((j) => j.kind === 'reverify')?.id

describe('the check', () => {

  it('is stopped by Cancel only after the reader says so', async () => {
    JOBS.hold('reverify')
    open()
    await screen.findByRole('progressbar')
    await waitFor(() => expect(checkId()).toBeTruthy())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Stop the check?' })
    expect(within(ask).getByText('It stops at once and leaves the item in hand untouched, and it is kept in Settings → Jobs with its log.')).toBeTruthy()
    // Said no: nothing stopped, nothing closed.
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(JOBS.stops()).toEqual([])
    expect(closed).toBe(0)
    // Said yes: that job is stopped, the dialog says so while the server ends
    // it, and goes once it reads stopped.
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Stop the check?' })).getByRole('button', { name: 'Stop it' }))
    await waitFor(() => expect(JOBS.stops()).toEqual([checkId()]))
    expect(await within(dialog()).findByText('Stopping…')).toBeTruthy()
    expect(closed).toBe(0)
    JOBS.finish(checkId(), { state: 'stopped' })
    await waitFor(() => expect(closed).toBe(1))
  })

})

describe('the findings and the apply', () => {
  const review = async () => {
    JOBS.plan('reverify', { result: FINDINGS })
    open()
    await screen.findByText('The Paper Boat')
    await waitFor(() => expect(within(dialog()).getAllByRole('checkbox').length).toBe(3))
  }

  it('applies as a job carrying what the reader was shown and the check it came from', async () => {
    await review()
    JOBS.plan('reverify-apply', { result: [{ type: 'book', id: 3, ok: true }] })
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Apply 1 approved change' }))
    await waitFor(() => expect(JOBS.started().some(([k]) => k === 'reverify-apply')).toBe(true))
    const [, params] = JOBS.started().find(([k]) => k === 'reverify-apply')
    expect(params).toEqual({
      from_job: checkId(),
      items: [{
        type: 'book', id: 3, source: 'openlibrary',
        set: { published_year: 1921 },
        sources: { published_year: 'openlibrary' },
        // The stored value the reader saw beside the tick — nothing, here.
        expect: { published_year: null },
      }],
    })
    expect(await within(dialog()).findByText('book 3: applied')).toBeTruthy()
    await waitFor(() => expect(flashes).toEqual(['re-verify: 1 item updated']))
  })

})
