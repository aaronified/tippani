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
          before: 'call  me Ishmael',
          after: 'call me Ishmael',
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
          before: 'a note[12]',
          after: 'a note',
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
  it('asks for the open bucket on arrival', async () => {
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    expect(gets()[0][1]).toBe('/cleanup?bucket=open')
  })

  it('shows what the finding is and what it would become', async () => {
    page()
    // MATCHED WITHOUT NORMALISING THE WHITESPACE, which is the point of the case: a
    // doubled space is what the finding IS, and getByText collapses runs of space by
    // default — so the default matcher cannot tell the evidence from the result.
    const exact = (want) => (_, el) => el?.textContent === want
    await waitFor(() => expect(screen.getByText(exact('call»  «me Ishmael'))).toBeTruthy())
    // THE ASSERTION THE WHOLE FEATURE RESTS ON: the result is on screen before
    // anything is pressed.
    expect(screen.getByText(exact('→call me Ishmael'))).toBeTruthy()
  })

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

  it('re-reads the list after answering rather than guessing what changed', async () => {
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    const before = gets().length
    fireEvent.click(screen.getByText(t('cleanup.accept.label')))
    await waitFor(() => expect(gets().length).toBeGreaterThan(before))
  })

  it('switches bucket by asking the server, not by filtering what it has', async () => {
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    fireEvent.click(screen.getByText(t('cleanup.bucket.ignored.label', { n: 1 })))
    await waitFor(() => expect(gets().some(([, p]) => p === '/cleanup?bucket=ignored')).toBe(true))
    // The ignored bucket offers a way back and NOT an accept: a finding you have
    // said no to is not one you are being asked about.
    await waitFor(() => expect(screen.getByText(t('cleanup.restore.label'))).toBeTruthy())
    expect(screen.queryByText(t('cleanup.accept.label'))).toBeNull()
  })

  it('puts an ignored finding back on the list', async () => {
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    fireEvent.click(screen.getByText(t('cleanup.bucket.ignored.label', { n: 1 })))
    await waitFor(() => expect(screen.getByText(t('cleanup.restore.label'))).toBeTruthy())
    fireEvent.click(screen.getByText(t('cleanup.restore.label')))
    await waitFor(() => expect(CALLS.some(([, p]) => p === '/cleanup/unignore')).toBe(true))
    expect(CALLS.find(([, p]) => p === '/cleanup/unignore')[2].items[0].match_hash).toBe('def456')
  })

  it('offers no accept for a rule this build cannot rewrite', async () => {
    // A finding with no `after` is listed and ignorable and has nothing to accept —
    // the state the server describes for a rule with no fix. No rule is in it today,
    // which is exactly why the page's handling of it needs a test.
    ANSWER = () => ({
      ...OPEN,
      items: [{ ...OPEN.items[0], findings: [{ ...OPEN.items[0].findings[0], after: '' }] }],
    })
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    expect(screen.queryByText(t('cleanup.accept.label'))).toBeNull()
    expect(screen.getByText(t('cleanup.ignore.label'))).toBeTruthy()
  })

  it('renders no unresolved key anywhere on it', async () => {
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    const keyish = [...document.querySelectorAll('*')]
      .flatMap((el) => [...el.childNodes])
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .filter((txt) => /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/.test(txt))
    expect(keyish, 'unresolved keys on screen').toEqual([])
  })
})
