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

