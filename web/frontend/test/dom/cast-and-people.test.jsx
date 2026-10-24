import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SpeakerChips } from '../../src/people.jsx'
import { FavouriteTile, quoteFav } from '../../src/Home.jsx'
import { CharacterLocal } from '../../src/identityLocal.jsx'
import { identityScope } from '../../src/identityScope.js'
import { t } from '../../src/i18n.js'
import { applyLanguageMarks } from '../../src/languages.jsx'
import { LANGUAGES, glyphsFor } from '../../src/iso639.js'
import { Face, PortraitBlock } from '../../src/characterRows.jsx'
import { PersonPortrait } from '../../src/credits.jsx'
import { WorkHero } from '../../src/works.jsx'

// The character box's dropdown.
//
// WHY IT IS NOT A <datalist> ANY MORE. It was, and the argument was that the
// browser's own list is strictly better in this one role. What the browser
// actually DOES with a datalist turns out to be a per-browser matter: desktop
// Chrome opens it only after a keystroke, so a reader who had typed nothing saw
// nothing and had no way to learn the list existed. For a memory aid that is the
// whole of its value, and the owner reported it as the box not having a dropdown.
//
// So the assertions here are about what a reader can SEE without knowing the
// control: it opens on focus, it names the actor beside the part, and it never
// refuses a name the cast has never heard of.
describe('cast combo', async () => {
const { CastCombo } = await import('../../src/suggest.jsx')

const CAST = [
  { character: 'Amanda Waller', actor: 'Viola Davis' },
  { character: 'Harley Quinn', actor: 'Margot Robbie' },
  { character: 'Rick Flag', actor: 'Joel Kinnaman' },
]
// Twelve, so both caps have something to cut.
const MANY = Array.from({ length: 12 }, (_, i) => ({ character: `Person ${i + 1}`, actor: `Actor ${i + 1}` }))

const asPhone = (matches) => {
  window.matchMedia = (media) => ({
    matches, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}

// A controlled box, exactly as every caller wires it.
function Box({ cast = CAST, field = 'character', start = '' }) {
  const [v, setV] = useState(start)
  return (
    <div>
      <CastCombo label="Character" value={v} onChange={setV} cast={cast} field={field} placeholder="who says it" />
      <span data-testid="value">{v}</span>
    </div>
  )
}

const box = () => screen.getByRole('combobox')
const options = () => screen.queryAllByRole('option')
const value = () => screen.getByTestId('value').textContent

beforeEach(() => {
  asPhone(false)
})

describe('the cast dropdown', () => {

  it('picking a row writes the character, not the actor', () => {
    render(<Box />)
    fireEvent.focus(box())
    fireEvent.click(screen.getByText('Harley Quinn'))
    expect(value()).toBe('Harley Quinn')
    // And the list closes, rather than standing over the form with one row in it.
    expect(options()).toHaveLength(0)
  })

})
})

// A CHIP PER CHARACTER NAMED ON A LINE, and the row that scrolls when they
// do not fit.
//
// WHAT THIS REPLACES, in the words of the code it replaces. A line with one
// resolvable speaker drew one chip; an ensemble line — several characters, which
// the linker deliberately refuses to guess between — drew a row of small
// FACELESS DISCS instead, and the comment beside it said so: "an ensemble line
// names several characters, the linker refuses to guess between them, and then
// this row is the only thing saying who is in it." A stack of discs says how MANY
// people are in a line and not one of their names, which is the one thing a
// reader wants from it.
//
// NO NEW DATA WAS NEEDED and that is worth pinning too: `character_images` has
// ridden the quote payload since the cast pass, already one entry per named
// character with the picture stored for them. The first attempt at this went
// looking for a schema change; there was none to make.
describe('speaker chips row', () => {
  const IMAGES = [
    { name: 'Woland', path: 'woland.jpg' },
    { name: 'Behemoth', path: '' },
    { name: 'Margarita', path: 'margarita.jpg' },
  ]

  const chips = () => [...document.querySelectorAll('.person-chip')]

  describe('the chip row', () => {
    it('draws one chip per character the line names', () => {
      render(<SpeakerChips images={IMAGES} />)
      expect(chips().length).toBe(3)
      expect(chips().map((c) => c.querySelector('.person-chip-name').textContent))
        .toEqual(['Woland', 'Behemoth', 'Margarita'])
    })

  })

  describe('the stored speaker among them', () => {

    // AND ONE THAT DOES OPEN, because that is the whole point of the ruling: a
    // named character the work's cast knows carries its cast row down to the chip.
    it('opens the work’s character popup for a name the cast knows', () => {
      const onOpen = vi.fn()
      render(
        <SpeakerChips
          images={[{ name: 'Behemoth', path: '', cast_id: 42, character_id: 7 }]}
          onOpenCharacter={onOpen}
        />,
      )
      fireEvent.click(chips()[0])
      // THE CAST ROW NAMES THE SCREEN, not the record: a work can bill one
      // character twice and the record id cannot tell the two apart.
      expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ cast_id: 42, character_id: 7 }))
    })

  })
})

// A NAME IS PRINTED ONCE, AND THE OCCASION HAS ITS OWN LINE.
//
// THE REPORT, in the owner's words, of a standalone quote on Home's favourites
// board: "why is albert einstein repeated in the prose? and the part about the
// letter could be placed below/above the chip row, like notes or translation."
//
// TWO RULES FALL OUT OF IT, and neither needs a line of the source:
//
//   A FACT APPEARS ONCE PER CARD. The chip beside the quote carries the
//   speaker's name AND their portrait; a line under it repeating that name in
//   small caps is the same fact twice, and the second printing is the one that
//   pushed the first out of its row. What the collapsed line is FOR is the one
//   thing no chip and no header carries — where the line was said.
//
//   AND IT SITS ON ITS OWN LINE. Beside the chips it competes with them for one
//   row's width, which is what clipped the chip to "Albert Ein…". Above or below
//   them, the way a note or a translation sits.
//
// THE CARD IS BUILT FROM A STORED ROW, not handed a finished shape. Both facts
// are decided in `quoteFav`, which turns the row into the card's shape, and a
// test given that shape ready-made would assert only that the tile prints what
// it was told to — the exact hole `credit-row.test.jsx` sat in for a week.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.
describe('favourite occasion', () => {
const ROW = {
  id: 7,
  quote: 'Everything should be made as simple as possible, but not simpler.',
  note: '',
  speaker: 'Albert Einstein',
  occasion: 'writing to Carl Seelig',
  kind: 'letter',
  color: 'yellow',
  tags: [],
  created_at: '1946-03-11T00:00:00Z',
  favorite: true,
}

const tile = (over = {}) => {
  const f = quoteFav({ ...ROW, ...over })
  render(
    <FavouriteTile
      f={f}
      variant="a"
      open={false}
      editing={false}
      onToggle={() => {}}
      onOpen={() => {}}
      speakerMap={{}}
      seps={{}}
    />,
  )
  return f
}

// The card's own body, so the edit modal's hidden copy of the same strings
// cannot answer for the resting card.
//
// AND THE CLASS IS THE ONE THE APP WRITES. This named `.tp-hand-card`, which no
// component in this app has ever had — `HandCard` writes `hand-card` — so every
// case here has been measuring `document.body` and the scope in the sentence
// above was not in force. It changed no verdict, because the tile is the only
// thing rendered; it would have changed one the moment a case rendered the edit
// modal it names, which is what the scope was written for.
const card = () => document.querySelector('.hand-card') || document.body

afterEach(() => cleanup())

describe('a standalone quote on the favourites board', () => {
  it('prints the speaker once, not once in a chip and again in the line beneath', () => {
    tile()
    const hits = [...card().querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && /Albert Einstein/.test(el.textContent))
    expect(hits.length,
      `the speaker is printed ${hits.length} times: ` + hits.map((h) => h.textContent).join(' | '))
      .toBe(1)
  })
})
})

// A CREDIT ROW IS THREE DIFFERENT DOORS, and which one you press decides what
// happens.
//
// THE SPECIFICATION, from the design pack. `character-popup.dc.html` splits the
// row deliberately: the PORTRAIT opens the person picker to change who is on the
// credit (`mode:'person'`, line 522) and wears a caret to say it is the thing
// being replaced; the NAME opens that person's own record (line 529); the pencil
// notes what is peculiar about this credit; the ✕ takes it off. `CreditRow`'s own
// header in `characterRows.jsx` says the same thing in the same order.
//
// AND THE ROW'S SECOND LINE CARRIES BOTH FACTS: the pack builds it as
// `[o.lang, o.note].filter(Boolean).join(' · ')` — the language first, "because
// 'Hindi' is the thing that tells two dubs apart and the note is the gloss on it".
//
// WHY THESE ARE WORTH A TEST. Every one of them is invisible when broken. Two
// controls that both open the same record look exactly like two controls that do
// different things until you press them; a dub whose language has been swallowed
// by its note still draws a full row; and a name with no record behind it looks
// pressable right up until it isn't. The app shipped all three at once, with a
// tooltip reading "Change who this is" over a control that could not.
//
// IT RENDERS THE SHEET, NOT THE ROW, and the difference is the whole reason this
// file was rewritten. Every one of those three defects lived in `creditRows()` —
// the function that BUILDS a row out of a served cast record — and the first
// version of this file rendered `CreditRow` with the finished props typed in by
// hand. So it asserted that a component calls the handler it was handed, which
// no version of the app has ever got wrong, and all eight cases stayed green
// while `note || lang` and a face wired to `onOpen` were live in the tree. A test
// that feeds in the answer cannot see the step that computes it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that the sheet is
// handed a work, the cast row it is showing (`here`), and the server's list of
// this character's appearances. Nothing about how the handlers are wired.
describe('credit row', () => {
const WORK = { kind: 'movie', id: 3, title: 'The Shawshank Redemption', media_type: 'movie' }

// One served cast row — `store.CastOf`'s shape, which is what the sheet reads.
const cast = (over = {}) => ({
  cast_id: 9,
  kind: 'movie',
  work_id: 3,
  work_title: 'The Shawshank Redemption',
  media_type: 'movie',
  character: 'Andy Dufresne',
  character_id: 4,
  actor: 'Tim Robbins',
  actor_id: 11,
  actor_image: 'tim.jpg',
  credit_lang: '',
  credit_note: '',
  ...over,
})

const verbs = () => ({
  onCreditPick: vi.fn(), onOpenCredit: vi.fn(), onCreditNote: vi.fn(), onCreditRemove: vi.fn(),
})

// `works` is the server's list and `here` names the row the sheet is on; the
// credit block is built from the two, which is the step under test.
const sheet = (over = {}, v = verbs()) => {
  const here = cast(over)
  render(
    <CharacterLocal
      record={{ id: 4, name: 'Andy Dufresne', image_path: '' }}
      work={WORK}
      here={here}
      works={[here]}
      scope={identityScope({ table: 'character', work: WORK })}
      {...v}
    />,
  )
  return v
}

const face = () => document.querySelector('.cs-credit-pick')
const nameBtn = () => document.querySelector('.cs-credit-name')

afterEach(() => cleanup())

describe('the portrait and the name', () => {

  it('and the name opens the record, not the picker', () => {
    const v = sheet()
    nameBtn().click()
    expect(v.onOpenCredit).toHaveBeenCalledTimes(1)
    expect(v.onCreditPick, 'the name went to the picker').not.toHaveBeenCalled()
  })
})

// ---- and the rows around it say a thing once --------------------------------
//
// THE OWNER'S RULING, on this sheet: "the 'in this work' section has duplicate
// and unnecessary prose" and "we don't need to write overly long proses like
// 'the only name this work uses'. it is obvious from there not being any alias."
//
// WHAT WAS THERE. The description row drew "In this work" as its label, "This
// work only" under it and "nothing written for this work" as its value — one
// scope stated three times, and long enough that the label itself wrapped and
// clipped to "In this wor". And the name row's sub-line, when a character has no
// aliases, said so in a sentence.
//
// THE PROPERTY, which is CLAUDE.md's now: a sub-line earns its place by carrying
// something the label does not. "Yours, private, this work only" under "Note"
// does — private and per-work are two facts the word Note has neither of. "This
// work only" under "In this work" does not.

const rowFor = (label) => [...document.querySelectorAll('.cs-row')]
  .find((r) => (r.querySelector('.cs-row-label')?.textContent || '').trim() === label)
})

// Language marks — what a proverb wears where every other quote wears a face.
//
// THE DECISION THIS FILE GUARDS is that nothing here maps a language to a
// country. The ask was "use flags for languages"; the first answer was to offer
// two dozen of them without ever mapping one, on the grounds that offering is
// not deciding. That reasoning was right and the screen was still wrong — a grid
// of flags at the top of a language's tray is a recommendation whoever wrote it
// — so 1.16.0 took them out of the tray entirely. A language offers the letters of
// its OWN NAME FOR ITSELF, and a flag is still reachable by typing one.
//
// The rule is therefore stronger than it was, not weaker, and it is asserted as
// a property of the WHOLE LIST rather than of the ten rows somebody remembered to
// check: no glyph the app OFFERS may be a flag, anywhere.
//
// AND THE LIST IS NO LONGER TEN. STARTER_LANGUAGES — ten names with four
// hand-typed glyphs each — is gone, and `iso639.js` answers in its place: 86
// languages, each one's glyphs derived from its own autonym. So the assertions
// that used to name a hand-picked letter now name the letter the rule produces,
// and the ones that were properties of the table are properties of 86 rows.
describe('language marks', () => {
  beforeEach(() => applyLanguageMarks({}))

  const FLAG = /\p{Regional_Indicator}/u

  describe('the app offers a script, never a country', () => {
    it('offers no flag anywhere in the list', () => {
      // Every glyph of every language, not just the default one. The tray renders
      // all four, so checking only the mark would have passed a flag sitting in the
      // second slot — which is exactly the shape of the miss this file exists for.
      const offered = LANGUAGES.flatMap((l) => glyphsFor(l.code))
      expect(offered.filter((g) => FLAG.test(g))).toEqual([])
    })
  })
})

// A PICTURE THAT DOES NOT ARRIVE IS NOT A PICTURE.
//
// THE REPORT, the owner's, over a photograph of their own phone: "the character
// chip (delia sturridge) on the V for vendetta poster is a missing image glyph
// that looks like server has broke. it should be simply a random person glyph, as
// used in the actual delia sturridge character page."
//
// WHAT WAS WRONG, and it was the same line written six times: every site branched
// on whether a PATH WAS STORED. That is a different question from whether the
// file behind it arrived, and it is the one the reader cannot see — so a portrait
// whose file had gone drew the browser's torn page, which reads as "the server is
// down" rather than as "no picture".
//
// WHY THIS FILE EXISTS AT ALL. The fallback shipped once with no test: deleting
// `onError` left the whole suite green, on the one item of that round the owner
// had photographed. Nothing in the app can see a picture fail except the element
// it fails on, so nothing but a fired `error` can assert it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `Face` takes `{ src, name, className, url }`,
// draws the address `url(src)` builds, and falls back to the app's six hashed
// silhouettes — the same six a row with no picture has always drawn.
describe('face fallback', () => {
afterEach(() => cleanup())

// `url` is the identity function: what is being tested is what happens to the
// element, not how an address is built.
const draw = (props) => render(<Face url={(x) => x} {...props} />).container
const img = (c) => c.querySelector('img')
const glyph = (c) => c.querySelector('svg')

describe('a face whose picture fails to arrive', () => {

  it('and the character page the owner named draws it too', () => {
    // NOT A TEST OF `Face` BUT OF THE SITE. `Face` having the fallback says
    // nothing about whether a screen CALLS it — reverting three converted sites
    // once left the whole suite green but for one assertion about a class name.
    // This is the screen the owner named as the model: "as used in the actual
    // delia sturridge character page".
    const { container } = render(<PortraitBlock src="gone.jpg" name="Delia Surridge" px="" from="" actions={null} />)
    const shot = container.querySelector('img')
    expect(shot, 'the portrait block drew no picture at all').toBeTruthy()
    fireEvent.error(shot)
    expect(container.querySelector('img'), 'the failed portrait is still on the screen').toBeNull()
    expect(container.querySelector('svg'), 'nothing stood in for the failed portrait').toBeTruthy()
  })
})
})

// WHAT A PORTRAIT'S CAPTION SAYS ABOUT THE PICTURE UNDER IT.
//
// THE OWNER, over a person sheet showing a loaded photograph and no numbers:
// "the character/actor cards do not say the size of the image or whether they are
// low contrast (for the images). and how do we tackle images that are not 2:3?"
//
// THREE SEPARATE THINGS WERE WRONG, and one of them had been wrong in writing.
//
//   THE SIZE WAS MEASURED ON `load` ALONE, and a cached image never fires it. So
//   the size appeared on a first visit and the caption fell back to "the record's
//   own picture" on every visit after — a loaded portrait with nothing under it,
//   which is exactly the screen that was reported.
//
//   "LOW CONTRAST" WAS A SIZE TEST. `identity.portrait.soft` has read "low
//   contrast" since it was written and the code showed it when `w < 400 || h <
//   400`. A small picture was labelled low contrast; a washed-out one said
//   nothing. The string's own comment described the size test underneath the
//   contrast wording.
//
//   AND A NON-2:3 PICTURE SAID NOTHING AT ALL, while `object-fit: cover`
//   centre-cropped it — so half a face can be outside the circle with nothing on
//   the screen to say so.
//
// WHAT A TEST WRITER NEEDS TO KNOW: jsdom has no canvas, so `contrastOf` returns
// null there and the contrast note is absent by design — a guess about somebody's
// portrait is worse than silence. The cases that need a contrast answer stub
// `getContext` and hand back the pixels they want measured.
describe('portrait measured', () => {
afterEach(() => { cleanup(); vi.restoreAllMocks() })

// A picture of a given size that is ALREADY loaded, the way a cached one is.
function cached({ w, h }) {
  Object.defineProperty(window.HTMLImageElement.prototype, 'complete', { value: true, configurable: true })
  Object.defineProperty(window.HTMLImageElement.prototype, 'naturalWidth', { value: w, configurable: true })
  Object.defineProperty(window.HTMLImageElement.prototype, 'naturalHeight', { value: h, configurable: true })
}

// Pixels for the contrast measurement: `flat` fills every channel with one value
// (no spread at all), `lit` alternates black and white (the whole range).
function pixels(kind) {
  const n = 32 * 32
  const data = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    const v = kind === 'flat' ? 130 : (i % 2 ? 250 : 8)
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255
  }
  vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: () => {},
    getImageData: () => ({ data }),
  })
}

const draw = async (props) => {
  let out
  await act(async () => { out = render(<PortraitBlock src="/x.jpg" name="Rupert Graves" px="the record's own picture" {...props} />) })
  return out
}

describe('a portrait’s caption', () => {
  it('states the size of a picture that was already in the cache', async () => {
    // THE REPORTED SCREEN. Nothing fires `load` for an image the browser already
    // has, so the block waited for an event that had happened before it existed.
    cached({ w: 1000, h: 1500 })
    await draw()
    expect(screen.queryByText(/1000×1500px/), 'a loaded picture’s size is not on the screen').toBeTruthy()
    expect(screen.queryByText(/record’s own picture|record's own picture/),
      'the caption is still the placeholder shown before a measurement exists').toBeNull()
  })

  it('and calls a flat picture low contrast, whatever its size', async () => {
    cached({ w: 1000, h: 1500 })
    pixels('flat')
    await draw()
    expect(screen.queryByText(/low contrast/), 'a picture with no tonal range at all is not flagged').toBeTruthy()
    expect(screen.queryByText(/under 400px/), 'a large picture is called small').toBeNull()
  })

  it('and says the shape of a picture that is not square, because the circle cuts the rest away', async () => {
    cached({ w: 1600, h: 701 }) // a wide logo, which is half outside a circle
    pixels('lit')
    await draw()
    expect(screen.queryByText(/1600:701, cropped/), 'a wide picture is cropped to a circle and says nothing').toBeTruthy()
  })

})
})

// A work's header — ONE arrangement, one stated order, every width, every kind of
// work.
//
// THIS FILE USED TO PIN THE PHONE'S OWN ARRANGEMENT, and the reason it no longer
// does is the point of the change it now guards. There were three heroes: a float
// for a wide page, a stack for a phone, a column for the two-column frame, chosen
// in JavaScript. Three copies of the same nine facts drift exactly as three copies
// do — the film side only ever called one of them, so a film never got the column
// at all, and the year lived in the credit line on one side and nowhere on the
// other. The design pack settles it: its hero is ONE markup at every width and
// only the cover's placement branches, which is a stylesheet's job.
//
// So what is asserted here is stronger than what was asserted before. It is not
// "the phone stacks in this order" — it is that there is only one order and every
// caller gets it. The order answers four questions in turn:
//
//   1. what it is        the cover, the kind, the year, the title
//   2. what it is about  its genres
//   3. what it holds     the count
//   4. where you are     the shelf state, with progress on the cover's own foot
//
// then the people, the description and the verbs. Asserted by DOM position, which
// is also the reading order for a screen reader and the tab order for a keyboard.
describe('work hero', () => {
  // The hooks that used to pick an arrangement are gone; matchMedia is stubbed
  // anyway so a stray reader cannot make the test depend on a width.
  const setScreen = (isMobile) => {
    window.matchMedia = (media) => ({
      matches: isMobile,
      media,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    })
  }
  const realMatchMedia = window.matchMedia
  beforeEach(() => setScreen(true))
  afterEach(() => { window.matchMedia = realMatchMedia })

  const hero = (over = {}) =>
    render(
      <WorkHero
        cover={<img alt="cover" src="x" />}
        kindRow={<span data-testid="kind">Book · 1998</span>}
        title="The Wide Margin"
        meta={<span data-testid="meta">A. Whitfield</span>}
        counts={<span data-testid="counts">12 quotes</span>}
        favorite={false}
        onFavorite={() => {}}
        tags={<span data-testid="shelf">reading ×2</span>}
        genres={['essays', 'memoir']}
        description="A book about margins."
        {...over}
      />,
    )

  // Where a node sits in the rendered document, so "before" and "after" are
  // document order rather than anything about styling.

  describe('the compact bar knows which screen it is on', () => {
    it('leaves exactly one copy of the title in the document on a phone', () => {
      // The cost of the bar is a second copy of the name. A phone must not pay it
      // for something it will never show.
      const { container } = hero()
      expect(container.querySelectorAll('h1, .work-hero-mini-title')).toHaveLength(1)
    })
  })
})
