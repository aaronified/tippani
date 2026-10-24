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
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let APPEARANCES
let CALLS
// WHAT THE COUNT REQUEST DOES, for the cases about what the door draws BEFORE it
// answers. `hang` is the one that matters: a socket accepted and never answered,
// which is the state `fetch` has no timeout for and which used to eat the press
// whole. `down` is the shape a real timeout arrives in — `send` catches the abort
// and resolves `{ok:false, status:0}` rather than rejecting, so a case that threw
// here would be testing something this api cannot produce.
let COUNT

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (method === 'GET' && path.startsWith('/characters/')) {
      if (COUNT === 'hang') return new Promise(() => {})
      if (COUNT === 'down') return { ok: false, status: 0, data: null }
      return { ok: true, data: { id: 3, name: 'Anand', appearances: APPEARANCES } }
    }
    return { ok: true, data: {} }
  }),
}))

const WorkDetail = (await import('../../src/WorkDetail.jsx')).default
const { SpeakerChips } = await import('../../src/people.jsx')

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
  COUNT = 'ok'
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

  it('offers it once the identity spans more than one work', async () => {
    APPEARANCES = TWO_WORKS
    mount()
    await press()
    expect(offered(), 'the identity across works was not offered').toHaveLength(3)
  })

})

// ---- and answering it lands on the answer -----------------------------------
//
// THE HALF THAT WAS MISSING, and it cost a working door. Every case above
// presses the CHIP and reads the question; none pressed a ROW. So when the
// chooser became a panel, `onDone` went on calling `stack.back()` — right for a
// modal, which is a layer over the screen — and on a panel that is one entry too
// far: the row's own `open()` had already REPLACED the question with the answer,
// so `back()` popped the entry underneath and the popstate guard truncated the
// stack to nothing. Pressing an answer closed everything, the suite stayed green,
// and the changelog said "going back works the way it looks like it should".
//
// THE PROPERTY: after pressing a row, the thing it names is ON SCREEN. Not "a
// panel exists" — the first draft of this file's sibling made that mistake and
// `PanelHost` renders only the top, so the count is 1 whatever the stack holds.
// The panel's TITLE is what says which record you landed on.
//
// AND jsdom CANNOT SEE THE CLOSING, which is why the last case here is shaped
// the way it is. `history.back()` in jsdom delivers no popstate, so the stack is
// never truncated and the four cases above pass against the broken version as
// well as the fixed one — the third time this repo has been caught by that hole
// (`panel-open-replaces.test.jsx` carries the first two). What jsdom CAN see is
// the CALL: answering a question that has already been replaced must not ask the
// browser to go back at all. The rectangles are `run-panel-depth.sh`'s, which
// presses an answer in a real browser and fails when nothing is left on screen.

describe('answering the question', () => {
  const answer = async (label) => {
    APPEARANCES = TWO_WORKS
    mount()
    await press()
    const row = [...document.querySelectorAll('.cs-choose')].find(
      (b) => b.querySelector('.cs-choose-label')?.textContent === label,
    )
    expect(row, `no row offered for ${label}`).toBeTruthy()
    await act(async () => { fireEvent.click(row) })
    await new Promise((r) => setTimeout(r, 0))
  }

  const onScreen = () => (document.querySelector('.tp-panel-title, .tp-panel-names')?.textContent || '')

  it('lands on the character when the character is chosen', async () => {
    await answer('Anand')
    expect(document.querySelectorAll('.tp-panel').length,
      'pressing an answer closed everything — the question dismissed a surface that had already been replaced')
      .toBe(1)
    expect(onScreen(), 'a panel is open and it is not the one that was asked for').toContain('Anand')
  })

})

// ---- THE PRESS DOES NOT WAIT ON THE COUNT ----------------------------------
//
// The owner called opening a character "a chore". The count — how many works the
// identity spans — decided whether a third row appeared, and the door awaited it
// before drawing ANY row. So the wait was paid by a panel that had two answers
// ready, and on a socket that is accepted and never answered it was paid for
// ever: the press drew nothing at all, with nothing on screen saying it landed.
//
// WHY THESE FIVE AND NOT THE TWENTY-ONE ABOVE. Every case before this one passes
// against the blocking version too — they await the door and then look, so a door
// that finished its request first is indistinguishable from one that did not.
// These look at the panel WHILE the request is still outstanding, which is the
// only way to tell the two apart.
describe('the count no longer gates the first paint', () => {
  // PRESSED WITHOUT AWAITING THE DOOR'S OWN PROMISE, and only in this describe.
  //
  // These two cases exist for the state where that promise may never settle, and
  // `await act(async () => { await door(sp) })` on a promise that never settles
  // leaves the act scope open — which fails the case by timeout twenty seconds
  // later AND poisons every case after it in the file. Measured, not feared: a
  // mutation that put the blocking await back produced FIVE failures at 8s each
  // from one defect, and three of those five pass in isolation.
  //
  // Not awaiting is sound rather than a dodge: the door reaches `stack.open` with
  // no `await` before it on this path, so the panel is up by the time the call
  // returns. A regression therefore fails on the assertion below — nothing was
  // drawn — which is the sentence a reader wants, immediately.
  const pressLoose = async (sp = SPEAKER) => {
    await waitFor(() => expect(door, 'the board never got a character door').toBeTruthy())
    await act(async () => { door(sp) })
  }

  it('and still asks, rather than dying, when the count never answers', async () => {
    COUNT = 'hang'
    mount()
    await pressLoose()
    expect(document.querySelector('.cs-choose'), 'no chooser at all on a hung socket').toBeTruthy()
  })

})
