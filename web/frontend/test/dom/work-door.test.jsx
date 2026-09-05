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
// which open a person write `usePersonOpener(stack, setPerson)` — the two
// arguments every one of the app's seven call sites passes today.
import { act, cleanup, render, screen } from '@testing-library/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
const { characterPanel } = await import('../../src/identity.jsx')
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

// A SCREEN, WRITTEN THE WAY THE APP'S SCREENS ARE WRITTEN. Two arguments to the
// opener and no mention of a work anywhere: Library, Movies, Quotes, Search,
// Home, WorkDetail and cast.jsx each say exactly this much.
function Screen({ onLegacy = () => {} }) {
  const stack = usePanelStack()
  const openPerson = usePersonOpener(stack, onLegacy)
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (done) return
    setDone(true)
    openPerson({ kind: 'actor', name: 'Tim Robbins', person: { id: 11 } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <PanelHost stack={stack} />
}

// A screen that hosts a CHARACTER panel, which work-detail pages and Home's
// favourite cards both do — and none of them names a work opener either.
function CharacterScreen() {
  const stack = usePanelStack()
  const [done, setDone] = useState(false)
  const panel = useMemo(() => characterPanel(stack, { id: 4, name: 'Andy Dufresne' }), [])
  useEffect(() => {
    if (done) return
    setDone(true)
    stack.open(panel)
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

  it('says it cannot be opened where the app has no door, and pressing it does not throw', async () => {
    await act(async () => { render(<Screen />) })
    await settle()
    const t = tile('Dead Man Walking')
    expect(t.getAttribute('aria-disabled'), 'a tile with nowhere to go says so').toBe('true')
    // A tile that draws as live and throws on press is the one outcome worse
    // than a dead control: it reads as the app breaking.
    await act(async () => { t.click() })
  })
})

describe('a work tile on a character’s screen', () => {
  it('opens that work, from a screen that never mentions a work opener', async () => {
    const opened = []
    await act(async () => {
      render(
        <WorkDoor open={(kind, id) => opened.push([kind, id])}>
          <CharacterScreen />
        </WorkDoor>,
      )
    })
    await settle()
    const t = tile('The Shawshank Redemption')
    expect(t.getAttribute('aria-disabled')).toBe(null)
    await act(async () => { t.click() })
    // A CHARACTER'S TILE HAS MORE THAN ONE THING BEHIND IT — the work, and this
    // character as that work has them — so it asks, which is the pack's own rule
    // and `work-chooser.test.jsx`'s subject. The door is what the WORK row needs;
    // without one that row is `aria-disabled` and the sheet offers a dead end.
    const row = screen.getAllByText('The Shawshank Redemption')
      .map((el) => el.closest('button.cs-choose')).find(Boolean)
    expect(row, 'the sheet has to offer the work itself').toBeTruthy()
    expect(row.getAttribute('aria-disabled')).toBe(null)
    await act(async () => { row.click() })
    expect(opened, 'the character’s strip is the same strip and owes the same thing').toEqual([['movie', 3]])
  })

  it('and where the app has no door the sheet says the work cannot be reached', async () => {
    await act(async () => { render(<CharacterScreen />) })
    await settle()
    await act(async () => { tile('The Shawshank Redemption').click() })
    // queryAll, not getAll: the local scope it opens instead does not print the
    // work's title at all, and getAllByText throws on an empty match — which
    // would fail this case for the query's reason rather than the app's.
    const row = screen.queryAllByText('The Shawshank Redemption')
      .map((el) => el.closest('button.cs-choose')).find(Boolean)
    // The one thing left behind the tile is the local scope, so the tile opens
    // it directly rather than asking — there is nothing to choose between.
    expect(row, 'with no door there is one answer left, and a sheet over one answer is a sheet to dismiss').toBeFalsy()
  })
})
