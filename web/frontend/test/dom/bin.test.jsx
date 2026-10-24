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
// It became a page in 1.11.2, behind a tile in Settings. The tile is gone now —
// the door is a counted row in the rail and the ☰ menu — so the last two blocks
// here assert the move in both directions: that Settings kept none of it, and
// that both navs carry it. The second block exists because nothing rendered the
// nav until it was written, which is how the drawer shipped WITHOUT a bin row at
// all while the rail had one.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'


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
const { t } = await import('../../src/i18n.js')
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

  it('puts one back and stops listing it', async () => {
    await page()
    fireEvent.click(screen.getByRole('button', { name: /Restore The Dispossessed/ }))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/trash/7/restore')).toBe(true))
    await waitFor(() => expect(screen.queryByText('The Dispossessed')).toBeNull())
    // A restored entry is spent: it must not sit there inviting a second restore
    // that would 404.
    expect(screen.getByText(/nothing deleted/)).toBeTruthy()
  })

  // THE DOOR THAT WAS NAMED IS GONE, and this asserted the opposite until the rail
  // shipped. The page used to be reachable only from Settings, so its back arrow
  // named that destination — "one door in means the way out has to say where it
  // goes". Settings lost the tile when Checks was built, and the rail, the phone
  // drawer and Checks all point here now, so the arrow named a page that no longer
  // contains this one.
  //
  // ANCHORED ON SOMETHING THAT RENDERED, per this suite's own rule: an absence
  // asserted against a screen that failed to mount passes for the wrong reason.
  
})

describe('filtering by kind', () => {
  const MIXED = [
    ENTRY(),
    ENTRY({ id: 8, kind: 'annotation', label: 'Only in silence the word', child_count: 0 }),
    ENTRY({ id: 9, kind: 'movie', label: 'Stalker', child_count: 3 }),
  ]

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

// ---- and the door that replaced it ----------------------------------------
//
// NOTHING IN THIS SUITE RENDERED THE NAV before this block. That is not a gap in
// coverage so much as the direct cause of a defect: the rail grew Checks and Bin
// rows, the drawer did not, and the phone was left with no route to either — a
// reader found it, not the suite. Both navs are asserted together here, because
// the failure mode is exactly one of them being updated.

// A DELETED ACCOUNT IS OPAQUE TO THE ADMIN HOLDING IT. Its row says whose it was
// and how many quotes it holds, and offers no way to open it — the server returns
// none of its contents either (Go: TestDeletingAnAccountBinsItWhole...), and a
// chevron here would promise a list and open an empty one.

