// Every screen mounts.
//
// THIS FILE EXISTS BECAUSE 1.13.0 SHIPPED A QUOTES SCREEN THAT THREW ON SIGHT.
// The board memo was written below the three memos that name it in their
// dependency arrays, and a dependency array is not a closure — it is built the
// moment the line runs, so `board` was read inside its own temporal dead zone and
// the whole page died with "can't access lexical declaration 'Se' before
// initialisation". Not a data bug and not an edge: every render, every library,
// empty or full.
//
// The suite had ten tests touching that file and none of them caught it, for a
// reason worth naming: every one of them imported a FUNCTION out of the module —
// groupUtterances, utteranceState, utteranceMeta, utteranceYear. Pulling the
// logic out of a component to test it is right, and it is exactly what left the
// component itself unexecuted. A page can be wholly broken while every extracted
// piece of it is green.
//
// So this is a smoke test, and it is deliberately shallow: it asserts that each
// screen can be put on a page. It makes no claim about what the screen shows —
// the screens that need that have their own files.
//
// The screen table itself lives in test/screens.js, because this file is no longer
// the only one that needs it — screens-i18n.test.jsx renders the same list under
// the pseudo-locale.
//
// The api is mocked to FAIL rather than to return empty collections. Two reasons.
// A failed load needs no invented payload shape, so this file does not silently
// become the place where eleven response formats are guessed at and then rot. And
// it exercises the state every screen must survive and nobody tests by hand: the
// server said no. A first-render throw like the one above happens before any
// fetch settles, so the mock's answer is irrelevant to catching it.

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { SCREENS, screenLabelsInApp } from '../screens.js'

// Every request refused, and refused the way api.js reports a refusal so the
// screens take their real error branch rather than an impossible one.
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: false, status: 500, error: 'refused by the mock' })),
  downloadPost: vi.fn(async () => ({ ok: false, status: 500, error: 'refused by the mock' })),
}))

describe('every screen App can route to', () => {
  it('is in the table, and nothing in it is a screen App dropped', () => {
    const inApp = screenLabelsInApp()
    expect(inApp.length).toBeGreaterThan(8) // the regex still finds them
    expect(inApp).toEqual(Object.keys(SCREENS).sort())
  })

  // One case per screen rather than a loop with one assertion, so a failure names
  // the screen in its own line instead of collapsing thirteen into one red test.
  for (const [key, [load, name, props]] of Object.entries(SCREENS)) {
    it(`${key} mounts`, async () => {
      const Screen = (await load())[name]
      expect(Screen, `${key} has no ${name} export`).toBeTypeOf('function')
      // React logs a component stack to console.error before rethrowing, which
      // is noise for an expected-to-pass test and misleading in a suite log.
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect(() => render(<Screen {...props} />)).not.toThrow()
      } finally {
        quiet.mockRestore()
      }
    })
  }
})
