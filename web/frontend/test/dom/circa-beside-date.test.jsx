// THE FLAG THAT QUALIFIES A DATE, BESIDE THE DATE.
//
// The owner's ask: "Approx date moves beside the date field", and their ruling on
// how: "Parse it and tick the button."
//
// THE DEFECT UNDER IT IS A SWALLOWED GESTURE, and it is the half that cannot be
// seen in a screenshot. The date box accepts digits and a separator and silently
// drops everything else, so a reader typing the ordinary thing — `c. 1890` —
// watched the `c.` disappear, saw 1890 land, and had no way to learn that a
// checkbox elsewhere on the form was what they had meant. Nothing was broken and
// nothing said anything.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraph above, that a partial date is a
// string of 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD', and that the flag is optional on
// the shared field — three other callers pass none of it and must be unchanged.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PartialDateField } from '../../src/ui.jsx'

const field = () => screen.getByPlaceholderText(/./)
const box = () => document.querySelector('input[type="checkbox"]')

const mount = (over = {}) => {
  const onChange = vi.fn()
  const onCirca = vi.fn()
  render(
    <PartialDateField
      label="Said when"
      value=""
      onChange={onChange}
      onCirca={onCirca}
      circaLabel="The date is approximate"
      {...over}
    />,
  )
  return { onChange, onCirca }
}

describe('typing an approximate date', () => {
  it('reads the marker the box used to delete, and keeps the digits', () => {
    const { onChange, onCirca } = mount()
    fireEvent.change(field(), { target: { value: 'c. 1890' } })
    expect(onCirca, 'the c. was dropped, as it always was').toHaveBeenCalledWith(true)
    expect(onChange, 'the year did not survive the parse').toHaveBeenCalledWith('1890')
  })

})

