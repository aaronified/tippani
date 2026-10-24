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
// What the screen sent to PUT /sources, for a file that is not an import at all.
const puts = []
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
    // The library the "which work?" row offers: a book, a film, a show and a game.
    if (path === '/books') return { ok: true, data: { books: [{ id: 3, title: 'Dust of Dreams', author: 'Steven Erikson' }] } }
    if (path === '/movies') {
      return {
        ok: true,
        data: {
          movies: [
            { id: 7, title: 'V for Vendetta', media_type: 'movie', release_year: 2005 },
            { id: 8, title: 'Andor', media_type: 'show', release_year: 2022 },
            { id: 9, title: 'Hades', media_type: 'game', release_year: 2020 },
          ],
        },
      }
    }
    return { ok: true, data: {} }
  },
  putUpload: async (path, file, fields) => {
    puts.push({ path, name: file.name, fields })
    return { ok: true, status: 201, data: { id: 1, name: file.name } }
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
  puts.length = 0
  progressed.length = 0
  gate = null
  reply = { status: 200, body: { staged: 3, works: [] } }
  states = ['succeeded']
  sents = []
  jobReads = 0
  kept = true
})

describe('the one import target', () => {
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

  // THE HOW-TOS ARE HELP NOW, and both halves of that are asserted, because only
  // one of them is a bug on its own. "Where do I get a Goodreads file" is a real
  // question — it was worth keeping off the wall of cards and it is still worth
  // answering — but eight step-lists are reference, not a control, and they were
  // the last reason this screen carried a fold.
  //
  // THIS SCREEN NO LONGER HOLDS THEM.

  // AND THE HELP SECTION DOES — every row of the table, not a sample of it. The
  // list is drawn FROM `SOURCES`, so a ninth parser added there appears here with
  // no edit; what this case defends is that the rendering did not quietly lose a
  // row, and that the section exists at all under its own key.
})

// A FILE IS A JOB ON THE SERVER'S QUEUE, and the row says where it stands. The
// owner's ask of Settings → Jobs was that no action skip the queue; what this
// screen owes the reader is the same answer the Jobs screen gives — waiting, and
// how many are ahead — and then the staging's own answer, read back from the job
// exactly as the request's used to be.

// AND THE PROGRESS IS ACTUALLY ASKED FOR. The move to XHR buys nothing if the
// caller passes no callback — the upload would report to nobody and the row
// would say "pending" exactly as it did before, with the API change invisible.

// A SUBTITLE OR AN EBOOK IS NOT AN IMPORT AND IS NOT AN ERROR. Its content cannot say
// which work it belongs to (a subtitle names no film inside itself), so the row asks,
// and the file goes up through the same route every other door uses. Nothing is
// staged: the summary still says so.
