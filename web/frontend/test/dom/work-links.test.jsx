// The Links door on a work — handoff §1.3.
//
// Before this there was nowhere on a work to put an address, so a reader who
// wanted the Letterboxd entry or the fandom wiki kept it in the note on one of
// the work's quotes. What is pinned here is the door, what it says at rest, and
// the two rules the panel behind it exists for: the list is what was ADDED, and
// the reading is shown before anything is stored.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let PUTS
let STORED

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') {
      PUTS.push({ path, body })
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
  isbn: '', asin: '', description: '', published_year: 1967, published_circa: false,
  language: '', orig_language: '', subtitle: '', publisher: '', pages: 0,
  links: 'https://www.imdb.com/title/tt0084787/ https://example.org/a-review',
  genres: [], series: '', series_index: 0, favorite: false,
}

beforeEach(() => {
  PUTS = []
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
const openLinks = async () => {
  panel()
  await shown()
  fireEvent.click(screen.getByRole('button', { name: /^Edit links$/i }))
  return waitFor(() => {
    const el = document.querySelector('.work-link-row')
    expect(el).toBeTruthy()
    return el
  })
}
// A PANEL MAY CARRY ONE VERB IN ITS HEADER, AND ONLY ITS OWN (§1.12): the list is
// what is already there, so adding to it is its own surface rather than a last
// row pretending to be a link.
const openPaste = async () => {
  await openLinks()
  // The header verb, not the empty state's button — this record has links. It is
  // "Add a link" and not "Paste a link" since the panel gained the derived list:
  // pasting is one of the two ways in behind that one verb, not the verb itself.
  fireEvent.click(screen.getByRole('button', { name: /^Add a link$/i }))
  // The panel is named after the verb too, so the box is asked for by tag.
  return waitFor(() => {
    const el = document.querySelector('.tp-panel input.tp-input')
    expect(el).toBeTruthy()
    return el
  })
}

describe('the Links row', () => {
  it('names the sites rather than counting them', async () => {
    panel()
    await shown()
    const row = [...document.querySelectorAll('.inline-field')]
      .find((el) => el.querySelector('[aria-label="Edit links"]'))
    expect(row.textContent).toContain('IMDb')
    expect(row.textContent).toContain('web page')
    // NO SOURCE TAG on the summary row: the links under it come from a dozen
    // places and one of them is a pasted address, so one tag over the lot would
    // be describing none of them.
    expect(row.querySelector('.field-src')).toBeNull()
  })

  it('is last, because a link is where you go next', async () => {
    panel()
    await shown()
    const order = [...document.querySelectorAll('.inline-field .field-icon-btn[aria-label^="Edit "]')]
      .map((b) => b.getAttribute('aria-label').replace(/^Edit /, ''))
    expect(order[order.length - 1]).toBe('links')
  })
})

describe('the Links panel', () => {
  it('draws a known site with its mark and anything else under the globe', async () => {
    await openLinks()
    const rows = [...document.querySelectorAll('.work-link-row')]
    expect(rows).toHaveLength(2)
    // The site's own mark is a mask, not an <img> — see providerMarks.js.
    expect(rows[0].querySelector('.src-mark')).toBeTruthy()
    // AND THE GLOBE IS NOT A FAILURE STATE, so the second row wears a glyph
    // rather than an error: it is a kind of link, not a broken one.
    expect(rows[1].querySelector('.src-mark')).toBeNull()
    expect(rows[1].querySelector('svg')).toBeTruthy()
    expect(rows[1].textContent).toContain('example.org/a-review')
  })

  it('says what a pasted address will be read as before it is stored', async () => {
    const box = await openPaste()
    fireEvent.change(box, { target: { value: 'letterboxd.com/film/stalker/' } })
    expect(await screen.findByText(/Reads as Letterboxd/)).toBeTruthy()
    // Nothing is stored by typing.
    expect(PUTS).toHaveLength(0)
  })

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
    // And walking back lands on a list that is showing it.
    await waitFor(() => expect(document.querySelectorAll('.work-link-row')).toHaveLength(3))
  })

  it('refuses to add the same address twice, and writes nothing doing it', async () => {
    const box = await openPaste()
    fireEvent.change(box, { target: { value: 'https://example.org/a-review' } })
    expect(await screen.findByText(/already on this record/i)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(document.querySelectorAll('.work-link-row')).toHaveLength(2))
    expect(PUTS).toHaveLength(0)
  })

  it('takes one off, leaving the other', async () => {
    await openLinks()
    fireEvent.click(screen.getByRole('button', { name: /Remove the IMDb link/i }))
    await waitFor(() => expect(PUTS).toHaveLength(1))
    expect(PUTS[0].body.links).toBe('https://example.org/a-review')
  })

  it('will not add what is not an address', async () => {
    const box = await openPaste()
    fireEvent.change(box, { target: { value: 'stalker' } })
    // The panel's own ✓ is greyed with the reason on it, which is how every other
    // blocked key in this app says no.
    expect(screen.getByLabelText('Save').disabled).toBe(true)
    expect(await screen.findByText(/not an address yet/)).toBeTruthy()
  })
})
