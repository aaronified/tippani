import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GESTURES, GESTURE_LABEL, Gesture, IMPLEMENTED } from '../../src/gestures.jsx'

// The library's own rules, and the clip a held grip uses. What a reader meets is a drawing with a name.
describe('the gesture clips', () => {
  it('every clip has a name and is drawn', () => {
    for (const kind of GESTURES) {
      expect(GESTURE_LABEL[kind], kind).toBeTruthy()
      const { container, unmount } = render(<Gesture kind={kind} />)
      expect(container.querySelector('svg'), kind).not.toBeNull()
      unmount()
    }
  })
  it('drag to reorder is drawn, named, and bound', () => {
    render(<Gesture kind="drag-reorder" />)
    expect(screen.getByRole('img', { name: 'Drag to reorder' })).toBeTruthy()
    expect(IMPLEMENTED).toContain('drag-reorder')
  })
  it('only a bound clip is shown as implemented', () => {
    for (const kind of IMPLEMENTED) expect(GESTURES).toContain(kind)
  })
})
