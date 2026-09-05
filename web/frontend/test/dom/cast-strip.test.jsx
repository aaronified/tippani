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
import { render, screen, waitFor } from '@testing-library/react'

import { resolveOn } from '../css-cascade.js'

const CAST = [
  { id: 11, character: 'Anand Sehgal', actor: 'Rajesh Khanna', character_id: 158, character_image_path: '', character_record_image: '', actor_image: 'face004.jpg' },
  { id: 12, character: 'Dr. Bhaskar K. Bannerjee', actor: 'Amitabh Bachchan', character_id: 182, character_image_path: 'still.jpg', character_record_image: '', actor_image: 'face6f9.jpg' },
  // A row with no record behind it: the tile still draws, and declines the press.
  { id: 13, character: 'Isabhai Suratwala', actor: 'Johnny Walker', character_id: 0, character_image_path: '', character_record_image: '', actor_image: '' },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path.endsWith('/cast')) return { ok: true, data: { cast: CAST, actor_role: 'actor' } }
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

beforeEach(() => resetPanelHistory())

const panel = () =>
  render(
    <PanelHarness
      panel={(stack) => workDetailsPanel(stack, { kind: 'movie', item: FILM, onChanged: () => {}, onDelete: null })}
    />,
  )

const tiles = () => [...document.querySelectorAll('.cs-face-tile')]
const shown = () => waitFor(() => expect(tiles().length).toBe(CAST.length))

describe('the cast strip', () => {
  it('draws one face per member, under a head that counts them', async () => {
    panel()
    await shown()
    expect(screen.getByText(`Cast · ${CAST.length}`), 'no head, or the wrong count').toBeTruthy()
    for (const t of tiles()) {
      expect(t.querySelector('.cs-face-round'), `${t.textContent} has no face`).toBeTruthy()
    }
  })

  it('names the character and who played them, on the same tile', async () => {
    // THE OWNER'S RULING, the same one the quote card carries: "the pill should
    // have character and actor both." A cast tile that named only the character
    // would send the reader to the People panel for the other half of one fact.
    panel()
    await shown()
    const anand = tiles().find((t) => t.textContent.includes('Anand Sehgal'))
    expect(anand.textContent).toContain('Rajesh Khanna')
  })

  it('prefers this work’s own picture of the character over the performer’s face', async () => {
    // They are different pictures of different things — a role in costume against
    // a person — and the tile is about the role. The performer's headshot is the
    // last resort rather than the first, which is what makes a film whose stills
    // have been fetched look different from one whose have not.
    panel()
    await shown()
    const bhaskar = tiles().find((t) => t.textContent.includes('Bhaskar'))
    expect(bhaskar.querySelector('img')?.getAttribute('src') || '').toContain('still.jpg')
    const anand = tiles().find((t) => t.textContent.includes('Anand Sehgal'))
    expect(anand.querySelector('img')?.getAttribute('src') || '', 'no picture at all where the performer has one')
      .toContain('face004.jpg')
  })

  it('opens the character, and says so when it cannot', async () => {
    panel()
    await shown()
    const openable = tiles().find((t) => t.textContent.includes('Bhaskar'))
    expect(openable.getAttribute('aria-disabled'), 'a row with a record refuses the press').toBeNull()
    const dead = tiles().find((t) => t.textContent.includes('Isabhai'))
    expect(dead.getAttribute('aria-disabled'),
      'a tile with no record behind it draws exactly like one that opens').toBe('true')
  })

  it('shortens no name', async () => {
    // The standing rule. The pack clamps each caption to two lines with
    // `overflow: hidden`, which cuts a long name without even an ellipsis to say
    // so; the strip scrolls sideways, so a third line costs nothing.
    for (const sel of ['.cs-face-name', '.cs-face-by']) {
      expect(resolveOn(sel, 'text-overflow')?.value || 'clip', `${sel} truncates`).not.toBe('ellipsis')
      expect(resolveOn(sel, 'max-height')?.value || 'none', `${sel} is clamped`).toBe('none')
      expect(resolveOn(sel, 'overflow')?.value || 'visible', `${sel} hides what does not fit`).not.toBe('hidden')
    }
  })

  it('measures a tile that holds text in em, not in px', async () => {
    // A frozen width and text that grows with the type dials is the clipping the
    // typescale suite exists to catch. The pack's 78px is the floor.
    const w = resolveOn('.cs-face-tile', 'width')?.value || ''
    expect(w, 'the tile width is a bare px').toMatch(/max\(/)
    expect(w).toMatch(/em/)
  })

  it('says it scrolls by measuring, not by counting', async () => {
    // `Scroller` writes the fade from a measurement of the row; the pack switches
    // it on at five tiles, which is wrong in both directions — four long names
    // that do overflow, six short ones that do not.
    //
    // ASSERTED ON THE SOURCE, because the measurement itself cannot run here:
    // jsdom lays nothing out, so `useEdgeScroll` measures every row as fitting
    // and writes no `data-scroll-x` whatever the component does. What a DOM test
    // CAN see is a box with `overflow-x` and no hook on it, which is the bare
    // overflow the standing rule forbids — and that is what this reads.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.env.TIPPANI_SRC, 'characterRows.jsx'), 'utf8')
    expect(src, 'the cast strip is a bare overflow rather than a Scroller')
      .toMatch(/<Scroller\s+className="cs-faces"/)
  })
})
