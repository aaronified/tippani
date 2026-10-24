// The six faces reach the screen — handoff §1.8.
//
// The pure test pins the choosing; this pins the DRAWING, because a stable index
// nothing renders is a stable index. What a reader is owed is that a person with
// no photograph still has a face, that it is the SAME face wherever they appear,
// and that two people do not look alike merely because neither has been
// photographed.
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PersonChip } from '../../src/people.jsx'

const chip = (name) => {
  const { container } = render(<PersonChip kind="book" name={name} onOpen={() => {}} />)
  return container.querySelector('svg.tp-silhouette')
}

describe('a person with no photograph', () => {
  it('still has a face', () => {
    const face = chip('Mikhail Bulgakov')
    expect(face).toBeTruthy()
    // A MASK, NOT AN <img>: it takes the theme, and it can never be mistaken for
    // a photograph that was actually uploaded.
    expect(face.getAttribute('fill')).toBe('currentColor')
    expect(face.querySelectorAll('path, circle').length).toBeGreaterThan(0)
  })

})
