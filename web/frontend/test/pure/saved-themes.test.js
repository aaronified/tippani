// A LOOK YOU CAN COME BACK TO, AND A FILE YOU CAN HAND SOMEBODY.
//
// WHY THIS IS A PURE TEST. Saving a look is a data question — what six fields
// travel, what happens at the cap, what a file that is not a theme does — and
// every one of those is a fact about a function. The browser tier covers the part
// a reader touches.
import { describe, expect, it } from 'vitest'
import {
  applyFields, fromFile, parseSaved, removeTheme, SAVED_THEME_CAP, saveTheme, themeFrom, toFile,
} from '../../src/savedThemes.js'

const WEARING = {
  theme: 'dark', materialSet: 'bindery', accent: 'olive',
  groundLight: 'sepia', groundDark: 'tobacco',
  tiles: ['wood', '', 'paper', ''], texTweak: { paper: { hard: 12 } },
}

describe('what a saved look holds', () => {
  // THE FAILURE THIS GUARDS IS "SAVED MOST OF IT". A look that comes back missing
  // one field is indistinguishable from a correct one until you switch away and
  // back, and then the thing that did not travel is a mystery.
  it('carries all six fields, not the ones that happened to be handy', () => {
    const got = themeFrom(WEARING, 'Evening')
    expect(got).toEqual({
      name: 'Evening',
      materialSet: 'bindery', accent: 'olive',
      groundLight: 'sepia', groundDark: 'tobacco',
      tiles: ['wood', '', 'paper', ''], texTweak: { paper: { hard: 12 } },
    })
  })

  // WHICH MODE YOU ARE IN IS NOT PART OF A LOOK. It is about the room you are
  // sitting in, and a saved theme that dragged you into dark at noon is a theme
  // nobody saves twice.
  it('does not carry the light/dark mode', () => {
    expect(themeFrom(WEARING, 'Evening').theme).toBeUndefined()
  })

  it('keeps the current mode when a look is worn', () => {
    const fields = applyFields(themeFrom(WEARING, 'Evening'), { ...WEARING, theme: 'light' })
    expect(fields.theme).toBe('light')
    expect(fields.materialSet).toBe('bindery')
  })

  // THE SEAM BETWEEN THE TWO SHAPES. texTweak is an object inside a saved theme
  // and a STRING through the preferences endpoint; a look applied with the object
  // form would silently wear the factory dials.
  it('hands the dials across as a string, which is what the endpoint takes', () => {
    const fields = applyFields(themeFrom(WEARING, 'Evening'), WEARING)
    expect(typeof fields.texTweak).toBe('string')
    expect(JSON.parse(fields.texTweak)).toEqual({ paper: { hard: 12 } })
  })
})

describe('the list of them', () => {
  it('keeps the newest four and drops the oldest', () => {
    let list = []
    for (const n of ['a', 'b', 'c', 'd', 'e']) list = saveTheme(list, WEARING, n)
    expect(list).toHaveLength(SAVED_THEME_CAP)
    expect(list.map((x) => x.name)).toEqual(['b', 'c', 'd', 'e'])
  })

  // A RE-SAVE REPLACES, rather than making a second row with the same word on it —
  // which a reader cannot tell apart and cannot choose between.
  it('replaces a look saved under a name it already has', () => {
    let list = saveTheme([], { ...WEARING, accent: 'olive' }, 'Evening')
    list = saveTheme(list, { ...WEARING, accent: 'slate' }, 'Evening')
    expect(list).toHaveLength(1)
    expect(list[0].accent).toBe('slate')
  })

  it('removes one by name and leaves the rest', () => {
    let list = saveTheme(saveTheme([], WEARING, 'a'), WEARING, 'b')
    expect(removeTheme(list, 'a').map((x) => x.name)).toEqual(['b'])
  })

  // A STORED VALUE THAT IS NOT A LIST IS NOT AN ERROR WORTH SURFACING: it means
  // this reader has no saved looks, which is the same thing an empty value means.
  it('reads nonsense as nothing saved, rather than throwing', () => {
    expect(parseSaved('')).toEqual([])
    expect(parseSaved('{')).toEqual([])
    expect(parseSaved('{"not":"a list"}')).toEqual([])
  })

  it('drops a stored entry with no name, which would draw a row nobody can press', () => {
    expect(parseSaved(JSON.stringify([{ accent: 'olive' }, { name: 'ok' }]))).toHaveLength(1)
  })
})

describe('the file', () => {
  it('round-trips what you are wearing', () => {
    const got = fromFile(toFile(WEARING, 'Evening'))
    expect(got.error).toBeUndefined()
    expect(got.theme.name).toBe('Evening')
    expect(got.theme.materialSet).toBe('bindery')
    expect(got.theme.groundDark).toBe('tobacco')
  })

  // EACH REFUSAL HAS ITS OWN REASON, because this is somebody pasting a file into
  // a box and "that did not work" is not something they can act on.
  it('says which way a file is wrong', () => {
    expect(fromFile('not json').error).toBe('parse')
    expect(fromFile('{"kind":"something.else"}').error).toBe('kind')
    expect(fromFile('{"kind":"tippani.theme","version":99,"theme":{}}').error).toBe('version')
    expect(fromFile('{"kind":"tippani.theme","version":1}').error).toBe('shape')
  })

  // A FORWARD VERSION IS REFUSED RATHER THAN GUESSED AT. Reading a later
  // release's file as though it were this one produces a look nobody chose.
  it('refuses a theme from a newer release instead of half-reading it', () => {
    expect(fromFile('{"kind":"tippani.theme","version":2,"theme":{"name":"x"}}').error).toBe('version')
  })

  it('names an unnamed import rather than importing a nameless row', () => {
    const got = fromFile('{"kind":"tippani.theme","version":1,"theme":{"accent":"olive"}}')
    expect(got.theme.name).toBeTruthy()
  })
})
