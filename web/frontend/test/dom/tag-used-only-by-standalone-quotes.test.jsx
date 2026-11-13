// A tag worn only by standalone quotes is in use, and the console says so.
//
// WHY THIS EXISTS. The tag list gave one count for annotations and one for
// dialogues, and the console added those two. A tag worn only by standalone quotes
// summed to zero: its Delete said nothing about them, on a delete that cannot be
// undone, and its Practise link was missing. The server now sends `utterances`
// too, and this checks the console adds it.
//
// THE MUTATION: take `+ (tag.utterances || 0)` out of `tagUses` in TagsPage.jsx
// and the confirmation reads `Delete tag "proverbs"?` with no mention of what it
// is detached from, so the first assertion fails.
//
// It knows only the words on the screen. The two calls it answers (the tag list
// and the sticker list) are the page's own reads, the network being the one
// thing a dom test has to stand in for.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path === '/tags') {
      return {
        ok: true,
        data: { tags: [{ id: 1, name: 'proverbs', color: 'blue', style: 'sticker', annotations: 0, dialogues: 0, utterances: 3 }] },
      }
    }
    if (method === 'GET' && path === '/stickers') {
      return { ok: true, data: { stickers: [{ id: 5, name: 'seal', path: 'seal.png', annotations: 0, dialogues: 0, utterances: 2 }] } }
    }
    return { ok: true, data: {} }
  }),
}))

const { default: TagsPage } = await import('../../src/TagsPage.jsx')

describe('a tag only standalone quotes wear', () => {
  it('asks before deleting what it is detached from, and offers to practise it', async () => {
    render(<TagsPage />)
    await screen.findByText(/proverbs · 3/)
    expect(screen.getByRole('button', { name: /practise/i })).toBeTruthy()

    // the tag's Delete is the first on the page; the sticker's follows it
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])
    await waitFor(() => expect(screen.getByText(/detached from 3/)).toBeTruthy())
  })

  it('does the same for a sticker', async () => {
    render(<TagsPage />)
    await screen.findByText(/proverbs · 3/)
    const buttons = await screen.findAllByRole('button', { name: /delete/i })
    fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() => expect(screen.getByText(/2 quotes/)).toBeTruthy())
  })
})
