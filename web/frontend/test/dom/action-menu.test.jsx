// The menu, and the keyboard behaviour that makes it one.
//
// A dropdown you can only reach with a pointer is not a menu, and the difference
// is invisible in a screenshot. Everything here is about the half that only a
// keyboard user meets: focus landing inside on open, arrows moving between items,
// Escape putting focus back where it came from, and Tab not walking out of an open
// panel and leaving it floating behind the page.
//
// Point anchoring is the other half. A context menu opens where the pointer was,
// and the reason it goes through the same placement code as an element-anchored one
// is that flipping and clamping are exactly what a menu near an edge needs — a
// second placement path is how one of the two ends up off-screen in a corner
// nobody tested.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ActionMenu, MoreMenu } from '../../src/ui.jsx'

const ITEMS = (onClick = vi.fn()) => [
  { id: 'copy', label: 'Copy', onClick },
  { id: 'edit', label: 'Edit', onClick },
  { id: 'delete', label: 'Delete', onClick, danger: true },
]

const items = () => screen.getAllByRole('menuitem')
const focused = () => document.activeElement?.textContent

describe('the ⋯ trigger', () => {
  it('opens and closes its menu', async () => {
    render(<MoreMenu items={ITEMS()} />)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    expect(await screen.findByRole('menu')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('runs the item it was given, and closes', async () => {
    const onClick = vi.fn()
    render(<MoreMenu items={ITEMS(onClick)} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(await screen.findByText('Edit'))
    expect(onClick).toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('the menu is a menu', () => {
  const open = (over = {}) => {
    const onClose = vi.fn()
    const ret = { current: document.createElement('button') }
    document.body.appendChild(ret.current)
    render(<ActionMenu open items={ITEMS()} at={{ x: 40, y: 40 }} onClose={onClose} returnFocusTo={ret} {...over} />)
    return { onClose, ret }
  }

  it('puts focus on the first item when it opens', async () => {
    open()
    await waitFor(() => expect(focused()).toContain('Copy'))
  })

  it('moves with the arrows, and wraps', async () => {
    open()
    const menu = screen.getByRole('menu')
    await waitFor(() => expect(focused()).toContain('Copy'))
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(focused()).toContain('Edit')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(focused()).toContain('Delete')
    // Wrapping rather than stopping: a three-item menu where the last arrow-down
    // does nothing feels broken, and every native menu wraps.
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(focused()).toContain('Copy')
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(focused()).toContain('Delete')
  })

  it('jumps with Home and End', async () => {
    open()
    const menu = screen.getByRole('menu')
    await waitFor(() => expect(focused()).toContain('Copy'))
    fireEvent.keyDown(menu, { key: 'End' })
    expect(focused()).toContain('Delete')
    fireEvent.keyDown(menu, { key: 'Home' })
    expect(focused()).toContain('Copy')
  })

  it('closes on Escape and hands focus back', async () => {
    const { onClose, ret } = open()
    await waitFor(() => expect(focused()).toContain('Copy'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(document.activeElement).toBe(ret.current)
  })

  it('closes on Tab rather than leaving itself open behind the page', async () => {
    // A menu is a mode. Tabbing out of one is how you end up with a floating panel
    // and focus somewhere in the page underneath it.
    const { onClose, ret } = open()
    await waitFor(() => expect(focused()).toContain('Copy'))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' })
    expect(onClose).toHaveBeenCalled()
    expect(document.activeElement).toBe(ret.current)
  })

  it('marks a dangerous item without relying on its position', async () => {
    open()
    const del = screen.getByText('Delete')
    expect(del.getAttribute('style')).toContain('var(--error)')
    expect(screen.getByText('Copy').getAttribute('style')).toBeNull()
  })
})

describe('anchoring to a point', () => {
  it('places itself at the pointer rather than at an element', async () => {
    render(<ActionMenu open items={ITEMS()} at={{ x: 120, y: 200 }} onClose={() => {}} />)
    const menu = await screen.findByRole('menu')
    // jsdom reports zero-size boxes, so the assertion is about what the placement
    // was ASKED to do: a fixed box positioned from the point it was given.
    expect(menu.style.position).toBe('fixed')
    expect(parseInt(menu.style.left, 10)).toBeGreaterThanOrEqual(0)
    expect(parseInt(menu.style.top, 10)).toBeGreaterThanOrEqual(0)
  })

  it('needs no anchor element at all', async () => {
    // The whole point of the generalisation: a right-click has no button behind it.
    expect(() =>
      render(<ActionMenu open items={ITEMS()} at={{ x: 10, y: 10 }} onClose={() => {}} />),
    ).not.toThrow()
    expect(await screen.findByRole('menu')).toBeTruthy()
  })

  it('renders nothing when closed', () => {
    render(<ActionMenu open={false} items={ITEMS()} at={{ x: 10, y: 10 }} onClose={() => {}} />)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
