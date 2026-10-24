// The pure half of the quote-card image: what goes on the card (buildModel),
// how it is broken into lines (flowRuns), and the one colour conversion the
// canvas needs (hexToRgba). Nothing here touches a real canvas — flowRuns asks
// its ctx for measureText and nothing else, so a fake with arithmetic widths
// makes the wrapping exactly predictable instead of font-dependent.
//
// The invariant I care most about is the first one: the image and the text
// formats are two renderings of the SAME choice. If buildModel and
// buildShareText ever disagree about which ticked field made it out, someone
// copies a quote whose attribution is on the picture but not in the text (or
// worse, the other way round). So the mirror is asserted directly, over every
// selection of every field, rather than spot-checked.

import { describe, expect, it } from 'vitest'
import { buildModel, drawQuoteCard,  flowRuns,  readTheme } from '../../src/quoteImage.js'
import { bookShare, buildShareText, movieShare, quoteShare } from '../../src/share.jsx'

// ---- fixtures ----------------------------------------------------------

const earthsea = () =>
  bookShare({
    quote: 'Only in silence the word',
    note: 'The opening of the Creation of Ea.',
    author: 'Ursula K. Le Guin',
    title: 'A Wizard of Earthsea',
    published: 1968,
    chapter: '1',
    location: '12',
    date: '2026-08-01',
    tags: ['magic', 'true names'],
    color: 'yellow',
  })

const casablanca = () =>
  movieShare({
    quote: 'Here is looking at you, kid.',
    note: 'The last time he says it.',
    character: 'Rick Blaine',
    actor: 'Humphrey Bogart',
    title: 'Casablanca',
    year: 1942,
    timestamp: '01:02:03',
    tags: ['farewell'],
  })

const ALL = new Proxy({}, { get: () => true })

// Every on/off combination of the given field ids, as selection maps. 2^9 for
// the book fixture is 512 maps — cheap, and it is the only way to be sure the
// two renderers agree on *every* choice rather than the handful I thought of.
const everySelection = (ids) => {
  const out = []
  for (let mask = 0; mask < 1 << ids.length; mask++) {
    const sel = {}
    ids.forEach((id, i) => {
      if (mask & (1 << i)) sel[id] = true
    })
    out.push(sel)
  }
  return out
}

// modelToPlaintext re-renders the drawable model in the plaintext share format.
// Deliberately a mirror of buildShareText's assembly rather than a call into it:
// the point is to compare two independent paths through the same payload. It
// mirrors the plaintext format specifically because plaintext adds no markup, so
// what is left is exactly the content both sides selected.
const modelToPlaintext = (model) => {
  const blocks = []
  if (model.quote) blocks.push(`“${model.quote}”`)
  if (model.attribution.length) blocks.push('— ' + model.attribution.map((p) => p.text).join(', '))
  if (model.meta.length) blocks.push(model.meta.join(' · '))
  if (model.note) blocks.push(model.note)
  const tags = model.tags
    .map((t) => String(t).trim().replace(/\s+/g, ''))
    .filter(Boolean)
    .map((t) => '#' + t)
    .join(' ')
  if (tags) blocks.push(tags)
  return blocks.join('\n\n')
}

const bose = () =>
  quoteShare({
    quote: 'Give me blood, and I will give you freedom',
    note: 'the Azad Hind broadcast',
    speaker: 'Subhas Chandra Bose',
    occasion: 'Burma Radio broadcast',
    when: '1944',
    place: 'Burma',
    medium: 'radio',
    date: '2026-08-01',
    tags: ['freedom'],
    color: 'blue',
  })

// ---- buildModel: the mirror --------------------------------------------

describe('buildModel mirrors buildShareText field for field', () => {
  const agreesOn = (share, ids) => {
    const disagreements = []
    for (const selected of everySelection(ids)) {
      const image = modelToPlaintext(buildModel(share, selected, null))
      const text = buildShareText(share, selected, 'plaintext')
      if (image !== text) disagreements.push({ ticked: Object.keys(selected), image, text })
    }
    return disagreements
  }

  const KINDS = [
    ['all 512 selections of a book quote', earthsea,
      ['quote', 'author', 'work', 'published', 'chapter', 'location', 'noted', 'tags', 'note']],
    ['all 256 selections of a film line', casablanca,
      ['quote', 'work', 'year', 'character', 'actor', 'timestamp', 'tags', 'note']],
    // The third kind (§24). Its field set is new on both sides at once, so this
    // is the run that catches a name typed one way into the payload and another
    // way into the picture.
    ['all 256 selections of a standalone quote', bose,
      ['quote', 'speaker', 'occasion', 'when', 'place', 'medium', 'noted', 'tags']],
  ]

  // One test over all 3 fixtures rather than three it() blocks: each body was
  // the same call to agreesOn with a different fixture and field list. The
  // exhaustive sweep inside agreesOn is untouched, so all 512 + 256 + 256 =
  // 1024 selection comparisons still run, and reporting them as one table means
  // a failure names every kind that disagreed rather than only the first.
  it('agrees with the text on every selection of every kind', () => {
    const got = KINDS.map(([label, make, ids]) => [label, agreesOn(make(), ids)])
    expect(got).toEqual(KINDS.map(([label]) => [label, []]))
  })
})

// ---- flowRuns ----------------------------------------------------------

// 7px per character, so a 70px line fits exactly ten characters and every
// expectation below is arithmetic rather than a font metric.
const fakeCtx = () => ({ font: '', measureText: (s) => ({ width: s.length * 7 }) })
const textOf = (line) => line.map((seg) => seg.text).join('')
const linesOf = (lines) => lines.map(textOf)

describe('flowRuns wrapping', () => {
  it('wraps at the last word that fits', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'aaaa bbbb cccc', font: 'f' }], 70)
    expect(linesOf(lines)).toEqual(['aaaa bbbb', 'cccc'])
  })
})

describe('flowRuns breaking an over-long token', () => {
  // A line too narrow for even one character still has to terminate: the cutter
  // always takes at least one character per pass.
  it('emits one character at a time rather than looping forever', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'abc', font: 'f' }], 3)
    expect(linesOf(lines)).toEqual(['a', 'b', 'c'])
  })
})

// ---- the draw path -------------------------------------------------------
//
// buildModel is where a field arrives and drawQuoteCard is where it becomes
// visible, and until now nothing exercised the second half — so a field could sit
// in the model, pass every test in this file, and be absent from the picture. The
// portrait flag earned the exhaustive toEqual above for exactly that reason; this
// is the other half of it.
//
// A PROXY RATHER THAN A HAND-WRITTEN STUB. drawQuoteCard touches a lot of the 2D
// API and the list will grow; a Proxy answers whatever it asks for and records
// only what matters here, so this harness does not need editing every time the
// drawing gains a gradient or a clip.
function recordingCanvas() {
  const drawn = []
  const chainable = { addColorStop() {} }
  const ctx = new Proxy(
    { drawn },
    {
      get(target, key) {
        if (key === 'drawn') return drawn
        if (key === 'canvas') return { width: 1000, height: 1000 }
        if (key === 'measureText') return (s) => ({ width: String(s).length * 7 })
        if (key === 'fillText') return (s) => drawn.push(String(s))
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => chainable
        if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) })
        if (key in target) return target[key]
        return () => undefined // every other ctx call is a no-op
      },
      set(target, key, value) {
        target[key] = value
        return true
      },
    },
  )
  return { getContext: () => ctx, width: 0, height: 0, style: {}, drawn }
}

describe('drawQuoteCard', () => {
  const theme = readTheme()
  // The flow engine draws WORD BY WORD, and the quote arrives wrapped in
  // typographic quotes, so the recorded calls are fragments rather than
  // sentences. Comparing with the whitespace removed asks the only question this
  // test has: did those glyphs reach the canvas at all.
  const flat = (s) => s.replace(/\s+/g, '')

  it('draws a proverb and its translation as two separate texts', () => {
    const canvas = recordingCanvas()
    const model = buildModel(
      { quote: 'যেমন কর্ম তেমন ফল', translation: 'As the deed, so the fruit' },
      ALL,
      null,
    )
    drawQuoteCard(canvas, model, theme)
    const text = flat(canvas.drawn.join(''))
    // The original, and the translation, and NOT one standing in for the other.
    expect(text).toContain(flat('যেমন কর্ম তেমন ফল'))
    expect(text).toContain(flat('As the deed, so the fruit'))
  })
})
