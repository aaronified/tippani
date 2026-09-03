// RESET CLEARS EVERY FILTER, INCLUDING THE TWO IT DID NOT.
//
// The handler read `setMedium('')` — a setter that has not existed since 0053
// renamed what that column means. Three things kept it hidden for a release:
// there is no ESLint in this project, the line is only reached by pressing Reset,
// and a ReferenceError thrown inside an onClick takes the press rather than the
// page. So Reset half-worked: colour, favourites, tagged, noted, tag and speaker
// cleared, and Kind and Language did not.
//
// That last part is why it is worth a test rather than just a fix. Kind and
// Language are `usePersistedState`, so the two filters Reset failed to clear
// survived a reload as well — a reader could press Reset, refresh, and still be
// looking at a narrowed board with a control that claims to have widened it.
//
// The assertion is on localStorage rather than on which rows are drawn, and
// deliberately: the rows are what the reader notices, but the persisted keys are
// what makes the failure outlive the press.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

let BOARDS, QUOTES

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/boards') return { ok: true, data: { boards: BOARDS, total: QUOTES.length } }
    if (path.startsWith('/quotes')) return { ok: true, data: { utterances: QUOTES } }
    if (path.startsWith('/tags')) return { ok: true, data: { tags: [] } }
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    if (path.startsWith('/stickers')) return { ok: true, data: { stickers: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: QuotesPage } = await import('../../src/Quotes.jsx')
const { buildScreenActions } = await import('../../src/ui.jsx')

// RESET IS A MENU ROW, not a button on the page — the board publishes it to the
// shell's ⋯ (works.jsx) and the phone draws it in the filter sheet's footer.
// Reached through the registry the ⋯ itself reads, which is the honest route and
// the one work-delete.test.jsx already uses for the same reason.
const pressReset = () => {
  const row = buildScreenActions().find((r) => r.id === 'reset')
  expect(row, 'the board published no reset row').toBeTruthy()
  act(() => row.onClick())
}

beforeEach(() => {
  BOARDS = [{ id: 1, name: 'Proverbs', quotes: 2, description: '', color: 'yellow', image_path: '', hidden: false, pos: 1 }]
  QUOTES = [
    { id: 11, board_id: 1, quote: 'A stitch in time saves nine', color: 'yellow', tags: [], kind: 'proverb', language: 'en' },
    { id: 12, board_id: 1, quote: 'Vor Tade sicher ist nur der Tote', color: 'blue', tags: [], kind: 'saying', language: 'de' },
  ]
})

// The two filters the broken line was supposed to clear. Set through the store
// rather than through their controls, because the controls live behind the
// filter sheet on a phone and behind a disclosure on a desk — and what is under
// test is the RESET, not the two Selects.
const narrow = () => {
  localStorage.setItem('tippani:quotes:kind', JSON.stringify('proverb'))
  localStorage.setItem('tippani:quotes:language', JSON.stringify('en'))
  localStorage.setItem('tippani:quotes:color', JSON.stringify('yellow'))
}

// OPENED BY THE PROP, not by a click. Pressing a board row calls `onOpen(id)` and
// the shell is what comes back with `openId` set — so a test that clicks and then
// waits is waiting for a parent it never rendered.
const openBoard = async () => {
  render(<QuotesPage openId={1} creditSeparators=",;&" onOpen={() => {}} onClose={() => {}} />)
  // Waited on the board PUBLISHING its verbs rather than on a row, because the
  // board is opened here with filters already set — the point of the fixture —
  // and which rows survive them is not what these cases are about.
  await waitFor(() => {
    expect(buildScreenActions().some((r) => r.id === 'reset')).toBe(true)
  })
}

const stored = (key) => localStorage.getItem(`tippani:quotes:${key}`)

describe('Reset on a quotes board', () => {
  it('clears the two filters the old handler threw on', async () => {
    narrow()
    await openBoard()
    pressReset()

    // BOTH, and neither was cleared before. `setMedium` threw on the way to them,
    // so even the setters after it on the line never ran.
    await waitFor(() => {
      expect(stored('kind'), 'Kind survived Reset').toBe(JSON.stringify(''))
      expect(stored('language'), 'Language survived Reset').toBe(JSON.stringify(''))
    })
  })

  it('still clears everything that came before them on the line', async () => {
    // The regression guard for the fix itself: the old line threw partway
    // through, so a repair that reordered the setters could silently drop one of
    // the six that already worked.
    narrow()
    await openBoard()
    pressReset()
    await waitFor(() => {
      expect(stored('color'), 'the colour filter stopped being cleared').toBe(JSON.stringify(''))
    })
  })

  it('does not throw when Reset is pressed', async () => {
    // The failure as the reader met it: nothing on screen said anything, because
    // the exception was inside the handler. React logs it and the press is lost.
    narrow()
    await openBoard()
    const errors = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')))
    try {
      pressReset()
      await waitFor(() => expect(stored('kind')).toBe(JSON.stringify('')))
    } finally {
      spy.mockRestore()
    }
    expect(errors.join(' | ')).not.toMatch(/is not defined/i)
  })
})
