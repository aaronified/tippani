// Harness smoke test for the jsdom project — that a real app component renders
// and that the stubs in setup-dom.js are the ones actually in effect.

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TagChip } from '../../src/ui.jsx'

describe('the dom harness', () => {
  it('renders a component from ui.jsx', () => {
    render(<TagChip color="blue" style="banner">grief</TagChip>)
    const chip = screen.getByText('grief')
    expect(chip.className).toContain('tag-chip')
    expect(chip.className).toContain('tc-blue')
    expect(chip.className).toContain('ts-banner')
  })

  it('has the APIs jsdom lacks that the app calls unguarded', () => {
    expect(typeof window.matchMedia).toBe('function')
    expect(typeof globalThis.ResizeObserver).toBe('function')
    expect(typeof URL.createObjectURL).toBe('function')
  })

  it('measures a non-zero box, so Masonry and Tooltip take the real path', () => {
    const { width, height } = document.createElement('div').getBoundingClientRect()
    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(0)
  })

  // The dom project loads its own setup file, so it needs its own copy of this
  // assertion — a pin applied in one setup and not the other is exactly the kind of
  // half-done guarantee that put four date assertions on CI's mercy in the first
  // place. Every component test that renders a date is downstream of this.
  it('runs with the locale pinned, like the pure project beside it', () => {
    const d = new Date('2026-08-01T10:00:00Z')
    expect(d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })).toBe('1 Aug')
    expect(d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })).toBe('Aug 1')
  })
})
