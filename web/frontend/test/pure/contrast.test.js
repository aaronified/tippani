// WCAG AA, COMPUTED RATHER THAN EYEBALLED.
//
// docs/plans/access.md asks for exactly this and says why: "Measure the four
// aesthetics rather than eyeballing them." Its guess about WHICH would fail was
// wrong — it expected the two looks the owner does not use, and both palettes
// failed, the light one worse. That is the argument for a computed test over a
// careful reading: a ratio of 3.49 and a ratio of 4.53 look identical on a screen
// and differ by whether somebody can read the words.
//
// WHAT CHANGED WHEN THIS WAS FIRST RUN, because it is the record of why these hex
// values are what they are:
//
//   light --faint  #8A7C68 -> #766A59   3.49 -> 4.53
//   light --ok     #3E8E5A -> #35794D   3.45 -> 4.51
//   light --amber  #BE8A4E -> #8A6439   2.60 -> 4.55
//   dark  --faint  #9A8C74 -> #A1937D   4.11 -> 4.50
//   dark  --error  #C96B5B -> #D18072   3.70 -> 4.54
//
// Each was moved along its own hue toward the ink end until it cleared, by the
// smallest step that did — 6.5% for the mildest, 27% for amber, which was the
// worst in the app at 2.60 and is the only change a reader will notice.
//
// THE TWO DARK FIGURES WERE SOLVED TWICE, and the first pass is the reason this
// suite checks EVERY surface rather than the obvious one. A throwaway measurement
// solved them against `--card` and reported both clear; `--card-top` is lighter,
// and against it they were 4.21 and 4.20. A guard that checks one background is a
// guard that agrees with whichever background you happened to think of.
//
// TWO PALETTES, NOT FOUR, and the plan's "four aesthetics" is out of date in
// theme.js's own words: "THE FILM PALETTES ARE GONE, NOT MERGED. There is nothing
// of film-light or film-dark in here." Colour comes from the theme; a material set
// changes TEXTURE. So the axis this measures is two, and the eight material sets
// multiply nothing.
//
// AND THE TEXTURES ARE WHY THIS IS FLAT-COLOUR MATH. A grain at 5.5% over the
// background does perturb local luminance, and WCAG has no answer for it — but
// index.css already drops every decorative layer under `prefers-contrast: more`,
// so the reader who needs the ratio is looking at exactly these flat colours.

import { describe, expect, it } from 'vitest'
import { PALETTES } from '../../src/theme.js'

const srgb = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const channels = (hex) => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16))
const luminance = (hex) => {
  const [r, g, b] = channels(hex)
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
}
// An rgba() token composited over a flat backdrop — what the eye actually gets.
// --ink-border is stored that way, and measuring its raw alpha would be measuring
// a colour nobody sees.
function flatten(colour, over) {
  const m = colour.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/)
  if (!m) return colour
  const a = m[4] === undefined ? 1 : Number(m[4])
  const back = channels(over)
  const mix = [1, 2, 3].map((i) => Math.round(Number(m[i]) * a + back[i - 1] * (1 - a)))
  return '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('')
}
function ratio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

// Tokens used as `color:` — 4.5:1. Each is checked against every surface it can
// land on, not only the friendliest one, because the card is lighter than the page
// in one palette and darker in the other.
const SURFACES = ['bg', 'raised', 'card', 'card-top', 'card-bottom']
const TEXT = ['ink', 'soft', 'faint', 'note', 'error', 'ok', 'amber']

describe('every text colour clears WCAG AA on every surface it can sit on', () => {
  for (const palette of Object.keys(PALETTES)) {
    for (const token of TEXT) {
      it(`${palette}: --${token}`, () => {
        const p = PALETTES[palette]
        expect(p[token], `--${token} is not in the ${palette} palette`).toBeTruthy()
        for (const surface of SURFACES) {
          const back = flatten(p[surface], p.bg)
          const got = ratio(flatten(p[token], back), back)
          expect(got, `--${token} on --${surface} in ${palette} is ${got.toFixed(2)}:1, ` +
            'and 4.5:1 is the floor for text').toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }
})

// A COMPONENT BOUNDARY IS 3:1 AND A DECORATIVE RULE IS NOT, which is the whole of
// why this list is short. WCAG 1.4.11 governs "visual information required to
// identify user-interface components", and the app's input borders are
// `--ink-border` — checked here, and passing in both palettes at 4.12 and 3.15.
//
// `--line` IS DELIBERATELY NOT IN IT. It is the hairline between rows and sections
// at 186 call sites, and it separates content that is already separated by spacing
// and background. It measures 1.19-1.47:1, and raising it to 3:1 would redraw every
// rule in the app — which is a change to the design rather than an accessibility
// floor, and belongs behind the reader's own contrast switch rather than in the
// palette everyone gets. The same goes for `--frame-border`, `--strip` and
// `--holes-border`, which draw a card's edge, a shelf band and a punch-hole margin.
describe('the borders that identify a control clear 3:1', () => {
  for (const palette of Object.keys(PALETTES)) {
    it(`${palette}: --ink-border on a card`, () => {
      const p = PALETTES[palette]
      const back = flatten(p.card, p.bg)
      const got = ratio(flatten(p['ink-border'], back), back)
      expect(got, `--ink-border on --card in ${palette} is ${got.toFixed(2)}:1; it draws every ` +
        'input border, so 3:1 is the floor').toBeGreaterThanOrEqual(3)
    })
  }
})

// A WALK THAT MEASURES NOTHING PASSES SILENTLY. Two palettes, seven text tokens,
// five surfaces: 70 pairs, plus two borders.
it('measured both palettes and every surface, rather than finding nothing to check', () => {
  expect(Object.keys(PALETTES).sort()).toEqual(['dark', 'light'])
  for (const p of Object.values(PALETTES)) {
    for (const key of [...TEXT, ...SURFACES, 'ink-border']) {
      expect(p[key], `the palette lost --${key}, so this suite silently stopped checking it`).toBeTruthy()
    }
  }
})
