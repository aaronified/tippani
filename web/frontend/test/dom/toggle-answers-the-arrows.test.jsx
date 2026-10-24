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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Toggle } from '../../src/ui.jsx'

const OPTIONS = [['a', 'Alpha'], ['b', 'Beta'], ['c', 'Gamma'], ['d', 'Delta']]

function draw(value = 'b', onChange = () => {}) {
  render(<Toggle value={value} onChange={onChange} options={OPTIONS} ariaLabel="Pick one" />)
  return [...document.querySelectorAll('[role="tab"]')]
}

describe('the toggle a keyboard meets', () => {

  it('moves focus along the row on Left and Right', async () => {
    const user = userEvent.setup()
    const tabs = draw('b')
    tabs[1].focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement, 'ArrowRight did not move focus').toBe(tabs[2])
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement, 'ArrowLeft did not move focus').toBe(tabs[0])
  })

})
