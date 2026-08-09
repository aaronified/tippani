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
  it('renders a plain row when it is not collapsible', () => {
    // Forms and filter sheets have room and must be untouched by any of this.
    const { container } = render(<ColorSwatches value="blue" onChange={() => {}} />)
    expect(container.querySelector('.cs-mini')).toBeNull()
    expect(container.querySelector('.cs-full')).toBeNull()
    expect(container.querySelectorAll('.color-dot-btn').length).toBe(ANNOTATION_COLORS.length)
  })

  it('renders both forms when collapsible, and lets CSS choose', () => {
    // Measuring would mean a ResizeObserver per card in a masonry column plus a
    // re-render on every reflow, for a decision the card's own width already
    // answers. So both are rendered and a container query hides one.
    const { container } = render(<ColorSwatches value="blue" onChange={() => {}} collapsible />)
    expect(container.querySelector('.cs-full')).toBeTruthy()
    expect(container.querySelector('.cs-mini')).toBeTruthy()
  })

  it('names every colour in the collapsed list', () => {
    // The reason the collapsed form is a list and not smaller dots. Since 1.7.1
    // the categories carry names the reader chose, and six unlabelled blobs
    // shrunk to fit are six things you cannot tell apart on a phone — the
    // cramped row hides information the full row was already failing to show.
    render(<ColorSwatches value="blue" onChange={() => {}} collapsible />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    const menu = document.querySelector('.cs-menu')
    expect(menu).toBeTruthy()
    expect(within(menu).getAllByRole('radio').length).toBe(ANNOTATION_COLORS.length)
    // Every row carries a readable label, not just a swatch.
    for (const row of within(menu).getAllByRole('radio')) {
      expect(row.textContent.trim().length).toBeGreaterThan(0)
    }
  })

  it('picks a colour and closes', () => {
    const picked = []
    render(<ColorSwatches value="blue" onChange={(c) => picked.push(c)} collapsible />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    const rows = within(document.querySelector('.cs-menu')).getAllByRole('radio')
    fireEvent.click(rows[rows.length - 1])
    expect(picked).toEqual([ANNOTATION_COLORS[ANNOTATION_COLORS.length - 1]])
    expect(document.querySelector('.cs-menu')).toBeNull()
  })

  it('marks the current colour in both forms', () => {
    // The collapsed button has to say which colour is on, or it is a control
    // that hides its own value.
    const { container } = render(<ColorSwatches value="blue" onChange={() => {}} collapsible />)
    expect(container.querySelector('.cs-mini .color-dot.active')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    const checked = within(document.querySelector('.cs-menu'))
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked.length).toBe(1)
  })

  it('closes on Escape', () => {
    render(<ColorSwatches value="blue" onChange={() => {}} collapsible />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    expect(document.querySelector('.cs-menu')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('.cs-menu')).toBeNull()
  })
})
