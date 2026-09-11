// ONE IMPORT TARGET, and what it says back.
//
// THE OWNER'S: "import should be single upload (and a drag and drop target) in
// the first screen." What it replaces was a wall of seven source cards, each
// with a file input of its own, and a searchable format picker on the phone
// because seven cards do not fit one — so the reader answered "which of these is
// my file" before the app would look at it.
//
// These are the three things that shape has to get right, and none of them is
// visible in the markup alone: the one target posts to the one endpoint, a file
// the app RECOGNISES AND CANNOT IMPORT is named rather than called unrecognised,
// and a file NOTHING CLAIMED gets the override — which is the only import fault
// the staging queue cannot repair, because `retarget` moves staged rows between
// works and not a file between parsers.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const uploads = []
// The progress callbacks, kept OUT of `uploads` because two cases compare a
// whole upload with toEqual — a fourth key there fails them against correct
// code, which is a test reporting its own bookkeeping as a defect.
const progressed = []
// `reply` is what the next upload answers, set per test.
let reply = { ok: true, data: { staged: 3, works: [] } }
// A promise the upload waits on before answering, or null to answer at once.
let gate = null

// THE SPY IS ON uploadWithProgress, NOT upload, and that is the point rather
// than a detail. `upload()` goes through fetch, which has NO upload-progress
// event at all — so a 5 MB clippings file staging tens of thousands of rows
// showed nothing between the first byte and the last, and a reader on a slow
// link could not tell a large upload from a hung one. Moving to XHR is the whole
// fix; a spinner would have been a picture of one.
//
// IT TAKES A PREPARED FormData rather than a file, so the fields come back out
// of the form here — which also proves `as` still rides with the bytes on a
// re-read, the thing the override depends on.
vi.mock('../../src/api.js', () => ({
  json: async () => ({ ok: true, data: {} }),
  uploadWithProgress: async (path, form, onProgress) => {
    const file = form.get('file')
    const as = form.get('as')
    uploads.push({ path, name: file.name, fields: as ? { as } : null })
    progressed.push(onProgress)
    // The real one reports 1 once the body is fully sent, before the server
    // answers. A mock that never called back would let a caller that ignores
    // progress pass this file.
    if (onProgress) onProgress(1)
    // A HELD UPLOAD, for the one case that has to look at the screen WHILE the
    // bytes are going up. Every other case wants the answer immediately, so the
    // gate is null and this is one settled promise.
    if (gate) await gate
    return reply
  },
  errText: (r, fallback) => (r.data && r.data.error) || fallback,
  coverImgURL: () => '',
}))

const { default: ImportPage } = await import('../../src/ImportPage.jsx')

const drop = (el, ...files) => fireEvent.drop(el, { dataTransfer: { files } })
const textFile = (name) => new File(['whatever'], name, { type: 'text/plain' })
const well = () => document.querySelector('.import-drop')

beforeEach(() => {
  uploads.length = 0
  progressed.length = 0
  gate = null
  reply = { ok: true, data: { staged: 3, works: [] } }
})

describe('the one import target', () => {
  it('is a single control, and the bytes pick the parser', async () => {
    render(<ImportPage />)
    // ONE file input on the screen, where there were seven. This is the assertion
    // the wall would fail, and it fails it by counting rather than by naming a
    // card — a re-styled wall is still a wall.
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1)
    drop(well(), textFile('clippings.txt'))
    await waitFor(() => expect(uploads).toHaveLength(1))
    // The sniffing endpoint, with no format asserted: the file says what it is.
    expect(uploads[0]).toEqual({ path: '/import/auto', name: 'clippings.txt', fields: null })
    // The run's own line, not the row's — both say "3 quotes staged", and the
    // summary is the one that proves the file count and the total were tallied.
    expect(await screen.findByText(/1 file → 3 quotes staged/)).toBeTruthy()
  })

  it('takes several files at once, one request each', async () => {
    render(<ImportPage />)
    drop(well(), textFile('a.md'), textFile('b.html'))
    await waitFor(() => expect(uploads).toHaveLength(2))
    expect(uploads.map((u) => u.name)).toEqual(['a.md', 'b.html'])
    // Both files counted in the run's own line, and the staged totals added.
    expect(await screen.findByText(/2 files/)).toBeTruthy()
  })

  // A ONE-TARGET IMPORT INVITES EVERY FILE A READER HAS, and "unrecognised" to a
  // Tippani backup is a worse answer than the wall was. `near_miss` names what
  // the file actually is and the words point at the door that does take it.
  it('names a file it recognises and cannot import, and offers no format list', async () => {
    reply = { ok: false, data: { error: 'server words', near_miss: 'backup' } }
    render(<ImportPage />)
    drop(well(), textFile('mine.tpbk'))
    expect(await screen.findByText(/restore it from/i)).toBeTruthy()
    // No override here: a backup is not a parser away from working, and a format
    // list would invite the reader to try eight of them.
    expect(screen.queryByLabelText('Read this file as a format you pick')).toBeNull()
  })

  it('offers the override only when nothing claimed the file, and sends it', async () => {
    reply = { ok: false, data: { error: 'server words', near_miss: '' } }
    render(<ImportPage />)
    drop(well(), textFile('mystery.txt'))
    const pick = await screen.findByLabelText('Read this file as a format you pick')
    reply = { ok: true, data: { staged: 2, works: [] } }
    // The slug is the SERVER'S — `importSources` is keyed by the importer's own
    // constants, not by the hyphenated route names — so this is the pairing that
    // answers "unknown import source" for a file that was fine.
    fireEvent.change(pick, { target: { value: 'goodreads_html' } })
    await waitFor(() => expect(uploads).toHaveLength(2))
    expect(uploads[1]).toEqual({ path: '/import/auto', name: 'mystery.txt', fields: { as: 'goodreads_html' } })
    // And the run is re-tallied off the re-read row rather than left reporting
    // the failure: one file, two quotes.
    expect(await screen.findByText(/1 file → 2 quotes staged/)).toBeTruthy()
  })

  // The seven step-lists were the one thing worth keeping off the wall: "where do
  // I get a Goodreads file" is a real question. They are behind one disclosure
  // rather than in front of seven file inputs.
  it('keeps the how-tos, collapsed, and lists the eighth source too', async () => {
    render(<ImportPage />)
    const summary = screen.getByText('Where do these files come from?')
    expect(summary.closest('details').open).toBe(false)
    fireEvent.click(summary)
    for (const name of ['Markdown', 'Readest', 'Bookcision', 'Goodreads', 'My Clippings']) {
      expect(screen.getByText(name), name).toBeTruthy()
    }
  })
})

// AND THE PROGRESS IS ACTUALLY ASKED FOR. The move to XHR buys nothing if the
// caller passes no callback — the upload would report to nobody and the row
// would say "pending" exactly as it did before, with the API change invisible.
describe('the upload reports how far it has got', () => {
  it('hands uploadWithProgress a callback', async () => {
    render(<ImportPage />)
    drop(well(), textFile('clippings.txt'))
    await waitFor(() => expect(uploads).toHaveLength(1))
    expect(typeof progressed[0], 'the upload reports progress to nobody').toBe('function')
  })

  it('draws the bar in the well while the bytes are going up', async () => {
    // THE CALLBACK ALONE IS NOT THE FEATURE. A caller can take a progress
    // callback, keep the fraction in state and render nothing with it, and the
    // case above passes on that — the reader still watches a well that says
    // "uploading" and nothing else. So this one holds the upload open and looks
    // at the screen.
    let release
    gate = new Promise((r) => { release = r })
    render(<ImportPage />)
    drop(well(), textFile('clippings.txt'))
    await waitFor(() => expect(document.querySelector('.import-drop [role="progressbar"]')).toBeTruthy())
    release()
    // AND IT GOES WHEN THE UPLOAD DOES. A bar left behind after the answer lands
    // is the "pending" row's failure in a new shape: something on screen that
    // stopped meaning anything.
    await waitFor(() => expect(document.querySelector('[role="progressbar"]')).toBeNull())
  })
})
