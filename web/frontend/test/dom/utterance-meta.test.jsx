// utteranceMeta — the line under a standalone quote, in its three modes.
//
// Worth testing at this depth because the thing it replaced was a join() and
// the failure modes are all quiet ones: a speaker who is text instead of a
// link, a person named twice on one card, or a proverb that gains an empty
// label and the spacing that comes with it. None of those throw.

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { utteranceMeta } from '../../src/Quotes.jsx'

const BOSE = {
  quote: 'Give me blood, and I will give you freedom.',
  speaker: 'Subhas Chandra Bose',
  occasion: 'Burma Radio broadcast',
  occasion_date: '1944',
  place: 'Burma',
  medium: 'radio',
}

// A proverb: the whole point of the kind is that these fields can all be empty.
const PROVERB = { quote: 'Measure twice, cut once.' }

const people = {
  'Subhas Chandra Bose': { id: 1, name: 'Subhas Chandra Bose', image_path: 'p/bose.jpg' },
}

const show = (node) => render(<div data-testid="meta">{node}</div>)

describe('the plain string mode', () => {
  // THE KIND'S PHRASE, THEN WHAT THE PHRASE DID NOT SAY — and no speaker, because
  // the card's chip has already named them. The owner: "the albert einstein is not
  // needed on that row. as it would already have a chip of its own."
  //
  // Bose's row has no `kind` and a legacy `medium`, so the phrase is that word: an
  // unfiled quote keeps the text its reader typed, visible as work to do, and
  // nothing about it can be composed until the kind is set.
  it('reads the kind first, then the rest', () => {
    expect(utteranceMeta(BOSE)).toBe('radio · Burma Radio broadcast · 1944 · Burma')
  })

  // THE CASE THE REPORT NAMED: "Quote cards need better formatting (e.g. letter to
  // carl seelig)." It used to draw the word "Letter" twice — once as the phrase the
  // reader had typed into Occasion by hand, and once as the kind chip — and the
  // recipient box appeared nowhere.
  it('and composes a letter instead of concatenating it', () => {
    expect(utteranceMeta({
      speaker: 'Albert Einstein',
      kind: 'letter',
      recipient: 'Carl Seelig',
      place: 'Zurich',
      occasion_date: '1952-03-11',
    })).toBe('Letter to Carl Seelig · 11 Mar 1952 · Zurich')
  })

  // A speech's phrase IS its occasion and place, so neither is said again.
  it('and never says a speech’s occasion twice', () => {
    expect(utteranceMeta({ speaker: 'Tagore', kind: 'speech', occasion: 'Nobel banquet', place: 'Stockholm' }))
      .toBe('Nobel banquet, Stockholm')
  })

  it('drops the fields that are empty', () => {
    expect(utteranceMeta({ speaker: 'Anon', medium: 'letter' })).toBe('letter')
  })

  it('is empty for a proverb nobody has filed', () => {
    expect(utteranceMeta(PROVERB)).toBe('')
  })

  // AND NOT EMPTY ONCE IT IS ONE. The owner's correction made the language a
  // proverb's whole attribution — "{language} proverb" — where the first proposal
  // used the region, which they replaced: a Sylheti proverb is a Bengali proverb
  // from somewhere in particular, and the card has room for the general fact only.
  it('and names a filed proverb by its language, never its region', () => {
    expect(utteranceMeta({ ...PROVERB, kind: 'proverb', language: 'Bengali', region: 'Sylhet' }))
      .toBe('Bengali proverb')
  })

  it('renders a bare year as a year', () => {
    // Not through the shelf's date formatter: `new Date('1944')` is a valid
    // Date and would print as a January morning nobody recorded.
    expect(utteranceMeta({ occasion_date: '1944' })).toBe('1944')
  })
})

// THE SPEAKER IS NOT ON THIS LINE, AND THERE IS NO OPTION TO PUT THEM BACK.
//
// The owner, on the composed Einstein card: "the albert einstein is not needed on
// that row. as it would already have a chip of its own." The card's bands are the
// person chip and THEN the attribution, so a line that could repeat the chip is an
// option to break that order.
//
// AND THE CODE HAD ALREADY AGREED WITH THEM. Both callers passed
// `omitSpeaker: true` — the Quotes board and the search hit — so the branch that
// split the credit, drew the faces and made each name a button was unreachable
// from every screen in the app. It had six cases here holding it up, which is what
// a test of an unused path looks like from the inside: green, detailed, and about
// nothing. The names branch is deleted; the rest of that chain is `SpeakerChips`'
// and is tested against the chip.
//
// The book card had already been doing it this way — Library.jsx drops the
// character from its own meta line the moment a chip draws it — so this makes the
// standalone quote agree with the two kinds beside it.
describe('the mark that stands where a face would', () => {
  const rich = (u) => utteranceMeta(u, { mark: true })

  it('never names the speaker, whatever else is on the row', () => {
    const node = rich(BOSE)
    show(node)
    expect(screen.getByTestId('meta').textContent).not.toContain('Subhas Chandra Bose')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('and the flat form does not either', () => {
    expect(utteranceMeta(BOSE)).toBe('radio · Burma Radio broadcast · 1944 · Burma')
    expect(utteranceMeta({ speaker: 'Anon' })).toBe('')
  })

  // A proverb is the one kind with nobody to credit, so the line used to begin
  // with nothing while every other quote in the app begins with a portrait. Its
  // language takes that slot.
  // LanguageMark draws a titled disc, so the language's NAME is what says it is
  // there — asserted through the title rather than a class, because the markup is
  // that component's business and a test pinning its element would fail the day it
  // changed shape without the behaviour changing.
  const markTitle = (u) => show(rich(u)).container.querySelector('span[title]')?.getAttribute('title') || ''

  it('draws the language mark when the line has no face to show', () => {
    expect(markTitle({ quote: 'x', occasion: 'somewhere', language: 'Bengali' })).toBe('Bengali')
    expect(markTitle({ quote: 'x', occasion: 'somewhere' })).toBe('')
  })

  // NOT WHEN THE PHRASE ALREADY NAMES THE LANGUAGE. On a filed proverb the
  // attribution IS the language — "Bengali proverb" — so a Bengali script mark in
  // front of it is the same fact twice, which is the directive this whole change
  // came out of.
  // AND IT STAYS WHEN THE WORDS BESIDE IT NAME THE LANGUAGE TOO. I took it off a
  // filed proverb — "Bengali proverb" with a Bengali disc in front looked like the
  // language twice — and the owner put it back: "the script mark should be in the
  // same row." The disc is not a printing of the language, it is the slot where
  // every other quote carries a portrait, and a proverb is the one kind with nobody
  // to credit. Without it this line alone begins with nothing.
  it('and stays even when the attribution names the language', () => {
    expect(markTitle({ quote: 'x', kind: 'proverb', language: 'Bengali' })).toBe('Bengali')
    show(rich({ quote: 'x', kind: 'proverb', language: 'Bengali' }))
    // `toContain`, not `toBe`: the disc holds a letter FROM the script, so it is
    // part of the row's text content as well as its own titled element. Both are
    // there, which is the point.
    expect(screen.getAllByTestId('meta').pop().textContent).toContain('Bengali proverb')
  })

  it('returns an empty STRING for an unfiled proverb, not an empty element', () => {
    // AnnotationCard renders this as `{metaLine && <MonoLabel>}`. A JSX element
    // is always truthy, so returning <></> here would give every proverb an
    // empty label and its spacing — a silent layout change, not an error.
    expect(rich(PROVERB)).toBe('')
  })

  it('renders the occasion alone when there is nothing else', () => {
    const node = rich({ occasion: 'a letter home' })
    expect(node).not.toBe('')
    show(node)
    expect(screen.getByTestId('meta').textContent).toBe('a letter home')
  })
})
