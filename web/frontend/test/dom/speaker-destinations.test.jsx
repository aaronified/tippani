// A SPEAKER CHIP CARRIES TWO PEOPLE AND UP TO THREE RECORDS, SO IT ASKS.
//
// THE OWNER'S RULING, in their words: "the pill should have character and actor
// both. clicking it should ask whether i want to open the work-character,
// global-character (only if the global character has more than 1 work), or the
// people." And the clause that decides the shape: "all work-character will also
// work as global character if their global character only contains them (single
// work). in that case, no need to show the global-character link anywhere."
//
// SO WHAT IS TESTED IS WHICH DOORS ARE OFFERED, for the states the library
// actually produces — a character in one work, the same character in several,
// and a credit nobody has linked to a person. Not the sheet's wording, and not
// its layout: those are the picker's, and it has its own cases.
//
// AND ONE LIVE ANSWER IS NOT A QUESTION. The pack's rule, which this shares with
// the work tile: "when there is only one thing behind the tile, it just opens
// it." A sheet offering a single answer is one the reader must dismiss to reach
// what they already asked for.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

let APPEARANCES
let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (method === 'GET' && path.startsWith('/characters/')) {
      return { ok: true, data: { id: 3, name: 'Anand', appearances: APPEARANCES } }
    }
    return { ok: true, data: {} }
  }),
}))

const WorkDetail = (await import('../../src/WorkDetail.jsx')).default

// The chip's own row, as `quote_speaker.go` serves it.
const SPEAKER = {
  cast_id: 11,
  character_id: 3,
  name: 'Anand',
  record_name: 'Anand',
  image: '',
  actor: 'Rajesh Khanna',
  actor_id: 9,
  actor_image: '',
}

const ONE_WORK = [{ cast_id: 11, kind: 'movie', work_id: 5, work_title: 'Anand' }]
const TWO_WORKS = [
  { cast_id: 11, kind: 'movie', work_id: 5, work_title: 'Anand' },
  { cast_id: 12, kind: 'book', work_id: 2, work_title: 'Anand, the novelisation' },
]

// The door under test is `openCharacter`, which WorkDetail hands to the board it
// renders. Reaching it through the whole film screen would need a work, a cast,
// a people map and four fetches; the board's render prop hands it over directly,
// which is the same function the chip presses.
let door
const mount = () => {
  door = null
  render(
    <WorkDetail
      side="movie"
      id={5}
      onClose={() => {}}
      renderBoard={({ openCharacter }) => { door = openCharacter; return null }}
    />,
  )
}

beforeEach(() => {
  CALLS = []
  APPEARANCES = ONE_WORK
})
afterEach(() => cleanup())

const press = async (sp = SPEAKER) => {
  await waitFor(() => expect(door, 'the board never got a character door').toBeTruthy())
  await act(async () => { await door(sp) })
}

const offered = () => [...document.querySelectorAll('.cs-choose')].map(
  (b) => b.querySelector('.cs-choose-label')?.textContent,
)

describe('pressing a speaker chip', () => {
  it('offers the character in this work and the performer, and asks between them', async () => {
    mount()
    await press()
    expect(offered(), 'the chip did not ask which of the two was meant').toEqual(['Anand', 'Rajesh Khanna'])
  })

  it('does not offer the identity when it holds only this work', async () => {
    // The two records are the same thing there, so a door to the "global" one
    // leads back to the screen you are standing on with a badge saying otherwise.
    mount()
    await press()
    expect(offered().filter((l) => l === 'Anand'), 'the same character is offered twice').toHaveLength(1)
  })

  it('offers it once the identity spans more than one work', async () => {
    APPEARANCES = TWO_WORKS
    mount()
    await press()
    expect(offered(), 'the identity across works was not offered').toHaveLength(3)
  })

  it('asks nothing when only one door is live', async () => {
    // A credit nobody has linked to a person, on a character with one work: the
    // work-character is the only answer, so it opens rather than asking.
    mount()
    await press({ ...SPEAKER, actor: '', actor_id: 0 })
    expect(document.querySelector('.cs-choose'), 'a sheet was opened to offer one answer').toBeNull()
    await waitFor(() => expect(document.querySelector('.tp-panel'), 'nothing opened at all').toBeTruthy())
  })

  it('still asks when the performer has no record, rather than hiding them', async () => {
    // The name is a fact worth showing even where it opens nothing — the row says
    // so itself. What it must not do is count as a live answer.
    APPEARANCES = TWO_WORKS
    mount()
    await press({ ...SPEAKER, actor_id: 0 })
    const dead = [...document.querySelectorAll('.cs-choose')].find(
      (b) => b.querySelector('.cs-choose-label')?.textContent === 'Rajesh Khanna',
    )
    expect(dead, 'the performer vanished from the list').toBeTruthy()
    expect(dead.getAttribute('aria-disabled'), 'a row that does nothing and says nothing').toBe('true')
  })
})
