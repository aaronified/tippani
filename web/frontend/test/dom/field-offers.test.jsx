// The door on a field's provenance mark, and what is behind it.
//
// THE GAP THIS CLOSES. Every field has shown who wrote it since 0054, and the
// re-verify reviewer has drawn each supplier's answer side by side since
// mix-and-match landed. What did not exist was the way from one to the other, so
// a description tagged TMDB could not be asked what TheTVDB says without running
// a re-verify over the whole record — and the reviewer's own table is empty for
// that field, because a value taken FROM TMDB has not changed from TMDB.
//
// So the two assertions that matter are: the mark is a button (a tag nobody can
// press is the state this replaces), and the panel it opens shows the value each
// supplier is offering rather than only what differs.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const calls = []
let OFFERS = []
let STATUS = 'ok'
let APPLY_OK = true

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    calls.push({ method, path, body })
    if (path === '/metadata/reverify') {
      return {
        ok: true,
        data: { items: [{ type: 'book', id: 7, status: STATUS, source: 'google', diffs: [], offers: OFFERS, error: 'no pinned identity' }] },
      }
    }
    if (path === '/metadata/reverify/apply') {
      return { ok: true, data: { results: [{ ok: APPLY_OK, error: APPLY_OK ? '' : 'nope' }] } }
    }
    return { ok: true, data: {} }
  }),
}))

const { FieldSourceTag } = await import('../../src/ui.jsx')
const { OFFERED_FIELDS, fieldOffersPanel } = await import('../../src/fieldOffers.jsx')

const DESC_OFFERS = [{
  field: 'description',
  stored: 'the stored description',
  fresh: 'the stored description',
  alts: [
    { source: 'google', value: 'the stored description' },
    { source: 'openlibrary', value: 'a second opinion' },
  ],
}]

const openPanel = async (over = {}) => {
  const stack = { push: vi.fn(), back: vi.fn() }
  const panel = fieldOffersPanel(stack, {
    kind: 'book',
    item: { id: 7, title: 'Dune' },
    field: 'description',
    label: 'Description',
    storedSource: 'google',
    onChanged: vi.fn(),
    ...over,
  })
  await act(async () => { render(panel.render()) })
  return stack
}

beforeEach(() => {
  calls.length = 0
  OFFERS = DESC_OFFERS
  STATUS = 'ok'
  APPLY_OK = true
})

describe('a fieldtag with a door', () => {
  it('is a button, and a tag without one is not', () => {
    const { unmount } = render(<FieldSourceTag source="tmdb" onOpen={() => {}} />)
    expect(screen.getByRole('button')).toBeTruthy()
    unmount()
    render(<FieldSourceTag source="tmdb" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says what pressing it does, and still says who wrote the field', () => {
    render(<FieldSourceTag source="tmdb" at="2026-01-02T00:00:00Z" onOpen={() => {}} />)
    const btn = screen.getByRole('button')
    // Both halves: a mark alone reads as a label, and a tooltip that dropped the
    // supplier would lose the fact the tag exists for.
    expect(btn.title.toLowerCase()).toContain('source')
    expect(btn.title).toContain('TMDB')
    expect(btn.title).toContain('2026-01-02')
  })

  // AND THE SCREEN READER HEARS IT TOO. The mark is decorative and the only text
  // inside is the sr-only supplier name, so without an explicit name the button
  // announced "TMDB, button" — indistinguishable from the label it must not be
  // mistaken for. A tooltip is not an accessible name.
  it('names what it opens to a screen reader, not only to a pointer', () => {
    render(<FieldSourceTag source="tmdb" onOpen={() => {}} />)
    const name = screen.getByRole('button').getAttribute('aria-label') || ''
    expect(name.toLowerCase()).toContain('source')
    expect(name).toContain('TMDB')
  })

  // TWO WRITERS ON ONE RECORD. The panel's ✓ collects every open row while a take
  // would rewrite one field from a supplier; the pencil beside this tag has always
  // been gated on the same flag, and the tag was not because it was not pressable.
  it('is gated while the panel master save is collecting', () => {
    const onOpen = vi.fn()
    render(<FieldSourceTag source="tmdb" onOpen={onOpen} disabled />)
    const btn = screen.getByRole('button')
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onOpen).not.toHaveBeenCalled()
  })

  // A DOOR ONTO AN EMPTY ROOM IS WORSE THAN A LABEL, which is what the offered
  // set is for: a supplier id names its own supplier and a cover is not a field.
  it('is offered only for fields a supplier can answer for', () => {
    expect(OFFERED_FIELDS.has('description')).toBe(true)
    expect(OFFERED_FIELDS.has('tmdb_id')).toBe(false)
    expect(OFFERED_FIELDS.has('cover')).toBe(false)
  })
})

describe('the offers panel', () => {
  it('asks for offers rather than for a diff', async () => {
    await openPanel()
    await waitFor(() => expect(calls.length).toBeGreaterThan(0))
    const ask = calls.find((c) => c.path === '/metadata/reverify')
    // Without this flag the response carries only what CHANGED, which for a
    // field already credited to a supplier is nothing.
    expect(ask.body.offers).toBe(true)
    expect(ask.body.book_ids).toEqual([7])
  })

  it('draws the stored value and one row per supplier', async () => {
    await openPanel()
    await waitFor(() => expect(screen.getByText('a second opinion')).toBeTruthy())
    const rows = document.querySelectorAll('.offer-row')
    // Kept + two suppliers. The two that AGREE are still two rows: both backing
    // a value is the strongest reason to accept it, and collapsing them hides it.
    expect(rows.length).toBe(3)
    expect(document.querySelector('.offer-row[data-kept="1"]')).toBeTruthy()
  })

  it('will not let you press the value you already have', async () => {
    await openPanel()
    await waitFor(() => expect(screen.getByText('a second opinion')).toBeTruthy())
    const kept = document.querySelector('.offer-row[data-kept="1"]')
    expect(kept.tagName).not.toBe('BUTTON')
  })

  it('writes one field and records the supplier it came from', async () => {
    const stack = await openPanel()
    const take = await waitFor(() => {
      const b = [...document.querySelectorAll('button.offer-row')]
        .find((x) => x.textContent.includes('a second opinion'))
      expect(b).toBeTruthy()
      return b
    })
    await act(async () => { fireEvent.click(take) })
    await waitFor(() => expect(calls.some((c) => c.path === '/metadata/reverify/apply')).toBe(true))
    const apply = calls.find((c) => c.path === '/metadata/reverify/apply').body.items[0]
    // ONE FIELD, not the record: the whole point of the door is that the rest of
    // the record is left where the reader put it.
    expect(Object.keys(apply.set)).toEqual(['description'])
    expect(apply.set.description).toBe('a second opinion')
    // And the tag it rewrites must now name the supplier whose value was taken.
    expect(apply.sources).toEqual({ description: 'openlibrary' })
    await waitFor(() => expect(stack.back).toHaveBeenCalled())
  })

  it('keeps the panel open when the write is refused', async () => {
    APPLY_OK = false
    const stack = await openPanel()
    const take = await waitFor(() => {
      const b = [...document.querySelectorAll('button.offer-row')]
        .find((x) => x.textContent.includes('a second opinion'))
      expect(b).toBeTruthy()
      return b
    })
    await act(async () => { fireEvent.click(take) })
    await waitFor(() => expect(document.body.textContent).toContain('nope'))
    // Closing on a failure would look like it worked.
    expect(stack.back).not.toHaveBeenCalled()
  })

  it('says so when nobody has another answer', async () => {
    OFFERS = []
    await openPanel()
    await waitFor(() => expect(document.querySelector('.tp-empty')).toBeTruthy())
    expect(document.querySelectorAll('.offer-row').length).toBe(0)
  })

  // AN UNPINNED WORK IS NOT AN ERROR and its remedy is one sentence — the same
  // one the reviewer shows, because it is the same fact.
  it('passes on the server sentence for a work with nothing pinned', async () => {
    STATUS = 'unpinned'
    await openPanel()
    await waitFor(() => expect(document.body.textContent).toContain('no pinned identity'))
  })
})
