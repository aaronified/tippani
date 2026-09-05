// A FACT APPEARS ONCE PER CARD.
//
// THE RULE, the owner's, made twice about two different cards:
//
//   "why is albert einstein repeated in the prose?" — a favourite tile printed
//   the speaker in the chip beside their portrait and again in the small-caps
//   line under it.
//
//   "there are still duplicates on the cards. the first card here doesnt have
//   the actor on the character but have it as subtitle like the old style!!!" —
//   a film line's chip carried the performer as its subtitle while the credit
//   line a few millimetres below named the same performer, with the door to
//   their page on it.
//
// AND THE SECOND HALF OF THAT REPORT IS ITS OWN DEFECT: the subtitle appeared
// only where the line's speaker resolved to a cast row, so two cards on one
// screen drew the same component two different ways — which reads as a
// rendering fault rather than as a difference in the data.
//
// WHERE THE CHIP IS THE ONLY PLACE THE PERFORMER APPEARS, it keeps them. A
// favourites tile prints no credit line, so the subtitle there is the fact's one
// printing rather than its second — which is why this is the caller's answer and
// not the component's.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SpeakerChips, chipRows } from '../../src/people.jsx'
import { utteranceMeta } from '../../src/Quotes.jsx'

const SPEAKER = {
  name: 'Dr. Bhaskar K. Banerjee',
  record_name: 'Dr. Bhaskar K. Banerjee',
  actor: 'Amitabh Bachchan',
  character_id: 7,
  cast_id: 3,
  image: '',
  actor_image: '',
}

afterEach(() => cleanup())

const namesOn = (root) => [...root.querySelectorAll('.person-chip-name, .person-chip-sub')]
  .map((e) => e.textContent.trim())

describe('a chip on a card that already names the performer', () => {
  it('does not name them a second time', () => {
    const { container } = render(<SpeakerChips speaker={SPEAKER} withActor={false} />)
    expect(namesOn(container).join(' | ')).not.toMatch(/Amitabh/)
  })

  it('and still names the character, which is what the chip is for', () => {
    const { container } = render(<SpeakerChips speaker={SPEAKER} withActor={false} />)
    expect(namesOn(container).join(' | ')).toMatch(/Bhaskar/)
  })

  it('so every chip on that card is the same shape, resolved speaker or not', () => {
    // THE HALF THAT WAS VISIBLE IN THE SCREENSHOT. One card's chip was stacked
    // and its neighbour's was not, because only one of the two lines had a
    // performer on it — one component, two pictures, on one screen.
    const withPerformer = render(<SpeakerChips speaker={SPEAKER} withActor={false} />).container
    const stackedA = !!withPerformer.querySelector('.person-chip.is-stacked')
    cleanup()
    const without = render(<SpeakerChips speaker={{ ...SPEAKER, actor: '' }} withActor={false} />).container
    const stackedB = !!without.querySelector('.person-chip.is-stacked')
    expect(stackedA, 'a line with a performer draws a taller chip than one without').toBe(stackedB)
  })
})

describe('a chip on a card that names the performer nowhere else', () => {
  it('carries them, because there is nothing else to carry them', () => {
    const { container } = render(<SpeakerChips speaker={SPEAKER} />)
    expect(namesOn(container).join(' | '), 'the performer is now named nowhere at all')
      .toMatch(/Amitabh/)
  })
})

describe('the row builder', () => {
  it('takes the answer from its caller rather than deciding for every screen', () => {
    // The component cannot know: only the card knows what else it prints.
    expect(chipRows([], SPEAKER, null, { withActor: false })[0].sub).toBe('')
    expect(chipRows([], SPEAKER, null, { withActor: true })[0].sub).toBe('Amitabh Bachchan')
    expect(chipRows([], SPEAKER, null)[0].sub,
      'a caller that says nothing loses the performer').toBe('Amitabh Bachchan')
  })
})

describe('the film frame', () => {
  it('keeps the performer IN the chip, and drops the line instead', async () => {
    // THE OWNER'S RULING, given twice and read backwards the first time: "the
    // actor is named below, not in the pill", then "still 2 lines everywhere
    // instead of the actor in the pill". The duplication was real and the half
    // that goes is the LINE. This case used to require the opposite, which is how
    // the wrong reading survived a green suite.
    //
    // The count itself is measured on a rendered card in
    // `dom/one-name-one-place.test.jsx`; what is read here is that the film frame
    // has not gone back to asking for a chip with no performer on it.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.env.TIPPANI_SRC, 'Movies.jsx'), 'utf8')
    const chip = src.match(/<SpeakerChips[\s\S]{0,1600}?\/>/)
    expect(chip, 'the film frame draws no chips at all').toBeTruthy()
    expect(chip[0], 'the film frame asks for a chip with no performer under the character')
      .not.toMatch(/withActor=\{false\}/)
  })
})

// ---- and the same rule on the quotes board -----------------------------------

const UTTERANCE = {
  id: 1,
  quote: 'I have no special talents. I am only passionately curious.',
  speaker: 'Albert Einstein',
  occasion: 'writing to Carl Seelig',
  occasion_date: '1952-03-11',
  kind: 'letter',
  language: '',
}

describe('a quote card', () => {
  it('does not print the speaker in the line under the chip that names them', () => {
    const meta = utteranceMeta(UTTERANCE, { people: {}, seps: null, onOpenPerson: () => {}, omitSpeaker: true })
    const { container } = render(<span>{meta}</span>)
    expect(container.textContent, 'the speaker is named twice on one card')
      .not.toMatch(/Albert Einstein/)
  })

  it('and draws no second portrait of them either', () => {
    const meta = utteranceMeta(UTTERANCE, { people: { 'Albert Einstein': { image_path: 'e.jpg' } }, seps: null, onOpenPerson: () => {}, omitSpeaker: true })
    const { container } = render(<span>{meta}</span>)
    expect(container.querySelector('img'), 'the same face is drawn twice on one card').toBeFalsy()
  })

  it('but keeps everything the chip does NOT say', () => {
    const meta = utteranceMeta(UTTERANCE, { people: {}, seps: null, onOpenPerson: () => {}, omitSpeaker: true })
    const { container } = render(<span>{meta}</span>)
    for (const part of [/Carl Seelig/, /1952/]) {
      expect(container.textContent, `the line lost ${part}, which no chip carries`).toMatch(part)
    }
  })

  it('and a quote with no speaker still opens with its mark, which is nobody’s duplicate', () => {
    // The mark stands where every other card begins with a face. Dropping the
    // speaker must not drop it: it is not a second printing of anything.
    const meta = utteranceMeta({ ...UTTERANCE, speaker: '', language: 'bn' }, { people: {}, seps: null, onOpenPerson: () => {}, omitSpeaker: true })
    const { container } = render(<span>{meta}</span>)
    expect(container.querySelector('svg, img, .language-mark') || container.textContent.trim(),
      'a quote with no speaker begins with nothing at all').toBeTruthy()
  })
})
