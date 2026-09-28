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
//
// FROM 3.1.0 EACH FILE IS A JOB, so the fake below answers an upload as the
// server does — 202 and the job — and knows the two reads that follow one: the
// job at /jobs/{id} (its id, kind, state and `ahead`) and, once it has ended, its
// result at /jobs/{id}/result, whose {status, body} is what the route answered
// before imports queued. Those addresses and fields are the wire contract jobs.js
// owns, declared here because the screen cannot be driven without them.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HelpList } from '../../src/ui.jsx'
import { SOURCES, sourceTitle } from '../../src/importSources.js'
import { helpFor } from '../../src/help.jsx'
import { pickFrom } from './helpers/pickFrom.jsx'

const uploads = []
// The progress callbacks, kept OUT of `uploads` because two cases compare a
// whole upload with toEqual — a fourth key there fails them against correct
// code, which is a test reporting its own bookkeeping as a defect.
const progressed = []
// `reply` is what the next file's import answers once its job has run — the
// status and body the route answered before imports queued — set per test.
let reply = { status: 200, body: { staged: 3, works: [] } }
// A promise the upload waits on before answering, or null to answer at once.
let gate = null
// AN IMPORT IS A JOB ON THE SERVER'S QUEUE (3.1.0), so the upload is answered as
// the server answers it: 202 and the job it queued. `states` is what each read of
// that job says, in turn (the last one repeated); `sents` is the upload's own
// answer, one per upload in turn, where a case needs a refusal that queued
// nothing (null, or a list run dry, is the 202).
let states = ['succeeded']
let sents = []
let jobReads = 0
// Whether a job that ended with no answer kept its upload, as the server says it
// on the job (`rerunnable`): a stopped import keeps it, one cut off just after
// letting go of it does not.
let kept = true
const JOB = 70

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
  // The two reads a followed job makes: the job itself, and once it has ended,
  // its result. A job stopped before it ran has no result, as on the server.
  json: async (method, path) => {
    if (path.startsWith(`/jobs/${JOB}?`)) {
      const state = states[Math.min(jobReads++, states.length - 1)]
      const halted = state === 'stopped' || state === 'interrupted'
      return { ok: true, data: { job: { id: JOB, kind: 'import', state, ahead: state === 'queued' ? 2 : 0, rerunnable: halted && kept }, lines: [] } }
    }
    if (path === `/jobs/${JOB}/result`) {
      const ran = states[states.length - 1] === 'succeeded' || states[states.length - 1] === 'failed'
      return { ok: true, data: { kind: 'import', result: ran ? reply : null } }
    }
    return { ok: true, data: {} }
  },
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
    const sent = sents.shift()
    if (sent) return sent
    jobReads = 0
    return { ok: true, status: 202, data: { job: { id: JOB, kind: 'import', state: 'queued', ahead: 2 } } }
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
  reply = { status: 200, body: { staged: 3, works: [] } }
  states = ['succeeded']
  sents = []
  jobReads = 0
  kept = true
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
    reply = { status: 400, body: { error: 'server words', near_miss: 'backup' } }
    render(<ImportPage />)
    drop(well(), textFile('mine.tpbk'))
    expect(await screen.findByText(/restore it from/i)).toBeTruthy()
    // No override here: a backup is not a parser away from working, and a format
    // list would invite the reader to try eight of them.
    expect(screen.queryByLabelText('Read this file as a format you pick')).toBeNull()
  })

  it('offers the override only when nothing claimed the file, and sends it', async () => {
    reply = { status: 400, body: { error: 'server words', near_miss: '' } }
    render(<ImportPage />)
    drop(well(), textFile('mystery.txt'))
    await screen.findByLabelText('Read this file as a format you pick')
    reply = { status: 200, body: { staged: 2, works: [] } }
    // PRESSED BY NAME, AND THE SLUG IS STILL THE THING UNDER TEST. The chooser is
    // the app's own now, so it is opened and the row reading "Goodreads" is
    // pressed — but the assertion below is unchanged, and it is the whole point:
    // `importSources` is keyed by the importer's own constants, not by the
    // hyphenated route names, so what the row SENDS is the pairing that answers
    // "unknown import source" for a file that was fine.
    pickFrom('Read this file as a format you pick', 'Goodreads')
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
    reply = { status: 400, body: { error: 'server words', near_miss: '' } }
    render(<ImportPage />)
    drop(well(), textFile('mystery.txt'))
    await screen.findByLabelText('Read this file as a format you pick')
    expect(await screen.findByText(/nothing was queued from this file/i)).toBeTruthy()
  })

  it('and says it only where the file actually failed', async () => {
    // A recognised-but-unimportable file has its own door (restore) and is not
    // sitting unqueued in the sense this line is about; a file that STAGED
    // something is queued, so the line would be a lie on both.
    reply = { status: 400, body: { error: 'server words', near_miss: 'backup' } }
    render(<ImportPage />)
    drop(well(), textFile('mine.tpbk'))
    await screen.findByText(/restore it from/i)
    expect(screen.queryByText(/nothing was queued from this file/i)).toBeNull()
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

// A FILE IS A JOB ON THE SERVER'S QUEUE, and the row says where it stands. The
// owner's ask of Settings → Jobs was that no action skip the queue; what this
// screen owes the reader is the same answer the Jobs screen gives — waiting, and
// how many are ahead — and then the staging's own answer, read back from the job
// exactly as the request's used to be.
describe('each file waits its turn on the queue', () => {
  it('says how many jobs are ahead, then what it staged', async () => {
    states = ['queued', 'succeeded']
    render(<ImportPage />)
    drop(well(), textFile('clippings.txt'))
    expect(await screen.findByText(/Waiting — 2 jobs ahead/)).toBeTruthy()
    expect(await screen.findByText(/1 file → 3 quotes staged/, undefined, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByText(/Waiting —/)).toBeNull()
  })

  it('a file stopped before it staged says Settings → Jobs can run it again', async () => {
    states = ['stopped']
    render(<ImportPage />)
    drop(well(), textFile('clippings.txt'))
    expect(await screen.findByText('Stopped — Settings → Jobs can run it again')).toBeTruthy()
    // Not the override: the upload is kept on the server, and the file is not a
    // parser away from working.
    expect(screen.queryByLabelText('Read this file as a format you pick')).toBeNull()
  })

  // AND ONLY WHERE THERE IS ONE. An import cut off by a restart just after it let
  // go of its upload, before its staging committed, has nothing to run again, and
  // its job says so; the row sends the reader back to the file this page still
  // holds rather than to a Run again that is not there.
  //
  // Mutation: the row pointing at Run again whatever the job says (the halted
  // branch reading no `rerunnable`): red.
  it('a file whose job kept no upload says to drop it again, not to run it again', async () => {
    states = ['interrupted']
    kept = false
    render(<ImportPage />)
    drop(well(), textFile('clippings.txt'))
    expect(await screen.findByText('Interrupted — the server no longer has this file; drop it again')).toBeTruthy()
    expect(screen.queryByText(/Settings → Jobs can run it again/)).toBeNull()
  })

  it('a refusal that queued nothing is shown as the server said it', async () => {
    sents = [{ ok: false, status: 429, data: { error: 'five of your jobs are already waiting' } }]
    render(<ImportPage />)
    drop(well(), textFile('clippings.txt'))
    expect(await screen.findByText('five of your jobs are already waiting')).toBeTruthy()
  })

  // EVERY FILE IS ON THE SERVER BEFORE ANY OF THEM HAS RUN: a batch dropped
  // behind a long job is sent at once, not a file at a time as each one's turn
  // comes, because a file sent is one a closed tab cannot lose.
  it('sends the whole batch while its first file is still waiting', async () => {
    // Waiting for good, until the case says otherwise: a batch that sent its
    // second file only once the first had run would never send it here.
    states = ['queued']
    render(<ImportPage />)
    drop(well(), textFile('a.md'), textFile('b.md'))
    await waitFor(() => expect(uploads).toHaveLength(2))
    expect(screen.getAllByText(/Waiting — 2 jobs ahead/)).toHaveLength(2)
    expect(screen.queryByText(/→ \d+ quotes staged/)).toBeNull()
    states = ['succeeded']
    expect(await screen.findByText(/2 files → 6 quotes staged/, undefined, { timeout: 8000 })).toBeTruthy()
  }, 20000)

  // FIVE OF A READER'S JOBS AT A TIME is the queue's rule, so a file the server
  // turns away for that waits in the page until one of this batch's has run, and
  // is sent again then — it is not reported as failed while the batch is still
  // going.
  it('a file refused for the five-job limit is sent again once one of the batch has run', async () => {
    sents = [null, { ok: false, status: 429, data: { error: 'five of your jobs are already waiting' } }]
    render(<ImportPage />)
    drop(well(), textFile('a.md'), textFile('b.md'))
    expect(await screen.findByText(/2 files → 6 quotes staged/, undefined, { timeout: 4000 })).toBeTruthy()
    expect(uploads.map((u) => u.name)).toEqual(['a.md', 'b.md', 'b.md'])
    expect(screen.queryByText('five of your jobs are already waiting')).toBeNull()
  })

  // SENDING IS NOT WAITING. A file already sent is a job on the server, and it
  // can wait for hours behind somebody else's; the well stayed locked for all of
  // it, saying "Uploading…" with nothing uploading. It is free once the bytes are
  // up, and a file dropped then joins the row still waiting rather than wiping it.
  //
  // Mutation: the well kept busy until every row has its answer (the send loop
  // waiting for its jobs before it lets go): red — the well still says
  // Uploading…, and the second drop sends nothing.
  it('the well is free while a sent file waits, and a second drop joins its row', async () => {
    states = ['queued']
    render(<ImportPage />)
    drop(well(), textFile('a.md'))
    expect(await screen.findByText(/Waiting — 2 jobs ahead/)).toBeTruthy()
    expect(within(well()).getByText('Choose file — one or many')).toBeTruthy()
    expect(within(well()).queryByText('Uploading…')).toBeNull()
    drop(well(), textFile('b.md'))
    await waitFor(() => expect(uploads).toHaveLength(2))
    const waiting = (name) => (_, el) => el?.tagName === 'P' && new RegExp(`^${name}\\s+Waiting`).test(el.textContent)
    expect(await screen.findByText(waiting('a\\.md'))).toBeTruthy()
    expect(await screen.findByText(waiting('b\\.md'))).toBeTruthy()
    states = ['succeeded']
    expect(await screen.findByText(/2 files → 6 quotes staged/, undefined, { timeout: 8000 })).toBeTruthy()
  }, 20000)

  // THE N1 NOTE: a closed tab keeps every file already sent — each is a job — and
  // loses the ones not sent yet, which are still only in this page. So while a
  // batch is sending, the rows say which is which.
  it('a batch still sending says which files are not sent yet', async () => {
    let release
    gate = new Promise((r) => { release = r })
    render(<ImportPage />)
    drop(well(), textFile('a.md'), textFile('b.md'))
    // The row of the file still in the page, read whole: its name, then the words.
    const unsent = (_, el) => el?.tagName === 'P' && /^b\.md\s+not sent yet$/.test(el.textContent)
    expect(await screen.findByText(unsent)).toBeTruthy()
    expect(screen.getByText(/one not sent yet does not/)).toBeTruthy()
    release()
    expect(await screen.findByText(/2 files → 6 quotes staged/, undefined, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByText(unsent)).toBeNull()
    expect(screen.queryByText(/one not sent yet does not/)).toBeNull()
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
