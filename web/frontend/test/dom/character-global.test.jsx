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

})

