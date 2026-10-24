// Which speaker labels the remap screen offers.
//
// A line spoken by two characters is stored as one string — "V, Evey" — and the
// screen offered that whole string as a single remappable row. Mapping an ensemble
// onto one cast member is not a thing, and the server would not have matched it
// anyway: it compared the whole stored label, so the mapping answered 200 having
// changed nothing. Both halves were the same bug.
//
// This is the client half, extracted from the fetch it used to be buried inside so
// that the rule can actually be checked.

import { describe, expect, it } from 'vitest'
import { remapLabels } from '../../src/MetadataPage.jsx'
import { DEFAULT_CREDIT_SEPS } from '../../src/people.jsx'

const seps = DEFAULT_CREDIT_SEPS
const lines = (...chars) => chars.map((character) => ({ character }))
const names = (out) => out.map((l) => l.name)

describe('the remappable speaker labels', () => {
  it('counts LINES, so the number matches what a mapping will touch', () => {
    const out = remapLabels(lines('V', 'V, Evey', 'Evey', 'Finch'), seps)
    const by = Object.fromEntries(out.map((l) => [l.name, l.count]))
    expect(by).toEqual({ V: 2, Evey: 2, Finch: 1 })
  })

  it('splits on the comma, the semicolon and the ampersand', () => {
    const out = remapLabels(lines('V & Evey', 'Finch; Dominic'), seps)
    expect(names(out)).toEqual(['Dominic', 'Evey', 'Finch', 'V'])
  })
})

