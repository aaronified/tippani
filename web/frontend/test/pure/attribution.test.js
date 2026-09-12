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
import { describe, expect, it } from 'vitest'
import { attribution, attributionParts } from '../../src/attribution.js'

describe('a letter', () => {
  // The phrase the reader was typing into Occasion by hand, because the recipient
  // box appeared nowhere on the card.
  it('is addressed to somebody', () => {
    expect(attribution({ kind: 'letter', recipient: 'Carl Seelig' })).toBe('Letter to Carl Seelig')
  })

  // THE RULE THAT REMOVES THE DUPLICATE WITHOUT REMOVING THE INFORMATION: the
  // kind's own word is printed only when nothing else in the phrase implies it.
  it('and says only "Letter" when nobody is named', () => {
    expect(attribution({ kind: 'letter' })).toBe('Letter')
    expect(attribution({ kind: 'letter', recipient: '   ' })).toBe('Letter')
  })

  // The occasion is NOT folded in. A reader who typed "Letter to Carl Seelig"
  // there before this shipped keeps that text on the card via the strip the card
  // draws separately; this line is about the recipient column.
  it('and does not reach into the occasion for it', () => {
    expect(attribution({ kind: 'letter', occasion: 'Letter to Carl Seelig' })).toBe('Letter')
  })
})

describe('a speech', () => {
  it('is placed by its occasion and where it happened', () => {
    expect(attribution({ kind: 'speech', occasion: 'Nobel banquet', place: 'Stockholm' }))
      .toBe('Nobel banquet, Stockholm')
  })

  // The shape implies the kind, so the word is not printed beside it — and with
  // one half filled, that half is the whole phrase.
  it('and takes whichever half it has', () => {
    expect(attribution({ kind: 'speech', occasion: 'Nobel banquet' })).toBe('Nobel banquet')
    expect(attribution({ kind: 'speech', place: 'Stockholm' })).toBe('Stockholm')
    expect(attribution({ kind: 'speech' })).toBe('Speech')
  })
})

describe('an essay', () => {
  // The owner's correction, punctuation included: essay: <"{work_title}", {locator}>
  it('is cited by its source and its page', () => {
    expect(attribution({ kind: 'essay', work_title: 'Why Socialism?', locator: 'p. 3' }))
      .toBe('“Why Socialism?”, p. 3')
  })

  it('and drops the half it does not have', () => {
    expect(attribution({ kind: 'essay', work_title: 'Why Socialism?' })).toBe('“Why Socialism?”')
    expect(attribution({ kind: 'essay', locator: 'p. 3' })).toBe('p. 3')
    expect(attribution({ kind: 'essay' })).toBe('Essay')
  })
})

describe('verse', () => {
  // The owner's three shapes: "1 when both work and poem name is available … then:
  // {poem_name} from {work_title}; otherwise: from {work_title} or {poem_name} (if
  // only one is available)."
  //
  // `piece` is the poem's own name, and where it comes from is the owner's other
  // decision: "if added as a book, poem name goes into chapter name field".
  it('names the piece and the book it came out of', () => {
    expect(attribution({ kind: 'poem', work_title: 'Gitanjali' }, { piece: 'Sonar Tori' }))
      .toBe('Sonar Tori from Gitanjali')
  })

  it('and either half alone', () => {
    expect(attribution({ kind: 'poem', work_title: 'Gitanjali' })).toBe('from Gitanjali')
    expect(attribution({ kind: 'poem' }, { piece: 'Sonar Tori' })).toBe('“Sonar Tori”')
    expect(attribution({ kind: 'poem' })).toBe('Poem')
  })

  // "song: same as poem" — so they share the branch rather than keeping a copy
  // each, and this is the case that fails if one of them drifts.
  it('and a song takes the same three, because the owner said so', () => {
    for (const args of [
      [{ work_title: 'The Times They Are a-Changin’' }, { piece: 'Blowin’ in the Wind' }],
      [{ work_title: 'The Times They Are a-Changin’' }, {}],
      [{}, { piece: 'Blowin’ in the Wind' }],
      [{}, {}],
    ]) {
      const [row, opts] = args
      expect(attribution({ kind: 'song', ...row }, opts).replace('Song', 'Poem'))
        .toBe(attribution({ kind: 'poem', ...row }, opts))
    }
  })
})

describe('a proverb', () => {
  // The owner's correction. The first proposal used the REGION and they replaced
  // it with the language: a Sylheti proverb is a Bengali proverb from somewhere in
  // particular, and the card has room for the general fact only.
  it('is named by its language', () => {
    expect(attribution({ kind: 'proverb', language: 'Bengali' })).toBe('Bengali proverb')
  })

  it('and never by its region, which stays a field and stops being the line', () => {
    expect(attribution({ kind: 'proverb', region: 'Sylhet' })).toBe('Proverb')
    expect(attribution({ kind: 'proverb', language: 'Bengali', region: 'Sylhet' }))
      .toBe('Bengali proverb')
  })
})

describe('what it says about a kind nobody has set', () => {
  // 'other' means the reader could not say what this is, so nothing about it can
  // be predicted.
  it('prints the kind and nothing more for "other"', () => {
    expect(attribution({ kind: 'other', occasion: 'somewhere' })).toBe('Other')
  })

  // 0053 kept the free-text `medium` and its values: the one-time pass folded the
  // ones that matched a word and left the rest. Showing the leftover is what makes
  // it visible as work to do, rather than the field a reader filled in vanishing
  // in the release that replaced it.
  it('and keeps a legacy medium visible until it is filed', () => {
    expect(attribution({ kind: '', medium: 'radio' })).toBe('radio')
    expect(attribution({ medium: 'radio' })).toBe('radio')
    expect(attribution({ kind: '' })).toBe('')
  })

  it('and survives a row that is not there at all', () => {
    expect(attribution(null)).toBe('')
    expect(attribution(undefined)).toBe('')
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

  // The Einstein letter, which is the case the report named. The phrase takes the
  // recipient; the place and the date have nowhere else to go, so they stay.
  it('keeps a letter’s place and date, because the phrase spoke for neither', () => {
    const u = { kind: 'letter', recipient: 'Carl Seelig', place: 'Zurich' }
    expect(attribution(u)).toBe('Letter to Carl Seelig')
    expect(rest(u, { date: '11 March 1952' })).toEqual(['11 March 1952', 'Zurich'])
  })

  // A speech's phrase IS its occasion and place, so neither may appear again.
  it('and drops a speech’s occasion and place, because the phrase is both', () => {
    const u = { kind: 'speech', occasion: 'Nobel banquet', place: 'Stockholm' }
    expect(attribution(u)).toBe('Nobel banquet, Stockholm')
    expect(rest(u, { date: '1921' })).toEqual(['1921'])
  })

  // An essay's phrase is its title and page, so the page may not follow it.
  it('and drops an essay’s page, which its citation already carries', () => {
    const u = { kind: 'essay', work_title: 'Why Socialism?', locator: 'p. 3', place: 'New York' }
    expect(rest(u, { date: '1949' })).toEqual(['1949', 'New York'])
  })

  // A poem's phrase names the work and not the stanza, so the stanza stays — the
  // fault this whole change exists for was four captured fields the card never
  // drew, and leaving one off would be committing it again.
  it('and keeps a poem’s stanza, which its phrase does not name', () => {
    const u = { kind: 'poem', work_title: 'Gitanjali', locator: 'st. 3' }
    expect(attribution(u)).toBe('from Gitanjali')
    expect(rest(u)).toEqual(['st. 3'])
  })

  // THE ONE CAPTURED FIELD DELIBERATELY LEFT OFF EVERY CARD, on the owner's
  // correction: the region was the proverb's attribution in the first proposal and
  // they replaced it with the language.
  it('and never carries a region', () => {
    const u = { kind: 'proverb', language: 'Bengali', region: 'Sylhet' }
    expect(attribution(u)).toBe('Bengali proverb')
    expect(rest(u)).toEqual([])
  })

  // 'other' consumes nothing, so the strip is what it always was — which is the
  // plan's own ruling for the residual kind.
  it('and leaves everything for a kind nobody could name', () => {
    const u = { kind: 'other', occasion: 'a radio broadcast', place: 'Berlin', locator: 'min. 4' }
    expect(rest(u, { date: '1933' })).toEqual(['a radio broadcast', '1933', 'Berlin', 'min. 4'])
  })

  it('and survives a row that is not there', () => {
    expect(attributionParts(null)).toEqual({ line: '', rest: [] })
  })
})
