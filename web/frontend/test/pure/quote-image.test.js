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
import { buildModel, drawQuoteCard, facesOnAttribution, flowRuns, hexToRgba, readTheme } from '../../src/quoteImage.js'
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
const only = (...ids) => Object.fromEntries(ids.map((id) => [id, true]))

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

  // The emphasis flags are the other half of the mirror: plaintext throws them
  // away, so the string comparison above cannot see them. Markdown can.
  it('carries the same emphasis markdown would apply to the attribution', () => {
    const share = earthsea()
    const model = buildModel(share, ALL, null)
    const wrapped = model.attribution
      .map((p) => (p.emphasis === 'bold' ? `**${p.text}**` : p.emphasis === 'italic' ? `*${p.text}*` : p.text))
      .join(', ')
    expect(buildShareText(share, ALL, 'markdown').split('\n\n')[1]).toBe('— ' + wrapped)
  })
})

// ---- buildModel: the details -------------------------------------------

describe('buildModel selection', () => {
  it('drops the quote when it is not ticked', () => {
    expect(buildModel(earthsea(), only('author'), null).quote).toBe('')
    expect(buildModel(earthsea(), only('quote'), null).quote).toBe('Only in silence the word')
  })

  it('keeps attribution in payload order, not selection order', () => {
    const model = buildModel(earthsea(), only('published', 'author'), null)
    expect(model.attribution.map((p) => p.text)).toEqual(['Ursula K. Le Guin', '1968'])
  })

  it('tags each attribution part with the emphasis its kind gets', () => {
    const model = buildModel(earthsea(), ALL, null)
    expect(model.attribution).toEqual([
      { text: 'Ursula K. Le Guin', emphasis: 'bold' },
      { text: 'A Wizard of Earthsea', emphasis: 'italic' },
      { text: '1968', emphasis: undefined },
    ])
  })

  it('flattens meta to prefixed strings', () => {
    expect(buildModel(casablanca(), ALL, null).meta).toEqual([
      'Rick Blaine',
      'played by Humphrey Bogart',
      '01:02:03',
    ])
  })

  // Deliberate asymmetry, not a mirror failure: the meta line is drawn as one
  // uppercase mono run, so there is nowhere to put the actor's bold that the
  // markdown/whatsapp text gives it. Pinned so the flattening is a decision
  // somebody made rather than something that quietly went missing.
  it('drops the emphasis on a meta part, which the text formats keep', () => {
    const share = casablanca()
    expect(buildModel(share, ALL, null).meta).toContain('played by Humphrey Bogart')
    expect(buildShareText(share, only('actor'), 'markdown')).toBe('played by **Humphrey Bogart**')
  })

  // A field can be ticked and still have nothing in it (a book with no chapter
  // recorded). The card must not grow an empty line for it.
  it('skips a ticked field with an empty value', () => {
    const bare = bookShare({ quote: 'q', author: '', title: '', chapter: '' })
    const model = buildModel(bare, ALL, null)
    expect(model.attribution).toEqual([])
    expect(model.meta).toEqual([])
  })

  it('returns an empty model when nothing is ticked', () => {
    const model = buildModel(earthsea(), {}, null)
    expect(model.quote).toBe('')
    expect(model.attribution).toEqual([])
    expect(model.meta).toEqual([])
    expect(model.tags).toEqual([])
    expect(model.note).toBe('')
  })

  // A PROVERB IS TWO TEXTS. The original carries the language and the
  // translation carries the sense, so a share of one that dropped either is half
  // the quote — and the toggle has to work in both directions, because somebody
  // sharing to readers of that language wants the original alone.
  it('carries a translation, and drops it when unticked', () => {
    const share = { quote: 'যেমন কর্ম তেমন ফল', translation: 'As the deed, so the fruit' }
    expect(buildModel(share, ALL, null).translation).toBe('As the deed, so the fruit')
    // ALL is a Proxy with no own keys, so it cannot be spread — everything-but
    // has to be another Proxy, or the untick test silently unticks the lot.
    const allBut = (id) => new Proxy({}, { get: (_t, k) => k !== id })
    expect(buildModel(share, allBut('translation'), null).translation).toBe('')
    // The original is untouched by the translation's own toggle.
    expect(buildModel(share, allBut('translation'), null).quote).toBe('যেমন কর্ম তেমন ফল')
  })

  it('survives a payload with no arrays at all', () => {
    // Exhaustive on purpose: toEqual over the WHOLE model, so a field added to
    // buildModel and forgotten everywhere else fails here rather than being
    // silently absent from the drawing. It has already earned that once — the
    // portrait flag below arrived and this is the test that noticed.
    expect(buildModel({}, ALL, null)).toEqual({
      quote: '',
      translation: '',
      attribution: [],
      meta: [],
      tags: [],
      note: '',
      faces: [],
      facesFor: null,
      colorHex: null,
      portrait: false,
    })
  })
})

// The portrait backdrop bleeds a credited person's photo in from the card edge.
// Every rule about WHETHER it draws lives in buildModel, so it is checkable
// without a canvas — which matters, because the failure mode is not an error. A
// portrait that should not be there is a face over somebody's words.
describe('the portrait backdrop', () => {
  const withFaces = (extra = {}) => ({
    ...earthsea(),
    faces: [{ name: 'Ursula K. Le Guin', url: '/api/covers/a.jpg' }],
    facesFor: 'author',
    ...extra,
  })

  it('is off unless asked for', () => {
    expect(buildModel(withFaces(), ALL, null).portrait).toBe(false)
  })

  it('draws when asked for and somebody has a photo', () => {
    expect(buildModel(withFaces({ portrait: true }), ALL, null).portrait).toBe(true)
  })

  it('refuses when nobody credited has a photo', () => {
    // Not a styling decision: fadedPortrait returns null for a missing image, so
    // an empty faces list would reserve the effect and draw nothing. Saying no
    // here keeps "portrait: true" meaning "there is a portrait".
    const model = buildModel({ ...earthsea(), portrait: true, faces: [] }, ALL, null)
    expect(model.portrait).toBe(false)
  })

  it('goes when its credit goes', () => {
    // The backdrop rides the same faces array as the small discs, which ride the
    // Author / Actor / Speaker tick. Unticking the credit must take both, or you
    // get a card crediting nobody with that nobody's face across it.
    const model = buildModel(withFaces({ portrait: true }), { ...ALL, author: false }, null)
    expect(model.faces).toEqual([])
    expect(model.portrait).toBe(false)
  })
})

describe('buildModel extras the text formats have no use for', () => {
  it('passes the annotation colour through, and normalises absence to null', () => {
    expect(buildModel(earthsea(), ALL, '#B4482D').colorHex).toBe('#B4482D')
    expect(buildModel(earthsea(), ALL, '').colorHex).toBeNull()
    expect(buildModel(earthsea(), ALL, undefined).colorHex).toBeNull()
  })

  // Faces ride with the credit they belong to: unticking Author has to take the
  // author's portrait off the card too, or the picture credits somebody the
  // sharer chose to leave out.
  it('gates the faces on the credit named by facesFor', () => {
    const share = { ...earthsea(), faces: [{ name: 'Ursula K. Le Guin', url: '/img/1' }] }
    expect(share.facesFor).toBe('author')
    expect(buildModel(share, only('author'), null).faces).toHaveLength(1)
    expect(buildModel(share, only('quote', 'work'), null).faces).toEqual([])
  })

  it('shows faces unconditionally when no credit gates them', () => {
    const share = { quote: 'q', faces: [{ name: 'Nobody', url: '/img/1' }] }
    expect(buildModel(share, {}, null).faces).toHaveLength(1)
    expect(buildModel(share, {}, null).facesFor).toBeNull()
  })

  it('reports the actor as the face gate for a film line', () => {
    const share = { ...casablanca(), faces: [{ name: 'Humphrey Bogart', url: '/img/2' }] }
    expect(buildModel(share, ALL, null).facesFor).toBe('actor')
    expect(buildModel(share, only('quote'), null).faces).toEqual([])
  })

  // The one place the two renderings genuinely differ. buildShareText runs every
  // tag through a hashtag cleaner that drops whitespace-only entries; buildModel
  // hands the raw strings to the pill drawer, so a tag of spaces becomes a small
  // empty pill on the image and nothing at all in the text. Pinned as current
  // behaviour rather than asserted as correct.
  it('carries tags raw, including one the text would drop', () => {
    const share = bookShare({ quote: 'q', tags: ['magic', '   '] })
    expect(buildModel(share, ALL, null).tags).toEqual(['magic', '   '])
    expect(buildShareText(share, ALL, 'plaintext')).toBe('“q”\n\n#magic')
  })
})

// ---- flowRuns ----------------------------------------------------------

// 7px per character, so a 70px line fits exactly ten characters and every
// expectation below is arithmetic rather than a font metric.
const fakeCtx = () => ({ font: '', measureText: (s) => ({ width: s.length * 7 }) })
const textOf = (line) => line.map((seg) => seg.text).join('')
const linesOf = (lines) => lines.map(textOf)

describe('flowRuns wrapping', () => {
  it('keeps a run that fits on one line', () => {
    expect(linesOf(flowRuns(fakeCtx(), [{ text: 'short', font: 'f' }], 70))).toEqual(['short'])
  })

  it('wraps at the last word that fits', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'aaaa bbbb cccc', font: 'f' }], 70)
    expect(linesOf(lines)).toEqual(['aaaa bbbb', 'cccc'])
  })

  // A token whose width is exactly the line width still fits: the break is on
  // `>`, not `>=`. Off by one here and every full-width line would break early.
  it('treats a token exactly as wide as the line as fitting', () => {
    expect(linesOf(flowRuns(fakeCtx(), [{ text: 'abcdefghij', font: 'f' }], 70))).toEqual(['abcdefghij'])
  })

  // ...except that on its own the line above cannot tell `>` from `>=`, which is
  // exactly the bug it is named after. At precisely the line width the
  // character-cutter emits the whole token as one chunk, so the over-long branch
  // and the fits-fine branch print the same string and the assertion holds either
  // way. Putting a word in front separates them: the cutter flushes the pending
  // line unconditionally (keeping its dangling space), the wrap path pops it. I
  // verified this fails when `w > maxWidth` is changed to `w >= maxWidth`.
  it('sends an exactly-line-wide token down the wrap path, not the cutter', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'aaaa abcdefghij', font: 'f' }], 70)
    expect(linesOf(lines)).toEqual(['aaaa', 'abcdefghij'])
    expect(lines[0]).toHaveLength(1) // the cutter would have left 'aaaa ' here
  })

  // The other `>` that must not drift to `>=`: a word landing flush on the right
  // edge belongs on this line, not the next. 'aaaa' + ' ' + 'bbbbb' is 4+1+5 = 10
  // characters = exactly 70px, and nothing else in this file lands on
  // `lineW + w === maxWidth`, so without this the wrap comparison had no boundary
  // test at all and could be off by one unnoticed.
  it('keeps a word that ends exactly on the line width', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'aaaa bbbbb', font: 'f' }], 70)
    expect(linesOf(lines)).toEqual(['aaaa bbbbb'])
    expect(lines).toHaveLength(1)
  })

  it('drops the space left dangling at the end of a wrapped line', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'abcdefghij bbb', font: 'f' }], 70)
    expect(linesOf(lines)).toEqual(['abcdefghij', 'bbb'])
    expect(lines[0]).toHaveLength(1) // the trailing space segment was popped, not just hidden
  })

  it('reports each segment width from the measured text', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'aaaa bbbb cccc', font: 'f' }], 70)
    expect(lines[0].map((s) => s.w)).toEqual([28, 7, 28])
  })

  it('returns nothing for no runs and for an empty run', () => {
    expect(flowRuns(fakeCtx(), [], 70)).toEqual([])
    expect(flowRuns(fakeCtx(), [{ text: '', font: 'f' }], 70)).toEqual([])
  })

  it('coerces a non-string run to text', () => {
    expect(linesOf(flowRuns(fakeCtx(), [{ text: 1968, font: 'f' }], 70))).toEqual(['1968'])
  })
})

describe('flowRuns hard breaks', () => {
  it('breaks at an explicit newline even when the line has room', () => {
    expect(linesOf(flowRuns(fakeCtx(), [{ text: 'one\ntwo', font: 'f' }], 700))).toEqual(['one', 'two'])
  })

  // A blank line between paragraphs is the gap between a quote's stanzas or two
  // speakers' turns; it survives as an empty line rather than collapsing.
  it('keeps a blank line as an empty line', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'a\n\nb', font: 'f' }], 700)
    expect(linesOf(lines)).toEqual(['a', '', 'b'])
    expect(lines[1]).toEqual([])
  })

  it('keeps a leading newline as an empty first line', () => {
    expect(linesOf(flowRuns(fakeCtx(), [{ text: '\nx', font: 'f' }], 700))).toEqual(['', 'x'])
  })

  it('applies hard breaks and width wrapping together', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'aaaa bbbb cccc\ndddd', font: 'f' }], 70)
    expect(linesOf(lines)).toEqual(['aaaa bbbb', 'cccc', 'dddd'])
  })
})

describe('flowRuns leading-space suppression', () => {
  it('drops a space that would start a line after a hard break', () => {
    expect(linesOf(flowRuns(fakeCtx(), [{ text: 'a\n  b', font: 'f' }], 700))).toEqual(['a', 'b'])
  })

  it('drops a space at the very start of the flow', () => {
    expect(linesOf(flowRuns(fakeCtx(), [{ text: '   x', font: 'f' }], 700))).toEqual(['x'])
  })

  // Indent-then-wrap: no line may open with whitespace, so the wrapped line
  // starts flush at the same x as the one above it.
  it('never opens a wrapped line with whitespace', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'aaaa bbbb cccc dddd eeee', font: 'f' }], 70)
    // Pin the wrap before looping. The loop below is guarded on `line.length`, so
    // an implementation that returned nothing (or only empty lines) would satisfy
    // it by running zero assertions — a green test proving nothing.
    expect(linesOf(lines)).toEqual(['aaaa bbbb', 'cccc dddd', 'eeee'])
    for (const line of lines) {
      if (line.length) expect(line[0].text).not.toMatch(/^\s/)
    }
  })
})

describe('flowRuns breaking an over-long token', () => {
  // A token wider than the whole line has nowhere to wrap, so it is cut by
  // character. Anything else and a pasted URL bleeds off the card edge.
  it('cuts a long token into line-width chunks', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'ABCDEFGHIJKLMNOPQRSTUVW', font: 'f' }], 70)
    expect(linesOf(lines)).toEqual(['ABCDEFGHIJ', 'KLMNOPQRST', 'UVW'])
  })

  it('measures every chunk it emits', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'ABCDEFGHIJKLMNOPQRSTUVW', font: 'f' }], 70)
    expect(lines.map((l) => l[0].w)).toEqual([70, 70, 21])
  })

  it('keeps the run font on every chunk', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'ABCDEFGHIJKLMN', font: 'italic 27px serif' }], 70)
    expect(lines.map((l) => l[0].font)).toEqual(['italic 27px serif', 'italic 27px serif'])
  })

  it('flushes whatever was already on the line before cutting', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'hi ABCDEFGHIJKLMN', font: 'f' }], 70)
    // 'hi ' keeps its trailing space: this flush is unconditional, unlike the
    // width-wrap above which pops it. Harmless — it sits at the end of a line.
    expect(linesOf(lines)).toEqual(['hi ', 'ABCDEFGHIJ', 'KLMN'])
  })

  it('carries on flowing after the cut token', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'ABCDEFGHIJKLMN tail', font: 'f' }], 70)
    expect(linesOf(lines)).toEqual(['ABCDEFGHIJ', 'KLMN', 'tail'])
  })

  it('cuts a token exactly twice the line width into two full chunks', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'ABCDEFGHIJKLMNOPQRST', font: 'f' }], 70)
    expect(linesOf(lines)).toEqual(['ABCDEFGHIJ', 'KLMNOPQRST'])
  })

  // A line too narrow for even one character still has to terminate: the cutter
  // always takes at least one character per pass.
  it('emits one character at a time rather than looping forever', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'abc', font: 'f' }], 3)
    expect(linesOf(lines)).toEqual(['a', 'b', 'c'])
  })
})

describe('flowRuns across runs', () => {
  // The attribution line is several runs — "— " plain, the author bold, ", "
  // plain, the title italic — and they have to share a line while each keeps its
  // own face, or the wrap would have to be done per font and would not line up.
  it('puts several runs on one line, each keeping its own font', () => {
    const runs = [
      { text: '— ', font: 'plain' },
      { text: 'Le Guin', font: 'bold' },
      { text: ', ', font: 'plain' },
      { text: 'Earthsea', font: 'italic' },
    ]
    const lines = flowRuns(fakeCtx(), runs, 700)
    expect(lines).toHaveLength(1)
    expect(textOf(lines[0])).toBe('— Le Guin, Earthsea')
    // Eight segments, not four: whitespace is tokenised separately and inherits
    // the font of the run it came from, so the space inside "Le Guin" is bold.
    expect(lines[0].map((s) => s.text)).toEqual(['—', ' ', 'Le', ' ', 'Guin', ',', ' ', 'Earthsea'])
    expect(lines[0].map((s) => s.font)).toEqual([
      'plain', 'plain', 'bold', 'bold', 'bold', 'plain', 'plain', 'italic',
    ])
  })

  it('wraps between runs when the second no longer fits', () => {
    const runs = [
      { text: 'aaaa ', font: 'plain' },
      { text: 'bbbbbbbb', font: 'bold' },
    ]
    const lines = flowRuns(fakeCtx(), runs, 70)
    expect(linesOf(lines)).toEqual(['aaaa', 'bbbbbbbb'])
    expect(lines[1][0].font).toBe('bold')
  })

  // Runs are not word-separated for you: two adjacent runs with no space between
  // them are one visual word, which is what "— " + name relies on.
  it('does not insert a space between adjacent runs', () => {
    const lines = flowRuns(fakeCtx(), [{ text: 'foo', font: 'a' }, { text: 'bar', font: 'b' }], 700)
    expect(linesOf(lines)).toEqual(['foobar'])
  })

  it('measures each run with its own font set on the ctx', () => {
    // A ctx whose widths depend on ctx.font: if flowRuns forgot to set the font
    // before measuring, the wide run would be measured narrow and overflow.
    const ctx = {
      font: '',
      measureText(s) {
        return { width: s.length * (this.font === 'wide' ? 14 : 7) }
      },
    }
    const lines = flowRuns(ctx, [{ text: 'aaaa', font: 'narrow' }, { text: 'bbbb', font: 'wide' }], 70)
    expect(lines[0].map((s) => s.w)).toEqual([28])
    expect(lines[1].map((s) => s.w)).toEqual([56])
  })
})

// ---- hexToRgba ---------------------------------------------------------

describe('hexToRgba', () => {
  // Canvas will not parse a bare hex with alpha, so every translucent fill on
  // the card goes through this. Note the two output spellings: a parsed colour
  // is spaced, the fallback is not — both are valid CSS, and both are pinned so
  // a tidy-up does not change what is drawn without anyone noticing.
  const cases = [
    ['#RRGGBB', '#B4482D', 0.5, 'rgba(180, 72, 45, 0.5)'],
    ['lowercase', '#b4482d', 0.5, 'rgba(180, 72, 45, 0.5)'],
    ['#RGB expanded by doubling', '#abc', 1, 'rgba(170, 187, 204, 1)'],
    ['white shorthand', '#FFF', 0.12, 'rgba(255, 255, 255, 0.12)'],
    ['black', '#000000', 1, 'rgba(0, 0, 0, 1)'],
    ['a missing hash', 'B4482D', 1, 'rgba(180, 72, 45, 1)'],
    ['surrounding whitespace', '  #b4482d  ', 1, 'rgba(180, 72, 45, 1)'],
  ]
  // One test over all 7 rows rather than seven it() blocks: identical assertion
  // form, pure data. Compared as one table of [name, result] pairs, so a
  // failure names every spelling that converted wrongly instead of stopping at
  // the first. Each row keeps its original it() title as its label. The two
  // tests below stay separate on purpose — see their own comments.
  it('converts every hex spelling it accepts', () => {
    const got = cases.map(([name, hex, a]) => [name, hexToRgba(hex, a)])
    expect(got).toEqual(cases.map(([name, , , want]) => [name, want]))
  })

  // The fallback is the app's terracotta accent: a malformed custom property
  // (an unresolved var(), a color-mix() canvas cannot read) draws in the brand
  // colour rather than throwing or painting transparent black.
  const malformed = [
    ['nonsense', 'nonsense'],
    ['an empty string', ''],
    ['a lone hash', '#'],
    ['four digits', '#abcd'],
    ['five digits', '#12345'],
    ['seven digits', '#1234567'],
    ['non-hex letters', '#GGGGGG'],
    ['null', null],
    ['undefined', undefined],
  ]
  // One test over all 9 rows rather than nine it() blocks: the same single line
  // each time, with only the input varying — the expected string is a constant
  // across all nine. Kept as its OWN it() rather than folded into the `cases`
  // table above, because the two tables pin different output spellings on
  // purpose (spaced when parsed, unspaced when falling back), which is exactly
  // what the comment above `cases` says. Every input survives as a row.
  it('falls back to terracotta for anything malformed', () => {
    const got = malformed.map(([name, hex]) => [name, hexToRgba(hex, 0.4)])
    expect(got).toEqual(malformed.map(([name]) => [name, 'rgba(180,72,45,0.4)']))
  })

  // parseInt stops at the first non-hex character instead of failing, so six
  // characters that are only partly hex parse as the prefix rather than falling
  // back. Recorded because it is surprising, not because it is wanted — in
  // practice the input is always a theme variable.
  it('quietly parses six characters whose tail is not hex', () => {
    expect(hexToRgba('#12345G', 1)).toBe('rgba(1, 35, 69, 1)')
  })

  it('passes the alpha through untouched', () => {
    expect(hexToRgba('#000', 0)).toBe('rgba(0, 0, 0, 0)')
    expect(hexToRgba('#000', 0.08)).toBe('rgba(0, 0, 0, 0.08)')
  })
})


// ---- where the portraits hang ------------------------------------------

// This decides which LINE a credit's faces sit beside, and it used to be a
// negative test (`facesFor !== 'actor'`) buried in the draw call — so a new
// credit kind landed on the attribution line by falling through it. That was
// right for a speaker by luck. Nothing tested it, and a mutation flipping the
// rule passed the whole suite.
describe('facesOnAttribution', () => {
  it('puts the credits that ARE the attribution on the attribution line', () => {
    expect(facesOnAttribution('author')).toBe(true)
    expect(facesOnAttribution('speaker')).toBe(true)
  })

  it('leaves an actor on the meta line, where "played by" is', () => {
    expect(facesOnAttribution('actor')).toBe(false)
  })

  // An unknown kind must not inherit a placement by falling through. Defaulting
  // to the author line is the historical behaviour for a payload with no
  // facesFor at all, and that is the only case it covers.
  it('treats a missing credit as an author and an unknown one as neither', () => {
    expect(facesOnAttribution(null)).toBe(true)
    expect(facesOnAttribution(undefined)).toBe(true)
    expect(facesOnAttribution('narrator')).toBe(false)
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

  it('omits the translation when it is unticked', () => {
    const canvas = recordingCanvas()
    const allBut = (id) => new Proxy({}, { get: (_t, k) => k !== id })
    const model = buildModel(
      { quote: 'যেমন কর্ম তেমন ফল', translation: 'As the deed, so the fruit' },
      allBut('translation'),
      null,
    )
    drawQuoteCard(canvas, model, theme)
    const text = flat(canvas.drawn.join(''))
    expect(text).toContain(flat('যেমন কর্ম তেমন ফল'))
    expect(text).not.toContain(flat('As the deed, so the fruit'))
  })
})
