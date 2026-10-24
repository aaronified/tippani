import { describe, expect, it } from 'vitest'
import { attribution, attributionParts } from '../../src/attribution.js'
import { quoteKindMeta } from '../../src/quoteKind.js'
import { quoteTexts } from '../../src/text.js'
import { groupUtterances } from '../../src/Quotes.jsx'
import { resolveTextOrder } from '../../src/textOrder.js'
import { groupAnnotations, sortAnnotations } from '../../src/Library.jsx'

// The kind's own line on a quote card, and the report that caused it.
//
// "Quote cards need better formatting (e.g. letter to carl seelig)." The Einstein
// letter drew "Albert Einstein · Letter to Carl Seelig · 11 March 1952 · Zurich ·
// Letter · English" — the word "Letter" twice, against this repo's directive that
// a row says a thing once, and under that: four fields the form collected and the
// card never drew.
//
// EVERY SHAPE HERE IS THE OWNER'S OWN WORDING, and several are their CORRECTION of
// a first proposal, so each case quotes the instruction it implements. A test that
// asserted my reading rather than theirs would pass while being wrong.
describe('attribution', () => {
  describe('a letter', () => {
    // The phrase the reader was typing into Occasion by hand, because the recipient
    // box appeared nowhere on the card.
    it('is addressed to somebody', () => {
      expect(attribution({ kind: 'letter', recipient: 'Carl Seelig' })).toBe('Letter to Carl Seelig')
    })
  })

  // `attributionOf` WAS TESTED HERE AND IS GONE WITH IT. These were its only
  // references anywhere — the function had no production caller at all — and the
  // owner ruled it deleted rather than left as a seam whose comment promised more
  // than it could do. The reasoning is in attribution.js where the function stood;
  // the case is not restored here, because a test for a function nobody calls is
  // the same dead surface one layer up.

  // ── what the phrase did NOT speak for ──────────────────────────────────────────
  //
  // THE ORIGINAL REPORT WAS A DUPLICATE — "Letter" twice — and the cure is not
  // deleting a field but knowing which fields the phrase has already spoken for. So
  // the strip beside the line carries the rest, and nothing appears in both.
  describe('the strip beside the line', () => {
    const rest = (u, o) => attributionParts(u, o).rest

    // A speech's phrase IS its occasion and place, so neither may appear again.
    it('and drops a speech’s occasion and place, because the phrase is both', () => {
      const u = { kind: 'speech', occasion: 'Nobel banquet', place: 'Stockholm' }
      expect(attribution(u)).toBe('Nobel banquet, Stockholm')
      expect(rest(u, { date: '1921' })).toEqual(['1921'])
    })
  })
})

// The quote-kind vocabulary and its words.
//
// WHY IT IS WORTH A PURE TEST. The values on the wire are machine words and the
// words on screen are not, and this is the one module that knows which is which —
// so the failure it protects against is a shelf heading or a card reading
// "speech" in a Bengali interface, which is the sort of thing that ships because
// it looks fine to whoever wrote it.
//
// The other half is the fallback. 0053 kept the free-text `medium` column and its
// values; a quote whose medium the one-time pass could not read has no kind, and
// its card has to go on showing that text or the reader watches a field they
// filled in disappear in the release that replaced it.
describe('quote kind', () => {
  describe('what a card shows', () => {
    it('falls back to the old free-text medium when there is not', () => {
      // The value the one-time pass declined to guess at. Showing it is what makes
      // it visible as work to do.
      expect(quoteKindMeta({ kind: '', medium: 'radio' })).toBe('radio')
    })
  })
})

// WHICH OF A QUOTE'S TWO TEXTS GOES IN THE BIG TYPE.
//
// FOUR STATES, ON ONE AXIS, and the owner's own numbering: "1) translations above
// quotations, 2) quotations above translation, 3) no translation, 4) no
// quotations." Which state applies is textOrder.js's question and is tested beside
// it; this file is only about what each state DRAWS.
//
// WHY IT IS A TABLE. Every state has to answer for a row that is missing one of
// its two texts, and that is where a display rule turns into a card with nothing
// on it. Six of the eight cases below are that.
//
describe('quote texts', () => {
  const both = { quote: 'Als die Nazis die Kommunisten holten', translation: 'First they came for the Communists' }
  const quoteOnly = { quote: 'a line', translation: '' }
  const transOnly = { quote: '', translation: 'eine Zeile' }

  // toMatchObject RATHER THAN toEqual, WHICH THESE CASES USED TO USE. `quoteTexts`
  // returns the face each of the two texts is set in as well as the texts
  // themselves, and a whole-object compare here failed on all eight of them for a
  // field none of them is about — every case below asks which TEXT leads, and that
  // is exactly what a partial match asserts. The scripts have their own cases in
  // text.test.js, where they are the subject.
  describe('what each state draws', () => {
    it('trans-first swaps them — "a poem in a foreign language will need the translation to be on top, and the original in the bottom"', () => {
      expect(quoteTexts(both, 'trans-first')).toMatchObject({ body: both.translation, second: both.quote })
    })
  })

  // A FALLBACK, NOT A BLANK. Honouring a state exactly on a row that lacks the text
  // it asks for would empty the card — which, on a library where translations are
  // the exception, is a setting that looks like a bug that has deleted your
  // highlights.
  describe('a row that is missing one of its two texts', () => {
    it('and never prints the same words twice', () => {
      // The failure this forbids is a card whose big type and second line are the
      // same string, which is what a naive fallback produces.
      for (const row of [quoteOnly, transOnly]) {
        for (const order of ['trans-only', 'trans-first', 'quote-first', 'quote-only']) {
          const { body, second } = quoteTexts(row, order)
          expect(second === '' || second !== body, `${order} on ${JSON.stringify(row)}`).toBe(true)
        }
      }
    })
  })
})

// Grouping a shelf of quotes that belong to no work.
//
// The Quotes screen was built as a flat list on the reasoning that a standalone
// quote has no parent, so there is nothing to group by. What a book gives you is
// a TITLE, and this kind has four things of that sort — who said it, through
// what medium, where, and when — so these are the piles it makes instead.
//
// The residual bucket carries more weight here than on the other two screens: a
// proverb has no speaker, no medium, no place and no date, so it lands in the
// catch-all of every dimension and its label has to say which thing is missing.
describe('quotes grouping', () => {
  const BOSE = { id: 1, speaker: 'Subhas Chandra Bose', occasion: 'Burma Radio broadcast', occasion_date: '1944', place: 'Burma', kind: 'speech' }
  const BOSE2 = { id: 2, speaker: 'Subhas Chandra Bose', occasion: 'Burma Radio broadcast', occasion_date: '1944', place: 'Burma', kind: 'speech' }
  const FDR = { id: 3, speaker: 'Franklin D. Roosevelt', occasion: 'first inaugural address', occasion_date: '1933-03-04', place: 'Washington', kind: 'letter' }
  const PROVERB = { id: 4, speaker: '', occasion: '', occasion_date: '', place: '', kind: '' }

  const ALL = [BOSE, BOSE2, FDR, PROVERB]
  const labels = (groups) => groups.map((g) => g.label)
  const ids = (group) => group.items.map((i) => i.id)

  describe('grouping by speaker', () => {
    it('splits a credit naming two people into both buckets', () => {
      // The card and the share image both split the speaker; a grouping that did
      // not would file a joint line under a speaker who does not exist.
      const joint = [{ id: 9, speaker: 'Subhas Chandra Bose, Franklin D. Roosevelt' }]
      const groups = groupUtterances(joint, 'speaker')
      expect(labels(groups)).toEqual(['Franklin D. Roosevelt', 'Subhas Chandra Bose'])
      expect(ids(groups[0])).toEqual([9])
      expect(ids(groups[1])).toEqual([9])
    })
  })

  describe('every dimension', () => {
    it('keeps every quote, and loses none', () => {
      for (const dim of ['speaker', 'kind', 'place', 'decade']) {
        const seen = new Set()
        for (const g of groupUtterances(ALL, dim)) for (const u of g.items) seen.add(u.id)
        expect([...seen].sort(), dim).toEqual([1, 2, 3, 4])
      }
    })
  })
})

// WHO DECIDES HOW MUCH OF THE ORIGINAL A CARD SHOWS.
//
// The owner's four states and three scopes, and the precedence between them:
// "the work controls will supercede the metadata controls."
//
// WHY THE PRECEDENCE IS THE THING WORTH TESTING. Each individual state is a line
// of `quoteTexts` and is covered beside it; what can go wrong here is a scope
// being consulted in the wrong order, or an empty value being read as an opinion
// rather than as silence. Both are silent in a screenshot: a card shows SOME text
// either way, and the reader only finds out their per-work setting is being
// ignored by comparing two screens.
describe('text order', () => {
  describe('the precedence', () => {
    const byLanguage = { german: 'trans-first' }

    it('lets the work overrule the language', () => {
      expect(resolveTextOrder({ scope: 'quote-only', language: 'German', byLanguage, master: 'trans-only' }))
        .toBe('quote-only')
    })
  })
})

// Ordering and grouping a book's board of quotes.
//
// THE STATE THIS REPLACES. There was no grouping at all, and the sort was the
// TABLE's alone — clickable column headers on the one view a reader does not
// read in. Three hundred highlights sat in whatever order they were saved, in
// both card views, with nothing on screen offering another.
//
// These are pure because the defect is entirely in two functions: what a
// dimension is ordered BY, and where a quote with no value for it goes. A render
// test would need the whole board to prove less.
describe('annotation order', () => {
  const rows = [
    { id: 1, quote: 'aaaa', chapter: 'Ten', chapter_no: 10, location: 'p.300', color: 'blue', tags: ['craft'], created_at: '2024-03-01 10:00:00' },
    { id: 2, quote: 'aa', chapter: 'Two', chapter_no: 2, location: 'p.40', color: 'yellow', tags: ['craft', 'truth'], created_at: '2024-01-01 10:00:00' },
    { id: 3, quote: 'aaaaaa', chapter: 'Preface', color: 'pink', tags: [], created_at: '2024-02-01 10:00:00' },
    { id: 4, quote: 'a', color: 'yellow', tags: [], created_at: '2024-01-01 18:00:00' },
  ]
  const ids = (list) => list.map((a) => a.id)

  describe('ordering a board', () => {
    // NUMBERED CHAPTERS FIRST, IN ORDER. Text put chapter 10 between 1 and 2, which
    // is the whole reason chapter_no is a separate column.
    it('reads chapters in reading order, with the named ones after the numbered', () => {
      // Two, then Ten (a text sort puts Ten between One and Two), then the named
      // Preface, then the quote with no chapter at all.
      expect(ids(sortAnnotations(rows, { col: 'chapter', dir: 'asc' }))).toEqual([2, 1, 3, 4])
    })
  })

  describe('grouping a board', () => {
    // A QUOTE WITH SEVERAL TAGS APPEARS UNDER EACH, exactly as a book with several
    // genres does — and the biggest bucket leads, because tags have no order of
    // their own.
    it('puts a multi-tagged quote in every one of its buckets', () => {
      const g = groupAnnotations(rows, 'tag')
      const craft = g.find((x) => x.label === 'craft')
      const truth = g.find((x) => x.label === 'truth')
      expect(ids(craft.items)).toEqual([1, 2])
      expect(ids(truth.items)).toEqual([2])
      // The residual sinks whatever its size — here it holds two of the four.
      expect(g[g.length - 1].residual).toBe(true)
      expect(g[g.length - 1].items).toHaveLength(2)
    })
  })
})
