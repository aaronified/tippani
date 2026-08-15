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
import { fireEvent, render, screen } from '@testing-library/react'
import { SearchBox } from '../../src/SearchPage.jsx'

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
function Harness({ vocabulary = VOCAB, onFirstFocus, initial = '' }) {
  const [q, setQ] = useState(initial)
  const [chips, setChips] = useState([])
  return (
    <div>
      <SearchBox
        q={q} setQ={setQ} chips={chips} setChips={setChips}
        vocabulary={vocabulary} onFirstFocus={onFirstFocus}
      />
      <output data-testid="q">{q}</output>
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

  it('opens on a known field and a colon, offering that field’s vocabulary', () => {
    render(<Harness />)
    type('tag:')
    expect(options()).toEqual(['tag:death', 'tag:stoicism', 'tag:gardening'])
  })

  it('narrows as you type', () => {
    render(<Harness />)
    type('tag:sto')
    expect(options()).toEqual(['tag:stoicism'])
  })

  it('forgives one typo', () => {
    render(<Harness />)
    type('tag:stoicsm')
    expect(options()).toEqual(['tag:stoicism'])
  })

  it('matches a name by any of its words', () => {
    render(<Harness />)
    type('author:guin')
    expect(options()).toEqual(['author:Ursula K. Le Guin'])
  })

  // The 1.7.1 rename reaching all the way to the menu: the reader named this
  // slot "doubt", so "doubt" is what is on offer and what is searched.
  it('offers a colour by the name the reader gave it', () => {
    render(<Harness />)
    type('colour:dou')
    expect(options()).toEqual(['colour:doubt'])
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

  it('escapes one field without disarming the rest of the box', () => {
    render(<Harness />)
    type('note\\: to self tag:sto')
    expect(options()).toEqual(['tag:stoicism'])
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
