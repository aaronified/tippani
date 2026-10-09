// A themed round on a phone takes the whole screen, and its back key says where
// it goes back to.
//
// Found by the rating pass over 1e935d00: the round drew a back arrow with no
// word beside it, and FormModal's own comment is that a back key that says
// nothing is a guess about where it lands. Each screen that starts a round now
// names itself.
//
// DECLARED EXCEPTIONS: the network is replaced (api.js's `json`) so the server can
// deal a round; it knows /review/practice and a card's fields. The width is
// forced the way add-surface-phone.test.jsx forces it, by answering the app's
// own phone query, because jsdom answers no to every media query.
//
// THE MUTATION: ThemedPracticeDialog without `backTo={from}`: red, no button
// named "Back to Stats".

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path) => {
    if (path.startsWith('/review/practice')) {
      return { ok: true, data: { items: [{ kind: 'book', id: 1, direction: 'source', quote: 'a line', title: 'Emma',
        author: 'Austen', color: 'yellow', options: ['Emma', 'Villette'], answer: 0 }] } }
    }
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  },
}))

const { MOBILE_SCREEN_QUERY } = await import('../../src/ui.jsx')
const { ThemedPracticeDialog } = await import('../../src/review.jsx')

let realMatchMedia
beforeEach(() => {
  realMatchMedia = window.matchMedia
  window.matchMedia = (media) => ({
    matches: media === MOBILE_SCREEN_QUERY,
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false },
  })
})
afterEach(() => { window.matchMedia = realMatchMedia })

describe('a themed round on a phone', () => {
  it('has a back key naming the screen it was started from', async () => {
    const onClose = vi.fn()
    render(<ThemedPracticeDialog theme={{ tag: 'grief', label: 'grief' }} from="Stats" onClose={onClose} />)
    await screen.findByText('1 of 1')
    fireEvent.click(screen.getByRole('button', { name: 'Back to Stats' }))
    expect(onClose).toHaveBeenCalled()
  })
})
