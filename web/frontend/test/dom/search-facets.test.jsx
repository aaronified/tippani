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
  it('stays shut for ordinary free text', () => {
    render(<Harness />)
    type('the obstacle is the way')
    expect(document.querySelector('.token-menu')).toBeNull()
  })

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

  it('offers nothing for a field nobody has values for', () => {
    render(<Harness vocabulary={{}} />)
    type('tag:')
    expect(document.querySelector('.token-menu')).toBeNull()
  })

  // The way out of the grammar. Thirteen ordinary English words became operators
  // when this shipped, and "note: to self" is a thing somebody writes and then
  // searches for. Without the backslash the box opens a dropdown and those words
  // never reach the query — unsearchable, and silently so.
  it('stays shut on an escaped colon', () => {
    render(<Harness />)
    type('note\\: to self')
    expect(document.querySelector('.token-menu')).toBeNull()
    expect(screen.getByTestId('wire').textContent).toBe('')
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

  // The half that is easy to get wrong: free text typed BEFORE the facet is a
  // search term and must survive the lift.
  it('keeps the free text that came before it', () => {
    render(<Harness />)
    type('revolution tag:sto')
    fireEvent.click(screen.getByRole('button', { name: 'tag:stoicism' }))
    expect(screen.getByTestId('q').textContent).toBe('revolution')
  })

  it('sends the colour’s storage word while showing its name', () => {
    render(<Harness />)
    type('colour:dou')
    fireEvent.click(screen.getByRole('button', { name: 'colour:doubt' }))
    expect(screen.getByTestId('wire').textContent).toBe('colour=blue')
    expect(document.querySelector('.token-pill').textContent).toContain('colour:doubt')
  })

  it('commits on Enter, taking the highlighted option', () => {
    render(<Harness />)
    type('tag:')
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(screen.getByTestId('wire').textContent).toBe('tag=stoicism')
  })

  it('closes on Escape without committing anything', () => {
    render(<Harness />)
    type('tag:sto')
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(document.querySelector('.token-menu')).toBeNull()
    expect(screen.getByTestId('wire').textContent).toBe('')
    // The text is still there — Escape dismisses the menu, it does not undo
    // the typing.
    expect(screen.getByTestId('q').textContent).toBe('tag:sto')
  })
})

describe('the chips', () => {
  const withChip = () => {
    render(<Harness />)
    type('tag:sto')
    fireEvent.click(screen.getByRole('button', { name: 'tag:stoicism' }))
  }

  it('come off with their ×', () => {
    withChip()
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag:stoicism' }))
    expect(screen.getByTestId('wire').textContent).toBe('')
    expect(document.querySelector('.token-pill')).toBeNull()
  })

  // The TokenInput gesture, because a reader who has used the tag fields already
  // has the habit: backspace on an empty field takes back the last thing added.
  it('come off with backspace on an empty box', () => {
    withChip()
    fireEvent.keyDown(box(), { key: 'Backspace' })
    expect(screen.getByTestId('wire').textContent).toBe('')
  })

  it('are left alone by backspace while there is text to delete', () => {
    withChip()
    type('rev')
    fireEvent.keyDown(box(), { key: 'Backspace' })
    expect(screen.getByTestId('wire').textContent).toBe('tag=stoicism')
  })

  it('never stack the same value twice', () => {
    withChip()
    type('tag:sto')
    fireEvent.click(screen.getByRole('button', { name: 'tag:stoicism' }))
    expect(screen.getByTestId('wire').textContent).toBe('tag=stoicism')
    expect(document.querySelectorAll('.token-pill')).toHaveLength(1)
  })

  // Two values of one field is the ordinary case for tags — that is what
  // intersecting means — so they have to be independently removable.
  it('hold two values of one field, removable one at a time', () => {
    withChip()
    type('tag:dea')
    fireEvent.click(screen.getByRole('button', { name: 'tag:death' }))
    expect(screen.getByTestId('wire').textContent).toBe('tag=stoicism&tag=death')

    fireEvent.click(screen.getByRole('button', { name: 'Remove tag:stoicism' }))
    expect(screen.getByTestId('wire').textContent).toBe('tag=death')
  })
})

describe('a draft that can never become a chip is just words', () => {
  // THE BUG THIS CLOSES ATE THE QUERY. Stripping on the draft alone threw the
  // words away whenever no dropdown could appear, so the screen showed "type to
  // search" over a box the reader had visibly typed into, with no completion to
  // pick and no way out but backspace.
  it('searches the words when nothing can be offered', () => {
    render(<Harness />)
    type('tag:zzzzzz')
    expect(document.querySelector('.token-menu')).toBeNull()
    expect(screen.getByTestId('free').textContent).toBe('tag:zzzzzz')
  })

  // The case that made it unrecoverable rather than merely odd: `book` and
  // `movie` are seeded from a work's page and have no vocabulary at all, so
  // their dropdown could never appear and their words were always eaten.
  it('never treats the seeded work fields as typed', () => {
    render(<Harness />)
    type('movie:blade runner')
    expect(document.querySelector('.token-menu')).toBeNull()
    expect(screen.getByTestId('free').textContent).toBe('movie:blade runner')
  })

  it('does not truncate the text before one either', () => {
    render(<Harness />)
    type('the book: of the new sun')
    expect(screen.getByTestId('free').textContent).toBe('the book: of the new sun')
  })

  // The promise made where the vocabulary is fetched: a vocabulary that will
  // not load is an empty dropdown, never a broken search box.
  it('still searches while the vocabulary is missing', () => {
    render(<Harness vocabulary={{}} />)
    type('tag:sto')
    expect(document.querySelector('.token-menu')).toBeNull()
    expect(screen.getByTestId('free').textContent).toBe('tag:sto')
  })

  it('goes back to stripping the moment there is something to pick', () => {
    render(<Harness />)
    type('tag:sto')
    expect(options()).toEqual(['tag:stoicism'])
    expect(screen.getByTestId('free').textContent).toBe('')
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

  // ...while a field that genuinely unions still stacks, which is what makes
  // this a property of the field rather than a blanket rule.
  it('still stacks two values of a unioning field', () => {
    render(<Harness />)
    type('colour:dou')
    fireEvent.click(screen.getByRole('button', { name: 'colour:doubt' }))
    type('colour:yel')
    fireEvent.click(screen.getByRole('button', { name: 'colour:yellow' }))
    expect(screen.getByTestId('wire').textContent).toBe('colour=blue&colour=yellow')
  })
})

describe('the vocabulary', () => {
  it('is asked for on first focus and not again', () => {
    const onFirstFocus = vi.fn()
    render(<Harness onFirstFocus={onFirstFocus} />)
    fireEvent.focus(box())
    fireEvent.focus(box())
    fireEvent.focus(box())
    // The hook behind this dedupes; the box just has to report every focus
    // rather than only the first, or a component that remounts never asks.
    expect(onFirstFocus).toHaveBeenCalled()
  })
})
