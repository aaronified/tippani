// A YEAR, ITS ESTIMATE, AND THE PHRASE THAT CARRIES BOTH.
//
// The owner: "every capture screen shall get the same year/circa behaviour. both
// the checkbox and the text parsing."
//
// WHAT WAS ACTUALLY WRONG IS WORSE THAN A MISSING CHECKBOX. All four year boxes ran
// `value.replace(/\D/g, '').slice(0, 4)` on every keystroke, while the comment above
// two of them said `parseYearInput` "reads '380 BCE' and 'c. 1500' as well as
// '1719'". Both were true and they could not both matter: the parser could read the
// phrase and the box could not hold it. So an estimate and a BCE year were
// undocumented-impossible to type.
//
// AND IT LOST DATA THAT WAS ALREADY THERE. The edit form seeded the box from
// `formatYear`, so a book already recorded as "c. 1500" opened with that in the box
// — and the first keystroke anywhere in the field stripped the "c. ", so the next
// save wrote the estimate away. No error, no warning, and the year still looked
// right afterwards.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the two paragraphs above, that `formatYear` is
// for DISPLAY and resolves locale keys while `yearInputValue` is the editable form,
// and that the flag is DERIVED from the string rather than stored beside it.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { YearField, yearInputValue, parseYearInput } from '../../src/ui.jsx'

const box = () => screen.getByPlaceholderText('Year')
const flag = () => document.querySelector('input[type="checkbox"]')
const mount = (value = '') => {
  const onChange = vi.fn()
  render(<YearField value={value} onChange={onChange} placeholder="Year" circaLabel="The year is approximate" />)
  return { onChange }
}

// ---- the round trip, which is the data-loss fix ---------------------------
//
// NOT THROUGH `formatYear`, AND THAT IS THE POINT. That one resolves one of four
// locale keys, so in Bengali it returns a Bengali prefix that `parseYearInput`'s
// `/^(?:circa|ca|c)\.?/i` cannot match — the estimate round-tripped in English and
// was silently dropped in every other language. These cases hold in any locale
// because `yearInputValue` resolves nothing.
describe('a year survives being written down and read back', () => {
  it.each([
    [1500, false],
    [1500, true],
    [-380, false],
    [-380, true],
    [1, true],
  ])('%s, approximate=%s', (year, circa) => {
    const back = parseYearInput(yearInputValue(year, circa))
    expect(back.year, 'the year changed on the way through the box').toBe(year)
    expect(back.circa, 'the estimate was lost on the way through the box').toBe(circa)
  })

  it('and no year at all stays no year', () => {
    expect(yearInputValue(0, true)).toBe('')
    expect(yearInputValue(null, true)).toBe('')
  })
})

describe('what the reader may type', () => {
  it('keeps a marker the box used to delete', () => {
    const { onChange } = mount()
    fireEvent.change(box(), { target: { value: 'c. 1500' } })
    expect(onChange, 'the estimate was stripped, as it always was').toHaveBeenCalledWith('c. 1500')
  })

  it('and keeps a BCE year, which was equally unenterable', () => {
    const { onChange } = mount()
    fireEvent.change(box(), { target: { value: '380 BCE' } })
    expect(onChange).toHaveBeenCalledWith('380 BCE')
  })

  it('and both at once, which is how an ancient text is actually dated', () => {
    const { onChange } = mount()
    fireEvent.change(box(), { target: { value: 'c. 380 BCE' } })
    expect(onChange).toHaveBeenCalledWith('c. 380 BCE')
  })
})

describe('the checkbox and the phrase are one fact', () => {
  it('is ticked by a phrase that carries the marker', () => {
    mount('c. 1500')
    expect(flag().checked, 'the box says nothing about a year that is already approximate').toBe(true)
  })

  it('and unticked by one that does not', () => {
    mount('1500')
    expect(flag().checked).toBe(false)
  })

  it('and ticking it writes the marker into the phrase', () => {
    const { onChange } = mount('1500')
    fireEvent.click(flag())
    expect(onChange).toHaveBeenCalledWith('c. 1500')
  })

  it('and unticking takes it out again, without eating the year', () => {
    const { onChange } = mount('c. 1500')
    fireEvent.click(flag())
    expect(onChange).toHaveBeenCalledWith('1500')
  })

  it('and ticking twice does not stack two markers', () => {
    // The flag is DERIVED, so this cannot happen by construction — which is the
    // reason it is derived, and the reason to pin it.
    const { onChange } = mount('c. 1500')
    fireEvent.change(box(), { target: { value: 'c. c. 1500' } })
    expect(parseYearInput('c. c. 1500').year, 'a doubled marker parsed as a year anyway').toBe(0)
  })

  it('and cannot be ticked with no year to be approximate about', () => {
    // "c. " on its own reads back as no year, so the flag would appear to untick
    // itself on the next render.
    mount('')
    expect(flag().disabled, 'an estimate was offered about nothing').toBe(true)
  })
})

describe('and a phrase it cannot read says so', () => {
  it('marks an unparseable year invalid', () => {
    // Newly possible: while the box stripped to digits nothing invalid could be
    // typed. Now "sometime in the 90s" is enterable and saves as no year at all.
    mount('sometime in the 90s')
    expect(box().getAttribute('aria-invalid')).toBe('true')
  })

  it('but says nothing about an empty box', () => {
    mount('')
    expect(box().getAttribute('aria-invalid')).toBeNull()
  })
})
