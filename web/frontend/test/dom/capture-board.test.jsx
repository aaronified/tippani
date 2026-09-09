// Where a captured quote is filed.
//
// A standalone quote sits on exactly one board, and the reader picks which. The
// edit form has asked since boards shipped; the capture card never did, so every
// quote written from ＋ went wherever the server files an unasked one — and a
// reader standing on their own board of Bengali proverbs, pressing the ＋ that is
// right there on it, got the quote back in Others and had to move it by hand.
//
// TWO HALVES, AND ONLY THE SECOND IS OBVIOUS. The control has to be on the card
// at all, and it has to be ANSWERED ALREADY when the reader has answered it by
// standing somewhere. Asking again for something you have just said is the same
// defect as not asking, one politeness removed.
//
// The board a work's highlight belongs to is not a question: a board holds
// standalone quotes, so a highlight against a book must not be offered one.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const BOOKS = { books: [{ id: 4, title: 'The Dispossessed', author: 'Le Guin' }] }
const MOVIES = { movies: [] }
const BOARDS = {
  boards: [
    { id: 3, name: 'Others' },
    { id: 7, name: 'Bengali proverbs' },
  ],
  total: 2,
}

const posted = []

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'POST') {
      posted.push({ path, body })
      return { ok: true, data: { id: 1 } }
    }
    if (path === '/books') return { ok: true, data: BOOKS }
    if (path === '/movies') return { ok: true, data: MOVIES }
    if (path === '/boards') return { ok: true, data: BOARDS }
    if (path === '/tags') return { ok: true, data: { tags: [] } }
    return { ok: true, data: {} }
  }),
}))

const { CaptureQuote } = await import('../../src/AddSurface.jsx')

// The card hands its save verb out rather than drawing a button of its own — the
// surface around it owns the tick. A test is one of those surfaces.
function openCapture(props = {}) {
  const state = {}
  render(
    <CaptureQuote
      initialStandalone
      onCaptured={() => {}}
      onSaveState={(s) => Object.assign(state, s)}
      {...props}
    />,
  )
  return state
}

const write = async (state) => {
  const box = await screen.findByPlaceholderText('the line worth keeping…')
  fireEvent.change(box, { target: { value: 'অতি সন্ন্যাসীতে গাজন নষ্ট' } })
  await waitFor(() => expect(state.canSave).toBe(true))
  await state.save()
  return posted[posted.length - 1]
}

beforeEach(() => {
  posted.length = 0
  localStorage.clear()
})

describe('capturing onto a board', () => {
  it('files the quote on the board the ＋ was pressed on', async () => {
    const state = openCapture({ initialBoard: 7 })
    // Shown, not merely stored: a silently pre-filled answer is the thing the
    // picker's own rule about works warns against.
    expect(await screen.findByText('Bengali proverbs')).toBeTruthy()
    const sent = await write(state)
    expect(sent.path).toBe('/quotes')
    expect(sent.body.board_id).toBe(7)
  })

  it('offers the boards to a capture that came from nowhere in particular', async () => {
    const state = openCapture()
    // The control exists even with no board in hand — that is how a quote jotted
    // from Home can still be filed rather than swept up by a default.
    expect(await screen.findByLabelText('Board')).toBeTruthy()
    const sent = await write(state)
    // Nothing chosen means nothing claimed: the server's own default answers,
    // which is what it has always done and is right for a jot-and-run capture.
    expect(sent.body.board_id).toBe(null)
  })

  it('does not offer a board for a highlight against a book', async () => {
    render(<CaptureQuote initialTarget={{ type: 'book', id: 4 }} onCaptured={() => {}} />)
    expect(await screen.findByText('The Dispossessed')).toBeTruthy()
    // A board holds standalone quotes. Offering one here would promise a filing
    // that the annotation route has nowhere to put.
    expect(screen.queryByLabelText('Board')).toBeNull()
  })
})
