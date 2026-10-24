import { describe, expect, it } from 'vitest'
import { bookShare, buildShareText, quoteShare } from '../../src/share.jsx'
import { actionsFor, atRow } from '../../src/actions.jsx'

// buildShareText — the four output formats, and the selection map that decides
// what goes into them.
//
// This is the part of sharing that produces text somebody else reads, in an app
// whose entire subject is quoting accurately. A dropped attribution or a stray
// markdown asterisk is not a rendering glitch, it is a misquote. The shapes are
// built by bookShare/movieShare, so those are tested as the contract they are
// rather than through the component.
describe('share', () => {
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
})

// A LETTER'S RECIPIENT, AN ESSAY'S TITLE AND ITS PAGE REACH THE SHARE.
//
// WHAT WAS WRONG. `quoteShare` composed its attribution out of flat fields —
// speaker, occasion, when — and never called attribution.js at all. So of the
// five fields migrations 0047 and 0053 added, THREE appeared in no part of the
// share: not in the picture, not in the text. A letter went out as
//
//     — Albert Einstein, 1952
//
// with Carl Seelig nowhere. That is the same "captured and never shown" fault
// attribution.js's own header says taught readers to type the whole attribution
// into Occasion by hand in the first place.
//
// AND THE OBVIOUS FIX IS THE WRONG ONE. Adding recipient, work_title and locator
// as three more flat entries breaks no toggle and reinstates exactly the
// concatenation the attribution work replaced — "Letter · Carl Seelig" where the
// card says "Letter to Carl Seelig". docs/plans/quote-card-types.md ends on that
// warning by name: "if that discipline is not held, B2 and B3 will drift and the
// share image will keep drawing a proverb as a speech."
//
// SO THE SHARE CALLS attributionParts, and these cases are about the two things
// that buys and the one thing it costs.
//
// THE COST, which the owner chose: the phrase rides on the `occasion` id it has
// always had, so a letter's toggle reads "Occasion" over "Letter to Carl Seelig".
// The alternative was a new id, and a new id resets the stored preference of
// every reader who had switched that field off.
describe('share attribution', () => {
  const valueOf = (share, id) =>
    [...share.attribution, ...share.meta].find((e) => e.id === id)?.value || ''

  const letter = () => {
    const row = { kind: 'letter', recipient: 'Carl Seelig', occasion: 'after the prize', place: 'Princeton', locator: 'p. 3' }
    return quoteShare({ row, quote: 'Everything should be made as simple as possible.', speaker: 'Albert Einstein', occasion: row.occasion, when: '1952', place: row.place })
  }

  describe('the phrase the card composes is the phrase the picture shares', () => {
    it('names a letter’s recipient, which reached nothing at all before', () => {
      expect(valueOf(letter(), 'occasion')).toMatch(/^Letter to Carl Seelig\b/)
    })
  })

  // ---- what the phrase already said, and must not say twice ---------------------
  //
  // A RATER FOUND ALL OF THIS, on the surface the change was about. The first cut
  // composed the credit correctly and then printed the kind AGAIN beside it, so a
  // letter shared as "Letter to Carl Seelig … Letter" and a proverb as "Bengali
  // proverb … Bengali … Proverb" — one fact, three times, which is the exact
  // duplicate the attribution work exists to end.
  describe('the kind is in the phrase, so nothing prints it again', () => {
    const share = (row, extra = {}) => quoteShare({ row, quote: 'x', ...extra })

    it('draws no separate Kind beside a phrase', () => {
      // Every branch of phrase() falls back to the kind's own WORD when its shape
      // has nothing, and its default arm returns quoteKindMeta — the very value
      // this entry carries. So a phrase implies the kind by construction, which is
      // why the card draws no medium at all.
      const s = share({ kind: 'letter', recipient: 'Carl Seelig' }, { medium: 'Letter' })
      expect(valueOf(s, 'occasion')).toBe('Letter to Carl Seelig')
      expect(valueOf(s, 'medium')).toBe('')
    })
  })
})

// Copy and share on a favourite tile — and the reason they were missing.
//
// THE BUG THIS FILE EXISTS FOR was invisible in every way a bug can be. Home's
// FavouriteTile asked the registry what could be done to a favourite and passed
// the favourite's OWN kind: `book`, `screen` or `quote`. Two of those are fine.
// The first is not — a favourite of kind `book` is a highlight OUT OF a book,
// while `book` is what the registry calls the book itself, and isWorkKind()
// gates copy and share on exactly that:
//
//     available: !isWork && !!ctx.copy
//
// So every book favourite came back with no copy and no share. The tile drew
// correctly. The handlers were wired and correct. QuoteTools rendered null,
// because null is what it renders for an empty list — and an empty row looks
// exactly like a row nobody has added yet.
//
// That is what let it survive being "fixed": 1.15.3 moved the tools row onto the
// collapsed tile, the row was genuinely added, and it still drew nothing.
//
// TWO HALVES, because the defect lived in the SEAM between them and either half
// alone passes. This file owns the registry half: what the action names mean,
// and which kinds the gate lets through. The screen half — that a favourite tile
// actually draws the row — is in test/dom/home-favourites.test.jsx, where it can
// be looked at.
describe('favourite tools', () => {
  const row = { id: 1, quote: 'The book is the author’s. The margin is yours.' }
  const toolsFor = (kind) =>
    atRow(actionsFor(kind, row, { copy: () => {}, share: () => {} })).map((a) => a.id)

  describe('what the registry will put in a quote card’s tools row', () => {
    it('gives copy and share to the three QUOTE kinds', () => {
      for (const kind of ['annotation', 'dialogue', 'quote']) {
        expect(toolsFor(kind), kind).toEqual(['copy', 'share'])
      }
    })
  })

  // WHAT HOME'S FAVOURITE TABLE REPORTS TO THE REGISTRY is asserted where it can
  // be seen: test/dom/home-favourites.test.jsx opens a favourite of each kind and
  // looks for Copy and Share on it. This file used to scrape Home.jsx for
  // `actionKind:\s*'([a-z]+)'` and `actionsFor(meta.actionKind,` — three regexes
  // that are true of a table nothing reads, a tile that never renders the row, and
  // a registry call whose result is thrown away. The rule they were guarding —
  // that a favourite reports the QUOTE kind and never the work kind, because copy
  // and share are gated off works — is above, over toolsFor and isWorkKind
  // directly, which is the half a pure test can actually answer.
})
