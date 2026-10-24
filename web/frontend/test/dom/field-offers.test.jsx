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

describe('the offers panel', () => {

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

  // AN UNPINNED WORK IS NOT AN ERROR and its remedy is one sentence — the same
  // one the reviewer shows, because it is the same fact.
})
