// The activity card's stream toggle does not move when the stream changes.
//
// It shared a wrapping row with a reset link that is drawn on ONE of the three
// streams, so choosing Practice on a phone re-laid the row out and the toggle
// slid out from under the thumb that had just pressed it. A control that moves
// because of what it was set to is the worst kind: the next press lands on
// whatever took its place.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const DAYS = (n) => Array.from({ length: 3 }, (_, i) => ({ day: `2024-0${i + 1}-01`, count: n, correct: n }))
const STATS = {
  daily: DAYS(2),
  daily_quiz: DAYS(3),
  daily_practice: DAYS(4),
  recall: { states: {} },
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/stats')) return { ok: true, data: STATS }
    return { ok: true, data: {} }
  }),
}))

const { ActivityCard } = await import('../../src/StatsPage.jsx')

const card = () =>
  render(
    <ActivityCard
      saves={STATS.daily}
      quiz={STATS.daily_quiz}
      practice={STATS.daily_practice}
      onSearch={() => {}}
      onResetPractice={() => {}}
    />,
  )

// The row that holds the count and the toggle. Read off the toggle rather than a
// class, so a restyle cannot make this assert nothing.
const headRow = () => screen.getByRole('tablist').parentElement

describe('the activity card', () => {
  it('keeps the stream toggle in the same row whichever stream is chosen', async () => {
    card()
    const before = headRow()
    expect([...before.children]).toHaveLength(2)

    fireEvent.click(screen.getByRole('tab', { name: /practice/i }))
    await waitFor(() => expect(screen.getByText(/reset/i)).toBeTruthy())
    // Same parent, same number of siblings: the reset link did not join the row.
    expect(headRow()).toBe(before)
    expect([...headRow().children]).toHaveLength(2)
  })

  it('puts the reset after the grid it empties, not above it', async () => {
    card()
    fireEvent.click(screen.getByRole('tab', { name: /practice/i }))
    const reset = await screen.findByText(/reset/i)
    const toggle = screen.getByRole('tablist')
    // Emptying a practice history is a decision reached by looking at the grid,
    // so it comes after it in the document.
    expect(toggle.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers no reset on the streams it cannot empty', async () => {
    card()
    expect(screen.queryByText(/reset/i)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /quiz/i }))
    expect(screen.queryByText(/reset/i)).toBeNull()
  })
})
