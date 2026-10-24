// buildShareText — the four output formats, and the selection map that decides
// what goes into them.
//
// This is the part of sharing that produces text somebody else reads, in an app
// whose entire subject is quoting accurately. A dropped attribution or a stray
// markdown asterisk is not a rendering glitch, it is a misquote. The shapes are
// built by bookShare/movieShare, so those are tested as the contract they are
// rather than through the component.

import { describe, expect, it } from 'vitest'
import { bookShare, buildShareText, shareDefaults } from '../../src/share.jsx'

const ALL = new Proxy({}, { get: () => true })

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
})

// ---- what a freshly-opened share starts with -------------------------------
//
// THE OWNER: "except for the quote annoations, others do not need year of
// writing/shooting/recording etc. as those are already there in the work level
// details." A book's publication year and a film's release year are facts about
// the WORK, named on a credit line that already says the work — so they come off
// by default. A standalone quote is the stated exception: its `when` is the
// OCCASION's date, the quote's own, and there is no work behind it to carry the
// date instead.
//
// A DEFAULT AND NOT A REMOVAL, which is their other ruling on this dialog: "the
// user anyway chooses what to put on the share image." So each case below
// asserts the part is still LISTED as well as unticked — a part deleted from the
// payload would satisfy "unticked" and take the reader's choice with it.
describe('shareDefaults — what comes without being asked for', () => {
  const book = () => bookShare({
    quote: 'Only in silence the word',
    author: 'Ursula K. Le Guin',
    title: 'A Wizard of Earthsea',
    published: 1968,
    chapter: '3',
    location: '12',
    date: '2026-08-01',
  })

  const listed = (share) => Object.keys(shareDefaults(share))

  it("a book's publication year is offered and starts off", () => {
    expect(listed(book())).toContain('published')
    expect(shareDefaults(book()).published).toBe(false)
  })
})
