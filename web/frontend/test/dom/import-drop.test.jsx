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
import { HelpList } from '../../src/ui.jsx'
import { SOURCES, sourceTitle } from '../../src/importSources.js'
import { helpFor } from '../../src/help.jsx'

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

  // AND IT SAYS WHAT HAPPENS IF YOU WALK AWAY, which is the half a reader cannot
  // see and would guess wrongly about. A file nothing claimed is answered with a
  // 400 and NO batch row: nothing is in the database, nothing is on Checks, and
  // the override above works only because this page still holds the File the
  // browser handed it. Reload and it is gone.
  //
  // The owner settled the alternative — persisting rejected uploads, so a failed
  // import waits on you like everything else on Checks — and chose against it,
  // for a migration, the bytes and a retention policy. The row saying so is what
  // that ruling costs, and the reader who assumes the app kept their file is the
  // defect it would otherwise leave behind.
  it('says the file is not queued anywhere, so nobody assumes it was kept', async () => {
    reply = { ok: false, data: { error: 'server words', near_miss: '' } }
    render(<ImportPage />)
    drop(well(), textFile('mystery.txt'))
    await screen.findByLabelText('Read this file as a format you pick')
    expect(await screen.findByText(/not waiting anywhere/i)).toBeTruthy()
  })

  it('and says it only where the file actually failed', async () => {
    // A recognised-but-unimportable file has its own door (restore) and is not
    // sitting unqueued in the sense this line is about; a file that STAGED
    // something is queued, so the line would be a lie on both.
    reply = { ok: false, data: { error: 'server words', near_miss: 'backup' } }
    render(<ImportPage />)
    drop(well(), textFile('mine.tpbk'))
    await screen.findByText(/restore it from/i)
    expect(screen.queryByText(/not waiting anywhere/i)).toBeNull()
  })

  // THE HOW-TOS ARE HELP NOW, and both halves of that are asserted, because only
  // one of them is a bug on its own. "Where do I get a Goodreads file" is a real
  // question — it was worth keeping off the wall of cards and it is still worth
  // answering — but eight step-lists are reference, not a control, and they were
  // the last reason this screen carried a fold.
  //
  // THIS SCREEN NO LONGER HOLDS THEM.
  it('leaves the step-lists to help rather than folding them under the target', () => {
    render(<ImportPage />)
    expect(screen.queryByText('Bookcision'), 'the screen kept its own copy of the source list').toBeNull()
    // AND ITS SHAPE IS GONE TOO, not just the eight names. A numbered list is
    // what a step-list IS here, and this screen draws no other — so an `ol`
    // surviving would mean the markup outlived the words it held.
    expect(document.querySelector('ol'), 'a step-list outlived the source list').toBeNull()
  })

  // AND THE HELP SECTION DOES — every row of the table, not a sample of it. The
  // list is drawn FROM `SOURCES`, so a ninth parser added there appears here with
  // no edit; what this case defends is that the rendering did not quietly lose a
  // row, and that the section exists at all under its own key.
  it('and the import help section draws every source in the table', () => {
    render(<HelpList entries={helpFor('import').entries} />)
    for (const s of SOURCES) {
      expect(screen.getByText(sourceTitle(s.kind)), s.kind).toBeTruthy()
    }
    // The extension is a hint about which file is yours, so it is printed beside
    // the name — detection is by content and never by this.
    expect(screen.getAllByText('.txt').length, 'the extension hint is gone').toBeGreaterThan(0)
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
