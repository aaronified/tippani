// A LOOK YOU CAN COME BACK TO, AND A FILE YOU CAN HAND SOMEBODY.
//
// WHY THIS IS A PURE TEST. Saving a look is a data question — what six fields
// travel, what happens at the cap, what a file that is not a theme does — and
// every one of those is a fact about a function. The browser tier covers the part
// a reader touches.
import { describe, expect, it } from 'vitest'
import { fromFile, toFile } from '../../src/savedThemes.js'

const WEARING = {
  theme: 'dark', materialSet: 'bindery', accent: 'olive',
  groundLight: 'sepia', groundDark: 'tobacco',
  tiles: ['wood', '', 'paper', ''], texTweak: { paper: { hard: 12 } },
}

describe('the file', () => {
  it('round-trips what you are wearing', () => {
    const got = fromFile(toFile(WEARING, 'Evening'))
    expect(got.error).toBeUndefined()
    expect(got.theme.name).toBe('Evening')
    expect(got.theme.materialSet).toBe('bindery')
    expect(got.theme.groundDark).toBe('tobacco')
  })
})
