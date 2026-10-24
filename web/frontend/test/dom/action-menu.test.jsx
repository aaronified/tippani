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
import { ActionMenu } from '../../src/ui.jsx'

const ITEMS = (onClick = vi.fn()) => [
  { id: 'copy', label: 'Copy', onClick },
  { id: 'edit', label: 'Edit', onClick },
  { id: 'delete', label: 'Delete', onClick, danger: true },
]

const items = () => screen.getAllByRole('menuitem')
const focused = () => document.activeElement?.textContent

describe('the menu is a menu', () => {
  const open = (over = {}) => {
    const onClose = vi.fn()
    const ret = { current: document.createElement('button') }
    document.body.appendChild(ret.current)
    render(<ActionMenu open items={ITEMS()} at={{ x: 40, y: 40 }} onClose={onClose} returnFocusTo={ret} {...over} />)
    return { onClose, ret }
  }

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

  it('closes on Escape and hands focus back', async () => {
    const { onClose, ret } = open()
    await waitFor(() => expect(focused()).toContain('Copy'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(document.activeElement).toBe(ret.current)
  })

})

