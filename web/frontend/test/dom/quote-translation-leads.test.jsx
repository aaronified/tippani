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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (_m, path) => {
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  },
}))

const { AnnotationCard } = await import('../../src/Library.jsx')
const { TextOrderHost } = await import('../../src/textOrderHost.jsx')

const GERMAN = 'Als die Nazis die Kommunisten holten'
const ENGLISH = 'First they came for the Communists'

const row = {
  id: 1, quote: GERMAN, translation: ENGLISH, language: 'German',
  color: 'yellow', tags: [], note: '',
}

// The card needs a handful of no-op verbs; none of them is what this measures.
const noop = () => {}
// The host takes the reader's settings — the slider above the column and the rows
// under it — exactly as App does. A card resolves its own state from them plus its
// row's language, which is the point: nothing is threaded.
const card = (settings) =>
  render(
    <TextOrderHost value={settings}>
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
    </TextOrderHost>,
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
// index.css is read rather than loaded: jsdom applies no stylesheet, so a
// declaration is a fact about the file. Same idiom as no-truncated-names.test.js,
// which guards the standing "never truncate a name" rule the same way.
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
const blockFor = (cls) => {
  const at = css.indexOf(`.${cls} {`)
  return at === -1 ? null : css.slice(at, css.indexOf('}', at))
}

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
    card({ master: 'trans-first', byLanguage: { german: 'quote-first' } })
    leads(GERMAN)
    expect(secondLine()?.textContent).toBe(ENGLISH)
  })

  it('and leads with the translation when they did not', () => {
    card({ master: 'trans-first', byLanguage: { english: 'quote-first' } })
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
// that kept its shape, because `.quote-translation` had no `pre-wrap` and the body
// had carried one since it could hold a paragraph.
//
// THE FIRST VERSION OF THIS TEST ASSERTED NOTHING. It selected `.quote-translation`
// and then checked that the element's className contained "quote-translation",
// which is true of anything that selector can return — so deleting `white-space:
// pre-wrap` from index.css left the whole suite green and the feature gone. jsdom
// not computing geometry is a real constraint but it is not a reason to assert a
// tautology: the declaration is READ instead.
//
// AND BOTH SIDES ARE READ, because the two carry pre-wrap from two different
// places — the body from an inline style in ExpandableText, the translation from
// the stylesheet — so either can be changed without the other, which is exactly
// the drift the owner's "like the quote body" forbids.
describe('the second line', () => {
  it('is given pre-wrap by the stylesheet', () => {
    const block = blockFor('quote-translation')
    expect(block, '.quote-translation is not declared in index.css any more').not.toBeNull()
    expect(block, "the translation no longer keeps its line breaks — a poem's translation draws as prose")
      .toMatch(/white-space\s*:\s*pre-wrap/)
  })

  it('and the body it has to match still has it too', () => {
    card({})
    // ExpandableText puts `card-text` on its WRAPPER and the pre-wrap on the <p>
    // inside it, so `.card-text` alone selects the wrapper and reads an empty
    // style. `.clampable` is the half TranslationLine does not carry, which is
    // what tells the body's paragraph from the translation's.
    const body = document.querySelector('.clampable.card-text > p')
    expect(body, 'the card no longer renders a body through ExpandableText').toBeTruthy()
    expect(body.style.whiteSpace, 'the quote body stopped keeping its line breaks, so there is nothing for the translation to match')
      .toBe('pre-wrap')
  })
})
