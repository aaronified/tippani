// A FACE'S NAME, IN THE SCRIPT IT IS BEING CHOSEN FOR.
//
// WHY THIS IS A PURE TEST AND NOT A JOURNEY. What the two functions below decide
// is a string, and the browser tier already presses the picker that shows it —
// see language-faces.test.jsx, which reads the Bengali name off a rendered
// option. What cannot be asked there is the rule at its edges: a script this app
// knows nothing about, a face with no entry, a family the measurement cannot
// judge. Those are the cases where "fall back to Latin" either holds or quietly
// starts showing boxes.
//
// THE OWNER'S REASON, in their words: "if a font doesn't natively support a
// script, it is very hard to see what it will show when chosen to render that
// script."
import { describe, expect, it } from 'vitest'
import {    nativeFaceName,  } from '../../src/fonts.js'

describe("a face's name in another script", () => {
  // THE HALF THAT MATTERS MORE. A Latin-only face named in Bengali would be a
  // promise the face cannot keep, and the reader finds out only when a quote
  // turns into boxes.
  it('is empty where it cannot, so the caller uses the Latin name', () => {
    expect(nativeFaceName('literata', 'bengali')).toBe('')
    expect(nativeFaceName('noto-serif-bengali', 'devanagari')).toBe('')
    expect(nativeFaceName('upload:7', 'bengali')).toBe('')
    // A script this app has no faces for at all — the ninety-odd languages
    // iso639 knows come back with scripts nothing here is written for.
    expect(nativeFaceName('noto-serif-bengali', 'arabic')).toBe('')
    expect(nativeFaceName('noto-serif-bengali', '')).toBe('')
  })
})

