// The ⋯ in the top bar: everything the screen you are looking at can do.
//
// WHAT THIS GUARDS. The menu is a MENU BAR rather than an overflow — it lists the
// whole set, including controls also drawn on the page — so its rows carry state:
// which sort is running, which filters are on, which bucket you are reading. A
// menu that shows the view you left is worse than no menu, because it reads as an
// answer. That is why useScreenBar takes a BUILDER and not a list, and it is the
// property most of this file is about.
//
// It also covers the composed-page case, which was already in the tree before the
// menu existed: Checks renders the staging queue and the stray-marks list
// together, both entitled to publish. A single slot would have let whichever
// rendered last win silently.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { ActionMenu, buildScreenActions, useScreenBar } from '../../src/ui.jsx'

// A screen, reduced to the one thing that matters here: it publishes, and what it
// publishes depends on its own state.
function Screen({ actions }) {
  useScreenBar({ actions })
  return <div>screen</div>
}

describe('a screen publishes what it can do', () => {
  it('hands the shell nothing until something is mounted', () => {
    expect(buildScreenActions()).toEqual([])
  })

  it('hands over what the builder returns', () => {
    render(<Screen actions={() => [{ id: 'a', label: 'Export' }]} />)
    expect(buildScreenActions().map((i) => i.label)).toEqual(['Export'])
  })

  it('stops publishing when the screen goes', () => {
    const { unmount } = render(<Screen actions={() => [{ id: 'a', label: 'Export' }]} />)
    unmount()
    expect(buildScreenActions()).toEqual([])
  })

  // THE WHOLE REASON IT IS A BUILDER. A list published through the subscription
  // would be stamped by its ids, the ids would not move when the sort did, and the
  // menu would go on ticking the sort you left.
  it('reflects state that changed since it was published', () => {
    function Sortable() {
      const [sort, setSort] = useState('recent')
      useScreenBar({
        actions: () => [
          { id: 'recent', label: 'Recent', checked: sort === 'recent', onClick: () => setSort('recent') },
          { id: 'title', label: 'Title', checked: sort === 'title', onClick: () => setSort('title') },
        ],
      })
      return <button onClick={() => setSort('title')}>sort by title</button>
    }
    render(<Sortable />)
    expect(buildScreenActions().find((i) => i.checked).id).toBe('recent')
    act(() => screen.getByText('sort by title').click())
    expect(buildScreenActions().find((i) => i.checked).id).toBe('title')
  })

  // CHECKS IS THE CASE THIS EXISTS FOR — two screens on one page, both publishing.
  it('concatenates every section on a composed page, in the order they are drawn', () => {
    render(
      <>
        <Screen actions={() => [{ id: 'a', label: 'Approve all' }]} />
        <Screen actions={() => [{ id: 'b', label: 'Rescan' }]} />
      </>,
    )
    expect(buildScreenActions().map((i) => i.label)).toEqual(['Approve all', 'Rescan'])
  })

  it('loses only the section whose builder throws', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <>
        <Screen actions={() => { throw new Error('boom') }} />
        <Screen actions={() => [{ id: 'b', label: 'Rescan' }]} />
      </>,
    )
    expect(buildScreenActions().map((i) => i.label)).toEqual(['Rescan'])
    quiet.mockRestore()
  })
})

describe('the menu draws a group, a choice and a verb differently', () => {
  const open = (items) => {
    const ref = { current: document.body }
    render(<ActionMenu open items={items} anchorRef={ref} onClose={() => {}} />)
    return document.querySelector('[role=menu]')
  }

  it('a heading is not a control', () => {
    const menu = open([{ id: 'h', heading: 'sort' }, { id: 'a', label: 'Recent', onClick: () => {} }])
    expect(menu.querySelector('.menu-head').textContent).toBe('sort')
    // One item, not two: a heading a reader can tab to and press is a control that
    // does nothing, and the arrow keys would stop on it.
    expect(menu.querySelectorAll('[role^=menuitem]')).toHaveLength(1)
  })

  // A TICK ALONE ANNOUNCES NOTHING. The row has to say it is one of a set, which
  // is what menuitemradio means; a plain menuitem with a ✓ drawn on it is a
  // decoration a screen reader never mentions.
  it('a choice is a radio and says whether it is the current one', () => {
    const menu = open([
      { id: 'a', label: 'Recent', checked: true, onClick: () => {} },
      { id: 'b', label: 'Title', checked: false, onClick: () => {} },
    ])
    const rows = menu.querySelectorAll('[role=menuitemradio]')
    expect(rows).toHaveLength(2)
    expect(rows[0].getAttribute('aria-checked')).toBe('true')
    expect(rows[1].getAttribute('aria-checked')).toBe('false')
    // AND IT IS DRAWN, so a sighted reader sees it too — the announcement above
    // is for a screen reader and this is the other half. Asserted as "a mark is
    // present on the chosen row and absent on the other", NOT as the character
    // `✓`: that was the app's typed tick, it is an SVG now, and a test keyed to
    // the glyph goes red on a change no reader can see. `.menu-tick` is what the
    // row puts the mark in either way.
    expect(rows[0].querySelector('.menu-tick'), 'the chosen row wears no mark').toBeTruthy()
    expect(rows[1].querySelector('.menu-tick'), 'a row that is not chosen wears one').toBeNull()
  })

  it('a verb is a plain menuitem, with no checked state to announce', () => {
    const menu = open([{ id: 'a', label: 'Export', onClick: () => {} }])
    const row = menu.querySelector('[role=menuitem]')
    expect(row.hasAttribute('aria-checked')).toBe(false)
  })

  // The arrow keys read [role^=menuitem] off the DOM. A selector naming only
  // `menuitem` would step over every choice row — which is to say, over exactly
  // the part of the menu that is a choice.
  it('the arrow keys reach a choice row as well as a verb', () => {
    // THE CHOICE ROW GOES SECOND, on purpose. With it first, a selector naming
    // only `menuitem` still lands on the verb by arithmetic — indexOf returns -1
    // for the unmatched active element and -1 + 1 is 0 — and the test passes while
    // the bug is live. Stepping ONTO the radio is the move that cannot fake it.
    const menu = open([
      { id: 'a', label: 'Export', onClick: () => {} },
      { id: 'b', label: 'Recent', checked: true, onClick: () => {} },
    ])
    const rows = [...menu.querySelectorAll('[role^=menuitem]')]
    expect(rows).toHaveLength(2)
    rows[0].focus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rows[1])
  })

  // Two sections of a composed page both head their own group, so ids repeat
  // across builders. React would warn on the duplicate key and, worse, reuse the
  // wrong node.
  it('survives two sections using the same ids', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const menu = open([
      { id: 'h-do', heading: 'actions' },
      { id: 'x', label: 'Approve all', onClick: () => {} },
      { id: 'h-do', heading: 'actions' },
      { id: 'x', label: 'Rescan', onClick: () => {} },
    ])
    expect(menu.querySelectorAll('[role^=menuitem]')).toHaveLength(2)
    expect(quiet).not.toHaveBeenCalled()
    quiet.mockRestore()
  })
})

// Each test renders into the same document; the registry is module state.
afterEach(() => cleanup())
