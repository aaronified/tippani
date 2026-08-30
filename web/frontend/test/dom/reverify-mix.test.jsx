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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS
let ITEMS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (path === '/metadata/reverify') {
      return { ok: true, data: { items: ITEMS, checked: ITEMS.length, changed: ITEMS.length } }
    }
    if (path === '/metadata/reverify/apply') {
      return { ok: true, data: { applied: 1, failed: 0, results: [{ type: 'movie', id: 1, ok: true }] } }
    }
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
  render(<ReverifyFlow selection={{ movie_ids: [1] }} onClose={() => {}} onFlash={() => {}} onDone={() => {}} />)
  await screen.findByText('The Matrix')
  // NO CLICK TO EXPAND. A single changed item opens itself (ReverifyReview.jsx:328),
  // so clicking the toggle here would CLOSE it — which is how this test first
  // failed, with the rows genuinely rendered and then genuinely hidden again.
  await waitFor(() => expect(document.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0))
}

function applyBody() {
  const call = CALLS.find(([, p]) => p === '/metadata/reverify/apply')
  return call?.[2]?.items?.[0]
}

describe('per-field mix and match', () => {
  beforeEach(() => {
    CALLS = []
    ITEMS = dualPinned()
  })

  it('offers a cell per supplier only where they disagree', async () => {
    await openReview()
    // Both suppliers are named against the description.
    await waitFor(() => expect(screen.getAllByText(/TheTVDB/i).length).toBeGreaterThan(0))
    expect(screen.getByText("TMDB's description.")).toBeTruthy()
    expect(screen.getByText("TheTVDB's description.")).toBeTruthy()
    // The single-answer field keeps the plain fresh column.
    expect(screen.getByText('The Wachowskis')).toBeTruthy()
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

  it('defaults an untouched tick to the preferred supplier', async () => {
    await openReview()
    // Tick the checkbox rather than picking a cell.
    const boxes = document.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(boxes[0])
    fireEvent.click(await screen.findByText(/^Apply/i))
    await waitFor(() => expect(applyBody()).toBeTruthy())
    const item = applyBody()
    expect(item.set.description).toBe("TheTVDB's description.")
    expect(item.sources.description).toBe('tvdb')
  })
})
