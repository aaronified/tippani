// The serendipity card shows the quote AND where it came from.
//
// THE BUG, as reported: "shuffled quotes are devoid of even chips and character
// names." The card was the quote, a colour bar, and a title-and-credit line in
// small caps — on the one surface in the app whose whole job is to make you glad
// you kept something. Every other quote surface draws a cover, the credited
// people as faces you can click through to, the tags, and the copy/share row.
// This one drew none of it, and nothing failed: the card rendered, the words were
// right, and it was simply the plainest thing on the screen.
//
// Two of those omissions were wrong rather than merely thin. The card printed
// `credit`, which for a film line is the ACTOR — so a line from Casablanca was
// captioned Humphrey Bogart and never Rick Blaine, which is the name a reader is
// looking for. And the row it sat in had no cover at all, so a library of posters
// showed none of them here.
//
// Scraped from source rather than rendered because the component is not exported,
// and because the regression this guards against is a simplification: somebody
// tidying the card back down to a paragraph and a caption. What each piece looks
// like is the visual system's business; THAT each piece is asked for is this file's.
// The server's half — that the row actually carries a cover, a character, a year,
// the tags and the heart — is pinned in serendipity_test.go, because a card asking
// for a field the API does not send fails silently in exactly the same way.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const home = readFileSync(join(SRC, 'Home.jsx'), 'utf8')

// The component, sliced out, so a match anywhere else in Home — and the
// favourites board next door draws all of these — cannot make this pass.
const card = (() => {
  const start = home.indexOf('function SerendipityCard(')
  expect(start, 'SerendipityCard has been renamed — this test is measuring nothing').toBeGreaterThan(-1)
  const end = home.indexOf('\nfunction ', start + 1)
  return home.slice(start, end === -1 ? undefined : end)
})()

describe('the serendipity card', () => {
  it('draws the cover or poster of where the line came from', () => {
    expect(card, 'no cover: a library of posters shows none of them here').toContain('coverImgURL')
    // And says so when there is none, rather than leaving a gap the width of one.
    expect(card, 'no placeholder for a work with no art').toContain('Placeholder')
  })

  it('names the CHARACTER, not only the actor who played them', () => {
    // The specific thing that was missing. `credit` alone is the actor.
    expect(card, 'q.character is never read — a film line is captioned with the wrong person').toContain('q.character')
  })

  // THIS ASSERTION USED TO REQUIRE BOTH, and requiring both was the bug. It read
  // `toContain('CreditFaces')` as well as PersonCredit, on the reasoning that the
  // card should show faces AND openable chips — but PersonCredit IS a portrait
  // beside the name, so the card drew every credited person twice: once in an
  // anonymous overlapping cluster on the source line, and again underneath with
  // their name. Roman Holiday showed four faces for two actors.
  //
  // The overlapping cluster is right where there is no room for names — the
  // collapsed favourite tile uses it, which is why Home still imports it — and
  // wrong here, where the names are the point. So this now pins one face each.
  it('draws each credited person once, as a face with their name', () => {
    expect(card, 'faces with no way into the person behind them').toContain('PersonCredit')
    expect(
      card,
      'CreditYFaces is back on this card: PersonCredit already draws the portrait, so a cluster here means every actor is drawn twice'.replace('CreditYFaces', 'CreditFaces'),
    ).not.toContain('CreditFaces')
    // Split on the READER'S separators, so co-authors are two people and not one
    // chip named after both of them.
    expect(card).toContain('splitCredits')
  })

  it('draws the tags', () => {
    expect(card).toMatch(/q\.tags/)
  })

  it('offers the same quote row every other surface offers', () => {
    // From the registry, so this card cannot end up with the actions in a
    // different order from the Library's.
    expect(card, 'the row is spelled out by hand instead of built from the registry').toContain('actionsFor')
    expect(card).toContain('QuoteTools')
    expect(card).toContain('QuoteActions')
    expect(card).toContain('atRow')
    expect(card).toContain('atOverflow')
  })

  it('keeps the heart honest by rolling it back when the write fails', () => {
    // patchFav returns false on failure and the card paints optimistically, so
    // without the rollback a failed write leaves a filled heart on an unhearted
    // quote — the one state a reader cannot tell is wrong.
    expect(card).toMatch(/=== false/)
  })

  it('does not pretend to be a doorway when there is nowhere to go', () => {
    // A standalone quote with the Quotes screen switched off has no destination.
    // The rule the row already follows: an absent control is honest, a dead one
    // is not — so the cover and the words are only buttons when onOpen exists.
    expect(card).toMatch(/onOpen \?/)
  })
})

describe('the row that holds it', () => {
  const row = (() => {
    const start = home.indexOf('function SerendipityRow(')
    const end = home.indexOf('\nfunction ', start + 1)
    return home.slice(start, end === -1 ? undefined : end)
  })()

  it('gives every card the people, the separators and the actions', () => {
    // On this day draws the same card as Shuffle. It used to be possible to enrich
    // one and leave the other plain, which is how a fix ships half-done.
    const cards = [...row.matchAll(/<SerendipityCard\b[^>]*\/>/g)].map((m) => m[0])
    expect(cards.length, 'expected the shuffled card in both layouts and the on-this-day card').toBe(3)
    for (const c of cards) {
      expect(c, `a SerendipityCard with no people: ${c}`).toContain('people={people}')
      expect(c, `a SerendipityCard with no actions: ${c}`).toContain('actions={actions}')
      expect(c, `a SerendipityCard with no separators: ${c}`).toContain('seps={seps}')
    }
  })
})
