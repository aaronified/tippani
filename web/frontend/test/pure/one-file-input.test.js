// ONE FILE INPUT IN THE APP, AND IT IS THE PRIMITIVE'S.
//
// Ten `<input type="file">` lived across eight files in two idioms, and the rule
// they were meant to share had already drifted in two ways that no test could see:
//
//   THE RESET. Eight cleared the input's value after a pick and TWO did not, so on
//   a board's cover and on the restore screen, choosing a file, thinking better of
//   it and choosing THE SAME FILE AGAIN did nothing at all — the browser has no new
//   value to report, so `change` never fires a second time.
//
//   THE HIDING. A label-wrapped picker has no focusable control of its own: the
//   input IS the control and the label is its face. Three of the five hid it with
//   `display: none`, which takes it out of the tab order and leaves the whole
//   control unreachable by keyboard. The two that used `sr-only` carried a comment
//   saying why, and the comment did not travel with the copies.
//
// Both are one line, both are invisible when missing, and both are exactly what
// gets left out of the ninth copy. So there is one input, in ui.jsx, and this
// refuses a second.

import { describe, expect, it } from 'vitest'
import { readSource, sourcesUnder } from '../src-files.js'

// THROUGH THE SHARED WALK, like every other source-reading guard here — see
// one-walk.test.js for why a second readdir is refused, and for why a walk that
// silently finds nothing is the failure mode that matters.
function inputsOutsideUi() {
  const found = []
  for (const file of sourcesUnder((n) => n.endsWith('.jsx'), 20)) {
    if (file.endsWith('ui.jsx')) continue
    const src = readSource(file)
    for (const m of src.matchAll(/<input[^>]*type="file"/gs)) {
      found.push(`${file}:${src.slice(0, m.index).split('\n').length}`)
    }
  }
  return found
}

describe('picking a file', () => {
  it('happens through one input, and ui.jsx owns it', () => {
    expect(
      inputsOutsideUi(),
      'a hand-rolled file input — use FilePick (a label IS the button) or useFilePick (a button opens it)',
    ).toEqual([])
  })

  it('and that input is in the tree to be found at all', () => {
    // A REGEX THAT MATCHES NOTHING PASSES SILENTLY. If the primitive is renamed or
    // rewritten and this pattern stops fitting, the case above starts reporting
    // success over a file it can no longer read.
    expect(readSource('ui.jsx')).toMatch(/<input[^>]*type="file"/s)
  })

  it('and the label form is reachable by keyboard', () => {
    // `sr-only`, never `hidden`: see the header. Asserted on the SOURCE because the
    // bug is a class name, and a DOM test would need a real stylesheet to tell the
    // two apart.
    const ui = readSource('ui.jsx')
    const pick = ui.slice(ui.indexOf('export function FilePick'), ui.indexOf('export function useFilePick'))
    expect(pick, 'FilePick hid its input with display:none — the control is then keyboard-dead').toContain('sr-only')
    expect(pick).not.toMatch(/hide: "hidden"/)
  })

  it('and the input clears itself before the handler runs', () => {
    // BEFORE, not after: the handler is usually async and usually awaits an upload,
    // so clearing afterwards leaves the input holding the old value for the whole
    // of that upload.
    const ui = readSource('ui.jsx')
    const fn = ui.slice(ui.indexOf('function filePickInput'), ui.indexOf('export function FilePick'))
    const cleared = fn.indexOf('e.target.value = ""')
    const handed = fn.indexOf('onFiles(')
    expect(cleared, 'the shared input never clears its value').toBeGreaterThan(-1)
    expect(cleared, 'the value is cleared after the handler, not before').toBeLessThan(handed)
  })
})
