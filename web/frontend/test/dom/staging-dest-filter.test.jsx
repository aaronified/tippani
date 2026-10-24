// NARROWING THE QUEUE TO A DESTINATION, WHICH IS THE OTHER QUESTION.
//
// The queue had one filter — by FILE — and the endpoint has taken `?work_id=`
// beside `?batch_id=` all along. A reader with four Kindle exports of one library
// asks "what is going into THIS book" far more often than "what did that export
// bring", and could not.
//
// AND THE POSTER IS THE POINT, not decoration. A dropdown of titles beside a
// dropdown of filenames is the same control twice; a strip of covers is how a book
// is picked out of a queue by looking. `stagedWorkRow` carried no path to draw one
// from until `target_cover`.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', () => ({
  json: async (method, path) => {
    if (method === 'GET' && path === '/import/staged') {
      return { ok: true, data: { pending: 3, batches: BATCHES, ...(shelf || { works: WORKS, quotes: QUOTES }) } }
    }
    return { ok: true, data: {} }
  },
  errText: (r, fallback) => (r.data && r.data.error) || fallback,
  // The real builder, so a case can tell a cover apart from a stand-in by its src.
  coverImgURL: (p) => (p ? `/covers/${p}` : ''),
}))

// TWO EXPORTS OF ONE LIBRARY, which is the case the filter is for: `dune-a.md` and
// `dune-b.md` both carry lines bound for the SAME book, staged as two separate
// `staged_works` rows. A filter keyed on the staged id would offer "Dune" twice and
// narrow to half its quotes; `target_id` is what a reader means by "this book".
const BATCHES = [
  { id: 1, filename: 'dune-a.md', source: 'markdown', quotes: 2 },
  { id: 2, filename: 'dune-b.md', source: 'markdown', quotes: 1 },
]
const WORKS = [
  { id: 1, kind: 'book', title: 'Dune', quotes: 2, batch_id: 1, target_id: 42, target_title: 'Dune', target_cover: 'dune.jpg' },
  { id: 2, kind: 'book', title: 'Dune', quotes: 1, batch_id: 2, target_id: 42, target_title: 'Dune', target_cover: 'dune.jpg' },
  // A film with no artwork at all, so the stand-in has a case of its own.
  { id: 3, kind: 'movie', title: 'Solaris', quotes: 1, batch_id: 1, target_id: 7, target_title: 'Solaris', target_cover: '' },
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
  q(13, 2, 2, 'A beginning is a delicate time.'),
  q(14, 3, 1, 'We do not want other worlds.'),
]

// What the queue answers with, set per case.
let shelf = null

const { default: StagingPage } = await import('../../src/StagingPage.jsx')

const noop = () => {}
const page = async (fixture = null) => {
  shelf = fixture
  render(<StagingPage embedded onPending={noop} onOpenBook={noop} onOpenMovie={noop} onApproved={noop} />)
  await screen.findByText(/The spice must flow/)
}

// SCOPED TO THE STRIP, and that is not fussiness: each GROUP HEADING also draws its
// destination as a button, so a bare `getByRole('button', { name: /Dune/ })` finds
// three things — the chip and two headings — and a case that reached for the wrong
// one would be pressing a link to the book instead of the filter.
const chips = () => [...document.querySelectorAll('.staging-dest-chip')]
const chip = (name) => chips().find((b) => b.textContent.includes(name))

describe('narrowing the import queue by destination', () => {

  it('and narrows to that destination across every file it came in', async () => {
    await page()
    fireEvent.click(chip('Dune'))
    // BOTH exports' Dune quotes survive — the point of keying on target_id. The
    // second is in a different batch, so a filter keyed on the staged work would
    // have dropped it.
    expect(screen.getByText(/The spice must flow/)).toBeTruthy()
    expect(screen.getByText(/A beginning is a delicate time/)).toBeTruthy()
    expect(screen.queryByText(/We do not want other worlds/)).toBeNull()
  })

})
