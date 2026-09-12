// EVERY DIALOG'S ACCESSIBLE NAME GOES THROUGH ONE FUNCTION.
//
// `ariaLabelText` exists because a title may be a node rather than a string, and
// `aria-label={someNode}` stringifies to "[object Object]" — an accessible name that
// says nothing, on the one element whose whole job is to say what the dialog is.
//
// THE HELPER'S OWN COMMENT ALREADY SAID WHY, AND THE COMMIT THAT WROTE IT LEFT FOUR
// SITES OUT. "A line each is how one of them goes on being right while the other
// quietly stops" — and `FormModal` was guarding its sub-sheet branch and not its
// centred one, the same component and the same prop, found by a rater rather than by
// anything here. A rule with no counter is a rule that drifts, so this is the counter.
//
// NO CALLER PASSES A NODE TODAY, which is why nothing was visibly broken and why this
// file is a ratchet rather than a bug report: it holds the asymmetry closed for the
// caller who eventually does.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SRC, sourcesUnder } from '../src-files.js'
import { ariaLabelText } from '../../src/ui.jsx'

// The shared walk, which throws rather than returning a short list — a sweep that can
// come back empty is a gate that has never once read a source file.
const sources = () => sourcesUnder((n) => /\.jsx$/.test(n), 20)

describe('a dialog’s accessible name', () => {
  it('is never the raw title prop', () => {
    const bare = []
    for (const rel of sources()) {
      const text = readFileSync(join(SRC, rel), 'utf8')
      text.split('\n').forEach((line, i) => {
        // The bare form only. `aria-label={ariaLabelText(title)}` is the fixed one and
        // must not match, so the test is anchored on the closing brace.
        if (/aria-label=\{title\}/.test(line)) bare.push(`${rel}:${i + 1}`)
      })
    }
    expect(bare).toEqual([])
  })

  it('drops a title that is not a string rather than stringifying it', () => {
    // The behaviour the sweep above is protecting, asserted once so a reader of this
    // file does not have to go and find out what the helper does.
    expect(ariaLabelText('Language marks')).toBe('Language marks')
    expect(ariaLabelText({ type: 'span' })).toBeUndefined()
    expect(ariaLabelText(undefined)).toBeUndefined()
  })
})
