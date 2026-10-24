// The serendipity card shows the quote AND where it came from.
//
// THE BUG, as reported: "shuffled quotes are devoid of even chips and character
// names." The card was the quote, a colour bar, and a title-and-credit line in
// small caps — on the one surface in the app whose whole job is to make you glad
// you kept something. Every other quote surface draws a cover, the credited people
// as faces you can click through to, the tags and the copy/share row. This one
// drew none of it, and nothing failed: the card rendered, the words were right,
// and it was simply the plainest thing on the screen.
//
// Two of those omissions were wrong rather than merely thin. The card printed
// `credit`, which for a film line is the ACTOR — so a line from Casablanca was
// captioned Humphrey Bogart and never Rick Blaine, the name a reader is looking
// for. And the row had no cover at all, so a library of posters showed none here.
//
// IT USED TO SCRAPE Home.jsx, slicing the function out by name and asserting it
// contained the identifiers `coverImgURL`, `q.character`, `PersonCredit`,
// `splitCredits`, `actionsFor` and `=== false`. That is a test that the code is
// present. It could not tell a cover that renders from one behind a condition
// that is never true, a character read into a variable and never printed, or a
// heart whose rollback never runs — and it failed outright the moment somebody
// renamed the component, while the card on screen was unchanged. Its own header
// said the card "is not exported", which is true and beside the point: it renders
// inside Home, and Home is exported.
//
// So a quote is put on the server and every assertion below is about the card.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'

let SHUFFLED
let TODAY
let PATCH_OK

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/on-this-day')) return { ok: true, data: { quotes: TODAY } }
    if (path.startsWith('/shuffle')) return { ok: true, data: { quote: SHUFFLED } }
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: [] } }
    if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: [] } }
    if (path.startsWith('/quotes')) return { ok: true, data: { utterances: [] } }
    if (method === 'PATCH') return { ok: PATCH_OK, data: {} }
    return { ok: true, data: {} }
  }),
}))

const { default: Home } = await import('../../src/Home.jsx')

// A film line with everything a card can show: a poster, a character, two
// performers under the reader's own separators, tags, and a heart already on.
const FILM_LINE = {
  id: 11, kind: 'screen', media_type: 'movie', work_id: 5,
  quote: 'Of all the gin joints in all the towns in all the world',
  title: 'Casablanca', year: 1942,
  character: 'Rick Blaine',
  credit: 'Humphrey Bogart & Ingrid Bergman',
  cover_path: 'casablanca.jpg',
  tags: ['noir', 'goodbye'],
  favorite: 1,
  color: 'yellow',
}

beforeEach(() => {
  SHUFFLED = FILM_LINE
  TODAY = []
  PATCH_OK = true
})
afterEach(() => cleanup())

const shuffleUp = async (props = {}) => {
  render(
    <Home
      user={{ username: 'alice', preferences: { creditSeparators: ',;&' } }}
      stats={{}}
      onOpenBook={() => {}}
      onOpenMovie={() => {}}
      onGoLibrary={() => {}}
      onGoMovies={() => {}}
      onGoQuotes={() => {}}
      onPending={() => {}}
      onReviewImport={() => {}}
      {...props}
    />,
  )
  await act(async () => {})
  await act(async () => {
    screen.getByText('Shuffle').closest('button').click()
  })
  const words = await screen.findByText(/Of all the gin joints/)
  return words.closest('.hand-card') || words.closest('section')
}

describe('the serendipity card', () => {

  it('names the CHARACTER, not only the actor who played them', async () => {
    // The specific thing that was missing. `credit` alone is the actor, so a line
    // from Casablanca was captioned Humphrey Bogart and never Rick Blaine.
    const card = await shuffleUp()
    expect(within(card).getByText(/Rick Blaine/), 'the character is nowhere on the card').toBeTruthy()
    expect(within(card).getByText(/Casablanca/)).toBeTruthy()
    expect(within(card).getByText(/1942/)).toBeTruthy()
  })

})
