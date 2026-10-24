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
// WHAT SURVIVES OF THE RULE IS SMALLER STILL, after a third ruling: "all chips
// will be buttons as well! that's their function." A chip with no record, or on a
// surface with nowhere to open, is drawn AND is a button — it simply carries
// aria-disabled, because the answer to a control with no destination is to give
// it one rather than to demote it to a span. The one state that draws nothing at
// all is a line naming nobody.
//
// `speaker-chips-row.test.jsx` holds the ROW; what this file holds is what the two
// CARDS do around it — the meta line that must stop repeating the name, the
// performer that must not be dropped with it, and the discs the chips replaced.
//
// AND ONE THING THAT IS NOT AN ABSENCE: the film card keeps its ACTOR beside the
// chip and drops only the character text. They are two different people — the role
// and the performer — which is the whole point of the cast table.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

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
      d={{ id: 1, quote: 'Let everything come true.', tags: [], character: 'the Stalker', actor: 'Aleksandr Kaydanovskiy', speaker_cast: { ...SPEAKER, name: 'the Stalker', actor: 'Aleksandr Kaydanovskiy' }, ...over }}
      editing={false}
      tagMap={{}}
      onOpenCharacter={(sp) => opened.push(sp)}
      {...props}
    />,
  )

const chip = () => document.querySelector('.person-chip')

describe('a film line’s speaker', () => {
  it('is a chip, and the performer stays beside it', async () => {
    film()
    const c = chip()
    expect(c, 'no chip on a film line').toBeTruthy()
    expect(within(c).getByText('the Stalker')).toBeTruthy()
    // THE ACTOR IS NOT THE CHARACTER, and both are on the chip — the character as
    // its name, the performer under it. A line that stopped naming its performer
    // would have lost the fact the cast table exists to keep; a line that names
    // them twice is what the owner reported. Once, in the pill.
    // ON THE CHIP'S OWN SUB-LINE, read off the element rather than by text:
    // `clip` shortens a long name there — the app's one deliberate truncation,
    // ruled on by the owner — so a match against the full string would fail for a
    // reason that has nothing to do with where the name is.
    const sub = c.querySelector('.person-chip-sub')
    expect(sub, 'the chip carries no performer under the character').toBeTruthy()
    expect('Aleksandr Kaydanovskiy'.startsWith(sub.textContent.replace(/…$/, '')),
      `the chip's sub-line is ${sub.textContent}, not the performer`).toBe(true)
    expect(screen.getAllByText(/the Stalker/)).toHaveLength(1)
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

})
