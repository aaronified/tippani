// A TABLIST HAS TO ANSWER THE ARROW KEYS, AND THIS ONE DID NOT.
//
// FOUND WHILE CHECKING MY OWN PROSE, which is worth recording because the defect
// and the way it surfaced are the same story. A changelog entry claimed "the
// pickers and toggles answer arrow keys". The pickers do — `ColorSwatches` has an
// `onKey` that moves focus with a wrap. The toggles did not: a grep over
// `Toggle`'s whole body found no `onKeyDown` and no `ArrowRight` anywhere in it.
// The sentence was corrected first (465e4da2); this closes the gap it described.
//
// IT WAS NEVER A BARRIER, which is why it is a fix rather than a bug. Every
// option is a real <button role="tab"> and could always be reached with Tab and
// pressed with Enter or Space. What was wrong is the CONTRACT: ARIA's tabs
// pattern puts ONE tab stop on a tablist and moves between its tabs with the
// arrows, so a screen reader announcing "tab, 2 of 4" was offering a gesture the
// widget ignored — and reaching the fourth option cost four Tab presses through
// a control the pattern says should cost one.
//
// MANUAL ACTIVATION, NOT AUTOMATIC, and the reason is not only consistency with
// `ColorSwatches`. Selecting as focus passes would fire `onChange` for every
// option arrowed THROUGH, and these toggles save — so arrowing from the first
// setting to the fourth would write three settings the reader never chose.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Toggle } from '../../src/ui.jsx'
import { SRC } from '../src-files.js'

const OPTIONS = [['a', 'Alpha'], ['b', 'Beta'], ['c', 'Gamma'], ['d', 'Delta']]

function draw(value = 'b', onChange = () => {}) {
  render(<Toggle value={value} onChange={onChange} options={OPTIONS} ariaLabel="Pick one" />)
  return [...document.querySelectorAll('[role="tab"]')]
}

describe('the toggle a keyboard meets', () => {
  it('is one tab stop, parked on the option that is chosen', () => {
    const tabs = draw('c')
    expect(tabs.map((b) => b.tabIndex), 'every option is its own tab stop again')
      .toEqual([-1, -1, 0, -1])
  })

  it('and never falls out of tab order when the value matches nothing', () => {
    // A filter sitting at "all", or a value cleared by a newer client. A group
    // with no tabbable member is a control a keyboard cannot reach at all —
    // strictly worse than the four tab stops this replaced.
    const tabs = draw('nothing-like-this')
    expect(tabs.filter((b) => b.tabIndex === 0), 'no option is tabbable').toHaveLength(1)
    expect(tabs[0].tabIndex, 'the fallback tab stop is not the first option').toBe(0)
  })

  it('moves focus along the row on Left and Right', async () => {
    const user = userEvent.setup()
    const tabs = draw('b')
    tabs[1].focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement, 'ArrowRight did not move focus').toBe(tabs[2])
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement, 'ArrowLeft did not move focus').toBe(tabs[0])
  })

  it('and on Up and Down, because a toggle can be drawn either way round', async () => {
    const user = userEvent.setup()
    const tabs = draw('a')
    tabs[0].focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(tabs[1])
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(tabs[0])
  })

  it('wraps at both ends rather than stopping dead', async () => {
    const user = userEvent.setup()
    const tabs = draw('a')
    tabs[0].focus()
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement, 'the row did not wrap backwards').toBe(tabs[3])
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement, 'the row did not wrap forwards').toBe(tabs[0])
  })

  it('CHOOSES NOTHING on the way past — the reason activation is manual', async () => {
    // THE CASE THIS PATTERN WAS PICKED FOR. Every one of these toggles writes a
    // preference on change, so automatic activation would save three settings
    // between the first option and the fourth.
    const onChange = vi.fn()
    const user = userEvent.setup()
    const tabs = draw('a', onChange)
    tabs[0].focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(onChange, 'arrowing through the options saved settings nobody chose').not.toHaveBeenCalled()
    // And the press still chooses, which is the other half: a control that moves
    // focus and can never commit is worse than one that does neither.
    await user.keyboard('{Enter}')
    expect(onChange, 'Enter on a focused option did not choose it').toHaveBeenCalledWith('d')
  })

  it('answers nothing else, so Tab still leaves the control', async () => {
    const user = userEvent.setup()
    const tabs = draw('b')
    tabs[1].focus()
    await user.keyboard('{Tab}')
    expect(document.activeElement, 'Tab was swallowed and the reader is trapped').not.toBe(tabs[2])
  })

  it('and a disabled toggle cannot be entered, so the arrows never reach it', async () => {
    // THE FIRST VERSION OF THIS CASE PASSED FOR THE WRONG REASON: it asserted
    // only that `onChange` was not called, which is true whether or not the
    // handler checks `disabled`, because activation is manual either way. A
    // mutation that deleted the check sailed through it.
    //
    // AND THERE IS NOTHING STRONGER TO ASSERT, which is the honest finding rather
    // than a gap. The handler carried an `if (disabled) return` for a while; no
    // mutation could kill it, because there is no path to it. A browser refuses
    // focus on a disabled <button>, and userEvent refuses to DISPATCH to one —
    // jsdom's willingness to honour `.focus()` on a disabled element is the only
    // thing that made it look reachable, and that is jsdom deviating rather than
    // a case worth guarding. The check is gone; the `disabled` prop on the
    // buttons is the protection, and this is the test of it.
    const onChange = vi.fn()
    render(<Toggle value="a" onChange={onChange} options={OPTIONS} ariaLabel="Off" disabled />)
    const tabs = [...document.querySelectorAll('[role="tab"]')]
    for (const b of tabs) expect(b.disabled, 'an option of a disabled toggle is still pressable').toBe(true)
    tabs[0].focus()
    await userEvent.setup().keyboard('{ArrowRight}')
    expect(document.activeElement, 'a disabled toggle walked focus along the row').not.toBe(tabs[1])
    expect(onChange, 'a disabled toggle changed').not.toHaveBeenCalled()
  })

  it('and shares ONE roving verb with the colour swatches, not a second copy', () => {
    // THE RULE THIS COMMIT'S FIRST DRAFT CITED AND BROKE. `ColorSwatches` had rowed
    // its dots for releases; the toggle's arrows arrived as a paste of the same
    // twelve lines, under a comment quoting "similar things behave similarly". A
    // rater put the two bodies side by side. They are one function now, and this
    // fails if a third copy appears — the arithmetic lives in exactly one place.
    const src = readFileSync(join(SRC, 'ui.jsx'), 'utf8')
    expect((src.match(/btns\[next\]\.focus\(\)/g) || []).length,
      'the roving verb was written out by hand again instead of calling rovingFocusKey').toBe(1)
    // `=>` so the DEFINITION does not count itself as a caller — the first draft
    // of this line matched three and the third was `export function rovingFocusKey`.
    expect((src.match(/=> rovingFocusKey\(e, ref,/g) || []).length,
      'a caller stopped using the shared verb').toBe(2)
  })

  it('keeps the group named, so the arrows are announced as belonging to it', () => {
    draw('a')
    expect(screen.getByRole('tablist').getAttribute('aria-label')).toBe('Pick one')
  })
})
