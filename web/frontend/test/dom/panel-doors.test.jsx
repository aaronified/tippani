// A CAPABILITY THE SHELL OWNS MUST REACH THE PANEL WITHOUT BEING THREADED.
//
// THE LESSON THIS FILE EXISTS TO KEEP, recorded as A17 in the defect register and
// then repeated within one release: "A capability that has to be re-threaded at
// each call site is a capability that is absent at most of them, and
// absent-by-omission looks exactly like absent-on-purpose from the outside — the
// control says the same thing either way."
//
// It happened twice. `onOpenWork` was a parameter and NOT ONE of the app's seven
// callers passed it, so every work tile on every identity panel drew itself
// unopenable — that half is guarded on the global screen, in
// `character-global.test.jsx`, where the tiles live. `onSearch` was a parameter and not one caller passed it either, so
// the two counts the design pack makes pressable — "37 quotes lands on the search
// screen with this character and this work already up as chips" — were live
// buttons with no handler on every route into the screen. The second was found by
// pressing every control on a real library, months after the first was fixed.
//
// SO THE CASES ARE ABOUT REACHABILITY, not about either handler. A panel mounted
// under the shell's providers has both doors; a panel mounted bare has neither
// AND SAYS SO. Nothing here asserts a locale string or a class beyond the ones
// that carry the answer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'

let CHARACTER
let COUNTS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path.startsWith('/characters/')) return { ok: true, data: CHARACTER }
    if (method === 'GET' && path.startsWith('/whos-in-it')) return { ok: true, data: COUNTS }
    return { ok: true, data: {} }
  }),
}))

const { characterPanel } = await import('../../src/identity.jsx')
const { PanelHost, usePanelStack } = await import('../../src/ui.jsx')
const { SearchDoor, WorkDoor } = await import('../../src/personOpen.jsx')

let SEARCHED
let OPENED

const WORK = { kind: 'movie', id: 5, title: 'Anand', media_type: 'movie', castId: 11 }

function Host({ doors }) {
  const stack = usePanelStack()
  useEffect(() => { stack.open(characterPanel(stack, { id: 3, name: CHARACTER.name, work: WORK })) }, [])
  const panel = <PanelHost stack={stack} />
  if (!doors) return panel
  return (
    <WorkDoor open={(kind, id) => { OPENED = { kind, id } }}>
      <SearchDoor open={(scope, chips) => { SEARCHED = { scope, chips } }}>
        {panel}
      </SearchDoor>
    </WorkDoor>
  )
}

const mount = async (doors) => {
  render(<Host doors={doors} />)
  await waitFor(() => expect(document.querySelector('.cs-count')).toBeTruthy())
}

// The counts are the two `.cs-count` cells the pack makes pressable.
const counts = () => [...document.querySelectorAll('.cs-count')]

beforeEach(() => {
  SEARCHED = null
  OPENED = null
  COUNTS = { lines: 12, locators: 3 }
  CHARACTER = {
    id: 3,
    name: 'Dr. Bhaskar K. Bannerjee',
    sort_name: '', description: '', note: '', aliases: [],
    appearances: [{
      cast_id: 11, kind: 'movie', work_id: 5, media_type: 'movie',
      work_title: 'Anand', character: 'Dr. Bhaskar K. Bannerjee',
      actor_id: 9, actor: 'Amitabh Bachchan', actor_image: '',
    }],
    lines: [], shared_lines: 0,
  }
})
afterEach(() => cleanup())

describe('the counts on a character in one work', () => {
  it('open the search the number summarises, with no caller threading it', async () => {
    // THE WHOLE POINT: the panel is opened with `{ id, name, work }` — exactly
    // what every real caller passes — and no search handler at all. It has to
    // find one anyway.
    await mount(true)
    expect(counts().length, 'the pack’s two counts are not drawn').toBeGreaterThan(0)
    act(() => counts()[0].click())
    await waitFor(() => expect(SEARCHED, 'a count pressed and searched nothing').toBeTruthy())
    // Scoped to what the work holds, and carrying the two chips that ARE the
    // question: this character, in this work.
    expect(SEARCHED.scope).toBe('dialogues')
    expect(SEARCHED.chips.map((c) => c.field).sort()).toEqual(['character', 'movie'])
    expect(SEARCHED.chips.find((c) => c.field === 'movie').value).toBe('Anand')
  })

  it('take the panel off the screen on the way, or the reader never sees where they went', async () => {
    // The shell moves its tab UNDERNEATH a panel that is a fixed overlay, so a
    // press that navigates and leaves the panel up is indistinguishable from a
    // press that did nothing — which is how this class of defect was reported
    // three times before it was understood.
    await mount(true)
    act(() => counts()[0].click())
    await waitFor(() => expect(SEARCHED).toBeTruthy())
    await waitFor(() => expect(document.querySelector('.tp-panel'), 'the panel stayed over the screen it opened').toBeNull())
  })

  it('and say they cannot be opened when there is no shell to open them', async () => {
    // The honest degradation the panel's own comment promised and nothing
    // implemented: "a number nobody can open is still the number". A live button
    // with no handler is the one outcome that promise was written to avoid.
    await mount(false)
    expect(counts().length).toBeGreaterThan(0)
    for (const c of counts()) {
      expect(c.getAttribute('aria-disabled'), `${c.textContent} presses and does nothing`).toBe('true')
    }
  })
})
