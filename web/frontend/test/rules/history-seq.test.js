// EVERY HISTORY ENTRY THIS APP PUSHES CARRIES A SERIAL.
//
// THE DEFECT THIS EXISTS FOR IS A JUMP THAT LANDS ON A PANEL. Holding the phone
// dock's Back key offers the screens behind this one, and picking one is a real
// `history.go(-k)` — the browser's own stack, rewound, so the device's Back walks
// on from there. `k` is the difference of two entries' `tpSeq`, and that
// arithmetic is only true while EVERY entry in the stack has one.
//
// Panels and overlays push entries too (`usePanelStack.push`, `useBackToClose`),
// and neither of them is a screen. A push site that forgets `stampPush` leaves a
// gap: the serials still count up, but they no longer count ENTRIES, so `go(-k)`
// stops one short and lands on somebody's panel entry. The address does not
// change, the shell reads the pop as an overlay dismissal and returns early, and
// the reader's press does nothing at all — the hardest class of defect to see,
// because the control looks unwired rather than wrong.
//
// A SCANNER RATHER THAN A TEST OVER THE APP, because the claim is about a line
// that does not exist yet: the next pushState somebody writes. No render can
// assert about code nobody has added. It reads source text, which is this
// directory's declared exception.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SRC, sourcesUnder } from '../src-files.js'

// The shared walk, because a guard over an empty tree reports no violations and
// means nothing — see test/src-files.js for the two that were caught that way.
const files = sourcesUnder()
const text = (rel) => readFileSync(join(SRC, rel), 'utf8')

// Each pushState call site, as `file:line` plus the text that follows the open
// paren on the same line and the next — enough to see whether the state object is
// a `stampPush(...)` call, and not so much that a later argument can fake it.
const pushes = files.flatMap((rel) => {
  const lines = text(rel).split('\n')
  return lines.flatMap((line, i) =>
    line.includes('history.pushState')
      ? [{ at: `${rel}:${i + 1}`, head: `${line}\n${lines[i + 1] || ''}` }]
      : [],
  )
})

describe('the session history', () => {
  it('found push sites at all, so this file cannot pass by finding nothing', () => {
    // Three today: pushRoute, the overlay marker, the panel marker. The number is
    // a floor rather than a ceiling — a fourth is allowed, it just has to stamp.
    expect(pushes.length, 'no history.pushState found; the scan is broken').toBeGreaterThanOrEqual(3)
  })

  it('stamps a serial on every entry it pushes', () => {
    const bare = pushes.filter((p) => !/stampPush\s*\(/.test(p.head)).map((p) => p.at)
    expect(
      bare,
      `these pushState calls write an entry with no tpSeq on it, which breaks the\n` +
        `distance arithmetic the dock's Back trail uses. Wrap the state object in\n` +
        `stampPush() from history.js:\n  ${bare.join('\n  ')}`,
    ).toEqual([])
  })

  // stampPush reads the CURRENT entry's serial and adds one. A second definition —
  // a copy in a component, a local helper that does the same thing — is how one of
  // them goes on being right while the other quietly stops counting.
  it('keeps the serial in one function', () => {
    expect(files.filter((rel) => /function stampPush\b/.test(text(rel)))).toEqual(['history.js'])
  })
})
