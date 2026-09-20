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
import { FONT_FACES, FONT_ROLES, FACE_NAME_IN, nativeFaceName, specimenSample } from '../../src/fonts.js'

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

// THE RATCHET THAT MAKES THE INTERFACE ROWS' WIRING HONEST.
//
// Settings passes the active language's script to the face list on every row,
// including the four Latin roles. Today that names nothing: every face offered
// for display, ui, mono or hand is Latin-only and has no entry in FACE_NAME_IN,
// so the prop could be deleted and the whole suite would stay green — a rating
// measured that, and a green suite over a dead wire is worse than no test.
//
// SO THE CLAIM IS PINNED INSTEAD OF THE WIRE. The day somebody offers a face
// with a native name for one of those roles, this fails and says which — and
// whoever reads it is looking at the one screen where the name would have had to
// follow the language and silently might not.
describe('the faces offered for the Latin roles', () => {
  it('have no native name, which is why nothing on those rows changes with the language', () => {
    const latinRoles = FONT_ROLES.filter((r) => !r.script).map((r) => r.key)
    const named = []
    for (const role of latinRoles) {
      for (const face of FONT_FACES[role] || []) {
        if (FACE_NAME_IN[face.id]) named.push(`${role}: ${face.id}`)
      }
    }
    expect(
      named,
      'a face with a native name is now offered for a Latin role — the interface rows pass the ' +
      'active script to the picker, so check that it really reaches the list, and guard it',
    ).toEqual([])
  })
})
