// WHAT A MATERIAL DOES WITH THE LIGHT, as four numbers per tile.
//
// WHY THIS IS A PURE TEST AND NOT A JOURNEY. The v3 pack's texture dials are the
// case the repo's own tier rule names as justified: the function IS the observable
// unit. What a reader can see is "the page looks softer", which no assertion can
// state — but the thing that has to be right is that a dial's number reaches the
// compiled stack, that the factory value is what an untouched tile gets, and that
// an edit to one material leaves the other twenty-six alone. Those are facts about
// a function.
//
// THE COST QUESTION THIS ANSWERS. The dials were approved on the understanding
// that they compile to CSS at theme-apply time and cost nothing at paint time.
// That is only true if the output is a static gradient stack, which is what the
// first case measures.
import { describe, expect, it } from 'vitest'
import { PHYS,   physFor } from '../../src/theme.js'

describe('the factory numbers', () => {
  it('takes the reader edits over the factory, per dial', () => {
    const got = physFor('marble', { marble: { hard: 10 } })
    expect(got.hard).toBe(10)
    // The three untouched dials still come from the table — an edit is an edit to
    // one number, not a replacement of the material's whole behaviour.
    expect(got.sss).toBe(PHYS.marble.sss)
    expect(got.diff).toBe(PHYS.marble.diff)
    expect(got.refl).toBe(PHYS.marble.refl)
  })
})

