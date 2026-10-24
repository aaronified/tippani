// The two marks a work in progress wears — the badge ON the artwork and the
// colour bar UNDER it — read out loud.
//
// Both are drawn by ui.jsx from a `kind` the tile hands down, and both were
// asking the wrong thing:
//
//   ReadingBadge was a two-way isBook split, and the Catalogue passes the literal
//   'movie' for every tile it deals. A game you are playing announced itself as
//   "Currently watching".
//
//   StatusBar called shelfLabel(state) with no kind at all, and shelfLabel
//   defaults to the books side — so a film you are watching announced itself as
//   "Reading — 40%".
//
// Neither is visible on screen: they are an accessible name and a tooltip, which
// is exactly the class of bug a screenshot cannot catch and nobody reports. So the
// assertions here are on the name a reader hears, per medium, from the row — the
// same "ask the row, do not infer" rule capKeyFor and moveLabel already follow.

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkCard } from '../../src/works.jsx'

// One tile, as a board deals it. `kind` is the BOARD's kind, which is the whole
// point: 'movie' is what the Catalogue passes for a film, a show and a game
// alike, so the medium can only come from the row.
const tile = (kind, item) =>
  render(<WorkCard kind={kind} item={{ id: 1, title: 'x', ...item }} index={0} onOpen={() => {}} />)

// THE BAR IS NO LONGER THE ONLY role="img" ON A TILE, and the sentence that said
// it was is why this helper is here rather than inline. Since the count sweep the
// quote count is a figure and a glyph, and the glyph is an image named for the
// noun it stands in for — so the bar is found by what it is about (a state and a
// percentage) rather than by being the only one of its kind. Its accessible name
// is still the string under test.
const barName = () =>
  screen.getAllByRole('img')
    .map((el) => el.getAttribute('aria-label'))
    .find((name) => name && !/^(quote|quotes|film line|film lines)$/.test(name))

describe('the badge on the artwork of something in progress', () => {
  it('calls a game you are playing playing', () => {
    tile('movie', { media_type: 'game', status: 'playing' })
    expect(screen.getByLabelText('Currently playing')).toBeTruthy()
    expect(screen.queryByLabelText('Currently watching')).toBeNull()
  })
})

describe('the colour bar under the artwork', () => {
  it('says Watching over a film, not Reading', () => {
    tile('movie', { status: 'watching', progress: 40 })
    expect(barName()).toBe('Watching — 40%')
  })
})
