// PER-FIELD MIX AND MATCH in the re-verify reviewer.
//
// A work pinned to two suppliers is now asked of both, so one field can carry two
// answers that disagree — and the reader is choosing a SOURCE as much as a value.
// The reviewer's old shape encoded the opposite: two columns, "stored" and
// "fresh", with a checkbox, because a record took every field from one supplier
// chosen for the whole row.
//
// What these tests pin is the wire, because that is what the server acts on: the
// value sent for a field must be the value belonging to the SOURCE that was
// picked, and the `sources` map must say which one it was. Getting that pairing
// wrong writes one supplier's text under another supplier's name, which is worse
// than either alone and invisible afterwards.
//
// SINCE 3.1.0 THE CHECK AND THE APPLY ARE JOBS on the server's queue: the flow
// starts a `reverify` job, reviews what its result says, and applies through a
// `reverify-apply` job whose items are what these cases read. The jobs routes
// are answered by test/dom/helpers/jobsServer.js, which declares what it knows.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { jobsServer } from './helpers/jobsServer.js'

let JOBS
let ITEMS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    const job = JOBS.answer(method, path, body)
    if (job) return job
    return { ok: true, data: {} }
  }),
}))

const { ReverifyFlow } = await import('../../src/ReverifyReview.jsx')

// A film both suppliers answered for, disagreeing about the description and
// agreeing about nothing else worth choosing.
const dualPinned = () => [{
  type: 'movie', id: 1, title: 'The Matrix', status: 'ok',
  source: 'tvdb', sources: ['tvdb', 'tmdb'],
  diffs: [
    {
      field: 'description', stored: 'old text', fresh: "TheTVDB's description.",
      alts: [
        { source: 'tvdb', value: "TheTVDB's description." },
        { source: 'tmdb', value: "TMDB's description." },
      ],
    },
    // A field only one supplier answered for: no choice, old two-column shape.
    { field: 'director', stored: '', fresh: 'The Wachowskis' },
  ],
}]

async function openReview() {
  JOBS.plan('reverify', { result: ITEMS })
  JOBS.plan('reverify-apply', { result: [{ type: 'movie', id: 1, ok: true }] })
  render(<ReverifyFlow selection={{ movie_ids: [1] }} onClose={() => {}} onFlash={() => {}} onDone={() => {}} />)
  await screen.findByText('The Matrix')
  // NO CLICK TO EXPAND. A single changed item opens itself, so clicking the
  // toggle here would CLOSE it — which is how this test first failed, with the
  // rows genuinely rendered and then genuinely hidden again.
  await waitFor(() => expect(document.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0))
}

// The first item of the apply job the flow started.
function applyBody() {
  const started = JOBS.started().find(([kind]) => kind === 'reverify-apply')
  return started?.[1]?.items?.[0]
}

describe('per-field mix and match', () => {
  beforeEach(() => {
    JOBS = jobsServer()
    ITEMS = dualPinned()
  })

  it('sends the picked supplier value and names it in sources', async () => {
    await openReview()
    fireEvent.click(screen.getByText("TMDB's description.").closest('button'))
    fireEvent.click(await screen.findByText(/^Apply/i))
    await waitFor(() => expect(applyBody()).toBeTruthy())
    const item = applyBody()
    // THE PAIRING IS THE WHOLE POINT: TMDB's words, recorded as TMDB's.
    expect(item.set.description).toBe("TMDB's description.")
    expect(item.sources.description).toBe('tmdb')
  })

})
