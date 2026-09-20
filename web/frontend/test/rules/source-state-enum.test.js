// THE FOUR WORDS A SUPPLIER'S KEY CAN BE IN, ASKED OF ALL THREE PLACES THAT SPELL
// THEM.
//
// THE BUG THIS EXISTS FOR SHIPPED, and it shipped past two green tests. The server
// named the built-in-key state `bundled`; the screen's vocabulary is `builtin` —
// the stylesheet's `.is-src-builtin`, `SRC_STATE_WORD`'s locale key, and the pack's
// own `SRC_STATE`. So on an official build, the only kind with a key compiled in,
// the mark had no colour rule and its accessible name read "TMDB — " with the state
// missing out of the middle. The Go test asserted the word on the wire; the browser
// journey ran in a world with no built-in key; each was right about its own half.
//
// AND THE FIRST ATTEMPT AT A GUARD DID NOT GUARD IT. A dom case that renders four
// states hardcodes its own four strings, so setting the Go constant back to
// `bundled` left it green — a rating caught that too. What has to be compared is
// the three LISTS, which is what this does. It reads all three rather than holding
// a list of its own: a list typed here would have been typed by whoever got one of
// the others wrong.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SRC } from '../src-files.js'

const read = (...p) => readFileSync(join(SRC, ...p), 'utf8')

describe('the state a supplier’s key is in', () => {
  it('is spelled the same in the server, the stylesheet and the accessible name', () => {
    // The Go consts, by the value each is declared with.
    const go = [...read('..', '..', '..', 'internal', 'httpapi', 'metadata_sources.go')
      .matchAll(/srcState[A-Za-z]+\s*=\s*"([a-z]+)"/g)].map((m) => m[1]).sort()
    // The words the mark can say, from the table that turns a state into one.
    const words = read('ui.jsx').match(/const SRC_STATE_WORD = \{([^}]*)\}/)
    // The hues the stylesheet has a rule for.
    const css = [...read('index.css').matchAll(/\.is-src-([a-z]+)\s*\{/g)].map((m) => m[1]).sort()

    expect(go.length, 'no Go state constants found — this scanner is checking nothing').toBeGreaterThan(3)
    expect(words, 'no SRC_STATE_WORD table found — this scanner is checking nothing').toBeTruthy()
    const spoken = [...words[1].matchAll(/^\s*([a-z]+):/gm)].map((m) => m[1]).sort()

    expect(spoken, 'a state the server can send that the mark cannot say in words').toEqual(go)
    expect(css, 'a state the server can send that the stylesheet has no colour for').toEqual(go)
  })
})
