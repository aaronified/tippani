// GIVING FOCUS BACK MAY NOT MOVE THE PAGE.
//
// THE OWNER'S REPORT, from their own phone: "when the popup is dismissed, it
// resets the scroll level of the master page. that is unacceptable."
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing about how it was repaired:
//
//  * `HTMLElement.focus()` scrolls its target into view. That is the platform's
//    default and it cannot be argued with — only asked not to happen.
//  * That default is RIGHT when focus is a destination: a field the reader is
//    about to type in should be brought to them.
//  * It is WRONG every time focus is being handed BACK after a popover, a menu or
//    a panel closes, because by then the reader may have scrolled elsewhere and
//    the page leaps to wherever the anchor now is. Measured in Chromium at 390px
//    on a work page: open the shelf chip's popover, scroll the page behind it to
//    600px, press Escape, land at 0.
//
// SO THE RULE, and it is the repo's own directive about two things that look the
// same rather than a new one: RESTORING FOCUS IS ONE VERB AND LIVES IN ONE
// FUNCTION. It was four copies — the shelf chip, the colour menu and the action
// menu twice — and all four scrolled, which is exactly how a line-each verb goes
// wrong in three places while looking right in the fourth.
//
// A SWEEP RATHER THAN A RENDER, because jsdom does not scroll: `focus()` there
// moves nothing whatever you pass it, so no rendered test in this suite can tell
// a restore that scrolls from one that does not. What is checkable everywhere is
// that no dismissal spells the restore itself. The behaviour is measured by
// `scripts/screenshots/chip-door.mjs` in a real browser.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { sourcesUnder } from '../src-files.js'

const SRC = process.env.TIPPANI_SRC
const read = (f) => readFileSync(join(SRC, f), 'utf8')
// Comments describe the defect and would otherwise be reported as it.
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const files = () => sourcesUnder((n) => n.endsWith('.jsx') || n.endsWith('.js'), 40)

// A restore, as opposed to a destination. The three shapes the app uses to say
// "put focus back where it was": an Escape handler, a Tab-out of a menu, and
// anything named for returning focus.
const RESTORE = /(onEscape\s*:[^\n]*|returnFocus[A-Za-z]*\s*\??\.?[^\n]*|onDismiss\s*:[^\n]*)\.focus\s*\(/

describe('handing focus back', () => {
  it('is not spelled at the call site by anything that dismisses', () => {
    const spelled = []
    for (const f of files()) {
      const body = code(read(f))
      for (const line of body.split('\n')) {
        if (!/\.focus\s*\(/.test(line)) continue
        if (!RESTORE.test(line)) continue
        if (/preventScroll/.test(line)) continue
        spelled.push(`${f}: ${line.trim().slice(0, 90)}`)
      }
    }
    expect(spelled,
      'these hand focus back by calling focus() themselves, so each one scrolls the page to wherever its anchor now is — the reader closes a popover and loses their place')
      .toEqual([])
  })

  it('goes through one function, and that function asks not to scroll', () => {
    // The claim above is only worth having if the shared verb exists and is the
    // thing being used; a run where nobody restored focus at all would satisfy it
    // vacuously.
    const ui = read('ui.jsx')
    const decl = ui.match(/export function returnFocus\s*\([^)]*\)\s*\{[^}]*\}/)
    expect(decl, 'there is no shared function for handing focus back').toBeTruthy()
    expect(decl[0],
      'the shared restore does not ask the browser to leave the page alone, so every caller scrolls')
      .toMatch(/preventScroll/)
    const users = files().filter((f) => /returnFocus\s*\(/.test(code(read(f))))
    expect(users.length, 'nothing calls the shared restore, so the sweep above is passing over an app that does not do this')
      .toBeGreaterThan(0)
  })

  // AND FOCUS AS A DESTINATION IS LEFT ALONE. A field the reader is about to type
  // in SHOULD be scrolled to; a sweep that banned focus() outright would be
  // banning the correct use with the incorrect one.
  it('leaves focus-as-a-destination scrolling, which is what it is for', () => {
    const destinations = []
    for (const f of files()) {
      const body = code(read(f))
      for (const line of body.split('\n')) {
        if (!/\.focus\s*\(/.test(line)) continue
        if (RESTORE.test(line)) continue
        if (/input|textarea|contenteditable|Ref\.current\?\.focus|btns\[|all\[/i.test(line)) destinations.push(f)
      }
    }
    expect(destinations.length,
      'no site focuses a field to type in, so this suite has lost track of which uses are which')
      .toBeGreaterThan(0)
  })
})
