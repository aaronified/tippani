// GIVING FOCUS BACK MAY NOT MOVE THE PAGE.
//
// THE OWNER'S REPORT, from their own phone: "when the popup is dismissed, it
// resets the scroll level of the master page. that is unacceptable."
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing about how it was repaired:
//
//  * `HTMLElement.focus()` scrolls its target into view. That is the platform's
//    default; it cannot be argued with, only asked not to happen.
//  * The default is RIGHT when focus is a DESTINATION — a field the reader is
//    about to type in, a menu item the arrow keys just moved to — because a
//    destination the reader cannot see is worse than a scroll.
//  * It is WRONG when focus is being handed BACK after a popover, a menu or a
//    panel closes. By then the reader may have scrolled elsewhere, and the page
//    leaps to wherever the anchor now is. Measured in Chromium at 390px on a work
//    page: open the shelf chip's popover, scroll the page behind it to 600px,
//    press Escape, land at 0.
//
// SO THE RULE IS: FOCUS IS EITHER A DESTINATION OR A RESTORE, A RESTORE GOES
// THROUGH ONE FUNCTION, AND THE DESTINATIONS ARE COUNTED. It was four copies of
// the restore — the shelf chip, the colour menu and the action menu twice — and
// three of the four were wrong while `tour.jsx` had been right on its own since
// it was written. That is the repo's directive about two things that look the
// same, in its usual shape.
//
// A COUNT, AND NOT ONLY A PATTERN, and the reason is that the pattern version of
// this file was defeated three times over by a rater. It matched one line at a
// time, so the identical defect written across two lines passed; it keyed on
// `onEscape`, so the same restore under `onClose` passed; and it looked for the
// shared function by name, so a SECOND helper doing the wrong thing passed —
// which is exactly the failure the rule exists to prevent. A ceiling cannot be
// slipped past by any of those, because all three ADD a `.focus(` to the tree.
// The number may fall and never rise, the same idiom as
// `scripts/screenshots/typescale-baseline.json` and `spacing-debt.test.js`: a new
// one is either routed through the shared restore, which does not move the count,
// or it is a destination and somebody says so here on purpose.
//
// A SWEEP RATHER THAN A RENDER, because jsdom does not scroll: `focus()` there
// moves nothing whatever you pass it, so no rendered test in this suite can tell
// a restore that scrolls from one that does not. The behaviour is measured by
// `scripts/screenshots/overlay-scroll.mjs` in a real browser.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { sourcesUnder } from '../src-files.js'

const SRC = process.env.TIPPANI_SRC
const read = (f) => readFileSync(join(SRC, f), 'utf8')
// Comments describe the defect and name the API; left in, they would be counted
// as instances of it.
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const files = () => sourcesUnder((n) => n.endsWith('.jsx') || n.endsWith('.js'), 40)

// `el.focus()`, `ref.current?.focus()`, `x?.focus?.()` — every way the call is
// spelled in this tree.
const CALL = /\.focus\s*\??\.?\s*\(/g

// THE SHARED RESTORE, found by what it does rather than by its name: the one
// function whose whole body is a focus call that asks not to scroll. A rename
// keeps this test working; a second helper does not, because the count catches it.
const SHARED = /export function (\w+)\s*\([^)]*\)\s*\{\s*[^;{}]*\.focus\s*\??\.?\s*\(\s*\{[^}]*preventScroll[^}]*\}\s*\)\s*;?\s*\}/

// EVERY FOCUS THAT IS A DESTINATION, counted. Twelve today: two search boxes, a
// tag card's field, a jump-to-field on the identity screen, the cloze blank, the
// tour card, a chip row's own input, an inline editor, three keyboard-roving calls
// inside menus and button groups, and the action menu's TAB-OUT. Every one of them
// SHOULD scroll its target into view — that is what a destination is.
//
// THE TAB-OUT IS THE INTERESTING ONE, and it is the same anchor as the Escape
// beside it. Escape is a reader saying "put this away", so moving the page under
// them is the defect this file is about. Tab is a reader NAVIGATING: they are
// asking where focus goes next, and keyboard focus landing off screen is worse
// than a scroll, because nothing on the page says where the caret went. One
// element, two acts, and only one of them is a restore.
const DESTINATIONS = 12

function counts() {
  let calls = 0
  let inShared = 0
  let shared = null
  for (const f of files()) {
    const body = code(read(f))
    calls += (body.match(CALL) || []).length
    const m = body.match(SHARED)
    if (m) {
      shared = { file: f, name: m[1] }
      inShared += (m[0].match(CALL) || []).length
    }
  }
  return { calls, inShared, shared, destinations: calls - inShared }
}

describe('focus', () => {
  it('is asked for in exactly as many places as there are destinations', () => {
    const { destinations, shared } = counts()
    expect(shared, 'there is no shared restore that asks the browser not to scroll').toBeTruthy()
    expect(destinations,
      `${destinations} places call focus() directly, against ${DESTINATIONS} known destinations. ` +
      'A NEW one is either a restore — route it through the shared function, which does not move this number — ' +
      'or a genuine destination, in which case raise the count here and say which it is. ' +
      'A restore that calls focus() itself scrolls the page to wherever its anchor has got to.')
      .toBe(DESTINATIONS)
  })

  it('goes through one function when it is being handed back', () => {
    const { shared } = counts()
    const users = files().filter((f) => new RegExp(`\\b${shared.name}\\s*\\(`).test(code(read(f))))
    expect(users.length,
      'nothing calls the shared restore, so the count above is measuring an app that does not hand focus back at all')
      .toBeGreaterThan(0)
    // AND THERE IS ONLY ONE OF THEM. A second helper spelled the same way is the
    // defect this rule exists to prevent, one level up — and it was how the
    // pattern version of this file was defeated.
    let helpers = 0
    for (const f of files()) {
      helpers += (code(read(f)).match(new RegExp(SHARED.source, 'g')) || []).length
    }
    expect(helpers, 'more than one function hands focus back without scrolling, so the two can drift apart').toBe(1)
  })

  // AND THE OBVIOUS SHAPE IS STILL NAMED, because a count says the number is
  // wrong and this says which line to look at.
  //
  // THE DISMISSAL HANDLERS ONLY, and not anything whose name merely contains the
  // word: this matched `returnFocus[A-Za-z]*` for one revision and so reported
  // `returnFocusTo?.current?.focus()` — the action menu's Tab-out, a destination
  // argued at its own site — as a defect. A sweep that flags the correct code is a
  // sweep somebody switches off.
  it('is not spelled at a dismissal by the dismissal itself', () => {
    const spelled = []
    for (const f of files()) {
      for (const line of code(read(f)).split('\n')) {
        if (!/\.focus\s*\??\.?\s*\(/.test(line)) continue
        if (!/\b(onEscape|onDismiss|onClose)\s*:/.test(line)) continue
        if (/preventScroll/.test(line)) continue
        spelled.push(`${f}: ${line.trim().slice(0, 90)}`)
      }
    }
    expect(spelled,
      'these hand focus back by calling focus() themselves, so each one scrolls the page to wherever its anchor now is — the reader closes a popover and loses their place')
      .toEqual([])
  })
})
