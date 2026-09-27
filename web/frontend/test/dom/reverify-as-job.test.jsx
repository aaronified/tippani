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
  it('is one job over the selection, drawing its progress, and says closing will not stop it', async () => {
    JOBS.plan('reverify', { total: 3 })
    JOBS.hold('reverify')
    open({ fillsOnly: true })
    await waitFor(() => expect(JOBS.started()).toEqual([[
      'reverify',
      { book_ids: [3], movie_ids: [1], people: [{ kind: 'author', name: 'Tagore' }], fills_only: true },
    ]]))
    expect(await screen.findByRole('progressbar', { name: 'checking · 0/3' })).toBeTruthy()
    expect(screen.getByText('Close this and it carries on — Settings › Jobs has it.')).toBeTruthy()
  })

  // ONE CHECK HOLDS 500 ITEMS. The People console's re-verify sends every person
  // it shows, and a Select all over the works can be more than that; the server
  // refuses a bigger check whole. So the first 500 are checked — works first, as
  // the selection lists them — and the dialog says so before anything is checked.
  it('checks the first 500 of a bigger selection, and says so', async () => {
    JOBS.hold('reverify')
    const book_ids = Array.from({ length: 499 }, (_, i) => i + 1)
    open({ selection: { book_ids, movie_ids: [7], people: [{ kind: 'author', name: 'Tagore' }] } })
    await waitFor(() => expect(JOBS.started()).toHaveLength(1))
    expect(JOBS.started()[0]).toEqual(['reverify', { book_ids, movie_ids: [7], people: [], fills_only: false }])
    expect(screen.getByText('A check holds 500 at most, so this one has the first 500 of 501. Narrow the list for the rest.')).toBeTruthy()
  })

  it('says nothing about a cap over a selection within it', async () => {
    JOBS.hold('reverify')
    open()
    await screen.findByRole('progressbar')
    expect(screen.queryByText(/A check holds/)).toBeNull()
  })

  it('says where it stands while it waits behind another job', async () => {
    JOBS.plan('reverify', { queued: true, ahead: 2 })
    JOBS.hold('reverify')
    open()
    expect(await screen.findByRole('progressbar', { name: 'Waiting — 2 jobs ahead' })).toBeTruthy()
  })

  it('goes on when the dialog is closed, and says where it will be', async () => {
    JOBS.hold('reverify')
    open()
    await screen.findByRole('progressbar')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(closed).toBe(1)
    expect(JOBS.stops(), 'closing the dialog stopped the check').toEqual([])
    expect(await screen.findByText('Still running · Settings › Jobs')).toBeTruthy()
  })

  it('is stopped by Cancel only after the reader says so', async () => {
    JOBS.hold('reverify')
    open()
    await screen.findByRole('progressbar')
    await waitFor(() => expect(checkId()).toBeTruthy())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Stop the check?' })
    expect(within(ask).getByText('It stops after the item in hand, and is kept in Settings › Jobs with its log.')).toBeTruthy()
    // Said no: nothing stopped, nothing closed.
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(JOBS.stops()).toEqual([])
    expect(closed).toBe(0)
    // Said yes: that job is stopped, and the dialog goes.
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Stop the check?' })).getByRole('button', { name: 'Stop it' }))
    await waitFor(() => expect(JOBS.stops()).toEqual([checkId()]))
    await waitFor(() => expect(closed).toBe(1))
  })

  // A CHECK STILL IN THE QUEUE HAS NO ITEM IN HAND, so the confirm does not say it
  // stops after one: the server ends it before it starts.
  it('says a waiting check is stopped before it starts, when Cancel asks', async () => {
    JOBS.plan('reverify', { queued: true, ahead: 2 })
    JOBS.hold('reverify')
    open()
    await screen.findByRole('progressbar', { name: 'Waiting — 2 jobs ahead' })
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Stop the check?' })
    expect(within(ask).getByText('It is stopped before it starts, and kept in Settings › Jobs with its log.')).toBeTruthy()
    expect(within(ask).queryByText(/item in hand/)).toBeNull()
    fireEvent.click(within(ask).getByRole('button', { name: 'Stop it' }))
    await waitFor(() => expect(JOBS.stops()).toEqual([checkId()]))
  })

  it('says why when the check failed, and offers nothing to apply', async () => {
    JOBS.plan('reverify', { state: 'failed', error: 'Open Library did not answer' })
    open()
    expect(await screen.findByText('Open Library did not answer')).toBeTruthy()
    expect(within(dialog()).getByRole('button', { name: /^Apply/ }).disabled).toBe(true)
  })

  // STOPPED FROM SETTINGS › JOBS while this dialog watched it: a check that did
  // not reach the end has no findings, and the dialog says so rather than
  // "everything checked is already up to date".
  it('says so when the check was stopped somewhere else', async () => {
    JOBS.hold('reverify')
    open()
    await waitFor(() => expect(checkId()).toBeTruthy())
    JOBS.finish(checkId(), { state: 'stopped' })
    expect(await screen.findByText('Re-verify · Stopped', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByText(/already up to date/)).toBeNull()
  })
})

describe('the findings and the apply', () => {
  const review = async () => {
    JOBS.plan('reverify', { result: FINDINGS })
    open()
    await screen.findByText('The Paper Boat')
    await waitFor(() => expect(within(dialog()).getAllByRole('checkbox').length).toBe(3))
  }

  it('opens on what the check found, ticking the pure fill and neither the change nor the overwrite', async () => {
    await review()
    expect(within(dialog()).getAllByRole('checkbox').map((b) => b.checked)).toEqual([true, false, false])
    expect(within(dialog()).getByText('changed since the check')).toBeTruthy()
    expect(within(dialog()).getByRole('button', { name: 'Apply 1 approved change' })).toBeTruthy()
  })

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

  // A FIELD SOMEBODY CHANGED BETWEEN THE REVIEW AND THE PRESS is skipped by the
  // server rather than overwritten, and its line says why — in the server's words.
  it('shows the server’s note for an item it left alone', async () => {
    await review()
    JOBS.plan('reverify-apply', { result: [{ type: 'book', id: 3, ok: true, note: 'changed since the check' }] })
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Apply 1 approved change' }))
    expect(await within(dialog()).findByText('book 3: applied (changed since the check)')).toBeTruthy()
  })

  it('keeps the findings when the review is closed unapplied, and says where they are', async () => {
    await review()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(closed).toBe(1)
    expect(await screen.findByText('Findings kept · Settings › Jobs')).toBeTruthy()
  })

  // NOTHING TO CHANGE, NOTHING KEPT TO COME BACK TO: closing an up-to-date review
  // says nothing, where one with findings says where they are.
  it('says nothing about kept findings when the check found nothing to change', async () => {
    JOBS.plan('reverify', { result: [{ type: 'book', id: 3, title: 'The Paper Boat', status: 'ok', source: 'openlibrary', diffs: [] }] })
    open()
    expect(await within(dialog()).findByText('everything checked is already up to date ✓')).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(closed).toBe(1)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('Findings kept · Settings › Jobs')).toBeNull()
  })

  it('goes back to the review, saying why, when the apply job fails', async () => {
    await review()
    JOBS.plan('reverify-apply', { state: 'failed', error: 'The database is busy' })
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Apply 1 approved change' }))
    expect(await within(dialog()).findByText('The database is busy')).toBeTruthy()
    expect(within(dialog()).getByRole('button', { name: 'Apply 1 approved change' }).disabled).toBe(false)
  })
})
