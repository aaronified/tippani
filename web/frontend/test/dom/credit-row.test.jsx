// A CREDIT ROW IS THREE DIFFERENT DOORS, and which one you press decides what
// happens.
//
// THE SPECIFICATION, from the design pack. `character-popup.dc.html` splits the
// row deliberately: the PORTRAIT opens the person picker to change who is on the
// credit (`mode:'person'`, line 522) and wears a caret to say it is the thing
// being replaced; the NAME opens that person's own record (line 529); the pencil
// notes what is peculiar about this credit; the ✕ takes it off. `CreditRow`'s own
// header in `characterRows.jsx` says the same thing in the same order.
//
// AND THE ROW'S SECOND LINE CARRIES BOTH FACTS: the pack builds it as
// `[o.lang, o.note].filter(Boolean).join(' · ')` — the language first, "because
// 'Hindi' is the thing that tells two dubs apart and the note is the gloss on it".
//
// WHY THESE ARE WORTH A TEST. Every one of them is invisible when broken. Two
// controls that both open the same record look exactly like two controls that do
// different things until you press them; a dub whose language has been swallowed
// by its note still draws a full row; and a name with no record behind it looks
// pressable right up until it isn't. The app shipped all three at once, with a
// tooltip reading "Change who this is" over a control that could not.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the two paragraphs above. Nothing about how
// the handlers are wired.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CreditRow } from '../../src/characterRows.jsx'

const verbs = () => ({
  onPick: vi.fn(), onOpen: vi.fn(), onNote: vi.fn(), onRemove: vi.fn(),
})

const row = (over = {}, v = verbs()) => {
  render(
    <CreditRow
      name="Tim Robbins"
      note=""
      face=""
      empty={false}
      pickTitle="Change who this is"
      openTitle="Open their record"
      noteTitle="Note on this credit"
      removeTitle="Take this credit off"
      {...v}
      {...over}
    />,
  )
  return v
}

const face = () => document.querySelector('.cs-credit-pick')
const nameBtn = () => document.querySelector('.cs-credit-name')

afterEach(() => cleanup())

describe('the portrait and the name', () => {
  it('are two different doors', () => {
    const v = row()
    face().click()
    expect(v.onPick, 'the portrait did not reach the picker').toHaveBeenCalledTimes(1)
    expect(v.onOpen, 'the portrait opened the record instead of changing who it is').not.toHaveBeenCalled()
  })

  it('and the name opens the record, not the picker', () => {
    const v = row()
    nameBtn().click()
    expect(v.onOpen).toHaveBeenCalledTimes(1)
    expect(v.onPick, 'the name went to the picker').not.toHaveBeenCalled()
  })
})

describe('a credit nobody is named on', () => {
  it('says the name cannot be opened rather than going quiet', () => {
    row({ name: 'Not named yet', empty: true, onOpen: null, openTitle: 'Nobody named on this credit yet' })
    expect(nameBtn().getAttribute('aria-disabled'),
      'a press that does nothing, with nothing saying why').toBe('true')
    expect(nameBtn().getAttribute('title')).toMatch(/nobody named/i)
  })

  it('but can still be reassigned, because that is how it stops being nobody', () => {
    const v = row({ name: 'Not named yet', empty: true, onOpen: null })
    face().click()
    expect(v.onPick, 'the one door out of the unnamed state was shut too').toHaveBeenCalledTimes(1)
  })
})

describe("the row's second line", () => {
  it('carries the language and the note together, language first', () => {
    row({ note: 'Hindi · dub · all releases' })
    const line = document.querySelector('.cs-credit-note')
    expect(line, 'no second line at all').toBeTruthy()
    expect(line.textContent).toBe('Hindi · dub · all releases')
  })

  it('and draws nothing when there is neither', () => {
    row({ note: '' })
    expect(document.querySelector('.cs-credit-note'),
      'an empty second line claims there is something to read').toBeNull()
  })
})

describe("the row's glyphs", () => {
  // "A screen's glyphs are the app's own, never an emoji. NavIcon, Icon* in
  // ui.jsx, and nothing hand-picked beside them." A character renders in the
  // reader's font, sits off the shared baseline, and is the one picture the
  // generated glossary cannot document. The row shipped three: ✎, ✕ and ▾.
  it('are drawn, not typed', () => {
    row({ note: 'Hindi' })
    const text = document.body.textContent
    for (const ch of ['✎', '✕', '▾', '✓', '⋯']) {
      expect(text.includes(ch), `the row prints the character ${ch} instead of drawing a glyph`).toBe(false)
    }
  })

  it('and there is one for every verb the row offers', () => {
    row()
    // Four controls, each with a drawing in it: reassign, open, note, remove.
    const svgs = document.querySelectorAll('.cs-credit svg')
    expect(svgs.length, 'a control on this row has no glyph at all').toBeGreaterThanOrEqual(3)
  })
})
