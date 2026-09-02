// DISMISSING A SUBMENU MUST NOT DISMISS ITS PARENT.
//
// THE BUG, as reported: "the details peoples menu is getting dismissed if i
// clicked an actor and then dismissed the people screen." Open a work's Details,
// press People, tap an actor — PersonModal opens over the panel — and dismissing
// the person took the People panel with it.
//
// WHY. usePanelStack pushes a history entry per panel, so a phone's back gesture
// is how a panel is dismissed. PersonModal pushed NOTHING, so it was not on the
// stack at all: back skipped straight past it to the entry underneath, which was
// the panel's. The modal vanished only because its parent unmounted.
//
// ui.jsx has had `useBackToClose` for exactly this since the first dialog needed
// it, and FormModal, MobileSheet and the changelog viewer all use it. Five
// dismissible overlays did not. So there are two things to hold here, and the
// second is the one that stops this recurring:
//
//   1. THE ORDERING. With its own entry, one back closes the overlay and leaves
//      the panel; a second back closes the panel. Asserted against jsdom's real
//      session history rather than a mock — these are real pushes and real
//      traversals, which is the only way the interleaving of two independent
//      history users can be wrong.
//
//   2. THE ROLL. A scan naming every overlay that owns a dismissible scrim, and
//      failing on one that does not register. The next overlay is what this is
//      for: nothing about writing a new modal makes you think about the back
//      gesture, and the symptom appears two surfaces away from the cause.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { PanelHost, useBackToClose, usePanelStack } from '../../src/ui.jsx'

const SRC = process.env.TIPPANI_SRC
const read = (f) => readFileSync(join(SRC, f), 'utf8')

beforeEach(() => {
  window.history.replaceState(null, '', '/library')
})

const popped = () => new Promise((r) => window.addEventListener('popstate', r, { once: true }))
const back = async () => {
  const landed = popped()
  window.history.back()
  await act(async () => { await landed })
}

// A submenu, drawn the way every one of the five is: mounted only while open,
// dismissed by its own control, and owning one history entry.
function Submenu({ onClose }) {
  useBackToClose(true, onClose)
  return (
    <div data-testid="submenu">
      <button type="button" onClick={onClose}>dismiss the submenu</button>
    </div>
  )
}

// A parent panel with a control that opens the submenu over it — the shape of
// Details → People → a person.
function Harness() {
  const stack = usePanelStack()
  const [sub, setSub] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => stack.push({
          title: 'People',
          render: () => (
            <div data-testid="panel">
              <button type="button" onClick={() => setSub(true)}>open the submenu</button>
            </div>
          ),
        })}
      >
        open the panel
      </button>
      <PanelHost stack={stack} />
      {sub && <Submenu onClose={() => setSub(false)} />}
    </>
  )
}

const panel = () => screen.queryByTestId('panel')
const submenu = () => screen.queryByTestId('submenu')

const openBoth = async () => {
  render(<Harness />)
  await act(async () => { fireEvent.click(screen.getByText('open the panel')) })
  expect(panel(), 'the panel did not open').toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByText('open the submenu')) })
  expect(submenu(), 'the submenu did not open').toBeTruthy()
}

describe('a submenu over a panel', () => {
  it('is dismissed by Back without taking the panel with it', async () => {
    await openBoth()
    await back()
    // THE WHOLE BUG, in two assertions. Before the fix the first was already
    // true — the submenu went — and the second was false.
    expect(submenu(), 'the submenu survived its own dismissal').toBeNull()
    expect(panel(), 'dismissing the submenu dismissed its parent').toBeTruthy()
  })

  it('hands the panel back to Back once it is gone', async () => {
    await openBoth()
    await back()
    await back()
    expect(panel(), 'the panel would not close on the second press').toBeNull()
  })

  it('leaves the panel alone when the submenu is dismissed by its own control', async () => {
    await openBoth()
    // Not every dismissal is a back gesture, and this is the half that already
    // worked: the entry has to be CONSUMED on unmount, or the panel's own Back
    // stops working because a dead entry sits on top of it.
    //
    // The consumption IS a traversal — the hook's cleanup calls history.back()
    // to hand the marker in — and jsdom queues traversals, so the test has to
    // let that one land before pressing Back itself. Otherwise the two races and
    // the press that closes the panel is spent unwinding the marker.
    const consumed = popped()
    await act(async () => { fireEvent.click(screen.getByText('dismiss the submenu')) })
    await act(async () => { await consumed })
    expect(submenu()).toBeNull()
    expect(panel(), 'the panel went with it').toBeTruthy()
    // And the panel is still the thing Back closes — proof the marker was given
    // back rather than stranded.
    await back()
    expect(panel(), 'the panel would not close, so the submenu stranded its entry').toBeNull()
  })
})

// ── THE ROLL.
//
// Named per overlay rather than counted: the fix is always one line, and knowing
// WHICH surface is missing it is the whole of the work. `ui.jsx` is excluded
// because it is where the hook lives; a scrim in there is a primitive that its
// callers gate (FormModal and MobileSheet both register for themselves).
describe('every dismissible overlay owns a back entry', () => {
  const OVERLAYS = [
    ['people.jsx', 'PersonModal'],
    ['AddSurface.jsx', 'ManualPopup'],
    ['AddSurface.jsx', 'AddSurface'],
    ['ReverifyReview.jsx', 'ReverifyFlow'],
    ['SearchPage.jsx', 'QuoteModal'],
    ['Settings.jsx', 'PromptFrame'],
    ['share.jsx', 'ShareDialog'],
  ]

  it.each(OVERLAYS)('%s: %s registers one', (file, component) => {
    const src = read(file)
    const at = src.indexOf(`function ${component}(`)
    expect(at, `${component} is not in ${file} any more — update this roll`).toBeGreaterThan(-1)
    // The registration has to be inside the component, so the search starts at
    // its declaration rather than at the top of the file.
    const body = src.slice(at, at + 4000)
    expect(
      /useBackToClose\(/.test(body),
      `${component} draws a dismissible overlay and pushes no history entry, so ` +
        'the press that dismisses it will dismiss whatever opened it. One line: ' +
        'useBackToClose(<open>, onClose).',
    ).toBe(true)
  })

  // The scan above can only check the files it lists, so this is what notices a
  // SIXTH overlay appearing. Every `tp-scrim` outside ui.jsx belongs to a
  // surface on the roll — a new one means a new row, and a new row means somebody
  // asked the question.
  it('has no scrim outside the roll', () => {
    const listed = new Set(OVERLAYS.map(([f]) => f))
    const { readdirSync } = require('node:fs')
    const stray = []
    for (const f of readdirSync(SRC)) {
      if (!f.endsWith('.jsx') || f === 'ui.jsx' || listed.has(f)) continue
      const src = readFileSync(join(SRC, f), 'utf8')
      // `tp-scrim-deep` is a BADGE over artwork, not an overlay — works.jsx
      // carries two and neither is dismissible.
      if (/["'`][^"'`]*\btp-scrim\b(?!-)/.test(src)) stray.push(f)
    }
    expect(stray, `these draw a scrim and are not on the roll above: ${stray.join(', ')}`).toEqual([])
  })
})
