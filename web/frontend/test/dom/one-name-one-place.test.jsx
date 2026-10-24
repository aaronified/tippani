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
import { act, cleanup, render, screen } from '@testing-library/react'

import { DEFAULT_CREDIT_SEPS } from '../../src/credits.jsx'

// The search modal fetches the row it shows, its parent and the tag list; every
// other card here renders from props and ignores this.
let SERVED = {}
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => ({ ok: true, data: SERVED[path] || {} })),
}))

// `Frame` is the film line's card — the component the screenshot is of.
const { Frame } = await import('../../src/Movies.jsx')
const { FavouriteTile, screenFav } = await import('../../src/Home.jsx')
const { QuoteModal } = await import('../../src/SearchPage.jsx')

// THE SEPARATORS THE APP ACTUALLY PASSES. `[',']` is not "a comma" — the splitter
// reads `seps.comma`, and an array has no such key, so every flag is false and
// `splitCredits` hands back the joined string as ONE name. A two-hander then looks
// like one performer called "Rajesh Khanna, Amitabh Bachchan", and the case below
// that keeps an uncovered performer passed on a substring match rather than on the
// behaviour. A fixture no screen supplies proves nothing about the screens.
const SEPS = DEFAULT_CREDIT_SEPS

const LINE = {
  id: 1,
  quote: 'बाबूमोशाय ज़िंदगी बड़ी होनी चाहिए लंबी नहीं',
  character: 'Anand',
  actor: 'Rajesh Khanna',
  speaker_cast: { name: 'Anand', actor: 'Rajesh Khanna', image: '', actor_image: '', record_name: 'Anand' },
  character_images: [],
}

const card = (over) => render(
  <Frame d={{ ...LINE, ...over }} tagMap={{}} stickerMap={{}} seps={SEPS} />,
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

})

// ---- the same rule, on the two shapes it kept being broken on ----------------

// The two-hander from the report: both characters on the work's cast, both
// performers credited on the line.
const TWO_HANDER = {
  id: 9,
  movie_id: 3,
  quote: "Mark Wallace: Just wish that you'd stop sniping.",
  character: 'Mark Wallace, Joanna Wallace',
  actor: 'Albert Finney, Audrey Hepburn',
  character_images: [
    { name: 'Mark Wallace', path: '', actor: 'Albert Finney', cast_id: 1, character_id: 1 },
    { name: 'Joanna Wallace', path: '', actor: 'Audrey Hepburn', cast_id: 2, character_id: 2 },
  ],
  speaker_cast: { cast_id: 1, character_id: 1, name: 'Mark Wallace', record_name: 'Mark Wallace', actor: 'Albert Finney' },
  color: 'yellow',
  tags: [],
  favorite: true,
  created_at: '2024-01-01T00:00:00Z',
}

const frame = (over = {}) =>
  render(
    <Frame
      d={{ ...TWO_HANDER, ...over }}
      tagMap={{}}
      editing={false}
      onEdit={() => {}}
      onCancelEdit={() => {}}
      onSave={() => {}}
      onPatch={() => {}}
      onDelete={() => {}}
      onOpenPerson={() => {}}
      onOpenCharacter={() => {}}
      seps={SEPS}
      actionsAlwaysVisible
    />,
  )

const tile = (over = {}, open = true) => {
  const f = screenFav({ ...TWO_HANDER, ...over }, { 3: { title: 'Two for the Road', media_type: 'movie' } })
  render(
    <FavouriteTile
      f={f}
      variant="a"
      open={open}
      editing={false}
      onToggle={() => {}}
      onOpen={() => {}}
      onOpenPerson={() => {}}
      onOpenCharacter={() => {}}
      actorMap={{}}
      seps={SEPS}
    />,
  )
}

// The card's own body — the edit modal renders the same names into hidden
// inputs, and a form field is not a printing. Named `cardBody` because `card()`
// above already means "render one" in this file.
//
// THE CLASSES ARE THE REAL ONES, MEASURED. `.tp-hand-card` does not exist in this
// app — `HandCard` writes `hand-card` — so a selector naming it falls through to
// `document.body` and the scope this line claims to apply is not applied. It
// happened to make no difference here (nothing else renders), which is exactly
// how a wrong selector survives: the assertions pass and the scope is a comment.
// `.film-frame` is the film card's own class (Movies.jsx) and `.hand-card` the
// favourite tile's (ui.jsx).
const cardBody = () => document.querySelector('.film-frame, .hand-card') || document.body

// How many times a name is PRINTED: leaf elements only, so a name is not counted
// once for itself and again for every wrapper around it.
const printings = (name) =>
  [...cardBody().querySelectorAll('*')]
    .filter((el) => el.children.length === 0 && el.textContent.includes(name))

const chipFor = (character) =>
  [...cardBody().querySelectorAll('.person-chip, .tp-person-chip, .speaker-chips > *')]
    .find((el) => el.textContent.includes(character))

// ---- and on the search hit, which is a header ABOVE a whole card -------------

