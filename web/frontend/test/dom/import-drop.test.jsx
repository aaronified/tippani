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
// `reply` is what the next upload answers, set per test.
let reply = { ok: true, data: { staged: 3, works: [] } }

vi.mock('../../src/api.js', () => ({
  json: async () => ({ ok: true, data: {} }),
  upload: async (path, file, fields) => {
    uploads.push({ path, name: file.name, fields: fields || null })
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
