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
import { FONT_ROLES, nativeFaceName, specimenSample } from '../../src/fonts.js'

const role = (key) => FONT_ROLES.find((r) => r.key === key)

describe("a face's name in another script", () => {
  it('is the native one where the face can write that script', () => {
    expect(nativeFaceName('noto-serif-bengali', 'bengali')).toBe('নোটো সেরিফ বাংলা')
    expect(nativeFaceName('hind', 'devanagari')).toBe('हिंद')
  })

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

describe('the specimen a row sets', () => {
  // UNDER A LATIN SCRIPT NOTHING CHANGES, which is most of the app: the role's
  // own line, doing the role's own job.
  it("is the role's own line where the script is Latin or unknown", () => {
    expect(specimenSample(role('ui'), 'Inter', 'latin')).toBe(role('ui').sample)
    expect(specimenSample(role('ui'), 'Inter', '')).toBe(role('ui').sample)
    expect(specimenSample(role('ui'), 'Inter', 'arabic')).toBe(role('ui').sample)
  })

  // AND WHERE THE MEASUREMENT CANNOT ANSWER. hasScript returns null with no
  // canvas — "I did not check" — and a specimen drawn in a script nobody
  // verified is the boxes the check exists to prevent. Under jsdom that is the
  // state every call is in, which is why this case can be written at all.
  it('falls back rather than guessing when the face cannot be measured', () => {
    expect(specimenSample(role('ui'), 'Inter', 'bengali')).toBe(role('ui').sample)
    expect(specimenSample(role('ui'), '', 'bengali')).toBe(role('ui').sample)
  })
})
