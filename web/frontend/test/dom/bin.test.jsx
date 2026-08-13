// The bin, as a reader meets it — a tile in Settings, and a page behind it.
//
// This is the screen somebody opens because they have already lost something, and
// that shapes every assertion here. The two things they came to do — put it back,
// or get rid of it — have to be VISIBLE, not hover-revealed like every other
// repeated row in the app; a control you only discover by pointing at it is a
// control you hunt for while wondering whether the feature exists.
//
// The rest is about not lying. A row says how many quotes travel with it, so the
// count has to come from the entry rather than from the list. "Empty now" cannot be
// undone, so it asks first. The retention window has to be the window the server
// holds, or the page is showing a promise nobody made. And the due date has to be
// a DATE rather than a countdown, because the purge clock only runs while the
// server is up — "gone in 3 days" is a promise nothing here can keep.
//
// It became a page in 1.11.2. The tile that replaced it in Settings is asserted
// separately and asserted for one thing above all: that it is still there for
// everybody. It sits between Devices and the two admin-only cards, which is
// exactly how it would end up behind the same gate.

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
const { default: BinPage, expiryLabel, fmtDeleted } = await import('../../src/BinPage.jsx')

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

// The page, loaded. Awaiting the row rather than the heading: the heading renders
// before the fetch resolves, so a test that waited on it would assert against an
// empty list half the time.
const page = async (props = {}) => {
  render(<BinPage onClose={() => {}} {...props} />)
  if (TRASH.length) await screen.findByText(TRASH[0].label)
  else await screen.findByText(/nothing deleted/)
}

const row = () => screen.getByText('The Dispossessed').closest('li')

describe('the bin page', () => {
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

  it('says when the entry is due to go for good', async () => {
    // The fourth fact, and the one the card in Settings had no room for.
    await page()
    expect(row().textContent).toMatch(/due to go 31 Aug/)
  })

  it('carries a glyph for the kind, so a row reads before it is read', async () => {
    await page()
    expect(row().querySelector('.trash-kind svg')).toBeTruthy()
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
    // …and still names its kind with a glyph, which is not something the chevron
    // was carrying for it.
    expect(li.querySelector('.trash-kind svg')).toBeTruthy()
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

  it('counts what it is holding in the header', async () => {
    await page()
    expect(screen.getByText('1 entry · 40 quotes held')).toBeTruthy()
  })

  it('names where Back goes, because this page has exactly one door', async () => {
    const onClose = vi.fn()
    await page({ onClose })
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('filtering by kind', () => {
  const MIXED = [
    ENTRY(),
    ENTRY({ id: 8, kind: 'annotation', label: 'Only in silence the word', child_count: 0 }),
    ENTRY({ id: 9, kind: 'movie', label: 'Stalker', child_count: 3 }),
  ]

  it('offers no chips at all for one kind, because a filter over one kind is furniture', async () => {
    await page()
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull()
  })

  it('offers one chip per kind PRESENT, and no others', async () => {
    TRASH = MIXED
    await page()
    expect(screen.getByRole('button', { name: 'Books' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Highlights' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Films & shows' })).toBeTruthy()
    // Nothing of these kinds is in the bin, so a chip for them could only ever
    // empty the list.
    expect(screen.queryByRole('button', { name: 'Film lines' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Accounts' })).toBeNull()
  })

  it('shows just that kind, and says so when the filter empties the list', async () => {
    TRASH = MIXED
    await page()
    fireEvent.click(screen.getByRole('button', { name: 'Films & shows' }))
    expect(screen.getByText('Stalker')).toBeTruthy()
    expect(screen.queryByText('The Dispossessed')).toBeNull()
    // The header count is about the BIN, not the filter — it is the number Empty
    // now would take, and that does not change when you narrow the view.
    expect(screen.getByText(/3 entries/)).toBeTruthy()
  })

  it('falls back to All when the kind it was filtering leaves the bin', async () => {
    // Restore the only film while filtered to films and the page would otherwise
    // read "nothing of that kind" over a bin with two things still in it — and the
    // chip that got you there is already gone, so there is no way back.
    TRASH = [ENTRY({ id: 9, kind: 'movie', label: 'Stalker', child_count: 0 }), ENTRY()]
    await page()
    fireEvent.click(screen.getByRole('button', { name: 'Films & shows' }))
    expect(screen.queryByText('The Dispossessed')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Restore Stalker/ }))
    await waitFor(() => expect(screen.queryByText(/nothing of that kind/)).toBeNull())
  })
})

describe('the two labels that must not overstate what is known', () => {
  it('reads the server’s stamp as UTC rather than letting the browser guess', () => {
    // No zone marker on `datetime('now')`, so the T and the Z are added. Safari
    // refuses the space form outright, and the guess that does parse is a day out
    // for half the world.
    expect(fmtDeleted('2026-08-01 10:00:00')).toMatch(/deleted 1 Aug/)
  })

  it('adds the year only when it is not this one', () => {
    // "deleted 1 Aug 2026" on every row of a bin emptied last week is a column of
    // noise; a year from another year is the fact worth printing.
    const thisYear = new Date().getFullYear()
    expect(fmtDeleted(`${thisYear}-08-01 10:00:00`)).not.toMatch(/\d{4}/)
    expect(fmtDeleted('2019-08-01 10:00:00')).toMatch(/2019/)
  })

  it('says nothing at all for a missing stamp rather than "deleted Invalid Date"', () => {
    expect(fmtDeleted('')).toBe('')
    expect(fmtDeleted(null)).toBe('')
  })

  it('gives a DATE for the expiry, never a countdown', () => {
    // The purge clock runs on server time and only while the server is up, so an
    // instance switched off for a week has not spent a week of anybody's thirty
    // days. "gone in 3 days" would be a promise nothing here can keep.
    const out = expiryLabel('2026-08-01 10:00:00', 30)
    expect(out).toMatch(/due to go 31 Aug/)
    expect(out).not.toMatch(/\bin \d+ days?\b/)
  })

  it('says what "never" actually means, rather than printing a date', () => {
    for (const days of [-1, 0, null, undefined]) {
      expect(expiryLabel('2026-08-01 10:00:00', days)).toBe('kept until you empty the bin')
    }
  })
})

describe('the tile that replaced it in Settings', () => {
  const settings = async () => {
    render(<Settings user={USER} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} onOpenBin={() => {}} />)
    await screen.findByText('The bin')
  }

  it('is there for everybody, not just an admin', async () => {
    // Backup and Updates are admin-only and this tile sits beside them, which is
    // exactly how it would end up behind the same gate. Every account has a bin.
    await settings()
    expect(screen.getByText('The bin')).toBeTruthy()
    expect(screen.queryByText('Backup & restore')).toBeNull() // the gate still works
  })

  it('says whether there is anything in it', async () => {
    await settings()
    expect(await screen.findByText(/1 entry waiting, holding 40 quotes/)).toBeTruthy()
  })

  it('says so when there is nothing, which is the answer that saves the trip', async () => {
    TRASH = []
    await settings()
    expect(await screen.findByText(/nothing deleted/)).toBeTruthy()
  })

  it('opens the page, and does not try to be the page', async () => {
    const onOpenBin = vi.fn()
    render(<Settings user={USER} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} onOpenBin={onOpenBin} />)
    await screen.findByText('The bin')
    fireEvent.click(screen.getByRole('button', { name: 'Open the bin' }))
    expect(onOpenBin).toHaveBeenCalled()
    // The list is emphatically not here any more: no rows, no retention control,
    // no Empty. A tile that grew half the page back would be the shape problem
    // returning one control at a time.
    expect(screen.queryByRole('button', { name: 'Empty now' })).toBeNull()
    expect(screen.queryByRole('button', { name: /How long the bin keeps things/ })).toBeNull()
    expect(screen.queryByText('The Dispossessed')).toBeNull()
  })

  it('keeps its words on the one button it has', async () => {
    // A lone wastebasket glyph on a settings page reads as "delete something",
    // not "open the place deleted things went".
    await settings()
    const b = screen.getByRole('button', { name: 'Open the bin' })
    expect(b.querySelector('.btn-label-fixed')).toBeTruthy()
    expect(b.className).not.toContain('has-btn-icon')
  })
})
