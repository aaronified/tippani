// A character's face on a BOOK'S quote card.
//
// The Catalogue's card has drawn one for as long as it has had one. A book's
// card printed the name and nothing else, in the mono locator line beside the
// chapter and the page — so the one part of that line that is about WHO SPOKE
// looked exactly like the part about which page it was on, and a character with
// a portrait saved had nothing to show for it.
//
// Nothing was missing underneath. A highlight has carried a character since
// migration 0047 and `character_images` has ridden the annotation payload since
// the cast pass (`internal/httpapi/annotation_handlers.go`); the card simply
// never read it. That is the shape of bug worth a test — no error, no gap, just
// a picture the app already had and did not draw.
//
// FALLING BACK TO NOTHING rather than to a silhouette, unlike a film's card,
// which falls back to the actor. A book's speaker has no actor to stand in for
// them, so an empty disc would be a picture of nobody.

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { AnnotationCard } from '../../src/Library.jsx'

const BASE = {
  id: 7,
  quote: 'A man may see how this world goes with no eyes.',
  note: '',
  chapter: 'IV',
  location: '12',
  color: 'yellow',
  tags: [],
  favorite: false,
}

const card = (over = {}) =>
  render(
    <AnnotationCard
      a={{ ...BASE, ...over }}
      variant={0}
      tagMap={{}}
      editing={false}
      setEditingId={() => {}}
      save={() => {}}
      patch={async () => {}}
      remove={() => {}}
      onCopy={() => {}}
      onShare={() => {}}
    />,
  )

// The face cluster draws one <img> per stored image, and a card with no cover has
// no other picture on it — so counting images is the whole assertion. `path`, not
// `image_path`: the server sends {name, path} pairs (cast_images.go), because a
// character's picture belongs to ONE WORK and a map keyed by name could not hold
// the same name in two films.
const faces = (c) => c.container.querySelectorAll('img').length

describe('a character with a portrait', () => {
  it('draws the face, not just the name', () => {
    const c = card({
      character: 'Gloucester',
      character_images: [{ name: 'Gloucester', path: 'c/gloucester.jpg' }],
    })
    expect(faces(c), 'no portrait was drawn for a character that has one').toBeGreaterThan(0)
  })

  it('still says the name, so the picture is an addition and not a replacement', () => {
    // A face alone is a quiz, not a credit — and at 24px it is a quiz with a
    // small picture. The name stays in the locator line where it always was.
    const c = card({
      character: 'Gloucester',
      character_images: [{ name: 'Gloucester', path: 'c/gloucester.jpg' }],
    })
    expect(c.container.textContent).toContain('Gloucester')
  })

  it('draws every character on a line spoken by more than one', () => {
    const c = card({
      character: 'Gloucester, Edgar',
      character_images: [
        { name: 'Gloucester', path: 'c/gloucester.jpg' },
        { name: 'Edgar', path: 'c/edgar.jpg' },
      ],
    })
    expect(faces(c)).toBe(2)
  })
})

describe('a character with no portrait', () => {
  it('draws no disc at all rather than a silhouette', () => {
    // The film side falls back to the ACTOR's face, because a role has one
    // behind it. A book's speaker does not, so the fallback here is nothing.
    const c = card({ character: 'Gloucester' })
    expect(faces(c)).toBe(0)
    expect(c.container.textContent).toContain('Gloucester')
  })

  it('tells "no picture" from "no character"', () => {
    // `character_images` is absent rather than empty when nothing is stored, and
    // an empty array must read the same way — a library with no character art
    // looks exactly as it did before.
    expect(faces(card({ character: 'Gloucester', character_images: [] }))).toBe(0)
    expect(faces(card({}))).toBe(0)
  })
})
