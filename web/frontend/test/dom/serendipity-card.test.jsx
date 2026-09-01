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
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'

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
  it('shows the poster of where the line came from', async () => {
    const card = await shuffleUp()
    // alt="" on purpose — the poster is decoration beside words that already name
    // the film — so it has no role to query by, and the DOM is the honest place
    // to look for it.
    const art = card.querySelector('img')
    expect(art, 'no cover: a library of posters shows none of them here').toBeTruthy()
    expect(art.getAttribute('src')).toContain('casablanca.jpg')
  })

  it('says so, rather than leaving a gap, when the work has no art', async () => {
    SHUFFLED = { ...FILM_LINE, cover_path: '' }
    const card = await shuffleUp()
    // The placeholder names what is missing — "Film" — instead of a blank the
    // width of a poster. Scoped to the hatch itself: the card's own kind badge
    // says "Film" too, and matching that instead would pass with no art at all.
    expect(card.querySelector('img'), 'a poster with no path still rendered').toBeNull()
    const hatch = card.querySelector('.ph')
    expect(hatch, 'no placeholder for a work with no art').toBeTruthy()
    expect(hatch.textContent).toMatch(/film/i)
  })

  it('names the CHARACTER, not only the actor who played them', async () => {
    // The specific thing that was missing. `credit` alone is the actor, so a line
    // from Casablanca was captioned Humphrey Bogart and never Rick Blaine.
    const card = await shuffleUp()
    expect(within(card).getByText(/Rick Blaine/), 'the character is nowhere on the card').toBeTruthy()
    expect(within(card).getByText(/Casablanca/)).toBeTruthy()
    expect(within(card).getByText(/1942/)).toBeTruthy()
  })

  it('draws each credited person once, with their name, split on the reader’s separators', async () => {
    // TWO people, not one chip named after both — the `&` is a separator this
    // account has switched on. And ONCE each: an overlapping portrait cluster
    // used to sit on the source line as well as this row, so Roman Holiday drew
    // four faces for two actors.
    const card = await shuffleUp()
    expect(within(card).getAllByText('Humphrey Bogart')).toHaveLength(1)
    expect(within(card).getAllByText('Ingrid Bergman')).toHaveLength(1)
    expect(within(card).queryByText(/Humphrey Bogart & Ingrid Bergman/), 'the credit was never split').toBeNull()
  })

  it('draws the tags', async () => {
    const card = await shuffleUp()
    expect(within(card).getByText('noir')).toBeTruthy()
    expect(within(card).getByText('goodbye')).toBeTruthy()
  })

  it('offers the same quote row every other surface offers', async () => {
    const card = await shuffleUp()
    expect(within(card).getByLabelText('Copy'), 'no Copy on the card').toBeTruthy()
    expect(within(card).getByLabelText('Share'), 'no Share on the card').toBeTruthy()
  })

  it('rolls the heart back when the write fails', async () => {
    // The card paints optimistically, so without the rollback a failed write
    // leaves a filled heart on an unhearted quote — the one state a reader cannot
    // tell is wrong.
    PATCH_OK = false
    const card = await shuffleUp()
    // The quote arrives already hearted, so the ⋯ offers to take it off. The row
    // is copy and share; favouriting lives in the overflow, where a thumb reaches
    // it first.
    const openOverflow = async () => {
      await act(async () => {
        within(card).getByLabelText('More actions').click()
      })
    }
    await openOverflow()
    expect(screen.getByRole('menuitem', { name: 'Unfavourite' }),
      'the card does not know the quote is already a favourite').toBeTruthy()

    await act(async () => {
      screen.getByRole('menuitem', { name: 'Unfavourite' }).click()
    })
    // The write failed, so the quote is still a favourite and the menu must say
    // so. Without the rollback it reads "Favourite" — an un-hearted quote that is
    // still hearted on the server, which is the one state a reader cannot tell is
    // wrong.
    await openOverflow()
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: 'Unfavourite' }),
        'the heart stayed off after the write failed').toBeTruthy())
  })

  it('is not a doorway when there is nowhere to go', async () => {
    // A standalone quote with the Quotes screen switched off has no destination.
    // An absent control is honest; a dead one is not.
    SHUFFLED = { ...FILM_LINE, id: 12, kind: 'quote', media_type: undefined, work_id: 0, cover_path: '' }
    render(
      <Home
        user={{ username: 'alice', preferences: { creditSeparators: ',;&' } }}
        stats={{}}
        onOpenBook={() => {}}
        onOpenMovie={() => {}}
        onGoLibrary={() => {}}
        onGoMovies={() => {}}
        onPending={() => {}}
        onReviewImport={() => {}}
      />,
    )
    await act(async () => {})
    await act(async () => { screen.getByText('Shuffle').closest('button').click() })
    await screen.findByText(/Of all the gin joints/)
    expect(screen.queryByLabelText('Go to your quotes'), 'a dead doorway on a card with nowhere to go').toBeNull()
  })
})

describe('the row that holds it', () => {
  it('enriches the on-this-day card exactly as it enriches the shuffled one', async () => {
    // On this day draws the same card as Shuffle. It used to be possible to
    // enrich one and leave the other plain, which is how a fix ships half-done.
    TODAY = [FILM_LINE]
    SHUFFLED = { ...FILM_LINE, id: 12, quote: 'Here’s looking at you, kid' }
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
      />,
    )
    await act(async () => {})
    const dated = (await screen.findByText(/Of all the gin joints/)).closest('.hand-card')
    await act(async () => { screen.getByText('Shuffle').closest('button').click() })
    const chanced = (await screen.findByText(/looking at you, kid/)).closest('.hand-card')

    for (const [name, card] of [['on this day', dated], ['shuffled', chanced]]) {
      expect(within(card).getByText('Humphrey Bogart'), `${name}: no people`).toBeTruthy()
      expect(within(card).getByText('noir'), `${name}: no tags`).toBeTruthy()
      expect(within(card).getByLabelText('Copy'), `${name}: no actions`).toBeTruthy()
      expect(within(card).getByText(/Rick Blaine/), `${name}: no character`).toBeTruthy()
    }
  })
})
