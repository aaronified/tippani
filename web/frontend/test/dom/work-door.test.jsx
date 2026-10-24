// A WORK TILE OPENS THAT WORK.
//
// THE RULE, and it needs no line of the source. A person's screen and a
// character's screen each end in a strip of the works they are on. `characterRows
// .jsx`'s `AppearanceStrip` states what a tile owes the reader: "A TILE WITH
// NOWHERE TO GO SAYS SO. `aria-disabled` rather than `disabled`, so the cover
// stays readable and the tooltip still explains… Silence here is the defect class
// the control probe exists for: a press that changes nothing and gives no
// reason."
//
// So a tile has exactly two honest states, and this file is the pair of them:
//
//   THE APP CAN OPEN THAT WORK → pressing the tile opens it, and the panel does
//   not have to be told how. Every screen in the app that opens a person reaches
//   the same shell; a door that each of them has to remember to hand down is a
//   door most of them will not hand down, and the tile then lies in the second
//   state while the app is in the first.
//
//   THE APP CANNOT → the tile says so, and pressing it is quiet rather than
//   broken.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraph above, plus that the screens
// which open a person write `usePersonOpener(stack)` — the one argument every one
// of the app's eight call sites passes today.
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let PERSON
let CHARACTER

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && /^\/people\/id\/\d+$/.test(path)) return { ok: true, data: PERSON }
    if (method === 'GET' && /^\/characters\/\d+$/.test(path)) return { ok: true, data: CHARACTER }
    if (/whos-in-it/.test(path)) return { ok: true, data: { characters: [] } }
    return { ok: true, data: {} }
  }),
}))

const { WorkDoor, usePersonOpener } = await import('../../src/personOpen.jsx')
await import('../../src/identity.jsx')
const { PanelHost, usePanelStack } = await import('../../src/ui.jsx')

beforeEach(() => {
  window.history.replaceState({}, '')
  PERSON = {
    id: 11, name: 'Tim Robbins', image_path: '', aliases: [], links: [], kinds: ['performer'],
    // What they MADE — the tiles `creditTiles` builds, and the ones that had no door.
    credits: [{ kind: 'movie', work_id: 3, title: 'Dead Man Walking', role: 'director', cover: '' }],
    roles: [],
  }
  CHARACTER = {
    id: 4, name: 'Andy Dufresne', image_path: '', aliases: [], lines: [], shared_lines: 0,
    appearances: [{
      cast_id: 9, kind: 'movie', work_id: 3, work_title: 'The Shawshank Redemption',
      media_type: 'movie', character: 'Andy Dufresne', character_id: 4, cover: '',
    }],
  }
})
afterEach(() => cleanup())

// A SCREEN, WRITTEN THE WAY THE APP'S SCREENS ARE WRITTEN. One argument to the
// opener and no mention of a work anywhere: Library, Movies, Quotes, Search,
// Home, WorkDetail and cast.jsx each say exactly this much.
function Screen() {
  const stack = usePanelStack()
  const openPerson = usePersonOpener(stack)
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (done) return
    setDone(true)
    openPerson({ kind: 'actor', name: 'Tim Robbins', person: { id: 11 } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <PanelHost stack={stack} />
}


const settle = async () => { await act(async () => { await Promise.resolve() }) }

const tile = (title) => {
  const cap = screen.getAllByText(title).find((el) => el.closest('.cs-tile'))
  expect(cap, `no work tile for ${title}`).toBeTruthy()
  return cap.closest('button')
}

describe('a work tile on a person’s screen', () => {
  it('opens that work, from a screen that never mentions a work opener', async () => {
    const opened = []
    await act(async () => {
      render(
        <WorkDoor open={(kind, id) => opened.push([kind, id])}>
          <Screen />
        </WorkDoor>,
      )
    })
    await settle()
    const t = tile('Dead Man Walking')
    expect(t.getAttribute('aria-disabled'), 'the app can open this work, so the tile must not say it cannot').toBe(null)
    await act(async () => { t.click() })
    expect(opened, 'pressing a work tile has to open THAT work').toEqual([['movie', 3]])
  })

})

