// Colour categories — what a slot is called, what it looks like, and whether it
// is offered.
//
// The rule underneath all of it: the stored TOKEN never moves. Everything here
// is presentation, and the moment that stops being true a Markdown export stops
// round-tripping and nobody finds out until they re-import a year of
// highlights. The Go side asserts the export directly; this side asserts the
// three things a client can get wrong on its own — naming the default bucket,
// hiding a colour off a quote that already wears it, and copying a hex where a
// custom property was needed.
//
// theme.js holds module-level state, so every case re-imports a fresh copy.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const load = async () => {
  vi.resetModules()
  return import('../../src/theme.js')
}

beforeEach(() => {
  document.documentElement.removeAttribute('style')
})
afterEach(() => {
  vi.resetModules()
})

const hl = (n) => document.documentElement.style.getPropertyValue('--hl-' + n)

describe('applyColors', () => {
  it('writes the built-ins when nothing is stored', async () => {
    const { applyColors, CATEGORY_DEFAULT_HEX } = await load()
    applyColors({})
    for (let i = 0; i < CATEGORY_DEFAULT_HEX.length; i++) {
      expect(hl(i + 1), `--hl-${i + 1}`).toBe(CATEGORY_DEFAULT_HEX[i])
    }
  })

  it('writes a chosen colour to the custom property the whole app reads', async () => {
    const { applyColors } = await load()
    applyColors({ catColor2: '#5AA8B5' })
    expect(hl(2)).toBe('#5AA8B5')
  })

  it('falls back to the built-in for a colour that is not one', async () => {
    // A restored archive or a hand-edited row can carry anything. A slot with a
    // bad value must look like the app's own colour, not like nothing — an empty
    // custom property leaves a card with no colour bar at all.
    const { applyColors, CATEGORY_DEFAULT_HEX } = await load()
    applyColors({ catColor3: 'not a colour' })
    expect(hl(3)).toBe(CATEGORY_DEFAULT_HEX[2])
  })
})

describe('the first slot is the default, not a category', () => {
  it('refuses a name even if one is stored', async () => {
    // The server rejects this, so the only way it arrives is a restored archive
    // or a hand-edited row — and the client is where it would be SEEN.
    const { applyColors, categoryName, UNSET_LABEL } = await load()
    applyColors({ catName1: 'Inspirational' })
    expect(categoryName('yellow')).toBe(UNSET_LABEL)
  })

  it('refuses to be hidden even if hiding is stored', async () => {
    const { applyColors, categoryHidden, visibleCategories } = await load()
    applyColors({ catHidden1: true })
    expect(categoryHidden('yellow')).toBe(false)
    expect(visibleCategories()).toContain('yellow')
  })

  it('still takes a colour, because that is presentation', async () => {
    const { applyColors, categoryHex } = await load()
    applyColors({ catColor1: '#B0806B' })
    expect(categoryHex('yellow')).toBe('#B0806B')
  })

  it('says it is the absence of a choice, not a colour word', async () => {
    // "Yellow" invites you to read it as one category among four. It is not: it
    // is what a quote gets when nobody picked, and what an import writes when
    // the source named no colour.
    const { applyColors, categoryName, UNSET_LABEL } = await load()
    applyColors({})
    expect(categoryName('yellow')).toBe(UNSET_LABEL)
    expect(categoryName('yellow')).not.toMatch(/yellow/i)
  })
})

describe('names', () => {
  it('uses the reader’s word when there is one', async () => {
    const { applyColors, categoryName } = await load()
    applyColors({ catName2: 'Fact', catName3: 'Disagreed' })
    expect(categoryName('blue')).toBe('Fact')
    expect(categoryName('pink')).toBe('Disagreed')
  })

  it('falls back to the BUILT-IN name, not the colour word', async () => {
    // "Blue" is what the token is; "Fact" is what it is for, and the app arrives
    // with an opinion rather than a colour word and an empty box. None of these
    // is stored — an untouched account stores nothing at all.
    const { applyColors, categoryName, CATEGORY_DEFAULT_NAME, CATEGORY_SLOTS } = await load()
    applyColors({})
    expect(categoryName('blue')).toBe('Fact')
    expect(categoryName('pink')).toBe('Disagreed')
    expect(categoryName('orange')).toBe('Inspirational')
    expect(categoryName('green')).toBe('Funny')
    expect(categoryName('purple')).toBe('Meta')
    // Every slot past the first has one, or a colour arrives unnamed.
    for (let i = 1; i < CATEGORY_SLOTS.length; i++) {
      expect(CATEGORY_DEFAULT_NAME[i], `slot ${i + 1} has no built-in name`).toBeTruthy()
    }
  })

  it('a reader’s name still beats the built-in', async () => {
    const { applyColors, categoryName } = await load()
    applyColors({ catName2: 'Evidence' })
    expect(categoryName('blue')).toBe('Evidence')
  })

  it('passes an unknown token straight through', async () => {
    // Callers hand this whatever a row's `color` column said. A future token, or
    // a corrupted one, must render as itself rather than as undefined.
    const { applyColors, categoryName } = await load()
    applyColors({})
    expect(categoryName('chartreuse')).toBe('chartreuse')
  })
})

describe('hiding', () => {
  it('takes a category out of the pickers', async () => {
    const { applyColors, visibleCategories, CATEGORY_SLOTS } = await load()
    applyColors({ catHidden4: true })
    expect(visibleCategories()).toEqual(CATEGORY_SLOTS.filter((t) => t !== 'orange'))
  })

  it('hides the two newest ones as readily as the old ones', async () => {
    // The slots a migration added are ordinary slots. Nothing about them is
    // special except that a CHECK on four tables had to be widened to store them.
    const { applyColors, visibleCategories } = await load()
    applyColors({ catHidden5: true, catHidden6: true })
    expect(visibleCategories()).toEqual(['yellow', 'blue', 'pink', 'orange'])
  })

  it('does NOT take it off a quote that already wears it', async () => {
    // The single most important rule here. Hiding is about tidying a picker you
    // have stopped using; a quote silently changing colour because of that would
    // be the app editing your library to match a preference you were not
    // thinking about it with.
    const { applyColors, categoryHex, categoryName, CATEGORY_DEFAULT_HEX } = await load()
    applyColors({ catHidden4: true, catName4: 'Inspirational' })
    expect(categoryHex('orange')).toBe(CATEGORY_DEFAULT_HEX[3])
    expect(categoryName('orange')).toBe('Inspirational')
  })
})

describe('the two ways a colour is read', () => {
  it('categoryVar is a custom property, so a recolour is live', async () => {
    // Everything that is not a canvas goes through here. A copied hex would need
    // a re-render to update; the property updates itself.
    const { categoryVar } = await load()
    expect(categoryVar('yellow')).toBe('var(--hl-1)')
    expect(categoryVar('orange')).toBe('var(--hl-4)')
    expect(categoryVar('nope')).toBeNull()
  })

  it('categoryHex is a real value, because a canvas cannot read a property', async () => {
    // ctx.fillStyle parses neither var() nor color-mix(), so the share image is
    // the one consumer that needs this — and the one whose output leaves the
    // app, which makes it the worst place to be stale.
    const { applyColors, categoryHex } = await load()
    applyColors({ catColor2: '#5AA8B5' })
    expect(categoryHex('blue')).toBe('#5AA8B5')
    expect(categoryHex('nope')).toBeNull()
  })
})

describe('the palette', () => {
  it('never offers a theme accent', async () => {
    // A category colour must never be mistakable for the app's own accent. The
    // server refuses the four exact values; this is the stronger promise the
    // picker keeps, which is that the neighbourhood is left alone entirely.
    const { CATEGORY_PALETTE, ACCENTS } = await load()
    const accents = Object.values(ACCENTS).map((h) => h.toLowerCase())
    for (const [hex] of CATEGORY_PALETTE) {
      expect(accents, `${hex} is a theme accent`).not.toContain(hex.toLowerCase())
    }
  })

  it('is not near one either', async () => {
    // Exact-match is the cheap half. Two colours 8 units apart in RGB are the
    // same colour to a reader, and "these look different enough" is a judgement
    // that quietly stops being true when someone adds a swatch.
    const { CATEGORY_PALETTE, ACCENTS } = await load()
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
    const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0))
    for (const [hex, name] of CATEGORY_PALETTE) {
      for (const [accent, ahex] of Object.entries(ACCENTS)) {
        const d = dist(rgb(hex), rgb(ahex))
        expect(d, `${name} (${hex}) is ${d.toFixed(0)} from the ${accent} accent`).toBeGreaterThan(40)
      }
    }
  })

  it('has no duplicates, and every swatch is named', async () => {
    const { CATEGORY_PALETTE } = await load()
    const hexes = CATEGORY_PALETTE.map(([h]) => h.toLowerCase())
    expect(new Set(hexes).size).toBe(hexes.length)
    for (const [hex, name] of CATEGORY_PALETTE) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(name.trim()).not.toBe('')
    }
  })

  it('contains all four built-ins, so a reader can always get back', async () => {
    const { CATEGORY_PALETTE, CATEGORY_DEFAULT_HEX } = await load()
    const hexes = CATEGORY_PALETTE.map(([h]) => h.toLowerCase())
    for (const d of CATEGORY_DEFAULT_HEX) expect(hexes).toContain(d.toLowerCase())
  })
})

describe('categoryState — what Settings renders from', () => {
  it('reports the raw name, so an unnamed slot shows a placeholder not a value', async () => {
    const { applyColors, categoryState } = await load()
    applyColors({ catName2: 'Fact' })
    const rows = categoryState()
    expect(rows[0].name).toBe('') // never pre-filled with "Uncategorised"
    expect(rows[0].label).toBe('Uncategorised')
    expect(rows[1].name).toBe('Fact')
  })

  it('marks the first slot fixed and flags a custom colour', async () => {
    const { applyColors, categoryState } = await load()
    applyColors({ catColor3: '#5AA8B5' })
    const rows = categoryState()
    expect(rows[0].fixed).toBe(true)
    expect(rows[1].fixed).toBe(false)
    expect(rows[2].custom).toBe(true)
    expect(rows[1].custom).toBe(false)
  })
})

// The name cap. It is fifteen because that is what the Stats breakdown's label
// column is cut to hold outright — the cap and the layout are one number, and
// this is the file that stops them drifting apart.
//
// Lowering it from 24 was not retroactive: rows stored under the old limit are
// still in the database. So the cap is applied on the way IN, where every reader
// sees the same string, rather than in one screen — otherwise Settings would show
// a name capped and the group headings would show it whole.
describe('CAT_NAME_MAX', () => {
  it('is fifteen, and the server agrees', async () => {
    const { CAT_NAME_MAX } = await load()
    expect(CAT_NAME_MAX).toBe(15)
  })

  it('fits every built-in name with room to spare', async () => {
    const { CAT_NAME_MAX, CATEGORY_DEFAULT_NAME, UNSET_LABEL } = await load()
    for (const n of [...CATEGORY_DEFAULT_NAME, UNSET_LABEL]) {
      expect([...n].length, n).toBeLessThanOrEqual(CAT_NAME_MAX)
    }
  })

  it('leaves a name that fits exactly alone', async () => {
    const { capCategoryName, CAT_NAME_MAX } = await load()
    const exact = 'a'.repeat(CAT_NAME_MAX)
    expect(capCategoryName(exact)).toBe(exact)
  })

  it('caps a longer one, and caps it everywhere at once', async () => {
    const { applyColors, categoryName, categoryState, CAT_NAME_MAX } = await load()
    // A name stored under the old 24-character cap.
    applyColors({ catName2: 'Disagreed with strongly' })
    const capped = 'Disagreed with strongly'.slice(0, CAT_NAME_MAX)
    // The pickers and headings read categoryName; Settings reads categoryState.
    // Both have to say the same thing or the field edits a name nothing shows.
    expect(categoryName('blue')).toBe(capped)
    expect(categoryState()[1].name).toBe(capped)
  })

  it('counts CODE POINTS, because the server counts runes', async () => {
    const { capCategoryName, CAT_NAME_MAX } = await load()
    // trimCap in server.go measures len([]rune(s)). Fifteen accented characters
    // are fifteen runes and must survive whole.
    const accents = 'é'.repeat(CAT_NAME_MAX)
    expect(capCategoryName(accents)).toBe(accents)
    // And an astral character is ONE rune to Go. Slicing by UTF-16 unit would cut
    // it in half and send a lone surrogate the server never counts the same way.
    const astral = '🌱'.repeat(CAT_NAME_MAX + 3)
    const out = capCategoryName(astral)
    expect([...out].length).toBe(CAT_NAME_MAX)
    expect(out).toBe('🌱'.repeat(CAT_NAME_MAX))
  })

  it('is untroubled by nothing at all', async () => {
    const { capCategoryName } = await load()
    for (const nil of [undefined, null, '']) expect(capCategoryName(nil)).toBe('')
  })
})
