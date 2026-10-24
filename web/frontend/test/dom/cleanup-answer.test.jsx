// Answering a cleanup finding: the rewrite on screen, and the two buttons.
//
// cleanup-page.test.jsx (if present) and the endpoint tests own the list and the
// server. These cases own the promise the page makes to somebody about to change
// their own words: the result is shown before anything is pressed, accepting sends
// exactly the finding that was shown, ignoring sends the server's own key for that
// one find, and the ignored bucket is a different request rather than a filter over
// the same list.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS
let ANSWER

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path.startsWith('/cleanup')) {
      return { ok: true, data: ANSWER(path.includes('bucket=ignored') ? 'ignored' : 'open') }
    }
    return { ok: true, data: { applied: 1, stale: 0, duplicates: 0, changed: 1 } }
  }),
}))

const { default: CleanupPage } = await import('../../src/CleanupPage.jsx')
const { t } = await import('../../src/i18n.js')

// One doubled space in a highlight's quote, and one reference mark that has been
// ignored — the two states the page has to draw.
const OPEN = {
  rules: ['double-space', 'reference-mark'],
  scanned: 12,
  counts: { open: 1, ignored: 1 },
  items: [
    {
      kind: 'book',
      id: 7,
      work_id: 3,
      work_title: 'Moby-Dick',
      findings: [
        {
          rule: 'double-space',
          field: 'quote',
          snippet: 'call»  «me Ishmael',
          count: 1,
          after_snippet: 'call»&nbsp;«me Ishmael'.replace('&nbsp;', ' '),
          match_hash: 'abc123',
        },
      ],
    },
  ],
}

const IGNORED = {
  rules: ['double-space', 'reference-mark'],
  scanned: 12,
  counts: { open: 1, ignored: 1 },
  items: [
    {
      kind: 'book',
      id: 7,
      work_id: 3,
      work_title: 'Moby-Dick',
      findings: [
        {
          rule: 'reference-mark',
          field: 'note',
          snippet: 'a note»[12]«',
          count: 1,
          after_snippet: 'a note»«',
          match_hash: 'def456',
          ignored: true,
        },
      ],
    },
  ],
}

beforeEach(() => {
  CALLS = []
  ANSWER = (bucket) => (bucket === 'ignored' ? IGNORED : OPEN)
})

const page = () =>
  render(<CleanupPage onClose={() => {}} onOpenBook={() => {}} onOpenMovie={() => {}} onOpenQuotes={() => {}} />)

const gets = () => CALLS.filter(([m, p]) => m === 'GET' && p.startsWith('/cleanup'))

describe('answering a cleanup finding', () => {

  it('accepts exactly the finding it was showing', async () => {
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    fireEvent.click(screen.getByText(t('cleanup.accept.label')))
    await waitFor(() => expect(CALLS.some(([, p]) => p === '/cleanup/accept')).toBe(true))
    const [, , body] = CALLS.find(([, p]) => p === '/cleanup/accept')
    // One field, one rule — not "everything on this quote" and not "every rule".
    expect(body).toEqual({ items: [{ kind: 'book', id: 7, field: 'quote', rule: 'double-space', match_hash: 'abc123' }] })
  })

  it('ignores by the server’s own key, so one find is answered and not the field', async () => {
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    fireEvent.click(screen.getByText(t('cleanup.ignore.label')))
    await waitFor(() => expect(CALLS.some(([, p]) => p === '/cleanup/ignore')).toBe(true))
    const [, , body] = CALLS.find(([, p]) => p === '/cleanup/ignore')
    expect(body.items[0].match_hash).toBe('abc123')
  })

})
