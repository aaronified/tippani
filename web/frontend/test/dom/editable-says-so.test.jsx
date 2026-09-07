// A ROW THAT OPENS AN EDITOR SAYS SO, AND THREE OF THEM DID NOT.
//
// THE OWNER, over a work-level character sheet: "the part, first appears, age
// here: these fields do not have the pencil to mark that they are editable."
//
// WHAT MAKES IT A DEFECT RATHER THAN A PREFERENCE. Every other editable row on
// that screen wears a pencil — Credited as, In this work, the credit's own name —
// so three cells that open the same kind of editor and wear none are the app
// signalling one behaviour two ways. The repo's directive is the general form of
// it: "two things that look the same behave the same", and the converse binds as
// well, because a reader learns the signal from the rows that have it and then
// reads its absence as "this one is just text".
//
// AND THE PACK DRAWS NO PENCIL HERE — `character-popup.dc.html:659` renders each
// fact cell as a label and a value in a button and nothing else. This is a
// departure from the prototype, argued in `docs/PLAN.md` per the owner's standing
// rule, and it is the owner's own call overruling their artboard.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `FactsRow` takes `cells`, each `{ label,
// value, onClick }`, and a cell whose caller gave no handler is `aria-disabled`
// and must draw NO pencil — promising an editor that is not there is the same
// defect as a control that does nothing. The pencil is a SIGN and not a second
// target: the whole cell is the button, which is the owner's ruling about the
// sheet's grab bar ("the bar is there just to make it intuitive").

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FactsRow, PairRow, ScreenRow } from '../../src/characterRows.jsx'

afterEach(() => cleanup())

const cell = (label, value, onClick) => ({ label, value, onClick })

// The pencil, as drawn: `IconEdit` inside the cell. Found by its class rather
// than by counting svgs, because a cell may legitimately gain another glyph.
const pencils = (el) => el.querySelectorAll('.cs-fact-pen')

describe('an editable fact says it is editable', () => {
  it('draws a pencil on every cell that opens an editor', () => {
    // THE REPORTED SCREEN: three facts, all editable, none marked.
    const { container } = render(<FactsRow cells={[
      cell('PART', 'not set', vi.fn()),
      cell('FIRST APPEARS', 'not set', vi.fn()),
      cell('AGE HERE', 'not set', vi.fn()),
    ]} />)
    expect(pencils(container).length, 'a cell that opens an editor is not marked as editable').toBe(3)
  })

  it('and none on a cell with nowhere to go', () => {
    // The other half, and it is not symmetry for its own sake: a pencil on a
    // cell with no handler promises an editor that does not exist, which is the
    // dead control `make controls` was written to catch wearing a badge.
    const { container } = render(<FactsRow cells={[
      cell('PART', 'Protagonist', vi.fn()),
      cell('FIRST APPEARS', 'CH 1 · PAGE 9'),
    ]} />)
    expect(pencils(container).length, 'a cell with no editor was marked as editable').toBe(1)
  })

  it('and a game’s two cells are both marked, not just the first', () => {
    // `factCells` drops "age here" for a game — nobody has an age in a game whose
    // character is the reader — so the row is two cells, and the second is the
    // one a per-index fix would miss.
    const { container } = render(<FactsRow cells={[
      cell('PART', 'Playable', vi.fn()),
      cell('FIRST APPEARS', 'ACT I', vi.fn()),
    ]} />)
    expect(pencils(container).length).toBe(2)
  })

  it('and the whole cell is still the button, not the pencil', () => {
    // THE OWNER'S RULING ABOUT THE GRAB BAR, applied: "the bar is there just to
    // make it intuitive." A 13px pencil inside a ~118px cell would be a worse tap
    // target than the cell, and two targets in one cell is two behaviours.
    const open = vi.fn()
    const { container } = render(<FactsRow cells={[cell('PART', 'Lead', open)]} />)
    const pen = pencils(container)[0]
    expect(pen, 'no pencil to check').toBeTruthy()
    expect(pen.closest('button'), 'the pencil is not inside the cell’s own button').toBeTruthy()
    expect(container.querySelectorAll('button').length, 'the pencil is a second button')
      .toBe(1)
  })

  it('and the value keeps its scroller, so a long answer is not cut', () => {
    // The standing rule: a name is never truncated — it scrolls under a fade.
    // Putting a pencil on the value's line must not turn the value into a clip.
    const { container } = render(<FactsRow cells={[
      cell('FIRST APPEARS', 'CHAPTER 14 · PAGE 233 · THE SECOND HOUSE', vi.fn()),
    ]} />)
    const value = container.querySelector('.cs-fact-value')
    expect(value, 'the value is gone').toBeTruthy()
    expect(value.className, 'the value lost its scroller, so a long answer is cut instead of scrolling')
      .toMatch(/name-scroll|cs-fact-value/)
    expect(screen.queryByText(/THE SECOND HOUSE/), 'the whole answer is not in the DOM').toBeTruthy()
  })
})

describe('and the rows that already said so still do', () => {
  it('a ScreenRow marked editable draws its pencil', () => {
    // The counterweight: this case is what makes the ones above a rule rather
    // than a coat of paint on one component.
    const { container } = render(<ScreenRow label="Credited as" meta="V" onClick={vi.fn()} edit />)
    expect(container.querySelector('.cs-row-pencil'), 'the editable row lost its pencil').toBeTruthy()
  })

  it('and one that is not editable does not', () => {
    const { container } = render(<ScreenRow label="Quotes" meta="11" onClick={vi.fn()} />)
    expect(container.querySelector('.cs-row-pencil')).toBeNull()
  })

  it('and a count is not an editor', () => {
    // `PairRow`'s cells are doors into search, not editors, so they must not
    // acquire the signal by proximity.
    const { container } = render(<PairRow cells={[{ label: 'QUOTES', figure: '11', onClick: vi.fn() }]} />)
    expect(container.querySelector('.cs-fact-pen'), 'a count was marked as editable').toBeNull()
  })
})
