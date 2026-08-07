// buildShareText — the four output formats, and the selection map that decides
// what goes into them.
//
// This is the part of sharing that produces text somebody else reads, in an app
// whose entire subject is quoting accurately. A dropped attribution or a stray
// markdown asterisk is not a rendering glitch, it is a misquote. The shapes are
// built by bookShare/movieShare, so those are tested as the contract they are
// rather than through the component.

import { describe, expect, it } from 'vitest'
import { bookShare, buildShareText, movieShare, SHARE_FORMATS } from '../../src/share.jsx'

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

describe('the format list', () => {
  it('is the four formats the tests below cover', () => {
    expect(SHARE_FORMATS.map((f) => f.id)).toEqual(['whatsapp', 'plaintext', 'markdown', 'reddit'])
  })
})

describe('quoting', () => {
  it('uses curly quotes in plaintext', () => {
    const out = buildShareText(earthsea(), only('quote'), 'plaintext')
    expect(out).toBe('“Only in silence the word”')
  })

  it('uses a blockquote everywhere else', () => {
    for (const fmt of ['markdown', 'reddit', 'whatsapp']) {
      expect(buildShareText(earthsea(), only('quote'), fmt)).toBe('> Only in silence the word')
    }
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

  it('bolds the person and italicises the work in markdown', () => {
    expect(attribution('markdown')).toBe('— **Ursula K. Le Guin**, *A Wizard of Earthsea*')
  })

  it('uses the same syntax for reddit', () => {
    expect(attribution('reddit')).toBe('— **Ursula K. Le Guin**, *A Wizard of Earthsea*')
  })

  // WhatsApp's single-character wrappers are the reason emphasis is a format
  // concern at all: * means bold there and italic in markdown.
  it('uses single-character wrappers for whatsapp', () => {
    expect(attribution('whatsapp')).toBe('— *Ursula K. Le Guin*, _A Wizard of Earthsea_')
  })

  it('applies no styling at all in plaintext', () => {
    expect(attribution('plaintext')).toBe('— Ursula K. Le Guin, A Wizard of Earthsea')
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

  it('assembles a film line with its speaker', () => {
    const out = buildShareText(casablanca(), ALL, 'plaintext')
    expect(out).toContain('“Here is looking at you, kid.”')
    expect(out).toContain('Rick Blaine')
    expect(out).toContain('Casablanca')
    expect(out).toContain('#farewell')
  })
})

describe('the payload shapers', () => {
  // Both shapes feed the same builder, so their field ids have to line up with
  // what the selection map is keyed on.
  it('give a book its author/work/published attribution', () => {
    expect(earthsea().attribution.map((a) => a.id)).toEqual(['author', 'work', 'published'])
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
