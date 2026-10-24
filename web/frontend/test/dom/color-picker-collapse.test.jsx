// The in-card colour picker at six categories.
//
// The row on a quote card is ♥ + the colours + ⋯, and the stylesheet has a
// comment sizing it: "♥ + FOUR blobs + ⋯ must fit a ~250px content column …
// this row measures at 232px". 1.7.1 made it six. Two more dots is ~56px, so
// the row measures ~288px and wraps to a second line — the comment described
// the bug a release before it happened.
//
// jsdom applies no container queries and measures nothing, so what is testable
// here is the CONTRACT rather than the layout: both forms exist, they are the
// same control, and the collapsed one is the only one that can show the names.
// The layout itself is a CSS rule with its reasoning written beside it.

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ANNOTATION_COLORS, ColorSwatches } from '../../src/ui.jsx'

describe('ColorSwatches', () => {

  it('picks a colour and closes', () => {
    const picked = []
    render(<ColorSwatches value="blue" onChange={(c) => picked.push(c)} collapsible />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    const rows = within(document.querySelector('.cs-menu')).getAllByRole('radio')
    fireEvent.click(rows[rows.length - 1])
    expect(picked).toEqual([ANNOTATION_COLORS[ANNOTATION_COLORS.length - 1]])
    expect(document.querySelector('.cs-menu')).toBeNull()
  })

  it('closes when the click lands outside both the button and the list', () => {
    // The portal moved the list out of the wrap, so "outside" has to ask two
    // elements. Asking only the wrap closes the menu on the way to choosing
    // from it.
    render(<ColorSwatches value="blue" onChange={() => {}} collapsible />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    const menu = document.querySelector('.cs-menu')
    fireEvent.mouseDown(menu)
    expect(document.querySelector('.cs-menu'), 'closed on its own list').toBeTruthy()
    fireEvent.mouseDown(document.body)
    expect(document.querySelector('.cs-menu')).toBeNull()
  })

})
