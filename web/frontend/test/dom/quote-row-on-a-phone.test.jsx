// A QUOTE'S ACTION ROW IS ONE LINE ON A PHONE (#60).
//
// Copy and share stood beside the heart, the colour pick and the ⋯, which is more than
// one line holds at 390px, so the ⋯ dropped to a second row. On a phone the row keeps
// the heart and the colour and the rest is behind the ⋯; on a desk the glyphs stay in
// the row. jsdom has no layout to measure, so what is checked is what a person can
// reach and where: which controls are in the row, and what the ⋯ opens.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ActionRow, actionsFor } from '../../src/actions.jsx'

const realMatchMedia = window.matchMedia
const setViewport = (mobile) => {
  window.matchMedia = (media) => ({
    matches: mobile,
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

const row = () => {
  const copy = vi.fn()
  const share = vi.fn()
  const item = { id: 1, quote: 'Manuscripts do not burn.', favorite: false }
  const acts = actionsFor('annotation', item, { copy, share, edit: () => {}, remove: () => {} })
  render(<ActionRow acts={acts} item={item} color="yellow" onColor={() => {}} onFavourite={() => {}} />)
  return { copy, share }
}

const menuTrigger = () => screen.getByRole('button', { name: /more/i })

describe('a quote card on a phone', () => {
  it('keeps copy and share out of the row and behind the ⋯', () => {
    setViewport(true)
    const { copy } = row()
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()

    fireEvent.click(menuTrigger())
    const names = screen.getAllByRole('menuitem').map((m) => m.textContent)
    expect(names.some((n) => /Copy/.test(n))).toBe(true)
    expect(names.some((n) => /Share/.test(n))).toBe(true)

    fireEvent.click(screen.getAllByRole('menuitem').find((m) => /^Copy/.test(m.textContent)))
    expect(copy).toHaveBeenCalledTimes(1)
  })

  it('still offers the heart in the row', () => {
    setViewport(true)
    row()
    expect(screen.getByRole('button', { pressed: false })).toBeTruthy()
  })
})

describe('a quote card on a desk', () => {
  it('keeps copy and share in the row', () => {
    setViewport(false)
    row()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
  })
})
