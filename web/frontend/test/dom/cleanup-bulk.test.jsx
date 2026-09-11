// ANSWERING MANY STRAY MARKS AT ONCE.
//
// The three endpoints have always taken a LIST — `answer()` posts `{ items }` —
// and every call site passed a single-element array, so a reader with four
// hundred finds of one rule answered them one press at a time over an endpoint
// that would have taken the lot. The staging half of the same screen (Checks is
// StagingPage above CleanupPage) already had a selection and a BulkBar; this
// half did not, which is the repo's "two things that look the same behave the
// same" failing between two sections of one page.
//
// cleanup-answer.test.jsx owns the single-find promises. These cases own the
// selection: what a tick sends, that the rule chip decides what "all" means, and
// that Accept never reaches a find it cannot correct.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path.startsWith('/cleanup')) return { ok: true, data: OPEN }
    return { ok: true, data: { applied: 1, stale: 0, duplicates: 0, changed: 1 } }
  }),
}))

const { default: CleanupPage } = await import('../../src/CleanupPage.jsx')
const { t } = await import('../../src/i18n.js')

// THREE FINDS ACROSS TWO QUOTES, AND ONE OF THEM CANNOT BE CORRECTED. The
// pronunciation gloss carries no `after_snippet`, which is how the server says a
// rule found something it has no rewrite for — the per-find Accept is drawn only
// when there is one, so the bulk verb has to hold the same line.
const OPEN = {
  rules: ['double-space', 'reference-mark', 'pronunciation'],
  scanned: 40,
  counts: { open: 3, ignored: 0 },
  items: [
    {
      kind: 'book',
      id: 7,
      work_id: 3,
      work_title: 'Moby-Dick',
      findings: [
        { rule: 'double-space', field: 'quote', snippet: 'call»  «me', count: 1, after_snippet: 'call» «me', match_hash: 'h1' },
        { rule: 'pronunciation', field: 'note', snippet: 'whale »/weɪl/«', count: 1, match_hash: 'h2' },
      ],
    },
    {
      kind: 'quote',
      id: 9,
      work_title: '',
      findings: [
        { rule: 'reference-mark', field: 'quote', snippet: 'a line»[4]«', count: 1, after_snippet: 'a line»«', match_hash: 'h3' },
      ],
    },
  ],
}

beforeEach(() => {
  CALLS = []
})

const page = () =>
  render(<CleanupPage onOpenBook={() => {}} onOpenMovie={() => {}} onOpenQuotes={() => {}} />)

const ticks = () => [...document.querySelectorAll('.cleanup-finds input[type="checkbox"]')]
const posted = (path) => CALLS.find(([, p]) => p === path)?.[2]

describe('answering many stray marks at once', () => {
  it('draws no bar until something is ticked, and then sends every ticked find', async () => {
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    // BulkBar renders nothing at n === 0, so the bar's own verb is the test for it.
    expect(screen.queryByText(t('cleanup.bulk.ignore.label'))).toBeNull()

    fireEvent.click(ticks()[0])
    fireEvent.click(ticks()[2])
    fireEvent.click(screen.getByText(t('cleanup.bulk.ignore.label')))

    await waitFor(() => expect(posted('/cleanup/ignore')).toBeTruthy())
    // BOTH, IN ONE REQUEST — which is the whole of this feature. The keys are the
    // server's own five fields, one per find, and the untouched middle one is
    // absent rather than swept along because it sits on the same quote.
    expect(posted('/cleanup/ignore')).toEqual({
      items: [
        { kind: 'book', id: 7, field: 'quote', rule: 'double-space', match_hash: 'h1' },
        { kind: 'quote', id: 9, field: 'quote', rule: 'reference-mark', match_hash: 'h3' },
      ],
    })
  })

  it('accepts only the finds that have a correction, and says how many that is', async () => {
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    // THROUGH SELECT-ALL, which is also this case's test of it: "all" is every
    // find on screen, INCLUDING the pronunciation gloss the server sent no rewrite
    // for. Ticking them by hand instead would leave the one control that makes
    // this feature worth having untested.
    const all = screen.getByText(t('cleanup.select-all.label', { n: 3 })).closest('label').querySelector('input')
    fireEvent.click(all)
    await waitFor(() => expect(ticks().every((b) => b.checked)).toBe(true))

    // THE COUNT IS THE ACCEPTABLE ONES, NOT THE TICKED ONES. Three are ticked and
    // two can be corrected; a button reading "Accept 3" over a request carrying 2
    // is the app saying one number and doing another.
    await waitFor(() => expect(screen.getByText(t('cleanup.bulk.accept.label', { n: 2 }))).toBeTruthy())
    fireEvent.click(screen.getByText(t('cleanup.bulk.accept.label', { n: 2 })))

    await waitFor(() => expect(posted('/cleanup/accept')).toBeTruthy())
    expect(posted('/cleanup/accept').items).toHaveLength(2)
    expect(posted('/cleanup/accept').items.map((x) => x.rule).sort()).toEqual(['double-space', 'reference-mark'])
  })

  it('“all” means the rule chip’s finds, so a filtered select-all is that rule’s', async () => {
    page()
    await waitFor(() => expect(screen.getByText('Moby-Dick')).toBeTruthy())
    // SCOPED TO THE CHIP. The rule's name is printed twice — on the filter chip
    // and on the find's own line — so an unscoped getByText finds both.
    const chip = [...document.querySelectorAll('.tp-filter-chip')]
      .find((b) => b.textContent.includes(t('cleanup.rule.double-space.label')))
    expect(chip, 'no filter chip for the rule').toBeTruthy()
    fireEvent.click(chip)

    // One find survives the chip, so select-all is one — and the bar says one.
    await waitFor(() => expect(ticks()).toHaveLength(1))
    fireEvent.click(ticks()[0])
    fireEvent.click(screen.getByText(t('cleanup.bulk.ignore.label')))

    await waitFor(() => expect(posted('/cleanup/ignore')).toBeTruthy())
    expect(posted('/cleanup/ignore')).toEqual({
      items: [{ kind: 'book', id: 7, field: 'quote', rule: 'double-space', match_hash: 'h1' }],
    })
  })
})
