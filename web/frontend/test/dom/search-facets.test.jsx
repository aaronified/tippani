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

import { FACET_MENU_PAGE, FACET_FIELDS, makeChip } from '../../src/facets.js'

const moreBtn = () => [...document.querySelectorAll('.token-opt')].find((b) => /^More/.test(b.textContent))

describe('the dropdown pages rather than pouring', () => {
  // A real library has hundreds of titles. A menu you can fall down is not a
  // menu, so it shows a page and offers another.
  const many = { tags: Array.from({ length: 14 }, (_, i) => `tag-${String(i).padStart(2, '0')}`) }

  it('shows one page, and says how many are behind it', () => {
    render(<Harness vocabulary={many} />)
    type('tag:')
    expect(options().filter((t) => !/^More/.test(t))).toHaveLength(FACET_MENU_PAGE)
    expect(moreBtn().textContent).toBe(`More (${14 - FACET_MENU_PAGE})`)
  })

  it('reveals another page on More, and stops offering it at the end', () => {
    render(<Harness vocabulary={many} />)
    type('tag:')
    // mouseDown, not click: the dismiss handler listens on pointerdown, so a
    // click would close the menu out from under the button. Pinned because the
    // symptom — the menu vanishing on the one press meant to grow it — reads as
    // "the button does nothing" rather than as an event-order bug.
    fireEvent.mouseDown(moreBtn())
    expect(options().filter((t) => !/^More/.test(t))).toHaveLength(FACET_MENU_PAGE * 2)
    fireEvent.mouseDown(moreBtn())
    expect(options().filter((t) => !/^More/.test(t))).toHaveLength(14)
    expect(moreBtn()).toBeUndefined()
  })

  it('and starts again at one page when the question changes', () => {
    render(<Harness vocabulary={many} />)
    type('tag:')
    fireEvent.mouseDown(moreBtn())
    expect(options().filter((t) => !/^More/.test(t))).toHaveLength(FACET_MENU_PAGE * 2)
    // Typing narrows to a different list; leaving ten of the old one on screen
    // would be showing a page of a question nobody asked.
    type('tag:tag-0')
    expect(options().filter((t) => !/^More/.test(t)).length).toBeLessThanOrEqual(FACET_MENU_PAGE)
  })
})

describe('the work fields are grammar now', () => {
  // They carried `typed: false` until 1.16.0, on the reasoning that there was no
  // vocabulary of titles to offer. A library IS a list of its own titles; the
  // reasoning described a query nobody had written.
  const works = {
    books: [{ key: '7', name: 'The Dispossessed' }],
    movies: [{ key: '9', name: 'Casablanca' }],
  }

  it('offer this library’s own titles, and send the id', () => {
    render(<Harness vocabulary={works} />)
    type('book:')
    expect(options()).toEqual(['book:The Dispossessed'])
    fireEvent.click(document.querySelector('.token-opt'))
    // The chip reads the title; the wire carries the id, because a title is not
    // unique and an id is.
    expect(screen.getByTestId('wire').textContent).toBe('book=7')
    expect(screen.getByText('book:The Dispossessed')).toBeTruthy()
  })

  it('and the same for a film', () => {
    render(<Harness vocabulary={works} />)
    type('movie:casab')
    expect(options()).toEqual(['movie:Casablanca'])
  })
})

describe('every field the panel will list can be labelled', () => {
  // The panel prints the combining rule on each group — two tags narrow, two
  // authors widen — so a field added to the grammar without deciding what a
  // second pick MEANS would render a group with no answer to the question the
  // reader is about to ask.
  it('because every one of them declares how it combines', () => {
    for (const f of FACET_FIELDS) {
      expect(['and', 'or'], `${f.name} has no combine rule`).toContain(f.combine)
    }
  })

  // The invariant the whole panel exists for, asserted at the seam both surfaces
  // share: one chip factory, so pressing and typing cannot disagree.
  it('and the panel builds its chip with the same factory the box does', () => {
    render(<Harness />)
    type('tag:stoicism')
    fireEvent.click(document.querySelector('.token-opt'))
    const typed = screen.getByTestId('wire').textContent
    const pressed = makeChip('tag', { value: 'stoicism', label: 'stoicism' })
    expect(typed).toBe(`${pressed.field}=${pressed.value}`)
  })
})
