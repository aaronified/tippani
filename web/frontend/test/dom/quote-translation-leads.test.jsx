// A QUOTE IN A LANGUAGE THE READER CANNOT READ LEADS WITH ITS TRANSLATION.
//
// THE PURE TEST BESIDE THIS ONE PINS THE DECISION; this one pins that the decision
// reaches a card. Those are different failures and the second is the one that has
// happened in this repo before: a capability provided once and then not read, or
// read by one card and not the other. `quoteTexts` being right is worth nothing if
// the predicate never arrives.
//
// AND IT IS PROVIDED, NOT THREADED, which is what makes it testable here at all:
// the card is two components below the screen and neither of them mentions this.
// A test that had to pass a prop through them would be testing the props.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (_m, path) => {
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  },
}))

const { AnnotationCard } = await import('../../src/Library.jsx')
const { ReadableLanguages, readerFrom } = await import('../../src/readLanguages.jsx')

const GERMAN = 'Als die Nazis die Kommunisten holten'
const ENGLISH = 'First they came for the Communists'

const row = {
  id: 1, quote: GERMAN, translation: ENGLISH, language: 'German',
  color: 'yellow', tags: [], note: '',
}

// The card needs a handful of no-op verbs; none of them is what this measures.
const noop = () => {}
const card = (preferences) =>
  render(
    <ReadableLanguages value={readerFrom(preferences)}>
      <AnnotationCard
        a={row}
        variant={0}
        tagMap={{}}
        setEditingId={noop}
        save={noop}
        patch={noop}
        remove={noop}
        onCopy={noop}
        onShare={noop}
        selectKind="quote"
      />
    </ReadableLanguages>,
  )

// The big type and the small line are two different classes, so "which one leads"
// is answerable from the DOM rather than from the order of two paragraphs.
//
// AND `getByText` CANNOT ASK IT. ExpandableText renders a second, hidden copy of
// the words to measure whether they clip, so the leading text is in the document
// twice and getByText throws "found multiple elements" — which is a true report
// about the card and a useless one about this question. So: the second line is one
// element and is read directly, and the leading text is asserted to be present and
// NOT to be the second line.
const secondLine = () => document.querySelector('.quote-translation')
const leads = (text) => {
  const hits = screen.queryAllByText(text)
  expect(hits.length, `the card does not show ${JSON.stringify(text)} at all`).toBeGreaterThan(0)
  expect(secondLine()?.textContent, `${JSON.stringify(text)} is the second line, not the words`)
    .not.toBe(text)
}

beforeEach(() => { document.body.innerHTML = '' })

describe('a card, and which text is the words', () => {
  it('reads as written when the reader declared its language', () => {
    card({ readLanguages: '["german"]' })
    leads(GERMAN)
    expect(secondLine()?.textContent).toBe(ENGLISH)
  })

  it('and leads with the translation when they did not', () => {
    card({ readLanguages: '["english"]' })
    leads(ENGLISH)
    // THE ORIGINAL IS STILL THERE, under it — "the original in the bottom". A
    // version of this that simply hid the German would pass an assertion about
    // the English and lose the quote.
    expect(secondLine()?.textContent).toBe(GERMAN)
  })

  it('and reads as written for a reader who has declared nothing', () => {
    card({})
    leads(GERMAN)
    expect(secondLine()?.textContent).toBe(ENGLISH)
  })
})

// AND THE SECOND LINE KEEPS ITS SHAPE.
//
// The owner's: "the translation needs to follow the linebreaks and spaces like the
// quote body." A poem's translation arrived as one run of prose beside an original
// that kept its shape, because `.quote-translation` had no `pre-wrap` and the
// body had carried one since it could hold a paragraph. Asserted on the class
// rather than on the rendered geometry, which jsdom does not compute.
describe('the second line', () => {
  it('is styled to keep the line breaks it was given', () => {
    card({})
    expect(secondLine()?.className, 'the second line is not the class the stylesheet gives pre-wrap')
      .toMatch(/quote-translation/)
  })
})
