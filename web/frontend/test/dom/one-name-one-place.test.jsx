// A NAME APPEARS ONCE ON A CARD, AND THE PILL IS WHERE IT APPEARS.
//
// THE OWNER SAID THIS TWICE AND I READ IT BACKWARDS THE FIRST TIME. "the actor is
// named below, not in the pill", and then "still 2 lines everywhere instead of
// the actor in the pill". The duplication was real — the chip carried the
// performer under the character AND a PLAYED BY line named them again four
// elements down — and the half I removed was the wrong half: I took the performer
// out of the chip and left the line. This file states which half goes, so the
// next reading of "there are duplicates" cannot resolve it the other way.
//
// WHAT IS ASSERTED IS THE COUNT, not a layout. A name that appears once appears
// once wherever the card decides to put it; a name that appears twice is the
// defect, in either arrangement. And a name the chip does NOT carry has to stay
// on the line, or dropping the line loses it — which is the failure the obvious
// fix ("no line when there is a chip") would have shipped.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

// `Frame` is the film line's card — the component the screenshot is of.
const { Frame } = await import('../../src/Movies.jsx')

const LINE = {
  id: 1,
  quote: 'बाबूमोशाय ज़िंदगी बड़ी होनी चाहिए लंबी नहीं',
  character: 'Anand',
  actor: 'Rajesh Khanna',
  speaker_cast: { name: 'Anand', actor: 'Rajesh Khanna', image: '', actor_image: '', record_name: 'Anand' },
  character_images: [],
}

const card = (over) => render(
  <Frame d={{ ...LINE, ...over }} tagMap={{}} stickerMap={{}} seps={[',']} />,
)

// How many times a name is printed anywhere on the card.
const times = (name) => screen.queryAllByText((_, el) => {
  if (!el || el.children.length) return false
  return (el.textContent || '').trim() === name
}).length

afterEach(() => cleanup())

describe('the performer on a film line', () => {
  it('is named once, not once in the pill and once on a line under it', () => {
    card({})
    expect(times('Rajesh Khanna'), 'the performer should be named exactly once — in the pill').toBe(1)
  })

  it('and so is the character', () => {
    card({})
    expect(times('Anand'), 'the character should be named exactly once — in the pill').toBe(1)
  })

  it('keeps a performer the pill does not carry', () => {
    // Several performers on one line — they are entered like genres — while the
    // chip's subtitle carries only the one the cast row resolved. Dropping the
    // line wholesale because a chip exists would silently lose the others.
    card({ actor: 'Rajesh Khanna, Amitabh Bachchan' })
    expect(screen.queryAllByText(/Amitabh Bachchan/).length,
      'a performer the pill does not name was dropped with the line').toBeGreaterThan(0)
  })

  it('is still named when there is no pill at all', () => {
    // No cast row resolved, so no chip: the line is the only place the performer
    // can be, and it has to be there.
    card({ speaker_cast: null })
    expect(screen.queryAllByText(/Rajesh Khanna/).length, 'a line with no pill names nobody').toBeGreaterThan(0)
  })
})
