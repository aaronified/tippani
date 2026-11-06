// THE BOARD FIELD ON THE QUOTE FORM. It drew its "Board" heading unconditionally and gated only the
// select, so a reader with no boards, or anyone while /boards was in flight, saw a heading with
// nothing under it (the screen audit's finding 4). The field is whole or absent.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

const { UtteranceForm } = await import('../../src/Quotes.jsx')

const form = (props = {}) =>
  render(<UtteranceForm initial={{ quote: 'A line.', board_id: 3 }} onSubmit={() => null} submitLabel="Save" {...props} />)

describe('the Board field on the quote form', () => {
  it('draws no heading when there are no boards', () => {
    form({ boards: [] })
    expect(screen.queryByText('Board')).toBeNull()
  })

  it('draws the heading and its select when there are boards', () => {
    form({ boards: [{ id: 3, name: 'Letters' }] })
    expect(screen.getByText('Board')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Board' })).toBeTruthy()
  })

  it('still sends the board it holds when the field is not drawn, so a save does not move the quote', async () => {
    let sent = null
    form({ boards: [], onSubmit: (fields) => { sent = fields; return null } })
    fireEvent.click(screen.getByText('Save'))
    await vi.waitFor(() => expect(sent).not.toBeNull())
    expect(sent.board_id).toBe(3)
  })
})
