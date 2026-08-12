// The bin, as a reader meets it.
//
// This is the screen somebody opens because they have already lost something, and
// that shapes every assertion here. The two things they came to do — put it back,
// or get rid of it — have to be VISIBLE, not hover-revealed like every other
// repeated row in the app; a control you only discover by pointing at it is a
// control you hunt for while wondering whether the feature exists.
//
// The rest is about not lying. A row says how many quotes travel with it, so the
// count has to come from the entry rather than from the list. "Empty now" cannot be
// undone, so it asks first. And the retention window has to be the window the
// server holds, or the card is showing a promise nobody made.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let TRASH
let DAYS
let CONTENTS
let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/trash') return { ok: true, data: { trash: TRASH, days: DAYS } }
    if (method === 'GET' && path.startsWith('/trash/')) return { ok: true, data: { contents: CONTENTS } }
    if (method === 'POST' && path.endsWith('/restore')) {
      TRASH = []
      return { ok: true, data: { ok: true } }
    }
    if (method === 'DELETE' && path.startsWith('/trash')) {
      TRASH = []
      return { ok: true, data: { ok: true, removed: 1 } }
    }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

const USER = { username: 'a', is_admin: false, preferences: {} }

const ENTRY = (over = {}) => ({
  id: 7,
  kind: 'book',
  label: 'The Dispossessed',
  child_count: 40,
  deleted_at: '2026-08-01 10:00:00',
  files: 1,
  ...over,
})

beforeEach(() => {
  TRASH = [ENTRY()]
  DAYS = 30
  CONTENTS = [
    { text: 'You cannot buy the revolution', color: 'blue' },
    { text: 'Where does a thought come from', color: 'yellow' },
  ]
  CALLS = []
})

const page = async () => {
  render(<Settings user={USER} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await screen.findByText('The bin')
}

const row = () => screen.getByText('The Dispossessed').closest('li')

describe('the bin', () => {
  it('is there for everybody, not just an admin', async () => {
    // Backup and Updates are admin-only and this card sits beside them, which is
    // exactly how it would end up behind the same gate. Every account has a bin.
    await page()
    expect(screen.getByText('The bin')).toBeTruthy()
    expect(screen.queryByText('Backup & restore')).toBeNull() // the gate still works
  })

  it('says what each entry is, when it went, and what went with it', async () => {
    await page()
    const li = row()
    expect(within(li).getByText('Book')).toBeTruthy()
    expect(li.textContent).toContain('40 quotes')
    expect(li.textContent).toMatch(/deleted 1 Aug/)
    // The picture is kept too, and saying so is the difference between trusting
    // the restore and re-uploading a cover you did not have to.
    expect(li.textContent).toContain('picture kept')
  })

  it('offers restore and remove without being hovered first', async () => {
    // The one place in the app where progressive disclosure is the wrong answer.
    await page()
    expect(screen.getByRole('button', { name: /Restore The Dispossessed/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Remove The Dispossessed for good/ })).toBeTruthy()
  })

  it('puts one back and stops listing it', async () => {
    await page()
    fireEvent.click(screen.getByRole('button', { name: /Restore The Dispossessed/ }))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/trash/7/restore')).toBe(true))
    await waitFor(() => expect(screen.queryByText('The Dispossessed')).toBeNull())
    // A restored entry is spent: it must not sit there inviting a second restore
    // that would 404.
    expect(screen.getByText(/nothing deleted/)).toBeTruthy()
  })

  it('opens a row to show the quotes it is holding, with their colours', async () => {
    await page()
    fireEvent.click(screen.getByRole('button', { name: /What is inside The Dispossessed/ }))
    expect(await screen.findByText('You cannot buy the revolution')).toBeTruthy()
    const held = screen.getByText('You cannot buy the revolution')
    // The colour bar is the quote's own category, read through the same custom
    // property every other quote in the app uses.
    expect(held.getAttribute('style')).toContain('--hl-2')
    expect(screen.getByText('Where does a thought come from').getAttribute('style')).toContain('--hl-1')
  })

  it('gives a single highlight no chevron, because there is nothing inside it', async () => {
    TRASH = [ENTRY({ kind: 'annotation', label: 'Only in silence the word', child_count: 0, files: 0 })]
    await page()
    expect(screen.getByText('Highlight')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /What is inside/ })).toBeNull()
    const li = screen.getByText('Only in silence the word').closest('li')
    expect(li.textContent).not.toContain('quotes')
  })

  it('asks before emptying, and says how much it is about to take', async () => {
    // The one act in this feature with no undo behind it.
    await page()
    fireEvent.click(screen.getByRole('button', { name: 'Empty now' }))
    expect(screen.getByText(/removes 1 entry/)).toBeTruthy()
    expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/trash')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Empty it' }))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/trash')).toBe(true))
  })

  it('offers no Empty when there is nothing to empty', async () => {
    TRASH = []
    await page()
    expect(screen.queryByRole('button', { name: 'Empty now' })).toBeNull()
  })

  it('shows the window the server holds, and saves a change to it', async () => {
    DAYS = 7
    await page()
    expect(screen.getByRole('button', { name: /How long the bin keeps things/ }).textContent).toContain('7 days')
    fireEvent.click(screen.getByRole('button', { name: /How long the bin keeps things/ }))
    fireEvent.click(await screen.findByRole('option', { name: 'Never' }))
    await waitFor(() =>
      expect(CALLS.some(([m, p, b]) => m === 'PUT' && p === '/auth/me/preferences' && b.trashDays === -1)).toBe(true),
    )
  })
})
