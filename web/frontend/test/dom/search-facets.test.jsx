// The search box's facet dropdown — typing a field name, and the token leaving
// the box.
//
// facets.test.js pins the grammar as functions. This pins the GESTURE, which is
// the part a reader actually meets: type `tag:`, get offered your own tags, pick
// one, and watch the words you typed turn into a chip beneath the box. Each of
// those four steps is a place the wiring can be right in isolation and wrong
// together — a dropdown that opens but never commits, a commit that adds the
// chip and leaves the text behind, a chip that shows the storage word.

import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SearchBox } from '../../src/SearchPage.jsx'
import { readSearchBox } from '../../src/facets.js'

const VOCAB = {
  tags: ['death', 'stoicism', 'gardening'],
  authors: ['Ursula K. Le Guin', 'Terry Pratchett'],
  colours: [
    { key: 'yellow', name: 'yellow' },
    { key: 'blue', name: 'doubt' },
  ],
}

// A controlled harness, because SearchBox is controlled: the page owns the text
// and the chips, and half of what is under test is what it hands back.
//
// It also owns the DRAFT, which is the shape SearchPage has: one computation of
// "what is being typed and what can be offered for it", handed down, so the
// decision about what to search and the decision about what to offer cannot
// diverge. `freeText` here mirrors the page's, so the test can see the query
// that would actually be sent.
function Harness({ vocabulary = VOCAB, onFirstFocus, initial = '' }) {
  const [q, setQ] = useState(initial)
  const [chips, setChips] = useState([])
  // The PAGE's own function, not a copy of it. A harness that re-implemented
  // this would be testing the harness — which is exactly the two-answers-to-one-
  // question shape that produced the bug the tests below pin.
  const { draft, options, freeText } = readSearchBox(q, vocabulary)
  return (
    <div>
      <SearchBox
        q={q} setQ={setQ} chips={chips} setChips={setChips}
        draft={draft} options={options} onFirstFocus={onFirstFocus}
      />
      <output data-testid="q">{q}</output>
      <output data-testid="free">{freeText}</output>
      <output data-testid="wire">{chips.map((c) => `${c.field}=${c.value}`).join('&')}</output>
    </div>
  )
}

const box = () => screen.getByRole('textbox', { name: 'Search' })
const type = (text) => fireEvent.change(box(), { target: { value: text } })
const options = () => [...document.querySelectorAll('.token-opt')].map((b) => b.textContent)

describe('the dropdown', () => {

  // One test over all six rows rather than six: each was the identical
  // three-step gesture — render the harness, type a string, compare the offered
  // options — over the same default vocabulary, differing only in what was typed
  // and what came back. Row names are the original it() titles, and the whole
  // collection is compared at once so a failure names every menu that was wrong
  // instead of dying on the first. cleanup() runs per row because RTL's
  // auto-cleanup fires between TESTS, not between iterations, and a second
  // mounted box would make box()/options() see two menus.
  //
  // The three tests below that assert the menu does NOT open are deliberately
  // not rows here: they assert the converse, on a different target.
  const TYPED = [
    { name: 'opens on a known field and a colon, offering that field’s vocabulary', typed: 'tag:', want: ['tag:death', 'tag:stoicism', 'tag:gardening'] },
    { name: 'narrows as you type', typed: 'tag:sto', want: ['tag:stoicism'] },
    { name: 'forgives one typo', typed: 'tag:stoicsm', want: ['tag:stoicism'] },
    { name: 'matches a name by any of its words', typed: 'author:guin', want: ['author:Ursula K. Le Guin'] },
    // The 1.7.1 rename reaching all the way to the menu: the reader named this
    // slot "doubt", so "doubt" is what is on offer and what is searched.
    { name: 'offers a colour by the name the reader gave it', typed: 'colour:dou', want: ['colour:doubt'] },
    { name: 'escapes one field without disarming the rest of the box', typed: 'note\\: to self tag:sto', want: ['tag:stoicism'] },
  ]

  it('offers what was typed for, in the order it ranks it', () => {
    const got = TYPED.map(({ name, typed }) => {
      cleanup()
      render(<Harness />)
      type(typed)
      return [name, options()]
    })
    expect(got).toEqual(TYPED.map(({ name, want }) => [name, want]))
  })

})

describe('picking a value lifts the token out of the box', () => {
  it('turns the typed field into a chip and empties the text', () => {
    render(<Harness />)
    type('tag:sto')
    fireEvent.click(screen.getByRole('button', { name: 'tag:stoicism' }))

    expect(screen.getByTestId('q').textContent).toBe('')
    expect(screen.getByTestId('wire').textContent).toBe('tag=stoicism')
    expect(document.querySelector('.token-pill').textContent).toContain('tag:stoicism')
  })

})

describe('a field answered twice', () => {
  // `favourite:yes` and `favourite:no` are not two filters, they are one filter
  // answered twice. Left to accumulate they both render as active while the
  // server takes only the last, so half the chip row asserts a narrowing that
  // never happened.
  it('replaces rather than stacking a contradictory flag', () => {
    render(<Harness />)
    type('favourite:')
    fireEvent.click(screen.getByRole('button', { name: 'favourite:yes' }))
    expect(screen.getByTestId('wire').textContent).toBe('favourite=yes')

    type('favourite:no')
    fireEvent.click(screen.getByRole('button', { name: 'favourite:no' }))
    expect(screen.getByTestId('wire').textContent).toBe('favourite=no')
    expect(document.querySelectorAll('.token-pill')).toHaveLength(1)
  })

})

// ---- the Filters panel, and the paged dropdown (1.16.0) ---------------------
//
// THE FACETS SHIPPED IN 1.10.0 AND NOBODY COULD FIND THEM. The grammar, the
// dropdown, the chips, the vocabulary endpoint and the SQL were all complete;
// the only thing on screen that said so was a placeholder string, gone the
// moment you typed a character. The report was three words long and correct:
// "I do not see search facets yet."
//
// So the panel exists to be the visible door. Its ONE invariant — the one this
// block is really for — is that pressing a value in it produces exactly the chip
// that typing the same facet produces. Two ways in, one chip out. A panel that
// assembled its own query object would be the render-versus-match divergence
// facets.js opens by refusing, moved one file closer.


