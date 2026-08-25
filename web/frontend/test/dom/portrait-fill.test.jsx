// Portraits fetch themselves, because a screen is about to draw them.
//
// THE REPORT: "people images are not auto fetched still and needs to be manually
// fetched." Which was literally true. `POST /people/portrait` has existed for
// many releases and resolves an actor's headshot from the cast row the library
// already holds — and the only caller was PersonModal's own effect, which runs
// when you OPEN one person. Twenty credits meant twenty panels opened by hand.
//
// WHAT IS WORTH ASSERTING HERE is not "it fetches" — that is the easy half and
// the obvious one. It is the three restraints, every one of which is invisible
// when it breaks:
//
//   * NOTHING when every face is already stored. A hook that asks anyway costs a
//     request per person per page view for ever, and looks identical on screen.
//   * ONCE PER NAME, even for the people it cannot resolve. The naive version —
//     "ask for everyone the map has no picture for" — re-asks on every render for
//     every minor credit with no findable portrait, which is most of them.
//   * NO RELOAD when nothing arrived. A refetch that changes nothing is a request
//     and a re-render, and it is how a quiet loop starts.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

let CALLS
let RESOLVES // name -> did a picture arrive?

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'POST' && path === '/people/portrait') {
      return { ok: true, data: { resolved: true, image: !!RESOLVES[body.name] } }
    }
    return { ok: true, data: {} }
  }),
}))

const { usePortraitFill } = await import('../../src/credits.jsx')

function Probe({ kind = 'actor', names, people = {}, onFilled }) {
  usePortraitFill(kind, names, people, onFilled)
  return null
}

const portraitsFor = () => CALLS.filter(([m, p]) => m === 'POST' && p === '/people/portrait').map(([, , b]) => b.name)

beforeEach(() => {
  CALLS = []
  RESOLVES = {}
})

describe('usePortraitFill', () => {
  it('asks for the people this screen has no picture for', async () => {
    RESOLVES = { 'Viola Davis': true }
    const names = ['Viola Davis', 'Margot Robbie']
    render(<Probe names={names} people={{ 'Margot Robbie': { image_path: 'robbie.jpg' } }} />)
    await waitFor(() => expect(portraitsFor()).toEqual(['Viola Davis']))
  })

  // THE FREE CASE, and the reason this can sit on every work page: the caller
  // already holds the map, so it can tell there is nothing to do without asking.
  it('makes no request when every face is already stored', async () => {
    const names = ['Viola Davis']
    render(<Probe names={names} people={{ 'Viola Davis': { image_path: 'davis.jpg' } }} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(portraitsFor()).toEqual([])
  })

  // A NAME IS ATTEMPTED ONCE, resolved or not. Re-rendering with the same map —
  // which is exactly what happens when a portrait for somebody ELSE lands — must
  // not start the unresolvable ones over.
  it('does not ask twice for someone it could not resolve', async () => {
    RESOLVES = {} // nobody resolves
    const names = ['A Minor Player']
    const { rerender } = render(<Probe names={names} people={{}} />)
    await waitFor(() => expect(portraitsFor()).toEqual(['A Minor Player']))
    rerender(<Probe names={names} people={{}} />)
    rerender(<Probe names={[...names]} people={{}} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(portraitsFor()).toEqual(['A Minor Player'])
  })

  it('tells the caller once, after the last one lands', async () => {
    RESOLVES = { 'Viola Davis': true, 'Margot Robbie': true }
    let filled = 0
    const names = ['Viola Davis', 'Margot Robbie']
    render(<Probe names={names} people={{}} onFilled={() => { filled += 1 }} />)
    await waitFor(() => expect(filled).toBe(1))
    expect(portraitsFor()).toEqual(['Viola Davis', 'Margot Robbie'])
  })

  it('says nothing when nothing arrived', async () => {
    RESOLVES = {}
    let filled = 0
    const names = ['Nobody At All']
    render(<Probe names={names} people={{}} onFilled={() => { filled += 1 }} />)
    await waitFor(() => expect(portraitsFor()).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 0))
    expect(filled).toBe(0)
  })

  // A BOOK HAS NO ACTORS, and asking for a kind the API refuses would be a
  // request per book opened whose answer nothing could read. The empty kind is
  // how the cast panel says "this work has no second column".
  it('asks for nothing when there is no kind', async () => {
    const names = ['Somebody']
    render(<Probe kind="" names={names} people={{}} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(portraitsFor()).toEqual([])
  })

  // SERIAL, not twenty connections at once from a self-hosted box. Asserted by
  // the order they arrive in, which a parallel fan-out would not guarantee.
  it('asks one at a time', async () => {
    RESOLVES = { A: true, B: true, C: true }
    const names = ['A', 'B', 'C']
    render(<Probe names={names} people={{}} />)
    await waitFor(() => expect(portraitsFor()).toHaveLength(3))
    expect(portraitsFor()).toEqual(['A', 'B', 'C'])
  })
})
