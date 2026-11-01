// STRAY MARKS, GROUPED BY WORK: what a reader sees and can press.
//
// WHAT THIS KNOWS: the three quotes below sit in two works and one is a quote of its own.
// The page shows one group per work with the work's poster at its head as the way into the
// work, the quotes under it, and for each quote a door to its edit form and (only when the
// file's lines are stored) a door to its context. The old row had a button of its own that
// said "open where this quote lives"; it is gone, because the poster is that door.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const CALLS = []

const finding = (rule, snippet) => ({ rule, field: 'quote', snippet, count: 1, after_snippet: '', match_hash: `${rule}-${snippet.length}` })

const LIST = {
  rules: ['double-space', 'reference-mark'],
  scanned: 9,
  counts: { open: 3, ignored: 0 },
  items: [
    { kind: 'book', id: 7, work_id: 3, work_title: 'Moby-Dick', work_cover: 'moby.jpg', findings: [finding('double-space', 'call»  «me')] },
    { kind: 'book', id: 8, work_id: 3, work_title: 'Moby-Dick', work_cover: 'moby.jpg', findings: [finding('reference-mark', 'Ishmael»[12]«')] },
    { kind: 'quote', id: 9, findings: [finding('double-space', 'a»  «loose')] },
  ],
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (method === 'GET' && path.startsWith('/cleanup')) return { ok: true, data: LIST }
    // The one quote with its file's lines stored. Everything else has none.
    if (path.startsWith('/sources/context-ids')) return { ok: true, data: { ids: path.includes('subject=book') ? [7] : [] } }
    if (method === 'GET' && path.startsWith('/annotations?id=7')) {
      return { ok: true, data: { annotations: [{ id: 7, book_id: 3, quote: 'call  me', note: '', tags: [] }] } }
    }
    return { ok: true, data: {} }
  }),
}))

const { default: CleanupPage } = await import('../../src/CleanupPage.jsx')
const { currentScreenSearch } = await import('../../src/ui.jsx')

const groupsOf = () => screen.queryAllByRole('listitem').filter((li) => li.className === 'cleanup-group')
// What the shell's field does on a keystroke.
const typeInBar = (v) => act(() => currentScreenSearch().onQuery(v))

beforeEach(() => {
  CALLS.length = 0
})

describe('stray marks, grouped by work', () => {
  it('draws one group per work, with both of a work\'s quotes under it and the loose quote apart', async () => {
    render(<CleanupPage embedded onOpenBook={() => {}} onOpenMovie={() => {}} onOpenQuotes={() => {}} />)
    const groups = await screen.findAllByRole('listitem', {}, { timeout: 4000 }).then((all) => all.filter((li) => li.className === 'cleanup-group'))
    expect(groups).toHaveLength(2)
    expect(within(groups[0]).getByText('Moby-Dick')).toBeTruthy()
    expect(within(groups[0]).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(groups[1]).getByText('a quote of its own')).toBeTruthy()
  })

  it('opens the work from its poster, and a group with no work has no such door', async () => {
    const opened = []
    render(<CleanupPage embedded onOpenBook={(id) => opened.push(['book', id])} onOpenMovie={() => {}} onOpenQuotes={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open Moby-Dick' }))
    expect(opened).toEqual([['book', 3]])
    expect(screen.queryByRole('button', { name: /Open a quote of its own/ })).toBeNull()
  })

  it('has no button on a row that opens "where this quote lives"', async () => {
    render(<CleanupPage embedded onOpenBook={() => {}} onOpenMovie={() => {}} onOpenQuotes={() => {}} />)
    await screen.findByRole('button', { name: 'Open Moby-Dick' })
    expect(screen.queryAllByRole('button', { name: /^Open where this quote lives/ })).toHaveLength(0)
  })

  it('offers Edit on every quote and In context only on the one whose file lines are stored', async () => {
    render(<CleanupPage embedded onOpenBook={() => {}} onOpenMovie={() => {}} onOpenQuotes={() => {}} />)
    await screen.findByRole('button', { name: 'Open Moby-Dick' })
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'In context' })).toHaveLength(1))
  })

  it('opens the quote\'s own edit form from Edit, asking the server for that one row', async () => {
    render(<CleanupPage embedded onOpenBook={() => {}} onOpenMovie={() => {}} onOpenQuotes={() => {}} />)
    await screen.findByRole('button', { name: 'Open Moby-Dick' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    await waitFor(() => expect(CALLS).toContainEqual(['GET', '/annotations?id=7']))
  })

  it('is searched by the shell\'s field: the page names itself as the context and narrows to what was typed', async () => {
    render(<CleanupPage embedded onOpenBook={() => {}} onOpenMovie={() => {}} onOpenQuotes={() => {}} />)
    await screen.findByRole('button', { name: 'Open Moby-Dick' })
    expect(currentScreenSearch()).toMatchObject({ key: 'checks-marks', label: 'stray marks' })
    typeInBar('ishmael')
    expect(groupsOf()).toHaveLength(1)
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0)
    typeInBar('moby')
    expect(groupsOf()).toHaveLength(1)
    expect(within(groupsOf()[0]).getAllByRole('checkbox')).toHaveLength(2)
    typeInBar('zzz')
    expect(groupsOf()).toHaveLength(0)
    expect(screen.getByText(/No stray marks match/)).toBeTruthy()
    typeInBar('')
    expect(groupsOf()).toHaveLength(2)
  })

  it('folds a work shut and open again, and a folded work is not reached by Select all', async () => {
    render(<CleanupPage embedded onOpenBook={() => {}} onOpenMovie={() => {}} onOpenQuotes={() => {}} />)
    await screen.findByRole('button', { name: 'Open Moby-Dick' })
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Hide the quotes of Moby-Dick' }))
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
    expect(screen.getByText(/select all 1$/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the quotes of Moby-Dick' }))
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3)
  })
})
