// buildShareText — the four output formats, and the selection map that decides
// what goes into them.
//
// This is the part of sharing that produces text somebody else reads, in an app
// whose entire subject is quoting accurately. A dropped attribution or a stray
// markdown asterisk is not a rendering glitch, it is a misquote. The shapes are
// built by bookShare/movieShare, so those are tested as the contract they are
// rather than through the component.

import { describe, expect, it } from 'vitest'
import { bookShare, buildShareText, movieShare, quoteShare, SHARE_FORMATS } from '../../src/share.jsx'
import { value } from '../locale-file.js'

const ALL = new Proxy({}, { get: () => true })
const only = (...ids) => Object.fromEntries(ids.map((id) => [id, true]))

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
  })

const casablanca = () =>
  movieShare({
    quote: 'Here is looking at you, kid.',
    character: 'Rick Blaine',
    actor: 'Humphrey Bogart',
    title: 'Casablanca',
    year: 1942,
    timestamp: '01:02:03',
    tags: ['farewell'],
  })

// A standalone quote (§24): no work, so the SPEAKER is the attribution.
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
  })

describe('the format list', () => {
  it('is the four formats the tests below cover', () => {
    expect(SHARE_FORMATS.map((f) => f.id)).toEqual(['whatsapp', 'plaintext', 'markdown', 'reddit'])
  })
})

describe('quoting', () => {
  // One test over all four formats rather than two: the second it() already
  // held three of them in a loop, and folding plaintext in as a fourth row puts
  // the contrast this describe asserts — curly quotes there, a blockquote
  // everywhere else — in one place instead of leaving it implied by the word
  // "else" in a title. Both original assertions survive as rows, and the
  // aggregate names every format that drifted at once.
  const delimited = [
    ['plaintext', '“Only in silence the word”'], // uses curly quotes in plaintext
    ['markdown', '> Only in silence the word'], // uses a blockquote everywhere else
    ['reddit', '> Only in silence the word'],
    ['whatsapp', '> Only in silence the word'],
  ]

  it('uses curly quotes in plaintext and a blockquote everywhere else', () => {
    const got = delimited.map(([fmt]) => [fmt, buildShareText(earthsea(), only('quote'), fmt)])
    expect(got).toEqual(delimited)
  })

  // A multi-line passage has to keep its own line breaks, and every line needs
  // the marker — one "> " on the first line makes the rest fall out of the quote.
  it('prefixes every line of a multi-line quote', () => {
    const share = bookShare({ quote: 'one\ntwo\nthree' })
    expect(buildShareText(share, only('quote'), 'markdown')).toBe('> one\n> two\n> three')
  })
})

describe('emphasis per format', () => {
  const attribution = (fmt) => buildShareText(earthsea(), only('author', 'work'), fmt)

  // One test over all four formats rather than four separate it()s: every body
  // was a single call to attribution() on the same fixture and the same
  // selection, differing only in the format and the expected string. Held as
  // one table the four spellings can be read against each other — which is the
  // whole point of the describe — and the aggregate names every format that
  // drifted at once. This is the shape the file already uses fifteen lines
  // below, in it('emphasises the actor in each format that has emphasis').
  const wrapped = [
    ['markdown', '— **Ursula K. Le Guin**, *A Wizard of Earthsea*'], // bolds the person, italicises the work
    ['reddit', '— **Ursula K. Le Guin**, *A Wizard of Earthsea*'], // the same syntax as markdown
    // WhatsApp's single-character wrappers are the reason emphasis is a format
    // concern at all: * means bold there and italic in markdown.
    ['whatsapp', '— *Ursula K. Le Guin*, _A Wizard of Earthsea_'],
    ['plaintext', '— Ursula K. Le Guin, A Wizard of Earthsea'], // no styling at all
  ]

  it('spells the person and the work the way each format spells emphasis', () => {
    expect(wrapped.map(([fmt]) => [fmt, attribution(fmt)])).toEqual(wrapped)
  })
})

describe('the selection map', () => {
  it('emits only what is ticked', () => {
    expect(buildShareText(earthsea(), only('quote'), 'plaintext')).toBe('“Only in silence the word”')
    expect(buildShareText(earthsea(), only('author'), 'plaintext')).toBe('— Ursula K. Le Guin')
    expect(buildShareText(earthsea(), only('note'), 'plaintext')).toBe('The opening of the Creation of Ea.')
  })

  it('emits nothing when nothing is ticked', () => {
    expect(buildShareText(earthsea(), {}, 'plaintext')).toBe('')
  })

  // A field that is ticked but empty must not leave a dangling separator — an
  // "— " with nothing after it, or a stray " · ".
  it('skips a ticked field with no value', () => {
    const bare = bookShare({ quote: 'q', author: '', title: '' })
    expect(buildShareText(bare, ALL, 'plaintext')).toBe('“q”')
  })

  it('joins blocks with a blank line', () => {
    const out = buildShareText(earthsea(), only('quote', 'author'), 'plaintext')
    expect(out).toBe('“Only in silence the word”\n\n— Ursula K. Le Guin')
  })
})

describe('meta', () => {
  it('joins meta parts with a middle dot and carries their prefixes', () => {
    const out = buildShareText(earthsea(), only('chapter', 'location', 'noted'), 'plaintext')
    expect(out).toBe('Ch. 1 · p.12 · 2026-08-01')
  })
})

describe('tags', () => {
  // A hashtag with a space in it is two hashtags, so the space is stripped
  // rather than replaced — "true names" has to become #truenames.
  it('strips whitespace inside a tag rather than splitting it', () => {
    const out = buildShareText(earthsea(), only('tags'), 'plaintext')
    expect(out).toBe('#magic #truenames')
  })

  it('drops a tag that is only whitespace', () => {
    const share = bookShare({ quote: 'q', tags: ['keep', '   '] })
    expect(buildShareText(share, only('tags'), 'plaintext')).toBe('#keep')
  })

  it('omits the block entirely when no tag survives', () => {
    const share = bookShare({ quote: 'q', tags: ['  '] })
    expect(buildShareText(share, ALL, 'plaintext')).toBe('“q”')
  })
})

describe('the whole card', () => {
  it('assembles a book quote in the epigraph order', () => {
    expect(buildShareText(earthsea(), ALL, 'markdown')).toBe(
      [
        '> Only in silence the word',
        '— **Ursula K. Le Guin**, *A Wizard of Earthsea*, 1968',
        'Ch. 1 · p.12 · 2026-08-01',
        'The opening of the Creation of Ea.',
        '#magic #truenames',
      ].join('\n\n'),
    )
  })

  // This was four toContain calls, which is why it caught nothing. An auditor
  // swapped the character and actor VALUES inside movieShare — so Bogart was
  // emitted as the character and Rick Blaine as the actor — and the test stayed
  // green, because toContain passes whichever slot a name lands in. For a file
  // whose whole point is that a wrong attribution is a misquote, that was the
  // one thing it had to catch. It is an exact-string assertion now.
  it('assembles a film line with its speaker', () => {
    expect(buildShareText(casablanca(), ALL, 'markdown')).toBe(
      [
        '> Here is looking at you, kid.',
        '— *Casablanca*, 1942',
        'Rick Blaine · played by **Humphrey Bogart** · 01:02:03',
        '#farewell',
      ].join('\n\n'),
    )
  })

  it('keeps the character plain and the actor credited', () => {
    // The two are not interchangeable: the character is who said it, the actor
    // is who played them, and only the actor takes the "played by" credit.
    const out = buildShareText(casablanca(), only('character', 'actor'), 'markdown')
    expect(out).toBe('Rick Blaine · played by **Humphrey Bogart**')
    expect(buildShareText(casablanca(), only('character'), 'markdown')).toBe('Rick Blaine')
    expect(buildShareText(casablanca(), only('actor'), 'markdown')).toBe('played by **Humphrey Bogart**')
  })
})

describe('meta prefixes and emphasis', () => {
  // buildShareText applies a meta part's prefix and emphasis in one expression,
  // and the movie actor credit is the only payload that uses either. Deleting
  // both used to pass, silently degrading "Rick Blaine · played by Humphrey
  // Bogart" into an ambiguous "Rick Blaine · Humphrey Bogart".
  //
  // The prefix half of that used to be its own it('carries the prefix in every
  // format'), asserting toContain('played by ') over these same four formats on
  // this same input. Every one of the exact-string assertions below already
  // contains that substring, so it was removed rather than kept as a weaker
  // duplicate — the prefix is still asserted four times, character for
  // character, here.
  it('emphasises the actor in each format that has emphasis', () => {
    expect(buildShareText(casablanca(), only('actor'), 'markdown')).toBe('played by **Humphrey Bogart**')
    expect(buildShareText(casablanca(), only('actor'), 'reddit')).toBe('played by **Humphrey Bogart**')
    expect(buildShareText(casablanca(), only('actor'), 'whatsapp')).toBe('played by *Humphrey Bogart*')
    expect(buildShareText(casablanca(), only('actor'), 'plaintext')).toBe('played by Humphrey Bogart')
  })
})

describe('the payload shapers', () => {
  // Both shapes feed the same builder, so their field ids have to line up with
  // what the selection map is keyed on.
  it('give a book its author/work/published attribution', () => {
    expect(earthsea().attribution.map((a) => a.id)).toEqual(['author', 'work', 'published'])
    // `character` leads the meta line, added in 2.2.3: a highlight has carried
    // one since 0047 and every share of one dropped it.
    expect(earthsea().meta.map((m) => m.id)).toEqual(['character', 'chapter', 'location', 'noted'])
  })

  // The film side was never asserted, so every id could have been renamed to
  // something the selection map does not key on and nothing would have failed —
  // the ALL Proxy answers true for any key, so a renamed id still renders.
  it('give a film its own attribution and meta ids', () => {
    expect(casablanca().attribution.map((a) => a.id)).toEqual(['work', 'year', 'tmdb', 'tvdb'])
    expect(casablanca().meta.map((m) => m.id)).toEqual(['character', 'actor', 'episode', 'timestamp'])
  })

  it('mark the actor as the credited one and the character as plain', () => {
    const actor = casablanca().meta.find((m) => m.id === 'actor')
    const character = casablanca().meta.find((m) => m.id === 'character')
    expect(actor.value).toBe('Humphrey Bogart')
    expect(actor.emphasis).toBe('bold')
    // A PHRASE, NOT A PREFIX, and the difference is the reason this assertion
    // changed shape. "played by " glued to the front of a name is a sentence
    // assembled by concatenation, and the credit does not run left to right in
    // every language — so the key holds the whole clause with the name in a hole,
    // and both renderers (buildShareText, quoteImage) fill it.
    expect(actor.phrase).toBe('share.credit.actor.phrase')
    expect(value(actor.phrase)).toBe('played by {value}')
    expect(character.value).toBe('Rick Blaine')
    expect(character.emphasis).toBeUndefined()
    expect(character.phrase).toBeUndefined()
  })

  // Exact ids again, for the same reason the film case spells them out: the ALL
  // Proxy answers true for any key, so a renamed id renders exactly as before
  // and only a spelled-out list catches it.
  it('give a standalone quote its speaker/occasion/when attribution', () => {
    expect(bose().attribution.map((a) => a.id)).toEqual(['speaker', 'occasion', 'when'])
    // `proverb` leads the meta line and is declared on every standalone quote,
    // empty-valued unless the quote IS one — the same way place/medium/noted are
    // declared and empty on a proverb. It leads because it answers "what is this",
    // which is more general than where or when it was said.
    expect(bose().meta.map((m) => m.id)).toEqual(['proverb', 'place', 'medium', 'noted'])
    // Declared, and inert: a speech is not a proverb, so the value is empty and
    // neither the dialog nor the image offers it.
    expect(bose().meta.find((m) => m.id === 'proverb').value).toBe('')
  })

  it('make the speaker the credited one, the way an author is', () => {
    const speaker = bose().attribution.find((a) => a.id === 'speaker')
    const occasion = bose().attribution.find((a) => a.id === 'occasion')
    expect(speaker.value).toBe('Subhas Chandra Bose')
    expect(speaker.emphasis).toBe('bold')
    expect(occasion.emphasis).toBe('italic')
  })

  it('point the image at the right face for each kind', () => {
    expect(earthsea().facesFor).toBe('author')
    expect(casablanca().facesFor).toBe('actor')
    expect(bose().facesFor).toBe('speaker')
  })

  // A proverb has no speaker and no occasion. It must still share as a quote
  // rather than as an empty attribution line with stray punctuation.
  it('share a proverb as bare words', () => {
    const proverb = quoteShare({ quote: 'Least said, soonest mended' })
    expect(buildShareText(proverb, ALL, 'plaintext')).toBe('“Least said, soonest mended”')
  })

  it('render a whole quote card in the epigraph order', () => {
    expect(buildShareText(bose(), ALL, 'markdown')).toBe(
      [
        '> Give me blood, and I will give you freedom',
        '— **Subhas Chandra Bose**, *Burma Radio broadcast*, 1944',
        'Burma · radio · 2026-08-01',
        'the Azad Hind broadcast',
        '#freedom',
      ].join('\n\n'),
    )
  })

  it('carry the colour through for the image, unused by text', () => {
    const share = bookShare({ quote: 'q', color: 'blue' })
    expect(share.color).toBe('blue')
    expect(buildShareText(share, ALL, 'plaintext')).toBe('“q”')
  })

  it('default every absent field to empty rather than undefined', () => {
    const empty = bookShare({})
    expect(empty.quote).toBe('')
    expect(empty.note).toBe('')
    expect(empty.tags).toEqual([])
    expect(buildShareText(empty, ALL, 'markdown')).toBe('')
  })
})

// THE TWO PICTURES A LINE CAN CARRY, and the fact that the payload now carries
// both rather than only the performer's.
//
// An actor is global and a character belongs to one work — two stored pictures
// since 0049 — and the share card could only ever draw the first. For a line
// whose whole point is who said it, that is often the wrong one: V delivers the
// speech, and Hugo Weaving is a man in a photograph not wearing the mask.
//
// Tested as a CONTRACT here rather than through the panel, for the reason this
// file's header gives: the shapes are what the drawing code reads, and the panel
// only chooses between them.
describe('both faces travel with a share', () => {
  const withCharacters = () =>
    movieShare({
      quote: 'Remember, remember',
      title: 'V for Vendetta',
      character: 'V',
      actor: 'Hugo Weaving',
      people: { 'Hugo Weaving': { name: 'Hugo Weaving', image_path: 'hugo.jpg' } },
      characterImages: [{ name: 'V', path: 'v-mask.jpg' }],
    })

  it('carries the actor faces and the character faces separately', () => {
    const s = withCharacters()
    expect(s.faces.map((f) => f.name)).toEqual(['Hugo Weaving'])
    expect(s.characterFaces.map((f) => f.name)).toEqual(['V'])
    // Same-origin cover route for both, which is what keeps the canvas untainted.
    expect(s.characterFaces[0].url).toContain('v-mask.jpg')
    // `faces` keeps meaning the actor's, so nothing downstream had to change.
    expect(s.facesFor).toBe('actor')
  })

  it('leaves characterFaces empty when the work has no character art, which is what hides the control', () => {
    // The existing fixture has no characterImages at all — the common case, and
    // the one where offering a choice would be a question with one answer.
    expect(casablanca().characterFaces).toEqual([])
  })

  it('drops a character with no stored picture rather than drawing a blank disc', () => {
    const s = movieShare({
      quote: 'x',
      character: 'V',
      actor: 'Hugo Weaving',
      people: {},
      characterImages: [{ name: 'V', path: '' }, { name: 'Evey', path: 'evey.jpg' }],
    })
    expect(s.characterFaces.map((f) => f.name)).toEqual(['Evey'])
  })

  it('gives a book quote its characters too, which no book surface has ever drawn', () => {
    const s = bookShare({
      quote: 'y',
      author: 'Murakami',
      title: '1Q84',
      people: {},
      characterImages: [{ name: 'Aomame', path: 'aomame.jpg' }],
    })
    expect(s.characterFaces.map((f) => f.name)).toEqual(['Aomame'])
  })
})
