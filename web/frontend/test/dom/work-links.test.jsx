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
  isbn: '9780143108276', asin: '', description: '', published_year: 1967, published_circa: false,
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
// THE LINKS PANEL IS BEHIND THE ＋ AT THE END OF THE PILL ROW. It was behind an
// `Edit links` row of the form until the ids and the links became one section on
// the owner's ruling; the row is gone and its door is the row's add control.
const openLinks = async () => {
  panel()
  await shown()
  fireEvent.click(document.querySelector('.cs-pills .cs-pill.is-add'))
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
describe('the ways out of a record', () => {
  const heads = () => [...document.querySelectorAll('.cs-head-row .cs-section')].map((el) => el.textContent.trim())
  const pills = () => [...document.querySelectorAll('.cs-pills .cs-pill')]
    .filter((el) => !el.classList.contains('is-add'))

  it('sit under one heading, not two', async () => {
    panel()
    await shown()
    expect(heads().filter((h) => /^links$/i.test(h)), 'the links section is gone or is named something else')
      .toHaveLength(1)
    expect(heads().some((h) => /^ids$/i.test(h)),
      'a second heading still separates the ids from the links, which is the thing the merge undoes')
      .toBe(false)
  })

  it('and both kinds of pill are in the one row', async () => {
    panel()
    await shown()
    const text = pills().map((el) => el.textContent).join(' | ')
    expect(text, 'the record\'s ISBN is not in the row').toContain('9780143108276')
    expect(text, 'the record\'s IMDb link is not in the row').toMatch(/imdb/i)
  })

  it('and an id still reads as an id — the mono voice, and the provider it opens', async () => {
    panel()
    await shown()
    const id = pills().find((el) => el.textContent.includes('9780143108276'))
    expect(id, 'no pill for the ISBN').toBeTruthy()
    expect(id.classList.contains('cs-pill-id'),
      'the id lost the mono voice the app uses for a number read character by character').toBe(true)
    expect(id.getAttribute('href'), 'the id pill no longer opens the catalogue that files it')
      .toContain('9780143108276')
  })

  it('and the two doors are the head\'s pencil and the row\'s ＋', async () => {
    panel()
    await shown()
    const head = [...document.querySelectorAll('.cs-head-row')]
      .find((h) => /^links$/i.test(h.querySelector('.cs-section')?.textContent?.trim() || ''))
    expect(head.querySelector('.cs-section-action'),
      'the ids have no editor: the head carries the verb that changes them, the way Cast does on this screen')
      .toBeTruthy()
    expect(document.querySelector('.cs-pills .cs-pill.is-add'),
      'the row has no way to add a link').toBeTruthy()
  })

  it('and there is no separate Links row left in the form', async () => {
    panel()
    await shown()
    const rows = [...document.querySelectorAll('.inline-field .field-icon-btn[aria-label^="Edit "]')]
      .map((b) => b.getAttribute('aria-label'))
    expect(rows, 'the form still carries a Links row, so the reader is offered the same thing twice')
      .not.toContain('Edit links')
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
