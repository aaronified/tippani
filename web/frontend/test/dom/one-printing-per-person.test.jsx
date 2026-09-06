// A PERSON IS PRINTED ONCE PER CARD, AND THE PRINTING IS THE CHIP.
//
// THE REPORTS, the owner's, two of them in one message: "expanded favourite card
// is still duplicating actor. the collapsed card is fine." and "as for cards in
// work pages, single character cards are fine. multi-character ones still has a
// separate actor line."
//
// THE SPECIFICATION, which is one rule the two cards were breaking in two ways.
// A character chip says "this character, played by that person" — the name, and
// the performer under it. A fact a chip carries does not get a second printing
// elsewhere on the same card, because the second printing is what pushes the
// first out of its row and teaches the reader that the card repeats itself.
// `favourite-occasion.test.jsx` pinned the same rule for a standalone quote's
// speaker; these are the two surfaces it had not reached.
//
//   THE FILM FRAME held the pairing for the STORED SPEAKER only, so a line with
//   two characters drew two bare chips and fell back to a PLAYED BY line naming
//   both performers. One character was fine and two were not, which is exactly
//   how it was reported.
//
//   THE FAVOURITES TILE, opened, drew the chip AND a portrait credit for the same
//   performer a few millimetres below. Collapsed there is no credit row, which is
//   why the collapsed card was fine.
//
// AND THE OTHER HALF, which a careless fix breaks: a line can credit somebody the
// chips do NOT name — the names are typed like genres and only the work's cast
// rows fold — and that person still needs their printing. So the rule is per
// name, not per card: what the chips cover goes, what they do not stays.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above; that a served line
// carries `character_images`, one entry per character named on it, each with
// whoever the work's cast has playing them; and that both cards are built from a
// stored row rather than from a finished shape, so the step that decides what to
// drop is inside the test rather than in front of it.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FavouriteTile, screenFav } from '../../src/Home.jsx'
import { Frame } from '../../src/Movies.jsx'
import { DEFAULT_CREDIT_SEPS } from '../../src/credits.jsx'

// THE SEPARATORS THE APP ACTUALLY PASSES. `{}` is not "the defaults" — every
// flag reads false, so `splitCredits` returns the joined string as ONE name and
// a two-hander looks like one performer called "Albert Finney, Audrey Hepburn".
// A fixture no screen supplies proves nothing about the screens.
const SEPS = DEFAULT_CREDIT_SEPS

afterEach(() => cleanup())

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
// inputs, and a form field is not a printing.
const card = () => document.querySelector('.tp-hand-card, article') || document.body

// How many times a name is PRINTED: leaf elements only, so a name is not counted
// once for itself and again for every wrapper around it.
const printings = (name) =>
  [...card().querySelectorAll('*')]
    .filter((el) => el.children.length === 0 && el.textContent.includes(name))

const chipFor = (character) =>
  [...card().querySelectorAll('.person-chip, .tp-person-chip, .speaker-chips > *')]
    .find((el) => el.textContent.includes(character))

describe('a film card that names two characters', () => {
  it('says who plays each of them on that character’s own chip', () => {
    frame()
    for (const [character, performer] of [['Mark Wallace', 'Albert Finney'], ['Joanna Wallace', 'Audrey Hepburn']]) {
      const chip = chipFor(character)
      expect(chip, `${character} has no chip at all`).toBeTruthy()
      expect(chip.textContent,
        `the chip for ${character} does not name ${performer}, so the card must print the performers on a line of their own`)
        .toContain(performer)
    }
  })

  it('and prints neither performer a second time underneath', () => {
    frame()
    for (const performer of ['Albert Finney', 'Audrey Hepburn']) {
      const hits = printings(performer)
      expect(hits.length,
        `${performer} is printed ${hits.length} times: ` + hits.map((h) => h.textContent.trim()).join(' | '))
        .toBe(1)
    }
  })

  it('but keeps a credit the chips do not carry', () => {
    // The line credits a third performer no cast row folded to — a dub, a
    // second-unit voice, a name typed with a different spelling. Dropping the
    // whole line because two of the three were covered loses them outright.
    frame({ actor: 'Albert Finney, Audrey Hepburn, William Daniels' })
    expect(card().textContent,
      'a performer no chip names vanished with the line that was carrying them')
      .toContain('William Daniels')
    expect(printings('Albert Finney').length,
      'the covered performer came back with the line').toBe(1)
  })
})

describe('an opened favourite tile', () => {
  it('prints the performer once, on the chip, not again in the credit row', () => {
    tile()
    const hits = printings('Albert Finney')
    expect(hits.length,
      `the performer is printed ${hits.length} times: ` + hits.map((h) => h.textContent.trim()).join(' | '))
      .toBe(1)
  })

  it('and the printing that survives is the one with the character on it', () => {
    tile()
    const chip = chipFor('Mark Wallace')
    expect(chip, 'the character chip is gone from the opened tile').toBeTruthy()
    expect(chip.textContent,
      'the surviving printing is the bare credit, not the chip that pairs the two')
      .toContain('Albert Finney')
  })

  it('and still prints a credit no chip carries', () => {
    tile({ actor: 'Albert Finney, William Daniels' })
    expect(card().textContent,
      'a performer no chip names was dropped along with the ones that were covered')
      .toContain('William Daniels')
  })

  it('does not repeat the film’s title under a header already naming it', () => {
    tile()
    const hits = printings('Two for the Road')
    expect(hits.length,
      `the title is printed ${hits.length} times: ` + hits.map((h) => h.textContent.trim()).join(' | '))
      .toBe(1)
  })
})
