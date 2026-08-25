// Choosing a material set has to change what the surfaces are made of.
//
// THE FAILURE MODE IS SILENCE, WHICH IS WHY THIS EXISTS. The set is stored, validated
// on the server, carried across an upgrade by a one-time pass, drawn as seven
// specimens in Settings and written onto <html> — and every one of those can work
// perfectly while the app looks identical, because the only thing that finally matters
// is whether a different tile lands on the page. A preference nothing consumes is a
// setting that appears to work: it saves, it reloads, its card shows a tick, and
// nothing on screen is different. That is the shape this file guards against.
//
// It asserts the resolved custom properties rather than any selector, because the
// stylesheet deliberately no longer knows a material's name — index.css says
// `background-image: var(--tile-card)` and theme.js decides what --tile-card is. So
// the contract between them IS the property, and the property is what gets tested.

import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, getResolvedTheme, MAT_SET_LABELS, MAT_SETS, surfaceStyle } from '../../src/theme.js'

const root = () => document.documentElement
const prop = (name) => root().style.getPropertyValue(name).trim()

describe('a material set reaches the page', () => {
  beforeEach(() => {
    root().removeAttribute('style')
    root().removeAttribute('data-mat-set')
  })

  it('lands on <html> so a test, a screenshot and a person can all see it', () => {
    applyTheme({ materialSet: 'quarry', theme: 'light' })
    expect(root().dataset.matSet).toBe('quarry')
    expect(getResolvedTheme().materialSet).toBe('quarry')
  })

  it('puts the set’s own four materials in the four slots', () => {
    // Quarry: sandstone underfoot, a granite bench, coated stock, marble boards.
    applyTheme({ materialSet: 'quarry', theme: 'light' })
    expect(prop('--tile-ground')).toBe('var(--tile-sandstone)')
    expect(prop('--tile-shell')).toBe('var(--tile-granite)')
    expect(prop('--tile-card')).toBe('var(--tile-satin)')
    expect(prop('--tile-cover')).toBe('var(--tile-marble)')
  })

  it('gives every set a different page to read off', () => {
    // The one assertion that a set which changes nothing would fail. Two sets
    // sharing a card material is allowed — Manuscript and School both write on
    // paper — so this asserts the FOUR-slot signature is distinct, which is what
    // makes them different rooms rather than different names.
    const seen = new Map()
    for (const name of Object.keys(MAT_SETS)) {
      applyTheme({ materialSet: name, theme: 'light' })
      const sig = ['ground', 'shell', 'card', 'cover'].map((s) => prop(`--tile-${s}`)).join('|')
      expect(sig, `${name} left a slot empty`).not.toContain('||')
      expect(seen.has(sig), `${name} is ${seen.get(sig)} under another name`).toBe(false)
      seen.set(sig, name)
    }
    expect(seen.size).toBe(7)
  })

  it('names a tile the stylesheet actually declares', () => {
    // theme.js writes var(--tile-linen); index.css has to be the file that says
    // what linen is. A typo here resolves to nothing at all and the surface simply
    // loses its grain — no error, no warning.
    const declared = new Set(
      [...require('node:fs')
        .readFileSync(require('node:path').join(process.env.TIPPANI_SRC, 'index.css'), 'utf8')
        .matchAll(/--tile-([\w-]+):\s*url\(/g)].map((m) => m[1]),
    )
    const missing = []
    for (const name of Object.keys(MAT_SETS)) {
      applyTheme({ materialSet: name, theme: 'light' })
      for (const slot of ['ground', 'shell', 'card', 'cover']) {
        const tile = /var\(--tile-([\w-]+)\)/.exec(prop(`--tile-${slot}`))?.[1]
        if (!declared.has(tile)) missing.push(`${name}/${slot}: --tile-${tile}`)
      }
    }
    expect(missing, 'a slot points at a tile index.css never declares').toEqual([])
  })

  it('falls back to Manuscript rather than to nothing', () => {
    // A stored value from a future release, or a hand-edited one. The old code
    // branched on the theme here; there is one answer now.
    applyTheme({ materialSet: 'vellum', theme: 'dark' })
    expect(root().dataset.matSet).toBe('manuscript')
    expect(prop('--tile-card')).toBe('var(--tile-paper)')
  })
})

describe('the operator writes a whole composite, not just a tile', () => {
  beforeEach(() => {
    root().removeAttribute('style')
  })

  it('veils the surface in its own colour at 1 − strength', () => {
    // paper is strength .10, so the veil is 90% of the card colour and the tile
    // takes the remaining tenth. A veil at 100% would hide the grain completely;
    // one at 0% would put a raw grey tile on the page.
    applyTheme({ materialSet: 'manuscript', theme: 'light' })
    const img = prop('--surf-card-image')
    expect(img).toContain('90.0%')
    expect(img).toContain('var(--tile-paper)')
    expect(prop('--surf-card-blend')).toBe('normal, overlay, normal')
    expect(prop('--surf-card-size')).toContain('220px 220px')
    expect(prop('--surf-card-size')).toContain('71px 71px')
  })

  it('gives glass a blur and a sweep instead of an opaque veil', () => {
    // A pane does not hide what is behind it, it softens it. Office puts glass on
    // the desk, so the ground slot takes the other branch entirely.
    applyTheme({ materialSet: 'office', theme: 'light' })
    expect(prop('--surf-ground-blur')).toContain('blur(18px)')
    expect(prop('--surf-ground-image')).toContain('124deg')
    expect(prop('--surf-ground-border')).not.toBe('transparent')
  })

  it('leaves an opaque material with identity values rather than nothing', () => {
    // Written every time, so switching from a glass set to a stone one cannot
    // leave the pane's blur and rim behind on the new surface.
    applyTheme({ materialSet: 'office', theme: 'light' })
    expect(prop('--surf-ground-blur')).toContain('blur')
    applyTheme({ materialSet: 'quarry', theme: 'light' })
    expect(prop('--surf-ground-blur')).toBe('none')
    expect(prop('--surf-ground-border')).toBe('transparent')
    expect(prop('--surf-ground-inset')).toBe('none')
  })

  it('bleeds the accent into metal and into nothing else', () => {
    // A mirror-ish surface reflects its surroundings rather than holding a colour
    // of its own. Film assembly's desk is metal; Atelier's is canvas.
    applyTheme({ materialSet: 'film-assembly', theme: 'light' })
    expect(prop('--surf-ground-blend')).toBe('soft-light, normal, overlay, normal')
    applyTheme({ materialSet: 'atelier', theme: 'light' })
    expect(prop('--surf-ground-blend')).toBe('normal, overlay, normal')
  })
})

describe('the picker draws what choosing it would do', () => {
  it('previews a set that is not applied, from the same function', () => {
    // Settings shows seven specimens at once; only one of them can be the live
    // set. The old four cards carried hardcoded palette hexes and drifted from
    // theme.js, which is the drift this closes.
    applyTheme({ materialSet: 'manuscript', theme: 'light' })
    const quarry = surfaceStyle('quarry', 'card', false, '#B4482D')
    expect(quarry.backgroundImage).toContain('var(--tile-satin)')
    expect(prop('--tile-card')).toBe('var(--tile-paper)') // the live set is untouched
  })

  it('answers in both modes for the same set', () => {
    const light = surfaceStyle('manuscript', 'card', false, '#B4482D')
    const dark = surfaceStyle('manuscript', 'card', true, '#B4482D')
    expect(light.backgroundColor).not.toBe(dark.backgroundColor)
    // One file serves both: the tile is identical and only the veil colour moves.
    expect(dark.backgroundImage).toContain('var(--tile-paper)')
  })

  it('has a label for every set, and no label for anything else', () => {
    expect(Object.keys(MAT_SET_LABELS).sort()).toEqual(Object.keys(MAT_SETS).sort())
  })
})
