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
import { applyTheme, getResolvedTheme, MAT_SET_LABELS, MAT_SETS, surfaceStyle, TILE_NAMES } from '../../src/theme.js'

const root = () => document.documentElement
const prop = (name) => root().style.getPropertyValue(name).trim()

describe('a material set reaches the page', () => {
  beforeEach(() => {
    root().removeAttribute('style')
    root().removeAttribute('data-mat-set')
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
    // Eight: the seven rooms, and Atrium — whose signature is four flat slots,
    // which is as distinct a signature as any of the others.
    expect(seen.size).toBe(8)
  })

  // ATRIUM IS THE PLAIN ONE, and "plain" has to mean nothing is drawn rather
  // than something is covered. A veil at strength 0 would look identical and
  // still name two tile layers the browser fetches and composites — which is
  // the opposite of the point of the set.

})

describe('a slot can be overridden off the set', () => {
  // WHY OVERRIDES EXIST AT ALL: two tiles in src/textures/ are named by no set —
  // glass-soft, and whatever a later pack adds — so without a per-slot choice they
  // are files nobody can ever see. And a reader who wants Manuscript with a stone
  // floor has nowhere else to say so.
  it('replaces one material and leaves the other three', () => {
    applyTheme({ materialSet: 'manuscript', theme: 'light', tileGround: 'sandstone' })
    expect(prop('--tile-ground')).toBe('var(--tile-sandstone)')
    expect(prop('--tile-shell')).toBe('var(--tile-paper)')
    expect(prop('--tile-card')).toBe('var(--tile-paper)')
    expect(prop('--tile-cover')).toBe('var(--tile-wood)')
  })

})

