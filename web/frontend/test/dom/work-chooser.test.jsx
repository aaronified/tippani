// A PRESS WITH MORE THAN ONE RIGHT ANSWER ASKS, RATHER THAN GUESSING.
//
// THE SPECIFICATION, from the design pack, twice:
//
//   "A WORK CAN HOLD MORE THAN ONE OF HIS ROLES, so a tile on a performer's strip
//   cannot assume what you meant by tapping it: two characters in one film, or
//   the film itself. When there is a choice, it asks; when there is only one
//   thing behind the tile, it just opens it."
//   (`character-popup.dc.html:754-758`)
//
//   "'Delete' here would reach into three works at once and quietly strip a name
//   off each — the one edit on this screen whose damage you could not see before
//   it happened. So the verb states the reach and then hands back the list: each
//   work is unlinked by its own tap, and the identity only goes once nothing is
//   left holding it. Slower on purpose, and the slowness is the safety."
//   (line 957)
//
// FOUR RULES FALL OUT OF THOSE, and none of them needs a line of the source:
//
//   IT ASKS ONLY WHERE THERE IS A CHOICE. One thing behind a tile and it opens.
//   A sheet that appears every time is a sheet a reader learns to dismiss.
//
//   THE THINGS BEHIND A WORK TILE ARE THE WORK, THIS CHARACTER AS THAT WORK HAS
//   THEM, AND WHOEVER PLAYED THEM.
//
//   NOTHING IS REMOVED IN BULK. The removal verb lists the works and each is
//   unlinked by its own press; the list stays up while there is more of it.
//
//   AND A ROW WITH NOTHING BEHIND IT SAYS SO rather than pressing and doing
//   nothing.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the block above.
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let RECORD
let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && /^\/characters\/\d+$/.test(path)) return { ok: true, data: RECORD }
    if (/whos-in-it/.test(path)) return { ok: true, data: { characters: [] } }
    return { ok: true, data: {} }
  }),
}))

const { characterPanel } = await import('../../src/identity.jsx')
const { PanelHost, usePanelStack } = await import('../../src/ui.jsx')

function Harness({ panel }) {
  const stack = usePanelStack()
  const [opened, setOpened] = useState(false)
  useEffect(() => {
    if (opened) return
    setOpened(true)
    stack.open(panel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <PanelHost stack={stack} />
}

const appearance = (over = {}) => ({
  cast_id: 9, kind: 'movie', work_id: 3, work_title: 'The Shawshank Redemption',
  media_type: 'movie', character: 'Andy Dufresne', character_id: 4,
  actor: 'Tim Robbins', actor_id: 11, actor_image: 'tim.jpg',
  image: 'andy.jpg', cover: 'poster.jpg', ...over,
})

let OPENED_WORK
let PUSHED

beforeEach(() => {
  window.history.replaceState({}, '')
  CALLS = []
  OPENED_WORK = []
  PUSHED = []
  RECORD = {
    id: 4, name: 'Andy Dufresne', image_path: '', aliases: [], lines: [], shared_lines: 0,
    appearances: [appearance()],
  }
})
afterEach(() => cleanup())

// The identity's own sheet: opened with no work.
const openGlobal = async (opts = {}) => {
  const stack = { open: () => {}, push: (p) => PUSHED.push(p?.title || '(untitled)'), close: () => {} }
  await act(async () => {
    render(<Harness panel={characterPanel(stack, {
      id: 4,
      name: 'Andy Dufresne',
      onOpenWork: (kind, workId) => OPENED_WORK.push([kind, workId]),
      ...opts,
    })} />)
  })
}

const buttons = () => [...document.querySelectorAll('button')]
const byText = (re) => buttons().find((b) => re.test(b.textContent))
const press = async (el) => { await act(async () => { el.click() }) }
// The sheet the choice is asked in.
const sheet = () => [...document.querySelectorAll('[role="dialog"]')]
  .find((d) => d.querySelector('.cs-choose'))

describe('pressing a work on the identity’s own sheet', () => {
  beforeEach(openGlobal)

  it('asks what was meant, rather than picking one', async () => {
    const tile = byText(/Shawshank/)
    expect(tile, 'the works strip drew no tile to press').toBeTruthy()
    await press(tile)
    expect(sheet(), 'the press guessed instead of asking').toBeTruthy()
  })

  it('offers the work, the character in it, and who played them', async () => {
    await press(byText(/Shawshank/))
    const rows = [...sheet().querySelectorAll('.cs-choose')].map((b) => b.textContent)
    expect(rows.length, `only ${rows.length} things offered`).toBeGreaterThanOrEqual(3)
    expect(rows.join(' | ')).toMatch(/Shawshank/)
    expect(rows.join(' | ')).toMatch(/Andy Dufresne/)
    expect(rows.join(' | ')).toMatch(/Tim Robbins/)
  })

  it('and every row it offers is pressable', async () => {
    await press(byText(/Shawshank/))
    for (const row of sheet().querySelectorAll('.cs-choose')) {
      expect(row.getAttribute('aria-disabled'),
        `"${row.textContent.trim().slice(0, 30)}" presses and does nothing`).not.toBe('true')
    }
  })

  it('opens the work when the work is chosen', async () => {
    await press(byText(/Shawshank/))
    const row = [...sheet().querySelectorAll('.cs-choose')].find((b) => /Shawshank/.test(b.textContent))
    await press(row)
    expect(OPENED_WORK, 'choosing the work opened nothing').toEqual([['movie', 3]])
  })

  it('and closes behind the choice, because a door is not a list', async () => {
    await press(byText(/Shawshank/))
    const row = [...sheet().querySelectorAll('.cs-choose')].find((b) => /Shawshank/.test(b.textContent))
    await press(row)
    expect(sheet(), 'the sheet stayed up after a door was taken').toBeFalsy()
  })
})

describe('a row with nothing behind it', () => {
  it('says so rather than pressing and doing nothing', async () => {
    // No screen threaded a door to the work, so there is nowhere for that row to
    // go — and a row that looks live and is not is worse than an absent one.
    RECORD.appearances = [appearance()]
    await openGlobal({ onOpenWork: null })
    await press(byText(/Shawshank/))
    const row = [...sheet().querySelectorAll('.cs-choose')].find((b) => /Shawshank/.test(b.textContent))
    expect(row.getAttribute('aria-disabled'), 'a row with no door looks live').toBe('true')
    expect(row.getAttribute('title'), 'and says nothing about why').toBeTruthy()
  })
})

describe('taking the character off every work', () => {
  beforeEach(async () => {
    RECORD.appearances = [
      appearance(),
      appearance({ cast_id: 10, work_id: 5, work_title: 'The Green Mile' }),
      appearance({ cast_id: 11, kind: 'book', work_id: 7, work_title: 'Different Seasons', media_type: '' }),
    ]
    await openGlobal()
  })

  it('offers the verb at all, now that it has a sheet to open', () => {
    expect(byText(/every work|all works/i), 'the removal verb is nowhere on the sheet').toBeTruthy()
  })

  it('lists the works instead of acting on them', async () => {
    await press(byText(/every work|all works/i))
    const rows = [...sheet().querySelectorAll('.cs-choose')].map((b) => b.textContent)
    expect(rows.length, 'the verb did not hand back the list').toBe(3)
    expect(CALLS.filter(([m]) => m === 'DELETE'),
      'works were unlinked by pressing the verb, which is the bulk act it exists to avoid').toEqual([])
  })

  it('unlinks one work per press, and stays open while there is more of the list', async () => {
    await press(byText(/every work|all works/i))
    const first = [...sheet().querySelectorAll('.cs-choose')][0]
    await press(first)
    expect(CALLS.filter(([m]) => m === 'DELETE').length, 'the press unlinked nothing').toBe(1)
    expect(sheet(), 'the list closed after one of three works').toBeTruthy()
  })
})

describe('a work with only one thing behind it', () => {
  it('opens it rather than asking', async () => {
    // Nobody is credited, so the work and the character are the only two things —
    // and with no work door threaded there is exactly one. A sheet offering one
    // answer is a sheet the reader has to dismiss to reach the thing they already
    // asked for, and it teaches them to dismiss the ones that matter.
    RECORD.appearances = [appearance({ actor: '', actor_id: 0 })]
    await openGlobal({ onOpenWork: null })
    await press(byText(/Shawshank/))
    expect(sheet(), 'a sheet was opened over a single answer').toBeFalsy()
    expect(PUSHED, 'and the one answer was not taken either').toEqual(['Andy Dufresne'])
  })

  it('but still asks where there are two', async () => {
    // The guard on the guard: without this, an implementation that never opens
    // the sheet passes the case above.
    RECORD.appearances = [appearance()]
    await openGlobal()
    await press(byText(/Shawshank/))
    expect(sheet(), 'three things behind the tile and no question asked').toBeTruthy()
  })
})
