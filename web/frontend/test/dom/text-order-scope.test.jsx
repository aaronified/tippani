// A WORK'S OWN ANSWER OUTRANKS THE READER'S — the top rung of the ladder, wired.
//
// THE OWNER'S SPEC: "There will be per work control over whether the cards are to
// show 1) translations above quotations, 2) quotations above translation, 3) no
// translation, 4) no quotations. same control will be there in metadata section on
// per language basis. the work controls will supercede the metadata controls."
//
// THE LADDER WAS BUILT AT BOTH ENDS AND JOINED TO NEITHER. `resolveTextOrder` has
// composed scope -> language -> master since it was written, with its own pure
// tests, and `useTextOrder` passed `scope` straight through — and NO CALLER
// ANYWHERE SUPPLIED ONE, because `text_order` did not exist as a column. Every one
// of those pure tests passed the whole time.
//
// SO THIS FILE IS A WIRING TEST AND NOT A LOGIC ONE. text-order.test.js already
// proves the precedence; what nothing could see is whether a real card ever
// RECEIVES a scope. The same shape of gap as useSheetDrag writing a custom
// property no rule read: two correct halves, one dead feature, and no failing test.
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api.js', () => ({
  json: async () => ({ ok: true, data: {} }),
  errText: () => 'nope',
  coverImgURL: () => '',
  upload: async () => ({ ok: true, data: {} }),
}))

const { AnnotationCard } = await import('../../src/Library.jsx')
const { TextOrderHost, TextOrderScope } = await import('../../src/textOrderHost.jsx')

// A bilingual row, so which text LEADS is visible rather than inferred: the big
// type is the body and the other is the second text.
const ROW = {
  id: 1,
  quote: 'অতি সন্ন্যাসীতে গাজন নষ্ট',
  translation: 'Too many holy men spoil the festival',
  language: 'Bengali',
}

// The reader's own settings say "lead with the original, everywhere" — so any
// card that leads with the translation below did so because something outranked
// them, which is the whole claim.
const READER = { master: 'quote-first', byLanguage: {} }

const card = (scope) =>
  render(
    <TextOrderHost value={READER}>
      <TextOrderScope value={scope}>
        <AnnotationCard a={ROW} tagMap={{}} save={() => {}} patch={() => {}} remove={() => {}} />
      </TextOrderScope>
    </TextOrderHost>,
  )

// WHAT THE CARD ACTUALLY PRINTS — the paragraphs, and nothing else.
//
// NOT `document.body.textContent`, WHICH IS WRONG HERE AND LOOKED RIGHT. Every
// AnnotationCard mounts its edit form unconditionally (a FormModal with
// `open={false}`), so BOTH texts are always in the document as the values of two
// closed textareas. The first draft of this file read the whole body and reported
// that "no quotations" had failed to remove the original — against code that
// removes it correctly. `quoteTexts` was checked at its own line before anything
// here was changed: 'trans-only' returns `{ body: translation, second: '' }`, and
// a render dump showed exactly one visible <p>, holding the translation.
const shown = () => [...document.querySelectorAll('p')].map((p) => p.textContent.trim()).join(' | ')

// The big type is the first paragraph the card draws.
const leads = () => shown().split(' | ')[0] || ''

// THE INNER SCOPE WINS, which is how the search modal gets the hit's own work
// rather than the screen's. Its card shows a row from ANY work in the library, so
// the container is a property of the hit — and nesting is what React context
// already gives, rather than a second mechanism for one surface.
describe('a nested scope is the one that answers', () => {
  it('the inner container beats the outer', () => {
    render(
      <TextOrderHost value={READER}>
        <TextOrderScope value="trans-first">
          <TextOrderScope value="quote-only">
            <AnnotationCard a={ROW} tagMap={{}} save={() => {}} patch={() => {}} remove={() => {}} />
          </TextOrderScope>
        </TextOrderScope>
      </TextOrderHost>,
    )
    // quote-only: the original alone. If the OUTER won it would be trans-first and
    // the translation would lead; if neither reached the card it would be the
    // reader's quote-first, which prints both — so this one assertion separates
    // all three.
    expect(shown()).toContain('অতি সন্ন্যাসীতে')
    expect(shown()).not.toContain('Too many holy men')
  })
})

describe('the container outranks the reader', () => {
  it('with no scope, the reader gets what they asked for', () => {
    card('')
    expect(leads()).toContain('অতি সন্ন্যাসীতে')
  })

  // THE ASSERTION THIS FILE EXISTS FOR. Same reader, same row, one difference —
  // and if the scope never reaches the card, this is identical to the case above
  // and fails.
  it("but a work saying 'translation first' wins", () => {
    card('trans-first')
    expect(leads()).toContain('Too many holy men')
  })

  // AND IT REACHES THE SUPPRESSING STATES TOO, which is the half a precedence
  // test over two orderings would miss: 'trans-only' is not a reordering, it is
  // the original not being drawn at all.
  it("and 'no quotations' removes the original rather than moving it", () => {
    card('trans-only')
    expect(shown()).toContain('Too many holy men')
    expect(shown()).not.toContain('অতি সন্ন্যাসীতে')
  })
})
