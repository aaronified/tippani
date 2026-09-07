// A MENU HANDS FOCUS BACK, WHICHEVER WAY YOU LEAVE IT.
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing about how it was built:
//
//  * A menu is a mode. It takes focus when it opens — the first row, so the arrow
//    keys work immediately — which means it OWES focus back when it closes.
//  * There are four ways out: Escape, Tab, a press somewhere else, and choosing a
//    row. A reader who uses one of them has not chosen to lose their place.
//  * Focus on `<body>` is the floor. From there a keyboard reader has nothing to
//    arrow from and a screen reader has nothing to announce, so the menu has
//    silently ended the reader's session with the page.
//  * A row marked `keepOpen` is not a way out — the menu is still there.
//
// THE DEFECT: two of the four restored focus and two dropped it. Choosing a row,
// which is what the menu is FOR, was one of the two that dropped it.
//
// jsdom does not lay out or scroll, so nothing here can see whether the page moved
// — that is `make overlay-scroll`'s job. What jsdom does have is
// `document.activeElement`, which is the whole of this claim.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'

const { ActionMenu } = await import('../../src/ui.jsx')

afterEach(() => cleanup())

// The anchor and the menu as a screen wires them: a button that opens it, and the
// ref that says where focus came from.
function Harness({ items, onClose }) {
  const anchor = useRef(null)
  return (
    <div>
      <button type="button" ref={anchor} data-testid="anchor">Open</button>
      <button type="button" data-testid="elsewhere">Something else</button>
      <ActionMenu open items={items} anchorRef={anchor} onClose={onClose} returnFocusTo={anchor} />
    </div>
  )
}

const open = (items = [{ id: 'a', label: 'Rename', onClick: () => {} }]) => {
  const closed = []
  const view = render(<Harness items={items} onClose={() => closed.push(1)} />)
  const anchor = view.getByTestId('anchor')
  const menu = document.querySelector('[role=menu]')
  expect(menu, 'the menu did not render, so nothing below is testing a menu').toBeTruthy()
  return { view, anchor, menu, closed }
}

const landedOn = () => document.activeElement
const onTheFloor = () => document.activeElement === document.body || document.activeElement === null

describe('leaving a menu', () => {
  it('by Escape puts focus back where it came from', () => {
    const { anchor, menu } = open()
    fireEvent.keyDown(menu, { key: 'Escape' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onTheFloor(), 'Escape dropped focus onto the document body').toBe(false)
    expect(landedOn(), 'Escape put focus somewhere other than the control that opened the menu').toBe(anchor)
  })

  it('by Tab puts focus back where it came from', () => {
    const { anchor, menu } = open()
    fireEvent.keyDown(menu, { key: 'Tab' })
    expect(onTheFloor(), 'Tab dropped focus onto the document body').toBe(false)
    expect(landedOn(), 'Tab put focus somewhere other than the control that opened the menu').toBe(anchor)
  })

  it('by pressing somewhere else puts focus back where it came from', () => {
    const { view, anchor } = open()
    fireEvent.mouseDown(view.getByTestId('elsewhere'))
    expect(onTheFloor(), 'a press outside the menu dropped focus onto the document body').toBe(false)
    expect(landedOn(), 'a press outside the menu left focus somewhere other than the control that opened it').toBe(anchor)
  })

  // THE ONE THE MENU EXISTS FOR, and the one that was broken.
  it('by choosing a row puts focus back where it came from', () => {
    const ran = []
    const { anchor } = open([{ id: 'a', label: 'Rename', onClick: () => ran.push('rename') }])
    fireEvent.click(document.querySelector('[role=menuitem]'))
    expect(ran, 'choosing the row did not run it, so this case is not about choosing a row').toEqual(['rename'])
    expect(onTheFloor(), 'choosing a row dropped focus onto the document body — a keyboard reader has nothing left to arrow from')
      .toBe(false)
    expect(landedOn(), 'choosing a row left focus somewhere other than the control that opened the menu').toBe(anchor)
  })

  // AND A ROW THAT KEEPS THE MENU OPEN IS NOT A WAY OUT. Restoring focus there
  // would take it off the row the reader is standing on, in a menu still on screen.
  it('does not happen for a row that leaves the menu open', () => {
    const { anchor } = open([{ id: 'a', label: 'Descending', keepOpen: true, onClick: () => {} }])
    const row = document.querySelector('[role=menuitem]')
    row.focus()
    fireEvent.click(row)
    expect(landedOn(), 'a keepOpen row handed focus back to the anchor while its own menu was still open')
      .not.toBe(anchor)
  })
})
