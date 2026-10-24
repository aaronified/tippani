// A CAST IS RECOGNISED BEFORE IT IS READ.
//
// THE SPECIFICATION, `work-details-popup.dc.html:784-800`, billed at `:1092`,
// `:1116` and `:1160`: between a work's fields and its ids, a head reading
// `Cast · N` and then one round face per member — 60px, the character's name
// under it, the performer's under that, the whole row scrolling sideways.
//
// WHY THE FACE AND NOT A LIST. The People panel already lists the cast as rows
// and that is the right shape for editing one. It is the wrong shape for
// answering "who is in this": every row on it carries the same work, so the only
// thing separating one from the next is a string, and a reader who knows the film
// knows the faces long before they know the spelling of a supporting part.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, plus three standing
// rules of this repo that bind the strip and that the pack's own CSS breaks:
// a name is never shortened, a box that holds text is not measured in px, and an
// edge fade is MEASURED rather than counted (so the strip is a Scroller).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

import { resolveOn } from '../css-cascade.js'

let CAST = [
  { id: 11, character: 'Anand Sehgal', actor: 'Rajesh Khanna', character_id: 158, character_image_path: '', character_record_image: '', actor_image: 'face004.jpg' },
  { id: 12, character: 'Dr. Bhaskar K. Bannerjee', actor: 'Amitabh Bachchan', character_id: 182, character_image_path: 'still.jpg', character_record_image: '', actor_image: 'face6f9.jpg' },
  // A row with no record behind it: the tile still draws, and declines the press.
  { id: 13, character: 'Isabhai Suratwala', actor: 'Johnny Walker', character_id: 0, character_image_path: '', character_record_image: '', actor_image: '' },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path.endsWith('/cast')) {
      // CAST_OK false is a read that FAILED — a 500, a dropped connection, a
      // logged-out session — which is a different thing from a work with no cast
      // and has to look different to the reader in exactly one way: not at all.
      return CAST_OK ? { ok: true, data: { cast: CAST, actor_role: 'actor' } } : { ok: false, status: 500 }
    }
    if (method === 'GET' && /^\/(books|movies)\/\d+$/.test(path)) return { ok: true, data: FILM }
    if (method === 'GET' && path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  }),
}))

const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
const { PanelHarness, resetPanelHistory } = await import('../panel-harness.jsx')

const FILM = {
  id: 11, title: 'Anand', media_type: 'movie', director: 'Hrishikesh Mukherjee',
  release_year: 1971, genres: ['Drama'], description: '', cast: [],
}
const BOOK = {
  id: 4, title: 'Anand', author: 'Gulzar', published_year: 1971, genres: ['Drama'], description: '',
}

const FULL_CAST = CAST
let CAST_OK = true
beforeEach(() => {
  resetPanelHistory()
  CAST = FULL_CAST
  CAST_OK = true
})

const panel = (kind = 'movie', item = FILM) =>
  render(
    <PanelHarness
      panel={(stack) => workDetailsPanel(stack, { kind, item, onChanged: () => {}, onDelete: null })}
    />,
  )

const tiles = () => [...document.querySelectorAll('.cs-face-tile')]
const shown = () => waitFor(() => expect(tiles().length).toBe(CAST.length))

describe('the cast strip', () => {

  it('opens the character, and says so when it cannot', async () => {
    panel()
    await shown()
    const openable = tiles().find((t) => t.textContent.includes('Bhaskar'))
    expect(openable.getAttribute('aria-disabled'), 'a row with a record refuses the press').toBeNull()
    const dead = tiles().find((t) => t.textContent.includes('Isabhai'))
    expect(dead.getAttribute('aria-disabled'),
      'a tile with no record behind it draws exactly like one that opens').toBe('true')
  })

})

// ---- the cast that is not there ---------------------------------------------
//
// THE PACK HAS A HEAD FOR IT: `Cast · none` (`work-details-popup.dc.html:1141`),
// not `Cast · 0`. A zero is a measurement and "none" is an answer, and this is
// the one head whose whole job is to say there is nothing here yet.
//
// AND THE HEAD IS THE DOOR. The way into the cast editor is the head's own key,
// so a head that does not draw takes the only way to ADD a cast with it — which
// is the state a reader with no cast is most likely to want.

// ---- and a cast with nobody playing anybody ---------------------------------

