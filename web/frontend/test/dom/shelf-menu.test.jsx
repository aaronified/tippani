// The shelf transitions menu, as a reader opens it.
//
// A game is a movies-table row told apart by media_type, and its finished word is
// "played" rather than "watched". moveLabel used to work that out from `from ===
// 'playing'` — i.e. from the status the work happens to be in — and so got it
// right only for a game you are playing right now. The Shelve chip on a game you
// have not started, and the menu on a paused or abandoned one, all offered "Mark
// as watched".
//
// works.test.js pins moveLabel itself. This file exists because that is not
// enough: ShelfControl computes the active word per row and then called
// transitionItems with only the kind, so `item` was dropped one frame ABOVE the
// bug. A corrected pure test passes while the rendered menu stays wrong. So the
// assertion here is on the menu a click actually opens, for the exact state the
// bug was reported in — a game with no status at all — and on the film half, so
// neither side can be satisfied by rewording the other.

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShelfControl } from '../../src/works.jsx'

// The chip is the only way in: StateTag renders its popover on click, into a
// portal. `status` empty is the "Shelve" stand-in chip. The FIRST chip is the
// state chip — a work with a state also carries the read-log chip beside it, so
// by-role would be ambiguous.
function openMenu({ media_type, status = '' }) {
  render(<ShelfControl kind="movie" item={{ id: 1, media_type }} status={status} onSelect={() => {}} />)
  fireEvent.click(document.querySelectorAll('.tp-chip-btn')[0])
  return [...document.querySelectorAll('[role="menu"] .menu-item')].map((b) => b.textContent)
}

describe('the shelf transitions menu', () => {
  it('offers a game "Mark as played" from the Shelve chip', () => {
    const items = openMenu({ media_type: 'game' })
    expect(items).toContain('Mark as played')
    expect(items).not.toContain('Mark as watched')
    // The whole menu, not just the row that was wrong: the destinations are the
    // game's own, so "start" reads as playing too. Four rows, not five — the
    // clear row is the current state here and ShelfControl filters it out.
    expect(items).toEqual(['Mark as playing', 'Pause it', 'Give up on it', 'Mark as played'])
  })

  it('offers a paused game "Mark as played" too', () => {
    const items = openMenu({ media_type: 'game', status: 'paused' })
    expect(items).toContain('Mark as played')
    expect(items).not.toContain('Mark as watched')
  })

  it('leaves the film menu watching and watched', () => {
    const items = openMenu({ media_type: 'movie' })
    expect(items).toContain('Mark as watched')
    expect(items).not.toContain('Mark as played')
    expect(items).toEqual(['Mark as watching', 'Pause it', 'Give up on it', 'Mark as watched'])
  })
})
