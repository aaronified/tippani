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

// ---- and the same question from a chip that is NOT the stored speaker --------
//
// A LINE NAMES SEVERAL CHARACTERS AND STORES A LINK TO AT MOST ONE. The others
// are chips too, and the owner's ruling does not have a clause exempting them:
// pressing one asks the same three questions.
//
// WHY THIS PRESSES A REAL CHIP INSTEAD OF CALLING THE DOOR. Every case above
// hands `door()` an object typed out by hand, which asks whether the CHOOSER
// works and never whether anything gives it what it needs — and for the whole
// life of that fixture nothing did: `actor_id` was in it, and neither the wire
// nor `chipRows` ever put one there, so the performer's row drew disabled on
// every real press while five green cases said the door was built. So this
// renders the chips a card renders, presses one, and feeds the door exactly what
// the press hands it.
describe('pressing a chip for a character the line does not link to', () => {
  const IMAGES = [
    { name: 'Anand', path: '', cast_id: 11, character_id: 3, actor: 'Rajesh Khanna', actor_id: 9, actor_image: '' },
    { name: 'Dr. Bhaskar', path: '', cast_id: 12, character_id: 4, actor: 'Amitabh Bachchan', actor_id: 10, actor_image: '' },
  ]

  // What the chip actually hands the door when a reader presses it.
  const pressChip = async (which) => {
    let got = null
    render(<SpeakerChips images={IMAGES} speaker={null} onOpenCharacter={(sp) => { got = sp }} />)
    const chip = [...document.querySelectorAll('.person-chip')].find((c) => c.textContent.includes(which))
    expect(chip, `no chip for ${which}`).toBeTruthy()
    await act(async () => { fireEvent.click(chip) })
    expect(got, `pressing ${which}'s chip called nothing`).toBeTruthy()
    return got
  }

  it('offers that character and their performer, the same as the speaker', async () => {
    APPEARANCES = TWO_WORKS
    const sp = await pressChip('Dr. Bhaskar')
    cleanup()
    mount()
    await press(sp)
    expect(offered(), 'the performer of a character the line does not link to is unreachable from the card')
      .toContain('Amitabh Bachchan')
  })

  it('and the performer is a door, not a row that declines', async () => {
    APPEARANCES = TWO_WORKS
    const sp = await pressChip('Dr. Bhaskar')
    cleanup()
    mount()
    await press(sp)
    const row = [...document.querySelectorAll('.cs-choose')].find(
      (b) => b.querySelector('.cs-choose-label')?.textContent === 'Amitabh Bachchan',
    )
    expect(row, 'the performer is not offered at all').toBeTruthy()
    expect(row.getAttribute('aria-disabled'),
      'the performer is offered and cannot be opened — the card lost its way to them when the credit line went')
      .not.toBe('true')
  })
})

// ---- one pill, one behaviour, wherever it is drawn --------------------------
//
// THE OWNER MADE THIS A REPO DIRECTIVE: "the home favourite chips directly opens
// the character. the work page chips gives the option. both should behave
// similarly. in fact this should be a repo directive. similar things should act
// similarly." Home opened the character outright — a line written before the
// chooser existed and never swept — so one pill did two different things
// depending on which board it was drawn on, and neither screen was wrong on its
// own terms.
//
// WHAT THE BEHAVIOUR IS, is asserted above: press a chip, get the question, with
// the global gated on the count. What is left to check is that the OTHER board
// goes through that and does not keep a second copy of the verb — and that is a
// fact about the wiring, which is read from the source. A DOM test could only
// prove it by supplying the handler itself, which is the test writing the answer
// down and then reading it back.
//
// The shape is deliberately "does not build its own panel", not "imports the
// right name": a second copy called `openCharacterDoor` would pass an import
// check and fail this one.

describe('the same pill on two different boards', () => {
  const source = async (file) => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    return readFileSync(join(process.env.TIPPANI_SRC, file), 'utf8')
  }
  // The prop as each board hands it over, from `onOpenCharacter={` to the line
  // that closes it.
  const handler = (src) => {
    const at = src.indexOf('onOpenCharacter={(sp)')
    return at === -1 ? '' : src.slice(at, at + 700)
  }

  it('sends Home’s pill through the same door, rather than opening a panel itself', async () => {
    const h = handler(await source('Home.jsx'))
    expect(h, 'the favourites tile no longer hands a character handler down at all').toBeTruthy()
    expect(h, 'Home opens a panel from the pill itself — one control, two behaviours')
      .not.toMatch(/characterPanel\s*\(/)
    expect(h).toMatch(/openCharacterDoor\s*\(/)
  })

  it('and the work page too, for the same reason', async () => {
    const src = await source('WorkDetail.jsx')
    expect(src, 'the work page kept its own copy of the chooser').not.toMatch(/setSpeakerChoice/)
    expect(src).toMatch(/openCharacterDoor\s*\(/)
  })

  it('and the door itself is written once', async () => {
    const files = ['Home.jsx', 'WorkDetail.jsx', 'identity.jsx']
    const defs = []
    for (const f of files) {
      if (/function openCharacterDoor/.test(await source(f))) defs.push(f)
    }
    expect(defs, 'more than one file defines the door, which is the drift this directive is about')
      .toEqual(['identity.jsx'])
  })
})

// ---- and the question wears the same chrome as its answers ------------------

describe('the sheet that asks', () => {
  it('is a panel, like everything it can open', async () => {
    // "the picker is full screen but then the menu that is opened is a popup.
    // this is not escalation, but still feels weird." A modal question over a
    // panel answer is the two swapping weights, and on a phone the modal is a
    // full-screen sheet while the panel hugs the bottom.
    APPEARANCES = TWO_WORKS
    mount()
    await press()
    const row = document.querySelector('.cs-choose')
    expect(row, 'nothing was offered at all').toBeTruthy()
    expect(row.closest('.tp-panel'),
      'the question is drawn outside the panel stack its answers live on').toBeTruthy()
    // AND IT ADDS NO SURFACE OF ITS OWN, which is the half that discriminates: a
    // modal rendered INSIDE the panel still satisfies the line above, and is
    // exactly what this replaced — a dialog within a dialog, full-screen on a
    // phone, over answers that hug the bottom. One dialog on screen, not two.
    expect(document.querySelectorAll('[role="dialog"]').length,
      'the question draws a second dialog inside the panel — the surface this was meant to remove')
      .toBe(1)
  })

  it('and hands its rows a stored path, not a resolved one', async () => {
    // `Face` resolves with `coverImgURL`; a caller that resolved first produced
    // `/api/covers//api/covers/…` — a 404 drawn as the browser's broken-image
    // glyph on every row. "the picker (when a chip is pressed) doesn't show any
    // images."
    APPEARANCES = TWO_WORKS
    mount()
    await press({ ...SPEAKER, image: 'still.jpg', actor_image: 'face.jpg' })
    const srcs = [...document.querySelectorAll('.cs-choose-face img')].map((i) => i.getAttribute('src'))
    expect(srcs.length, 'no row drew a picture at all').toBeGreaterThan(0)
    for (const src of srcs) {
      expect(src.match(/covers/g)?.length || 0,
        `the picker resolved a path twice: ${src}`).toBeLessThan(2)
    }
  })
})
