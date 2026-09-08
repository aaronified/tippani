// THE EASY TIER'S SCAFFOLDING, ON THE CARD.
//
// The plan's sentence for that difficulty is "speaker and character chips visible
// beside the quote, with the face", and three things about it are invisible to
// every Go test in the repo and to a grep: whether the chips are drawn at all,
// whether a character's face reaches them, and whether a card that has no chips
// draws no empty row.
//
// THE LEAK IS THE SERVER'S TO PREVENT AND IT IS TESTED THERE — `easy_chips` and
// `easy_people` arrive filled only at Easy and only on directions the people do
// not answer (review_lures_test.go). This file is about the drawing, so it hands
// the component both shapes directly and asks what a reader would see.
//
// AND IT IS THE QUIZ CARD'S OWN CHIP, WHICH IS NOT A DOOR. people.jsx's
// SpeakerChips draws a button per credit — "all chips will be buttons, that's
// their function" — and it is the wrong row here twice over: review.jsx cannot
// import people.jsx (people.jsx imports usePractice from it, the cycle
// credits.jsx exists to keep open), and on a quiz card the answer buttons own
// the tap. So each case below asserts the chip is NOT pressable, because a chip
// that became a door mid-question would take the reader out of the round from
// the one place every tap is already spoken for.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

let SENT

const PEOPLE = [
  { id: 1, kind: 'speaker', name: 'Sojourner Truth', image_path: 'truth.jpg' },
  { id: 2, kind: 'author', name: 'Austen', image_path: 'austen.jpg' },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path, body) => {
    SENT.push({ method, path, body })
    if (path.startsWith('/people')) return { ok: true, data: { people: PEOPLE } }
    return { ok: true, data: { ok: true, stability: 7, status: 'remembered' } }
  },
}))

const { QuizRunner } = await import('../../src/review.jsx')

const card = (over = {}) => ({
  kind: 'screen', id: 1, direction: 'source', quote: 'the only way out is through',
  title: 'Casablanca', character: 'Rick Blaine', actor: 'Humphrey Bogart', color: 'yellow',
  options: ['Casablanca', 'Chinatown'], answer: 0, ...over,
})

beforeEach(() => { SENT = [] })

describe('an easy card', () => {
  it('names the character beside the quote, with their face', () => {
    render(<QuizRunner mode="daily" cards={[card({
      easy_chips: [{ name: 'Rick Blaine', path: 'rick.jpg', actor: 'Humphrey Bogart' }],
    })]} />)
    const label = screen.getByText('Rick Blaine')
    expect(label, 'the easy tier drew no chip for the character the line names').toBeTruthy()
    const chip = label.closest('span.inline-flex')
    // AND THE FACE. A row of names with no pictures is the state this tier is
    // meant to improve on, so the character's stored still has to reach the img.
    const img = chip.querySelector('img')
    expect(img, 'the chip drew no face, so "with the face" is not what shipped').toBeTruthy()
    expect(img.getAttribute('src')).toMatch(/rick\.jpg/)
    // NOT A DOOR — see the head of this file.
    expect(chip.closest('button'),
      'the scaffolding chip is pressable, so it competes with the answer buttons for the tap').toBeNull()
  })

  // A SHORT NAME, deliberately. The quiz card's chip ellipsises in CSS rather
  // than in JS, so the DOM carries the whole name either way — but the first
  // draft of this file used people.jsx's chip, which clips at 18 characters, and
  // "Subhas Chandra Bose" is 19: the case failed by not finding the element at
  // all. Kept short so a future change of chip cannot make this a test of the
  // truncation.
  it("and a standalone quote's speaker as a person, not a character", async () => {
    render(<QuizRunner mode="daily" cards={[card({
      kind: 'utterance', character: '', actor: '',
      title: 'the Akron convention', speaker: 'Sojourner Truth',
      easy_people: ['Sojourner Truth'],
    })]} />)
    // The portrait map is fetched, so the face arrives a tick after the name.
    await act(async () => {})
    const chip = screen.getByText('Sojourner Truth').closest('span.inline-flex')
    expect(chip).toBeTruthy()
    // THE PORTRAIT COMES FROM THE PEOPLE MAP for a person, where a character's
    // comes off the card: a character's picture belongs to one WORK, so the same
    // name in two films is two pictures and a name-keyed map could not hold both.
    expect(chip.querySelector('img')?.getAttribute('src') || '').toMatch(/truth\.jpg/)
    expect(chip.closest('button'),
      'the scaffolding chip is pressable, so it competes with the answer buttons for the tap').toBeNull()
  })
})

describe('a card at any other tier', () => {
  // A ROW THAT DRAWS NOTHING MUST DRAW NOTHING. An empty chip row is still a flex
  // child with a gap before it, which is the defect the favourites tile's own
  // comment records — a row of pills followed by a column of air.
  it('draws no chip row at all', () => {
    render(<QuizRunner mode="daily" cards={[card()]} />)
    expect(screen.queryByText('Rick Blaine'),
      'the character was named on a card the server sent no chips for').toBeNull()
    expect(screen.queryByText('Humphrey Bogart'),
      'the performer was named on a card the server sent no chips for').toBeNull()
  })
})
