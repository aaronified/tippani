// The character box's dropdown.
//
// WHY IT IS NOT A <datalist> ANY MORE. It was, and the argument was that the
// browser's own list is strictly better in this one role. What the browser
// actually DOES with a datalist turns out to be a per-browser matter: desktop
// Chrome opens it only after a keystroke, so a reader who had typed nothing saw
// nothing and had no way to learn the list existed. For a memory aid that is the
// whole of its value, and the owner reported it as the box not having a dropdown.
//
// So the assertions here are about what a reader can SEE without knowing the
// control: it opens on focus, it names the actor beside the part, and it never
// refuses a name the cast has never heard of.

import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { CastCombo } = await import('../../src/suggest.jsx')

const CAST = [
  { character: 'Amanda Waller', actor: 'Viola Davis' },
  { character: 'Harley Quinn', actor: 'Margot Robbie' },
  { character: 'Rick Flag', actor: 'Joel Kinnaman' },
]
// Twelve, so both caps have something to cut.
const MANY = Array.from({ length: 12 }, (_, i) => ({ character: `Person ${i + 1}`, actor: `Actor ${i + 1}` }))

const asPhone = (matches) => {
  window.matchMedia = (media) => ({
    matches, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}

// A controlled box, exactly as every caller wires it.
function Box({ cast = CAST, field = 'character', start = '' }) {
  const [v, setV] = useState(start)
  return (
    <div>
      <CastCombo label="Character" value={v} onChange={setV} cast={cast} field={field} placeholder="who says it" />
      <span data-testid="value">{v}</span>
    </div>
  )
}

const box = () => screen.getByRole('combobox')
const options = () => screen.queryAllByRole('option')
const value = () => screen.getByTestId('value').textContent

beforeEach(() => {
  asPhone(false)
})

describe('the cast dropdown', () => {

  it('picking a row writes the character, not the actor', () => {
    render(<Box />)
    fireEvent.focus(box())
    fireEvent.click(screen.getByText('Harley Quinn'))
    expect(value()).toBe('Harley Quinn')
    // And the list closes, rather than standing over the form with one row in it.
    expect(options()).toHaveLength(0)
  })

})
