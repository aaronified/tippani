// WHO SAID IT, ON THE QUOTE ITSELF.
//
// THE PACK, handoff 1.5: "quote.speakerId → a character of that work, rendered as
// a person chip that opens that character… 'Cowardice is the most terrible of
// vices' is Yeshua's, not Bulgakov's, and the difference between the author saying
// it and a character saying it is the whole meaning of the line."
//
// The storage had been right for three migrations and no handler serialised it, so
// what these cases hold is the whole chain: the payload's shape, which chips press
// and which do not, and what a chip hands back when pressed.
//
// THE THREE ABSENCES, AND WHAT BECAME OF THEM. This file was written when a line
// drew at most ONE chip and a chip was a DOOR, so three states drew none and the
// card fell back to its character text or to a row of faceless discs: no link, no
// `characters` record behind the link, no panel stack to open into. Two owner
// rulings have since made the chip a NAME that sometimes opens:
//
//   "if there are multiple speakers or characters in an annotation, then they
//   both shall have their own character/people chip" — so a line the linker
//   refused to guess at draws a chip PER NAMED CHARACTER, and not one of those
//   has a record behind it. A chip that opens nothing is now the ordinary case,
//   and the state that used to draw none would now hide every name on the row
//   but the linked one.
//
//   "same character pills should be there in the favourite section of the
//   homepage" — Home owns no panel stack, so the no-opener state draws them too.
//
// WHAT SURVIVES OF THE RULE IS THE PRESS: a chip with no record, or on a surface
// with nowhere to open, is drawn and is not a button — a span, so the keyboard
// walks past it. The one state that still draws nothing is a line naming nobody.
//
// `speaker-chips-row.test.jsx` holds the ROW; what this file holds is what the two
// CARDS do around it — the meta line that must stop repeating the name, the
// performer that must not be dropped with it, and the discs the chips replaced.
//
// AND ONE THING THAT IS NOT AN ABSENCE: the film card keeps its ACTOR beside the
// chip and drops only the character text. They are two different people — the role
// and the performer — which is the whole point of the cast table.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

const { AnnotationCard } = await import('../../src/Library.jsx')
const { Frame } = await import('../../src/Movies.jsx')

const SPEAKER = {
  cast_id: 11,
  character_id: 3,
  name: 'Woland',
  image: '',
}

let opened
beforeEach(() => {
  opened = []
})

const book = (over = {}, props = {}) =>
  render(
    <AnnotationCard
      a={{ id: 1, quote: 'Manuscripts don’t burn.', tags: [], character: 'Woland', speaker_cast: SPEAKER, ...over }}
      variant={0}
      // EXPLICIT, because `undefined` is not false here: FormModal's `open`
      // defaults to true, so a card handed `editing={undefined}` renders its edit
      // dialog — with the character in a token pill, which is a second copy of the
      // name this file counts.
      editing={false}
      tagMap={{}}
      setEditingId={() => {}}
      save={() => {}}
      patch={() => {}}
      remove={() => {}}
      onOpenCharacter={(sp) => opened.push(sp)}
      {...props}
    />,
  )

const film = (over = {}, props = {}) =>
  render(
    <Frame
      d={{ id: 1, quote: 'Let everything come true.', tags: [], character: 'the Stalker', actor: 'Aleksandr Kaydanovskiy', speaker_cast: { ...SPEAKER, name: 'the Stalker' }, ...over }}
      editing={false}
      tagMap={{}}
      onOpenCharacter={(sp) => opened.push(sp)}
      {...props}
    />,
  )

const chip = () => document.querySelector('.person-chip')

describe('a book quote’s speaker', () => {
  it('is a chip, and the meta line stops repeating the name', async () => {
    book()
    const c = chip()
    expect(c, 'no chip, so the line still only says who it is in text').toBeTruthy()
    expect(within(c).getByText('Woland')).toBeTruthy()
    // ONE MENTION, NOT TWO. Naming the same person in the chip and again in the
    // locator line is the reader reading one fact twice and wondering what the
    // difference between the two is — the SearchPage `omitSpeaker` precedent.
    expect(screen.getAllByText('Woland')).toHaveLength(1)
  })

  it('hands back the cast row, not just the record', async () => {
    book()
    fireEvent.click(chip())
    expect(opened).toHaveLength(1)
    // THE ROW IS WHAT OPENS THE RIGHT APPEARANCE. A work can bill one character
    // twice, and a panel told only the record and the work lifts whichever comes
    // first — the bug characterPanel's `castId` exists to stop.
    expect(opened[0].cast_id).toBe(11)
    expect(opened[0].character_id).toBe(3)
  })

  it('falls back to the text when the line has no link', async () => {
    book({ speaker_cast: undefined })
    expect(chip(), 'a chip with nothing behind it').toBeNull()
    // Not silence: the card said who it was before this feature existed and must
    // go on saying so.
    expect(screen.getByText(/Woland/)).toBeTruthy()
  })

  it('keeps the name and drops the press when the cast row has no record', async () => {
    book({ speaker_cast: { ...SPEAKER, character_id: 0 } })
    const c = chip()
    expect(c, 'the name went out with the door').toBeTruthy()
    expect(within(c).getByText('Woland')).toBeTruthy()
    expect(c.tagName, 'a chip that opens nothing is announced as a button').toBe('SPAN')
    fireEvent.click(c)
    expect(opened, 'pressed a chip with no page behind it').toHaveLength(0)
  })

  it('keeps the name and drops the press on a surface with nowhere to open it', async () => {
    // Home, Search and the standalone board render this card and own no panel
    // stack, so they pass no opener. The owner's ruling put these pills on Home's
    // favourites, so what is withheld there is the press and not the chip.
    book({}, { onOpenCharacter: undefined })
    const c = chip()
    expect(c, 'the favourites tile lost its pill').toBeTruthy()
    expect(within(c).getByText('Woland')).toBeTruthy()
    expect(c.tagName).toBe('SPAN')
  })
})

describe('a film line’s speaker', () => {
  it('is a chip, and the performer stays beside it', async () => {
    film()
    const c = chip()
    expect(c, 'no chip on a film line').toBeTruthy()
    expect(within(c).getByText('the Stalker')).toBeTruthy()
    // THE ACTOR IS NOT THE CHARACTER. The chip replaces the character TEXT and
    // nothing else; a line that stopped naming its performer would have lost the
    // fact the cast table exists to keep.
    expect(screen.getByText(/Aleksandr Kaydanovskiy/)).toBeTruthy()
    expect(screen.getAllByText(/the Stalker/)).toHaveLength(1)
  })

  it('hands back the cast row', async () => {
    film()
    fireEvent.click(chip())
    expect(opened).toHaveLength(1)
    expect(opened[0].cast_id).toBe(11)
  })

  it('falls back to the text when there is no link', async () => {
    film({ speaker_cast: undefined })
    expect(chip()).toBeNull()
    expect(screen.getByText(/the Stalker/)).toBeTruthy()
  })
})

describe('the face on the chip', () => {
  it('is hashed from the record’s name, not from what this work bills', async () => {
    // HANDOFF 1.8, and the reason it is a rule: "hash the canonical name, never
    // creditAs — otherwise a person changes face between two books." A novel
    // billing "the professor" and a film billing "Woland" are one record and must
    // wear one face, so the label takes the billing and the silhouette takes the
    // record.
    const { Silhouette } = await import('../../src/silhouette.jsx')
    // Two references drawn from the two candidate names, so the assertion is
    // "which of these did it pick" rather than a hash value copied into the test.
    const face = (name) => {
      const { container } = render(<Silhouette name={name} />)
      const svg = container.querySelector('svg.tp-silhouette').innerHTML
      cleanup()
      return svg
    }
    const asRecord = face('Woland')
    const asBilled = face('the professor')
    expect(asRecord, 'the two names hash alike, so this case proves nothing').not.toBe(asBilled)

    book({ speaker_cast: { ...SPEAKER, name: 'the professor', record_name: 'Woland' } })
    const c = chip()
    expect(within(c).getByText('the professor'), 'the chip prints the record name, not this work’s billing').toBeTruthy()
    const drawn = c.querySelector('svg.tp-silhouette').innerHTML
    expect(drawn, 'hashed the billing rather than the record').toBe(asRecord)
  })
})

// ---- one face on the row, not two ------------------------------------------
//
// THE OWNER'S REPORT: "the character chip + actor buttons plus their individual
// picture chips are messing around in the annotation cards… only character images
// should be there, actor images will be a fallback."
//
// Both cards had drawn a row of small face discs beside the line — the
// character's on a book, the character's-then-the-actor's on a film. Adding the
// chip put the same person on the card twice: once as a disc with no name, once
// as a pill with one. The discs survived that round as the only thing left
// speaking for an ensemble line; the multi-chip ruling took that job off them, so
// on the CHARACTER side they are gone. The film card keeps `CreditFaces` — the
// PEOPLE named in the line, a different row from the characters in it — and only
// where no chip is drawn at all.

describe('the face on a card', () => {
  // COUNTED AS IMAGES, because the disc row has no class of its own — it is a
  // FaceStack, an inline-flex span of <img>. A chip's own face is an <img> too
  // once the character has a picture, so the count excludes anything inside a
  // chip: without that the assertions below would pass on the chips themselves.
  const discFaces = () => [...document.querySelectorAll('img[src*="characters/"]')]
    .filter((i) => !i.closest('.person-chip'))

  it('is the chip alone when the line has one speaker', async () => {
    book({ character_images: [{ name: 'Woland', path: 'characters/w.jpg' }] })
    expect(document.querySelectorAll('.person-chip')).toHaveLength(1)
    expect(discFaces(), 'the disc row is still drawn behind the chip').toHaveLength(0)
  })

  it('is the chip alone on a film line too', async () => {
    film({ character_images: [{ name: 'the Stalker', path: 'characters/s.jpg' }] })
    expect(document.querySelectorAll('.person-chip')).toHaveLength(1)
    expect(discFaces(), 'the disc row is still drawn behind the chip').toHaveLength(0)
  })

  it('is a chip per named character on the line the chip could not speak for', async () => {
    // AN ENSEMBLE LINE, which is the case the discs existed for: the linker
    // refuses to guess between two names, so nothing is stored. A stack of discs
    // said how MANY people were in the line and not one of their names, which is
    // the one thing a reader wants from it.
    book({
      speaker_cast: undefined,
      character_images: [{ name: 'Rick', path: 'characters/r.jpg' }, { name: 'Ilsa', path: '' }],
    })
    expect([...document.querySelectorAll('.person-chip-name')].map((n) => n.textContent))
      .toEqual(['Rick', 'Ilsa'])
    expect(discFaces(), 'the discs are still drawn behind the chips').toHaveLength(0)
    // A CHARACTER WITH NO PICTURE IS STILL A CHIP — the discs dropped them, since
    // a disc with no picture is a picture of nobody, and a chip carries the name.
    expect(document.querySelectorAll('.person-chip')).toHaveLength(2)
  })

  it('wears the actor’s headshot when the character has no picture of their own', async () => {
    // THE FALLBACK, on the film side, and the ladder is the character's still →
    // the record's default → the performer. A book has no actor to fall back to
    // and lands on the hashed silhouette instead.
    film(
      { speaker_cast: { cast_id: 11, character_id: 3, name: 'the Stalker', image: '' }, actor: 'Aleksandr Kaydanovskiy' },
      { actorMap: { 'Aleksandr Kaydanovskiy': { name: 'Aleksandr Kaydanovskiy', image_path: 'people/ak.jpg' } } },
    )
    const img = document.querySelector('.person-chip img')
    expect(img, 'the chip drew no face at all').toBeTruthy()
    expect(img.getAttribute('src')).toContain('people/ak.jpg')
  })

  it('prefers the character’s own still over the actor’s headshot', async () => {
    film(
      { speaker_cast: { cast_id: 11, character_id: 3, name: 'the Stalker', image: 'characters/stalker.jpg' }, actor: 'Aleksandr Kaydanovskiy' },
      { actorMap: { 'Aleksandr Kaydanovskiy': { name: 'Aleksandr Kaydanovskiy', image_path: 'people/ak.jpg' } } },
    )
    const img = document.querySelector('.person-chip img')
    expect(img.getAttribute('src'), 'the performer won over the role').toContain('characters/stalker.jpg')
  })
})
