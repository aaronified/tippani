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
import { PHYS, lightLayers, physDirty, physFor } from '../../src/theme.js'

describe('the factory numbers', () => {
  it('gives an untouched tile exactly what the table says', () => {
    expect(physFor('marble')).toEqual(PHYS.marble)
    expect(physFor('wool')).toEqual(PHYS.wool)
  })

  // A TILE THE BUILD DOES NOT KNOW IS NOT AN ERROR. A preference can name one —
  // written by a build one release ahead, or simply mistyped — and the answer is a
  // plain surface rather than a crash, because the alternative is a screen that
  // fails to paint over a texture nobody can see anyway.
  it('falls back rather than throwing on a tile it has never heard of', () => {
    expect(physFor('unobtainium')).toEqual(PHYS.matte)
  })

  it('takes the reader edits over the factory, per dial', () => {
    const got = physFor('marble', { marble: { hard: 10 } })
    expect(got.hard).toBe(10)
    // The three untouched dials still come from the table — an edit is an edit to
    // one number, not a replacement of the material's whole behaviour.
    expect(got.sss).toBe(PHYS.marble.sss)
    expect(got.diff).toBe(PHYS.marble.diff)
    expect(got.refl).toBe(PHYS.marble.refl)
  })

  // A GLOBAL MULTIPLIER WAS THE ALTERNATIVE AND THIS IS WHY IT WAS NOT BUILT: the
  // answer to "make my paper less shiny" is about paper, and a dial that moved all
  // twenty-seven would make the other twenty-six wrong to fix one.
  it('leaves every other material alone when one is edited', () => {
    const tweaks = { marble: { hard: 10 } }
    expect(physFor('wool', tweaks)).toEqual(PHYS.wool)
    expect(physFor('paper', tweaks)).toEqual(PHYS.paper)
  })

  it('ignores a value outside the range rather than compiling it', () => {
    // 0-100 is what the sliders offer; a stored value outside it came from
    // somewhere else and the factory number is a better answer than a gradient
    // with a negative alpha in it.
    expect(physFor('paper', { paper: { hard: 400 } }).hard).toBe(PHYS.paper.hard)
    expect(physFor('paper', { paper: { hard: -1 } }).hard).toBe(PHYS.paper.hard)
    expect(physFor('paper', { paper: { hard: 'loud' } }).hard).toBe(PHYS.paper.hard)
  })
})

describe('what the dials compile to', () => {
  it('is a static gradient stack, with one blend mode per layer', () => {
    const { layers, modes } = lightLayers('marble', {}, false)
    expect(layers.length).toBe(modes.length)
    expect(layers.length).toBeGreaterThan(0)
    for (const l of layers) {
      expect(l.startsWith('radial-gradient(')).toBe(true)
      // NOTHING DEFERRED TO PAINT TIME. A var() or a color-mix() here would be a
      // value the compositor resolves per frame rather than one written once.
      expect(l).not.toContain('var(')
      expect(l).not.toContain('color-mix(')
    }
  })

  // FIVE STOPS ON A CURVE, NOT TWO. A wide gradient with two stops steps in 1/255
  // jumps a reader can see on a dark ground; five puts the steps under the tile's
  // own noise. Counting them is how that stays true.
  it('ramps in five stops so it cannot band', () => {
    const { layers } = lightLayers('marble', {}, true)
    for (const l of layers) {
      expect((l.match(/rgba\(/g) || []).length).toBe(5)
    }
  })

  it('draws nothing at all for a material that does nothing', () => {
    // Atrium's material is the absence of one, and the operator's identity element
    // has to stay identity — a stack of invisible layers still costs a composite.
    expect(lightLayers('flat', {}, false).layers).toEqual([])
  })

  // THE DIAL HAS TO REACH THE OUTPUT, which is the whole claim. Turning hardness
  // down spreads the highlight and dims it; a stack that did not change would mean
  // the control was decorative.
  it('changes the stack when a dial moves', () => {
    const hard = lightLayers('marble', { marble: { hard: 100 } }, false).layers.join('|')
    const soft = lightLayers('marble', { marble: { hard: 0 } }, false).layers.join('|')
    expect(hard).not.toBe(soft)
  })

  it('drops a layer entirely when its dial reaches nothing', () => {
    const withRefl = lightLayers('metal', {}, false).layers.length
    const without = lightLayers('metal', { metal: { refl: 0, diff: 0 } }, false).layers.length
    expect(without).toBeLessThan(withRefl)
  })
})

describe('knowing whether there is anything to undo', () => {
  it('says no for an untouched tile, and for one set back to its own factory', () => {
    expect(physDirty('paper', {})).toBe(false)
    expect(physDirty('paper', { paper: { hard: PHYS.paper.hard } })).toBe(false)
  })

  it('says yes once a dial differs', () => {
    expect(physDirty('paper', { paper: { hard: PHYS.paper.hard + 1 } })).toBe(true)
  })
})
