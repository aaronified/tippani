// The Links door on a work — handoff §1.3.
//
// Before this there was nowhere on a work to put an address, so a reader who
// wanted the Letterboxd entry or the fandom wiki kept it in the note on one of
// the work's quotes. What is pinned here is the door, what it says at rest, and
// the two rules the panel behind it exists for: the list is what was ADDED, and
// the reading is shown before anything is stored.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

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
const { ToastHost } = await import('../../src/ui.jsx')
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
const linkPill = (url) => screen.queryAllByRole('link').find((a) => a.getAttribute('href') === url)

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

  // ONE PILL PER DESTINATION. An id's pill opens the address the app BUILDS from
  // it, and the reader can paste that same address into the links panel — so the
  // two halves of the merged row can name one page twice, which is the standing
  // rule ("a row says a thing once") broken by the merge that was meant to serve
  // it. The ID wins: its pill carries the record's own number under the
  // provider's mark, where the link's would carry a host.
  it('draws one pill per destination, not one per way of storing it', async () => {
    STORED = { ...BOOK, links: `${BOOK.links}\nhttps://books.google.com/books?vid=ISBN9780143108276` }
    render(
      <PanelHarness
        panel={(stack) => workDetailsPanel(stack, { kind: 'book', item: STORED, onChanged: () => {}, onDelete: null })}
      />,
    )
    await shown()
    const urls = pills().map((el) => el.getAttribute('href')).filter(Boolean)
    const dupes = urls.filter((u, i) => urls.indexOf(u) !== i)
    expect(dupes, `the row draws ${dupes.length} address twice — the id and the link name one page`).toEqual([])
    // And the survivor is the id, which is the half that carries the number.
    const isbn = pills().find((el) => el.textContent.includes('9780143108276'))
    expect(isbn, 'deduping took the id rather than the link').toBeTruthy()
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

  // A NAME IS OPTIONAL, AND GIVING ONE IS THE OWNER'S CHOSEN SHAPE FOR THIS
  // PANEL: "'Add a link' takes a URL with an optional label."
  //
  // WHAT IS PINNED HERE is that the name reaches storage and comes back as what
  // the row is CALLED. Where it is stored — after a pipe, in the same field —
  // is `link-names.test.js`'s subject and deliberately not asked here: this case
  // should survive somebody moving it to a column.
  it('takes a name for the link, and the row is called by it', async () => {
    const box = await openPaste()
    fireEvent.change(box, { target: { value: 'example.net/talks' } })
    fireEvent.change(screen.getByLabelText(/What to call it/i), { target: { value: 'Their talks' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS).toHaveLength(1))
    expect(PUTS[0].body.links, 'the name never reached the record').toContain('Their talks')
    await waitFor(() => {
      const rows = [...document.querySelectorAll('.work-link-row')].map((el) => el.textContent)
      expect(rows.join(' | '), 'the link was named and the row it made does not say so')
        .toContain('Their talks')
    })
  })

  it('and leaving the name empty changes nothing about how a link is stored', async () => {
    // EVERY LINK IN EVERY LIBRARY TODAY HAS NO NAME. A field that gained a
    // separator, or a trailing space, on a link nobody named would be this change
    // rewriting data it was told not to touch.
    const box = await openPaste()
    fireEvent.change(box, { target: { value: 'example.net/talks' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS).toHaveLength(1))
    const lines = PUTS[0].body.links.split('\n')
    expect(lines).toContain('https://example.net/talks')
    for (const line of lines) {
      expect(line, `a link nobody named was stored as ${JSON.stringify(line)}`).toBe(line.trim())
      expect(line, 'a link nobody named gained a separator').not.toContain('|')
    }
  })

  // AND THE SECOND LINK DOES NOT COST THE FIRST ITS NAME.
  //
  // THE GAP THIS FILLS, found by mutation rather than by reading: dropping the
  // names of the OTHER rows while appending left every case here green, because
  // nothing in the fixture had a name to lose. Adding a link rewrites the whole
  // field — that is what makes it the place a name goes missing, silently and for
  // good.
  it('and naming one link does not erase the name on another', async () => {
    const box = await openPaste()
    fireEvent.change(box, { target: { value: 'example.net/talks' } })
    fireEvent.change(screen.getByLabelText(/What to call it/i), { target: { value: 'Their talks' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS).toHaveLength(1))
    await waitFor(() => expect(pasteBox()).toBeNull())

    fireEvent.click(document.querySelector('.cs-pills .cs-pill.is-add'))
    await waitFor(() => expect(document.querySelectorAll('.work-link-row')).toHaveLength(3))
    const again = pasteBox()
    fireEvent.change(again, { target: { value: 'letterboxd.com/film/stalker/' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS).toHaveLength(2))
    expect(PUTS[1].body.links, 'the second link was added and the first lost its name')
      .toContain('Their talks')
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
    // And the ✓ closes the screen, as a header ✓ does.
    await waitFor(() => expect(pasteBox()).toBeNull())
  })

  // AND THE ROW SHOWS IT AFTERWARDS, which is the whole point of the merge: the
  // section is the record's ways out, so a way out that has just been added is
  // one of them. The old arrangement could not be wrong about this — the Links
  // ROW printed a summary and the pills were the ids' — and the new one can, if
  // the details panel goes on holding the record it was rendered with.
  //
  it('and the pill row behind the panel is showing it when you come back', async () => {
    const box = await openPaste()
    fireEvent.change(box, { target: { value: 'letterboxd.com/film/stalker/' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS).toHaveLength(1))
    await waitFor(() => {
      expect(linkPill('https://letterboxd.com/film/stalker/'), 'the link was saved and the row it was added to does not know')
        .toBeTruthy()
    })
  })

  it('refuses to add the same address twice, and writes nothing doing it', async () => {
    const box = await openPaste()
    fireEvent.change(box, { target: { value: 'https://example.org/a-review' } })
    expect(await screen.findByText(/already on this record/i)).toBeTruthy()
    expect(screen.getByLabelText('Save').disabled, 'the ✓ offers to add what is already there').toBe(true)
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
describe('the ids and the links on one screen', () => {
  // The head's verb, found beside the heading it belongs to: "Edit" alone is
  // also Cast's.
  const pencil = () => within(screen.getByText(/^links$/i).parentElement).getByRole('button', { name: /edit/i })

  it('the head\'s pencil opens it, with every id and the paste box', async () => {
    panel()
    await shown()
    fireEvent.click(pencil())
    await waitFor(() => expect(pasteBox(), 'the pencil opened a screen with no way to add a link').toBeTruthy())
    expect(screen.getByLabelText(/^ISBN$/i).value).toBe('9780143108276')
    expect(removes()).toHaveLength(2)
    // THE PENCIL EDITS IDS, so it lands on the first of them and not in the box.
    expect(document.activeElement).toBe(screen.getByLabelText(/^ISBN$/i))
  })

  it('and an id and a link go out together on the one ✓', async () => {
    await openLinks()
    fireEvent.change(screen.getByLabelText(/^ASIN$/i), { target: { value: 'B00NPB8WUQ' } })
    fireEvent.change(pasteBox(), { target: { value: 'letterboxd.com/film/stalker/' } })
    // THE BADGE COUNTS BOTH: one id changed and one link to add.
    // The count sits beside the ✓ rather than in its name (it is drawn, not
    // said), so it is read off the nearest box around the ✓ that holds a figure.
    let beside = screen.getByLabelText('Save')
    while (beside && !/\d/.test(beside.textContent)) beside = beside.parentElement
    expect(beside?.textContent, 'the ✓ does not count the id and the link').toBe('2')
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS).toHaveLength(1))
    expect(PUTS[0].body.asin).toBe('B00NPB8WUQ')
    expect(PUTS[0].body.links).toContain('https://letterboxd.com/film/stalker/')
  })

  it('and on a work with no links the ＋ lands on the paste box', async () => {
    STORED = { ...BOOK, links: '' }
    render(
      <PanelHarness
        panel={(stack) => workDetailsPanel(stack, { kind: 'book', item: STORED, onChanged: () => {}, onDelete: null })}
      />,
    )
    await shown()
    fireEvent.click(plus())
    await waitFor(() => expect(pasteBox(), 'the ＋ opened a screen with nothing to add on it').toBeTruthy())
    expect(document.body.textContent).not.toMatch(/No links yet/)
    expect(document.activeElement, 'the ＋ did not land in the box').toBe(pasteBox())
    fireEvent.change(pasteBox(), { target: { value: 'example.net/talks' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS).toHaveLength(1))
    expect(PUTS[0].body.links).toBe('https://example.net/talks')
  })

  // NOTHING CHANGED IS ITS OWN REASON. With the box empty the greyed ✓ said "That
  // is not an address yet", about a box the reader had not touched and on a
  // screen they may have opened to edit an id.
  it('says there is nothing to save before anything has changed', async () => {
    render(<>
      <ToastHost />
      <PanelHarness panel={(stack) => workDetailsPanel(stack, { kind: 'book', item: BOOK, onChanged: () => {}, onDelete: null })} />
    </>)
    await shown()
    fireEvent.click(pencil())
    const save = await waitFor(() => {
      const b = screen.getByLabelText('Save')
      expect(b.disabled).toBe(true)
      return b
    })
    // A pointer resting on the greyed ✓ is told why.
    fireEvent.pointerEnter(save, { pointerType: 'mouse' })
    expect(await screen.findByText('Nothing to save yet')).toBeTruthy()
  })

  it('and a save that fails says so on the screen', async () => {
    REFUSE = 'the library is busy'
    await openLinks()
    fireEvent.change(pasteBox(), { target: { value: 'example.net/talks' } })
    fireEvent.click(screen.getByLabelText('Save'))
    expect(await screen.findByText(/the library is busy/), 'a refused save left the screen saying nothing').toBeTruthy()
  })

  // TAKING ONE LINK OFF KEEPS THE OTHERS' NAMES. The removal rewrote the field
  // from bare addresses, so every other link lost the name a reader gave it.
  it('and taking one link off keeps the name on another', async () => {
    STORED = { ...BOOK, links: 'https://example.org/a-review | Their review\nhttps://www.imdb.com/title/tt0084787/' }
    render(<PanelHarness panel={(stack) => workDetailsPanel(stack, { kind: 'book', item: STORED, onChanged: () => {}, onDelete: null })} />)
    await shown()
    fireEvent.click(plus())
    fireEvent.click(await screen.findByRole('button', { name: /Remove the IMDb link/i }))
    await waitFor(() => expect(PUTS).toHaveLength(1))
    expect(PUTS[0].body.links, 'the other link lost its name').toContain('Their review')
  })

  // AND WHILE IT IS ON ITS WAY THE ✓ IS GREYED, so a second press does not send
  // the same save twice.
  it('greys the ✓ while a save is on its way', async () => {
    let release
    HOLD = new Promise((r) => { release = r })
    await openLinks()
    fireEvent.change(pasteBox(), { target: { value: 'example.net/talks' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS).toHaveLength(1))
    expect(screen.getByLabelText('Save').disabled, 'the ✓ can be pressed again mid-save').toBe(true)
    release()
    await waitFor(() => expect(pasteBox()).toBeNull())
  })
})
