// THE ORDER EVERY ANNOTATION CARD READS IN, and it is the owner's, stated as a
// rule rather than a preference:
//
//   "quote, translation: these will form the card body. both separately
//    expandable. which of these two will be shown (and if both then which one on
//    top), will be governed by the language chosen, and then overridden by the
//    work / board rules. both these sections will be expandable.
//    then the author/speaker/character chip
//    then the Kind specific attribution (settled for quote kinds already)
//    then notes (expandable)
//    then the tag row.
//    finally the icons / action row.
//    this shape will be adhered for all annotation cards across the app."
//
// WHY THIS NEEDS A TEST OF ITS OWN. When the translation was moved out from under
// the attribution and into the body where it belongs, the whole DOM suite — 2,287
// cases — stayed green. Nothing anywhere asserted the order, so the card could
// have been reassembled in any sequence and every existing case would have agreed.
// A rule that says "adhered for all cards across the app" and is checked by
// nothing is a rule that lasts until the next person moves a line.
//
// ASSERTED AS DOCUMENT ORDER, not as a snapshot: a snapshot fails on every
// unrelated class change and teaches people to regenerate it without reading, and
// the thing being protected here is the sequence and nothing else.
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api.js', () => ({
  json: async () => ({ ok: true, data: {} }),
  errText: () => 'nope',
  coverImgURL: () => '',
  upload: async () => ({ ok: true, data: {} }),
}))

const { AnnotationCard } = await import('../../src/Library.jsx')

// One row with every band filled, so a missing band is a missing band and not an
// empty one. The language is Bengali and the reader's default leads with the
// original, so `quote` is the body and `translation` is the second text.
const FULL = {
  id: 1,
  quote: 'অতি সন্ন্যাসীতে গাজন নষ্ট',
  translation: 'Too many holy men spoil the festival',
  character: 'Yeshua',
  // The chip band draws from the work's cast (`character_images`) and falls back
  // to the credit when there is none, so a row with neither draws no chip at all —
  // and a band-order test whose band 2 is absent would be asserting five bands
  // while claiming six.
  speaker: 'Yeshua',
  chapter: 'The Fall',
  chapter_no: 4,
  location: '112',
  note: 'The thing I thought about it, which is not the thing it says.',
  tags: ['craft'],
  language: 'Bengali',
  color: 'yellow',
}

const TAGS = { craft: { color: 'blue', style: 'ink' } }

function card(row = FULL, props = {}) {
  const { container } = render(
    <AnnotationCard
      a={row}
      tagMap={TAGS}
      save={() => {}}
      patch={() => {}}
      remove={() => {}}
      actionsAlwaysVisible
      {...props}
    />,
  )
  return container
}

// The position of an element in document order. Comparing indices into one flat
// walk is what makes "A is above B" an assertion rather than a description.
const at = (container, el) => Array.from(container.querySelectorAll('*')).indexOf(el)
const one = (container, sel) => {
  const el = container.querySelector(sel)
  expect(el, `no element matched ${sel} — the band is missing, not merely reordered`).toBeTruthy()
  return at(container, el)
}
const byText = (container, text) => {
  const el = Array.from(container.querySelectorAll('p, span, div')).find(
    (n) => n.textContent.trim() === text && n.children.length === 0,
  )
  expect(el, `no element held exactly ${JSON.stringify(text)}`).toBeTruthy()
  return at(container, el)
}

describe('the six bands, in the owner’s order', () => {
  it('reads body, chip, attribution, note, tags, actions — top to bottom', () => {
    const c = card()
    const quote = byText(c, FULL.quote)
    const translation = one(c, '.quote-translation')
    const chip = at(c, screen.getByRole('button', { name: /Yeshua/ }))
    const attribution = at(c, c.querySelector('.mono-label'))
    const note = one(c, '.hand-note')
    const tag = one(c, '.tag-chip')

    // 1 — THE BODY IS BOTH TEXTS, and they are adjacent. This is the band that was
    // wrong: the translation sat below the attribution, so half the card's own
    // words came after a line of metadata about the other half.
    expect(quote, 'the quote must lead the body').toBeLessThan(translation)
    // 2 — the person.
    expect(translation, 'the translation belongs above the chip, not below it').toBeLessThan(chip)
    // 3 — the kind's own line.
    expect(chip, 'the chip comes before the attribution').toBeLessThan(attribution)
    // 4, 5, 6.
    expect(attribution, 'the note follows the attribution').toBeLessThan(note)
    expect(note, 'the tags follow the note').toBeLessThan(tag)
  })

})
