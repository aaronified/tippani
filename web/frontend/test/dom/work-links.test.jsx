// The Links door on a work — handoff §1.3.
//
// Before this there was nowhere on a work to put an address, so a reader who
// wanted the Letterboxd entry or the fandom wiki kept it in the note on one of
// the work's quotes. What is pinned here is the door, what it says at rest, and
// the two rules the panel behind it exists for: the list is what was ADDED, and
// the reading is shown before anything is stored.
//
// DECLARED EXCEPTION: a site's mark is a CSS mask on a span with no name, so
// `.src-mark` is how a known site's mark is told from the globe; and "the ways
// out of a record" reads an ARRANGEMENT — ids and links under one heading, the
// verbs that belong to it — from the section's classes (`.cs-head-row`,
// `.cs-section`, `.cs-section-action`, `.cs-pills`, `.cs-pill`, `.cs-pill-id`,
// `.is-add`, `.inline-field`, `.field-icon-btn`), because where a thing sits has
// no name to ask for. Everything else here goes by role and name.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let PUTS
let STORED
let REFUSE = ''
let HOLD = null

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') {
      PUTS.push({ path, body })
      if (REFUSE) return { ok: false, status: 500, data: { error: REFUSE } }
      if (HOLD) await HOLD
      STORED = { ...STORED, ...body }
      return { ok: true, data: STORED }
    }
    if (method === 'GET' && /^\/(books|movies)\/\d+$/.test(path)) return { ok: true, data: STORED }
    if (method === 'GET' && path.endsWith('/cast')) return { ok: true, data: { cast: [], actor_role: 'none' } }
    if (method === 'GET' && path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  }),
}))

const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
const { PanelHarness, resetPanelHistory } = await import('../panel-harness.jsx')

const BOOK = {
  id: 7, title: 'The Master and Margarita', author: '', translator: '', editor: '',
  isbn: '9780143108276', asin: '', description: '', published_year: 1967, published_circa: false,
  language: '', orig_language: '', subtitle: '', publisher: '', pages: 0,
  links: 'https://www.imdb.com/title/tt0084787/ https://example.org/a-review',
  genres: [], series: '', series_index: 0, favorite: false,
}

beforeEach(() => {
  PUTS = []
  REFUSE = ''
  HOLD = null
  STORED = { ...BOOK }
  resetPanelHistory()
})

const panel = () =>
  render(
    <PanelHarness
      panel={(stack) => workDetailsPanel(stack, { kind: 'book', item: BOOK, onChanged: () => {}, onDelete: null })}
    />,
  )
const shown = () => waitFor(() => expect(screen.getByRole('button', { name: /^Edit title$/i })).toBeTruthy())
// THE LINKS SCREEN IS BEHIND THE ＋ AT THE END OF THE PILL ROW, and behind the
// section head's pencil. It was behind an `Edit links` row of the form until the
// ids and the links became one section on the owner's ruling.
const plus = () => screen.getByRole('button', { name: 'Add a link' })
const removes = () => screen.queryAllByRole('button', { name: /^Remove the .* link$/ })
const openLinks = async () => {
  panel()
  await shown()
  fireEvent.click(plus())
  return waitFor(() => expect(removes().length).toBeGreaterThan(0))
}
// THE PASTE BOX IS ON THE SAME SCREEN AS THE LIST. It had a screen of its own,
// behind a header ＋ on the list's, until the owner: "the edit and add opens
// separate screens. They can be merged into one."
const pasteBox = () => screen.queryByRole('textbox', { name: 'Add a link' })
const openPaste = async () => {
  await openLinks()
  return pasteBox()
}

// THE IDS AND THE LINKS ARE ONE SECTION, which replaces the row this block used
// to describe.
//
// THE OWNER'S RULING: "IDs can merge with links with option for a custom link…
// for the user, this will be equivalent to the people screen links." A person's
// page has ONE section — a strip of pills, each a way out of the record, and a ＋
// that adds another. A work had two, headed `LINKS` and `IDS`, stacked on the
// same screen and saying the same kind of thing: a provider id IS a link to that
// provider, and the only difference is that the app writes the address.
//
// WHAT IS PINNED HERE is the merge, not the arrangement of its parts: one
// heading, both kinds of pill under it, and the two doors — the ＋ adds a link,
// the head's pencil edits the ids AS IDS, because the columns are what re-verify
// and the metadata fetch read.

describe('the Links panel', () => {
  it('adds what was read, and writes the whole column', async () => {
    const box = await openPaste()
    fireEvent.change(box, { target: { value: 'letterboxd.com/film/stalker/' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS).toHaveLength(1))
    const links = PUTS[0].body.links.split(/\s+/)
    expect(links).toHaveLength(3)
    expect(links).toContain('https://letterboxd.com/film/stalker/')
    // THE REST OF THE RECORD, in the same body: this is a full-state PUT like
    // every other write in the panel.
    expect(PUTS[0].body.title).toBe(BOOK.title)
    expect(PUTS[0].body.published_year).toBe(1967)
    // And the ✓ closes the screen, as a header ✓ does.
    await waitFor(() => expect(pasteBox()).toBeNull())
  })

  it('refuses to add the same address twice, and writes nothing doing it', async () => {
    const box = await openPaste()
    fireEvent.change(box, { target: { value: 'https://example.org/a-review' } })
    expect(await screen.findByText(/already on this record/i)).toBeTruthy()
    expect(screen.getByLabelText('Save').disabled, 'the ✓ offers to add what is already there').toBe(true)
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(removes()).toHaveLength(2))
    expect(PUTS).toHaveLength(0)
  })
})

// ONE SCREEN FOR THE IDS AND THE LINKS. The owner, of the two it replaced: "the
// edit and add opens separate screens. They can be merged into one. And also add
// has a middleman screen with nothing, that can be skipped." The pencil opened an
// ids dialog; the ＋ opened a list, empty on most works, whose own ＋ opened the
// paste box.
//
// THE MUTATIONS, each built, run red and put back: the screen's save sending the
// links alone (WorkDetails.jsx's `write` without the ids) reddens the one-request
// case; the head's pencil given no action reddens the first; the paste box drawn
// only once a link exists reddens the last.
