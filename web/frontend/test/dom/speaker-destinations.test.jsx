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

  // THE ROLE'S OWN STILL REACHES THE SHEET, which is the second half of "the
  // picker doesn't show any images".
  //
  // The first half was a resolver applied twice. This half is a field that never
  // left the card: the chip's own face climbs still-then-headshot, and the door
  // was handed the headshot alone — so a character photographed IN THE ROLE, with
  // no separate portrait of whoever played them, had a face on the card and a
  // silhouette on the sheet the card opened. Half the library is silhouettes by
  // design, so the sheet looked exactly like a sheet that is working.
  //
  // PRESSED, NOT HANDED. Every earlier case here fed the door an object typed in
  // this file, which is the "test writes the answer down and reads it back" hole
  // this suite's own header warns about — and it is why the field being absent
  // from the chip's payload went unnoticed while five cases passed. This one
  // renders a chip, clicks it, and takes whatever the component produced.
  const STILL = [{
    name: 'Anand', path: 'roles/anand-in-the-role.jpg', cast_id: 11, character_id: 3,
    actor: 'Rajesh Khanna', actor_id: 9, actor_image: '',
  }]

  it('carries the role\'s own still to the sheet, not only the performer\'s headshot', async () => {
    APPEARANCES = ONE_WORK
    let got = null
    render(<SpeakerChips images={STILL} speaker={null} onOpenCharacter={(sp) => { got = sp }} />)
    const chip = [...document.querySelectorAll('.person-chip')].find((c) => c.textContent.includes('Anand'))
    await act(async () => { fireEvent.click(chip) })
    cleanup()
    mount()
    await press(got)
    const row = [...document.querySelectorAll('.cs-choose')].find(
      (b) => b.querySelector('.cs-choose-label')?.textContent === 'Anand',
    )
    expect(row, 'the character was not offered at all').toBeTruthy()
    const img = row.querySelector('img')
    expect(img, 'the row drew a silhouette for a character the card had a picture of')
      .toBeTruthy()
    expect(img.getAttribute('src'), 'the sheet drew some other picture than the role\'s still')
      .toContain('roles/anand-in-the-role.jpg')
    // AND EXACTLY ONCE. `Face` resolves a stored path itself; a caller that
    // resolves it first produces `/api/covers//api/covers/…`, which is the other
    // half of the same report and drew the broken-image glyph on every row.
    expect((img.getAttribute('src').match(/\/api\/covers\//g) || []).length,
      'the path was resolved twice on its way to the sheet').toBe(1)
  })

  // AND THE PERFORMER'S FACE IS NOT LENT TO THE CHARACTER HERE.
  //
  // THE OWNER'S RULING: "a character does inherit the image of the actor, but
  // that is valid only for the chips on display. nowhere else. here bhaskar
  // bannerjee does not have his image, Amitabh bachchan has. so the picker should
  // respect that." On a chip the borrowed face is right and is argued at
  // `chipRows`; this list is the one place the character and the performer are
  // side by side, and there the loan makes two rows show one man — the question
  // drawing its own answer.
  const BORROWED = [{
    name: 'Dr. Bhaskar', path: '', cast_id: 12, character_id: 4,
    actor: 'Amitabh Bachchan', actor_id: 10, actor_image: 'people/bachchan.jpg',
  }]

  it('shows the character\'s own picture or none, never the performer\'s', async () => {
    APPEARANCES = ONE_WORK
    let got = null
    render(<SpeakerChips images={BORROWED} speaker={null} onOpenCharacter={(sp) => { got = sp }} />)
    const chip = [...document.querySelectorAll('.person-chip')].find((c) => c.textContent.includes('Dr. Bhaskar'))
    await act(async () => { fireEvent.click(chip) })
    cleanup()
    mount()
    await press(got)
    const row = (label) => [...document.querySelectorAll('.cs-choose')].find(
      (b) => b.querySelector('.cs-choose-label')?.textContent === label,
    )
    const character = row('Dr. Bhaskar')
    const performer = row('Amitabh Bachchan')
    expect(character, 'the character was not offered').toBeTruthy()
    expect(performer, 'the performer was not offered').toBeTruthy()
    expect(character.querySelector('img'),
      'the character borrowed the performer\'s face, so both rows draw one man')
      .toBeNull()
    expect(performer.querySelector('img')?.getAttribute('src'),
      'the performer lost their own face, which they DO have')
      .toContain('people/bachchan.jpg')
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

describe('the same pill on every board that draws it', () => {
  // EVERY BOARD, DERIVED — not two files named here. The first cut read a
  // 700-character window in `Home.jsx` and `WorkDetail.jsx`, which is a directive
  // written repo-wide and enforced on the two screens that already obeyed it.
  //
  // AND SCOPED TO THE PILL, which the second cut was not: widening it to every
  // `onOpenCharacter` flagged the cast EDITOR's row and the cast strip's tile,
  // and those are not the control the owner was talking about. A row in a work's
  // own cast list means "open this billing", has one destination by construction,
  // and pushes on purpose so Back returns to the list. A pill on a quote card
  // carries two people and up to three records, which is why it asks.
  //
  // So the rule is: A COMPONENT THAT DRAWS CHARACTER PILLS GETS THE SHARED DOOR.
  // Which components those are is read from the source — they are the ones that
  // render `SpeakerChips` — so a fourth card that starts drawing pills joins the
  // rule by drawing them, not by being added to a list here.
  const read = async () => {
    const { readSource, sourcesUnder } = await import('../src-files.js')
    return sourcesUnder((n) => /\.jsx?$/.test(n), 60).map((f) => [f, readSource(f)])
  }

  // From an index, the balanced run of braces starting at the first `{`.
  // A REGEX FOR A FUNCTION BODY IS A REGEX FOR THE WRONG THING: the first cut
  // stopped at the first `}` in column 0, which is a function's end only when
  // nothing inside it is written that way — and `FavouriteTile` is, so the one
  // card the owner reported was silently left out of its own guard.
  const balanced = (src, from) => {
    let i = src.indexOf('{', from)
    if (i === -1) return ''
    let depth = 0
    const at = i
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(at, i + 1) }
    }
    return src.slice(at)
  }

  // The components that draw a character pill: the ones whose own body renders
  // <SpeakerChips>. Derived, so a fourth card joins by drawing them.
  // PAST THE PARAMETERS FIRST. A destructured parameter list is itself a `{…}`,
  // so taking the first brace after `function Name(` balances the props object
  // and reads none of the body — which returned an empty set and made the cases
  // below pass on nothing.
  const afterParams = (src, from) => {
    let depth = 0
    for (let i = from; i < src.length; i++) {
      if (src[i] === '(') depth++
      else if (src[i] === ')') { depth--; if (depth < 0) return i + 1 }
    }
    return from
  }

  const pillDrawers = async () => {
    const names = new Set()
    for (const [, src] of await read()) {
      for (const m of src.matchAll(/(?:export\s+)?function ([A-Z][A-Za-z0-9]*)\s*\(/g)) {
        const body = balanced(src, afterParams(src, m.index + m[0].length))
        if (/<SpeakerChips/.test(body)) names.add(m[1])
      }
    }
    return names
  }

  // Every place one of those cards is handed its handler, with the whole
  // expression — and, where that expression is a NAME, what the name resolves to
  // in the same file. A handler threaded down from `WorkDetail`'s render prop
  // resolves to nothing here, and is covered by that screen's own case below.
  const pillHandlers = async () => {
    const drawers = await pillDrawers()
    const out = []
    for (const [file, src] of await read()) {
      for (const m of src.matchAll(/onOpenCharacter=\{/g)) {
        const before = src.slice(0, m.index)
        const open = [...before.matchAll(/<([A-Z][A-Za-z0-9]*)/g)]
        const owner = open.length ? open[open.length - 1][1] : ''
        if (!drawers.has(owner)) continue
        const body = balanced(src, m.index + 'onOpenCharacter='.length - 1)
        const bare = body.replace(/[{}\s]/g, '')
        const local = /^[a-zA-Z_$][\w$]*$/.test(bare)
          ? (src.match(new RegExp(`const ${bare}\\s*=`)) ? balanced(src, src.indexOf(`const ${bare} =`)) : null)
          : null
        out.push({ file, owner, body, decides: /=>/.test(body) || !!local, expr: local || body })
      }
    }
    return out
  }

  it('knows which components draw a pill, and finds handlers on them', async () => {
    const drawers = await pillDrawers()
    expect([...drawers].length, 'no component draws character pills — the derivation has drifted')
      .toBeGreaterThan(1)
    const all = await pillHandlers()
    expect(all.length, `no pill-drawing card is handed a character handler (drawers: ${[...drawers].join(', ')})`)
      .toBeGreaterThan(1)
  })

  it('and not one of those handlers opens a record itself', async () => {
    for (const h of await pillHandlers()) {
      // A handler that merely passes the prop along is not a behaviour; only one
      // that DECIDES is.
      if (!h.decides) continue
      expect(h.expr, `${h.file} opens a panel from <${h.owner}>'s pill itself — one control, two behaviours`)
        .not.toMatch(/characterPanel\s*\(|personPanel\s*\(/)
    }
  })

  it('and every one that decides goes through the door', async () => {
    const deciders = (await pillHandlers()).filter((h) => h.decides)
    expect(deciders.length, 'no board decides what the pill does, so nothing is being checked')
      .toBeGreaterThan(0)
    for (const h of deciders) {
      expect(h.expr, `${h.file} decides what <${h.owner}>'s pill does without going through openCharacterDoor`)
        .toMatch(/openCharacterDoor\s*\(/)
    }
  })

  it('and the door is defined in exactly one file', async () => {
    const defs = (await read())
      .filter(([, src]) => /function openCharacterDoor/.test(src))
      .map(([f]) => f)
    expect(defs, 'more than one file defines the door, which is the drift this directive is about')
      .toEqual(['identity.jsx'])
  })

  it('and the handler the work screen threads down to its boards goes through it too', async () => {
    // THE ONE THE DERIVATION ABOVE CANNOT SEE. `WorkDetail` hands `openCharacter`
    // to a render prop, and the board passes it to the card — so the card's own
    // handler is a bare name and the DECIDING expression is two files away. It is
    // named here because it is the last link in that chain, and because a
    // regression there would reach both a book's board and a film's at once.
    const [, src] = (await read()).find(([f]) => f === 'WorkDetail.jsx')
    const decl = src.indexOf('const openCharacter =')
    expect(decl, 'the work screen no longer names a character handler').toBeGreaterThan(-1)
    const expr = src.slice(decl, src.indexOf('\n\n', decl))
    expect(expr, 'the work screen opens a record from the pill itself')
      .not.toMatch(/characterPanel\s*\(|personPanel\s*\(/)
    expect(expr, 'the work screen decides what the pill does without going through the door')
      .toMatch(/openCharacterDoor\s*\(/)
  })

  it('and the work page kept no chooser of its own', async () => {
    const [, src] = (await read()).find(([f]) => f === 'WorkDetail.jsx')
    expect(src, 'the work page still holds its own copy of the question').not.toMatch(/setSpeakerChoice/)
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

  it('and on the performer when the performer is chosen', async () => {
    await answer('Rajesh Khanna')
    expect(document.querySelectorAll('.tp-panel').length, 'pressing an answer closed everything').toBe(1)
    expect(onScreen()).toContain('Rajesh Khanna')
  })

  it('and the question is gone, not buried under the answer', async () => {
    // `open()` replaces rather than deepens, so the reader who came from a card
    // gets back to the card in one press — not to a question they have already
    // answered.
    await answer('Anand')
    expect(document.querySelector('.cs-choose'),
      'the question is still on the stack under its own answer').toBeNull()
  })

  it('and does not ask the browser to go back on the way', async () => {
    // THE ONE ASSERTION THAT DISCRIMINATES HERE. A row's own `open()` has already
    // replaced the question with the answer, so there is nothing left to dismiss
    // — and dismissing anyway pops the entry UNDER the answer and truncates the
    // stack to nothing. In a browser that closes everything; in jsdom the pop
    // never arrives and every other case in this describe passes either way.
    const spy = vi.spyOn(window.history, 'back')
    try {
      await answer('Anand')
      expect(spy.mock.calls.length,
        'answering walks history back — one entry past the answer it just opened')
        .toBe(0)
    } finally {
      spy.mockRestore()
    }
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

  it('draws the answers it already has while the count is still outstanding', async () => {
    COUNT = 'hang'
    mount()
    await pressLoose()
    // The character's own row and the performer's need nothing asked, and the
    // count can only ever ADD to them.
    expect(offered(), 'the press drew nothing while the count was in flight')
      .toEqual(['Anand', 'Rajesh Khanna'])
  })

  it('and still asks, rather than dying, when the count never answers', async () => {
    COUNT = 'hang'
    mount()
    await pressLoose()
    expect(document.querySelector('.cs-choose'), 'no chooser at all on a hung socket').toBeTruthy()
  })

  it('and leaves the identity out when the count comes back unreachable', async () => {
    // The shape a timeout arrives in. The door had already chosen this
    // degradation for a failed request; a timeout is now the same branch.
    COUNT = 'down'
    APPEARANCES = TWO_WORKS
    mount()
    await press()
    expect(offered(), 'an unreachable count invented an identity row')
      .toEqual(['Anand', 'Rajesh Khanna'])
  })

  // THE ROW ARRIVES LATE AND STILL LANDS IN THE MIDDLE, which is the failure a
  // naive fix produces: the panel is already drawn, so the obvious thing is to
  // append — and the owner's order is "the work-character, global-character ...
  // or the people".
  it('and the identity drops into its own place, not onto the end', async () => {
    APPEARANCES = TWO_WORKS
    mount()
    // `record_name` distinct from `name` so the three rows can be told apart:
    // the local row and the identity row are both called "Anand" otherwise.
    await press({ ...SPEAKER, record_name: 'Anand, across both' })
    expect(offered(), 'the row that arrived second was appended rather than spliced')
      .toEqual(['Anand', 'Anand, across both', 'Rajesh Khanna'])
  })

  // AND THE ONE PATH THAT STILL WAITS, said out loud so a later reader does not
  // "fix" it: with no live performer the count decides between OPENING the
  // character and ASKING between two, and those are different presses. It is
  // bounded instead — see the door's note on timeoutMs.
  it('but waits where the count decides whether to ask at all', async () => {
    APPEARANCES = TWO_WORKS
    mount()
    await press({ ...SPEAKER, actor: '', actor_id: 0, record_name: 'Anand, across both' })
    expect(offered(), 'the identity was not offered, so the count was not waited for')
      .toEqual(['Anand', 'Anand, across both'])
  })
})
