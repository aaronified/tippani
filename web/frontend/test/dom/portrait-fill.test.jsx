// Portraits fetch themselves, because a screen is about to draw them.
//
// THE REPORT: "people images are not auto fetched still and needs to be manually
// fetched." Which was literally true. The only thing that ever asked for an
// actor's headshot was PersonModal's own effect, which runs when you OPEN one
// person. Twenty credits meant twenty panels opened by hand.
//
// SINCE 3.1.0 A WORK PAGE ASKS ONCE: `POST /{books|movies}/{id}/cast/art` with
// the names it is about to draw, and the server fetches their headshots (and the
// work's missing character art) in that one request, answering how many arrived.
//
// WHAT IS WORTH ASSERTING HERE is not "it fetches" — that is the easy half and
// the obvious one. It is the restraints, every one of which is invisible when it
// breaks:
//
//   * NOTHING when every face is already stored. A page that asks anyway costs a
//     request per page view for ever, and looks identical on screen.
//   * ONCE PER NAME, even for the people it cannot resolve. The naive version —
//     "ask for everyone the map has no picture for" — re-asks on every render for
//     every minor credit with no findable portrait, which is most of them.
//   * NO RELOAD when nothing arrived. A refetch that changes nothing is a request
//     and a re-render, and it is how a quiet loop starts.
//   * ONE REQUEST for the page, not one per face.
//
// DECLARED EXCEPTION, as cast-panel.test.jsx's hook cases declare it: the hook is
// driven on its own rather than through a work page, because the page pulls in
// half the app and what is at issue is which requests are made and when.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

let CALLS
let RESOLVES // name -> does a headshot arrive?

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'POST' && /^\/(books|movies)\/\d+\/cast\/art$/.test(path)) {
      const portraits = (body?.names || []).filter((n) => RESOLVES[n]).length
      return { ok: true, data: { character_images: 0, portraits } }
    }
    return { ok: true, data: {} }
  }),
}))

const { useCastArt } = await import('../../src/cast.jsx')

function Probe({ kind = 'movie', names, people = {}, onFilled }) {
  useCastArt(kind, 7, { cast: [], names, people, onFilled })
  return null
}

const asked = () => CALLS.filter(([m, p]) => m === 'POST' && /cast\/art$/.test(p)).map(([, , b]) => b.names)

beforeEach(() => {
  CALLS = []
  RESOLVES = {}
})

describe('the headshots a work page asks for', () => {
  it('asks for the people this screen has no picture for', async () => {
    RESOLVES = { 'Viola Davis': true }
    const names = ['Viola Davis', 'Margot Robbie']
    render(<Probe names={names} people={{ 'Margot Robbie': { image_path: 'robbie.jpg' } }} />)
    await waitFor(() => expect(asked()).toEqual([['Viola Davis']]))
  })

  // A NAME IS ATTEMPTED ONCE, resolved or not. Re-rendering with the same map —
  // which is exactly what happens when a portrait for somebody ELSE lands — must
  // not start the unresolvable ones over.
  it('does not ask twice for someone it could not resolve', async () => {
    const names = ['A Minor Player']
    const { rerender } = render(<Probe names={names} people={{}} />)
    await waitFor(() => expect(asked()).toEqual([['A Minor Player']]))
    rerender(<Probe names={names} people={{}} />)
    rerender(<Probe names={[...names]} people={{}} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(asked()).toEqual([['A Minor Player']])
  })

})
