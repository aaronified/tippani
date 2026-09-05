// THE CHARACTER'S GLOBAL SCREEN, AGAINST THE PACK IT IS BUILT TO.
//
// WHY THIS FILE EXISTS. Four separate reports landed on this one screen, and each
// of them was a thing the prototype does not draw or a control that draws and
// does nothing. `docs/design/prototypes/character-popup.dc.html:942-984` gives
// char-global exactly four blocks — the identity's fields, Links, Appearances,
// and the two acts that end it — and the screen had grown a list of quotes, a
// second "add a work" button below that list, and an "Add a work" tile whose
// press only scrolled.
//
// SO THE CASES ARE ABOUT THE SCREEN'S SHAPE, NOT ABOUT COPY. What is on it, what
// each control does when it is pressed, and what a press leaves on the page — a
// test asserting the wording of any of these would pass on a screen that had all
// the words and none of the doors, which is what shipped.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'

let CHARACTER
let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path.startsWith('/characters/')) return { ok: true, data: CHARACTER }
    if (method === 'GET' && path === '/books') return { ok: true, data: { books: [{ id: 21, title: 'Bawarchi novelisation' }] } }
    if (method === 'GET' && path === '/movies') return { ok: true, data: { movies: [{ id: 22, title: 'Namak Haraam', media_type: 'movie' }] } }
    return { ok: true, data: {} }
  }),
}))

const { characterPanel } = await import('../../src/identity.jsx')
const { PanelHost, usePanelStack } = await import('../../src/ui.jsx')
const { WorkDoor } = await import('../../src/personOpen.jsx')

// OPENED THE WAY THE APP OPENS IT — inside a panel, under the shell's work door.
// Both matter here: the panel is what draws the header this file measures, and
// the door is what a work tile needs before it can open anything. A body rendered
// bare would report every tile dead and every header absent, and would have
// passed on the screen the owner photographed.
let OPENED
// THE PANEL IS BUILT FROM THE REAL STACK, not from a stub. A work tile has to
// take the panel off the screen before the shell can move underneath it, and a
// stub with no `leaveTo` would take the fallback path and pass a case the app
// fails — which is exactly the shape of the report this file exists for.
function Host() {
  const stack = usePanelStack()
  useEffect(() => { stack.open(characterPanel(stack, { id: 3, name: CHARACTER.name })) }, [])
  return <PanelHost stack={stack} />
}
const openPanel = async () => {
  render(
    <WorkDoor open={(kind, id) => { OPENED = { kind, id } }}>
      <Host />
    </WorkDoor>,
  )
  await screen.findByText(/^The identity$/i)
}

beforeEach(() => {
  CALLS = []
  OPENED = null
  CHARACTER = {
    id: 3,
    name: 'Dr. Bhaskar K. Bannerjee',
    sort_name: '',
    description: '',
    note: '',
    aliases: [],
    appearances: [
      {
        cast_id: 11, kind: 'movie', work_id: 5, media_type: 'movie',
        work_title: 'Anand', character: 'Dr. Bhaskar K. Bannerjee',
        actor_id: 9, actor: 'Amitabh Bachchan', actor_image: 'ab.jpg',
      },
      {
        cast_id: 12, kind: 'movie', work_id: 6, media_type: 'movie',
        work_title: 'Namak Haraam', character: 'Vicky',
        actor_id: 9, actor: 'Amitabh Bachchan', actor_image: 'ab.jpg',
      },
      {
        cast_id: 13, kind: 'movie', work_id: 7, media_type: 'movie',
        work_title: 'Mili', character: 'Shekhar',
        actor_id: 0, actor: 'Ashok Kumar', actor_image: '',
      },
    ],
    lines: [
      { id: 4, kind: 'screen', text: 'आनंद मरा नहीं, आनंद मरता नहीं', name: 'Dr. Bhaskar K. Bannerjee', work_title: 'Anand', character_images: [] },
    ],
    shared_lines: 0,
  }
})
afterEach(() => cleanup())

describe('what the screen is made of', () => {
  it('does not list the character’s quotes', async () => {
    // THE OWNER'S RULING, GIVEN THREE TIMES. The pack's char-global has no such
    // list; the counts on the appearances are the door to the screen that does
    // hold one. Asserted on the QUOTE ITSELF rather than on a heading, because a
    // heading can be renamed while the list stays.
    await openPanel()
    expect(screen.queryByText(/आनंद मरा नहीं/)).toBeNull()
  })

  it('lists every performer who has played the character, once each', async () => {
    // The owner's own addition to the pack: "a list of actors assigned to the
    // character in various different works". One row per PERSON — the fixture has
    // one performer across two films — because three rows saying one name is the
    // duplication this screen was reported for.
    await openPanel()
    const named = screen.getAllByText('Amitabh Bachchan')
    expect(named, 'the performer is listed twice for two films').toHaveLength(1)
    // And the works they did it in are on the row, which is what makes the list
    // worth more than a name.
    const row = named[0].closest('.cs-row')
    expect(row.textContent).toContain('Anand')
    expect(row.textContent).toContain('Namak Haraam')
    // A performer with no record is still listed — they played the part.
    expect(screen.getByText('Ashok Kumar')).toBeTruthy()
  })

  it('says so on the performer row it cannot open, rather than dying quietly', async () => {
    await openPanel()
    const dead = screen.getByText('Ashok Kumar').closest('.cs-row')
    expect(dead.getAttribute('aria-disabled'), 'a row that does nothing and says nothing').toBe('true')
    const live = screen.getByText('Amitabh Bachchan').closest('.cs-row')
    expect(live.getAttribute('aria-disabled')).toBeNull()
  })

  it('actually opens an editor from every row that wears the mark', async () => {
    // THE MARK IS A PROMISE. The pencil went on before this case existed and the
    // sheet those rows open was mounted on the character's LOCAL branch only — so
    // on this screen every one of them set a picker nothing drew, and the press
    // did nothing at all. Driven off the marks rather than off a list of row
    // names, so a row added later is covered the day it is added.
    await openPanel()
    const marked = [...document.querySelectorAll('.cs-row-pencil')].map((p) => p.closest('.cs-row'))
    expect(marked.length, 'no row on this screen opens an editor').toBeGreaterThan(2)
    for (const row of marked) {
      const name = row.querySelector('.cs-row-label')?.textContent
      const before = document.querySelectorAll('input, textarea').length
      act(() => row.click())
      // SOMETHING TO TYPE INTO, wherever the screen puts it. Most of these rows
      // open the pack's sheet; the names row reveals its spellings under itself,
      // because split is a verb per spelling and a single line of them cannot
      // hold it. What both owe the reader is a field — and what neither may do is
      // nothing, which is what all four did on this branch.
      await waitFor(() => {
        expect(document.querySelectorAll('input, textarea').length,
          `pressing ${name} opened no editor`).toBeGreaterThan(before)
      })
      const back = document.querySelector('.tp-subsheet .tp-panel-back')
      act(() => (back || row).click())
      await waitFor(() => expect(document.querySelectorAll('input, textarea').length).toBe(before))
    }
  })

  it('marks the rows that open an editor and leaves the others alone', async () => {
    // "there are no edit pencils on the fields." A row that prints `Born 1942` and
    // is secretly a door is a door nobody opens. The acts that end the screen are
    // not editors and must not wear the mark, or it stops meaning anything.
    await openPanel()
    const pencilled = (label) => !!screen.getByText(label).closest('.cs-row').querySelector('.cs-row-pencil')
    expect(pencilled('Sort name'), 'an editable field with no mark').toBe(true)
    expect(pencilled('Born')).toBe(true)
    expect(pencilled('Merge with another character'), 'a mark on a row that edits nothing').toBe(false)
  })
})

describe('the appearances strip', () => {
  it('opens the work behind a tile', async () => {
    // Reported three times, most recently "i hate to repeat myself, but the Anand
    // pill still does not open". The tile's press must reach the shell's door.
    await openPanel()
    const tile = screen.getByText('Anand').closest('button')
    expect(tile.getAttribute('aria-disabled'), 'the tile says it cannot be opened').toBeNull()
    act(() => tile.click())
    // A tile with more than one thing behind it asks first; the answer that opens
    // the work is one press further on.
    const sheet = await waitFor(() => {
      const el = document.querySelector('.tp-subsheet')
      expect(el, 'the tile asked nothing and opened nothing').toBeTruthy()
      return el
    })
    // The sheet is TITLED after the work as well, so the answer is picked off the
    // rows rather than off the first match.
    const answer = [...sheet.querySelectorAll('button.cs-choose')]
      .find((b) => /Anand/.test(b.textContent))
    expect(answer, 'the sheet offered no way to open the work').toBeTruthy()
    act(() => answer.click())
    // AND THE PANEL HAS TO BE GONE BY THE TIME THE SHELL MOVES, or the reader is
    // looking at this screen over a work they cannot see — which reads exactly
    // like a press that did nothing.
    await waitFor(() => expect(OPENED, 'the tile opened nothing at all').toEqual({ kind: 'movie', id: 5 }))
    expect(document.querySelector('.tp-panel'), 'the panel stayed over the work it opened').toBeNull()
  })

  it('opens the works picker from the add tile, and nowhere else', async () => {
    // Two halves of one report: "the add work (beside the cover doesn't work) but
    // the add button below the quote works (that should not even exist)". The
    // tile is the only door, and pressing it opens the picker rather than
    // scrolling to one.
    await openPanel()
    const adds = screen.getAllByText(/Add a work/i)
    expect(adds, 'more than one control adds a work').toHaveLength(1)
    act(() => adds[0].closest('button').click())
    await screen.findByPlaceholderText(/find a book or a film/i)
  })
})

describe('the panel header', () => {
  it('sets the name and its crumb as one block, not spaced apart', async () => {
    // "the header vertical gaps look weird", twice. The title carries a 44px floor
    // so a title ALONE lines up with the keys beside it; stacked over a crumb that
    // floor becomes empty space wedged between the two lines. Read off the
    // stylesheet, because jsdom lays nothing out.
    await openPanel()
    await waitFor(() => {
      expect(document.querySelector('.tp-panel-title.is-scoped'), 'the scoped header did not render').toBeTruthy()
    })
    const { resolveOn } = await import('../css-cascade.js')
    expect(resolveOn('.tp-panel-title.is-scoped', 'min-height').value).toBe('0')
  })
})
