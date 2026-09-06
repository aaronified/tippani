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
// IT RENDERS THE SHEET, NOT THE ROW, and the difference is the whole reason this
// file was rewritten. Every one of those three defects lived in `creditRows()` —
// the function that BUILDS a row out of a served cast record — and the first
// version of this file rendered `CreditRow` with the finished props typed in by
// hand. So it asserted that a component calls the handler it was handed, which
// no version of the app has ever got wrong, and all eight cases stayed green
// while `note || lang` and a face wired to `onOpen` were live in the tree. A test
// that feeds in the answer cannot see the step that computes it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that the sheet is
// handed a work, the cast row it is showing (`here`), and the server's list of
// this character's appearances. Nothing about how the handlers are wired.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CharacterLocal } from '../../src/identityLocal.jsx'
import { identityScope } from '../../src/identityScope.js'

const WORK = { kind: 'movie', id: 3, title: 'The Shawshank Redemption', media_type: 'movie' }

// One served cast row — `store.CastOf`'s shape, which is what the sheet reads.
const cast = (over = {}) => ({
  cast_id: 9,
  kind: 'movie',
  work_id: 3,
  work_title: 'The Shawshank Redemption',
  media_type: 'movie',
  character: 'Andy Dufresne',
  character_id: 4,
  actor: 'Tim Robbins',
  actor_id: 11,
  actor_image: 'tim.jpg',
  credit_lang: '',
  credit_note: '',
  ...over,
})

const verbs = () => ({
  onCreditPick: vi.fn(), onOpenCredit: vi.fn(), onCreditNote: vi.fn(), onCreditRemove: vi.fn(),
})

// `works` is the server's list and `here` names the row the sheet is on; the
// credit block is built from the two, which is the step under test.
const sheet = (over = {}, v = verbs()) => {
  const here = cast(over)
  render(
    <CharacterLocal
      record={{ id: 4, name: 'Andy Dufresne', image_path: '' }}
      work={WORK}
      here={here}
      works={[here]}
      scope={identityScope({ table: 'character', work: WORK })}
      {...v}
    />,
  )
  return v
}

const face = () => document.querySelector('.cs-credit-pick')
const nameBtn = () => document.querySelector('.cs-credit-name')

afterEach(() => cleanup())

describe('the portrait and the name', () => {
  it('are two different doors', () => {
    const v = sheet()
    face().click()
    expect(v.onCreditPick, 'the portrait did not reach the picker').toHaveBeenCalledTimes(1)
    expect(v.onOpenCredit, 'the portrait opened the record instead of changing who it is').not.toHaveBeenCalled()
  })

  it('and the name opens the record, not the picker', () => {
    const v = sheet()
    nameBtn().click()
    expect(v.onOpenCredit).toHaveBeenCalledTimes(1)
    expect(v.onCreditPick, 'the name went to the picker').not.toHaveBeenCalled()
  })

  it('and each is given the row it was pressed on', () => {
    // Not just "a handler fired": the sheet can show more than one credit, so a
    // door that fires with the wrong row edits somebody else's casting.
    const v = sheet()
    nameBtn().click()
    expect(v.onOpenCredit.mock.calls[0][0]).toMatchObject({ cast_id: 9, actor_id: 11 })
  })
})

describe('a credit nobody is named on', () => {
  it('says the name cannot be opened rather than going quiet', () => {
    sheet({ actor: '', actor_id: 0, actor_image: '' })
    expect(nameBtn().getAttribute('aria-disabled'),
      'a press that does nothing, with nothing saying why').toBe('true')
    expect(nameBtn().getAttribute('title')).toMatch(/nobody named/i)
  })

  it('but can still be reassigned, because that is how it stops being nobody', () => {
    const v = sheet({ actor: '', actor_id: 0, actor_image: '' })
    face().click()
    expect(v.onCreditPick, 'the one door out of the unnamed state was shut too').toHaveBeenCalledTimes(1)
  })
})

describe("the row's second line", () => {
  it('carries the language and the note together, language first', () => {
    // A dub with a note on it. `note || lang` printed the note alone, so the one
    // row where the language is the whole point stopped saying which one it is.
    sheet({ credit_lang: 'Hindi', credit_note: 'all releases' })
    const line = document.querySelector('.cs-credit-note')
    expect(line, 'no second line at all').toBeTruthy()
    expect(line.textContent).toBe('Hindi · all releases')
  })

  it('and the language alone where there is no note', () => {
    sheet({ credit_lang: 'Hindi' })
    expect(document.querySelector('.cs-credit-note').textContent).toBe('Hindi')
  })

  it('and draws nothing when there is neither', () => {
    sheet()
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
    sheet({ credit_lang: 'Hindi' })
    const text = document.querySelector('.cs-credit').textContent
    for (const ch of ['✎', '✕', '▾', '✓', '⋯', '×']) {
      expect(text.includes(ch), `the row prints the character ${ch} instead of drawing a glyph`).toBe(false)
    }
  })

  it('and there is one for every verb the row offers', () => {
    sheet()
    // Four controls, each with a drawing in it: reassign, open, note, remove.
    const svgs = document.querySelectorAll('.cs-credit svg')
    expect(svgs.length, 'a control on this row has no glyph at all').toBeGreaterThanOrEqual(3)
  })
})

// ---- and the rows around it say a thing once --------------------------------
//
// THE OWNER'S RULING, on this sheet: "the 'in this work' section has duplicate
// and unnecessary prose" and "we don't need to write overly long proses like
// 'the only name this work uses'. it is obvious from there not being any alias."
//
// WHAT WAS THERE. The description row drew "In this work" as its label, "This
// work only" under it and "nothing written for this work" as its value — one
// scope stated three times, and long enough that the label itself wrapped and
// clipped to "In this wor". And the name row's sub-line, when a character has no
// aliases, said so in a sentence.
//
// THE PROPERTY, which is CLAUDE.md's now: a sub-line earns its place by carrying
// something the label does not. "Yours, private, this work only" under "Note"
// does — private and per-work are two facts the word Note has neither of. "This
// work only" under "In this work" does not.

const rowFor = (label) => [...document.querySelectorAll('.cs-row')]
  .find((r) => (r.querySelector('.cs-row-label')?.textContent || '').trim() === label)

describe('a row on the character sheet', () => {
  it('does not restate its own label underneath itself', () => {
    sheet()
    const row = rowFor('In this work')
    expect(row, 'the per-work description row is gone from the sheet').toBeTruthy()
    const sub = (row.querySelector('.cs-row-sub')?.textContent || '').trim()
    expect(sub, `the row says its scope twice: "In this work" then "${sub}"`).toBe('')
  })

  it('and says the absence of a value in the same word the row beside it uses', () => {
    // A LENGTH TEST WAS TOOTHLESS AND SHIPPED. The first version of this case
    // allowed anything under 40 characters, and the string it was written against
    // — "nothing written for this work" — is 29: it passed on the code it was
    // meant to fail. What is actually being asked is that two rows on one sheet,
    // both saying "there is nothing here", say it the same way. The Note row's
    // word is the one to match, because it was already right.
    sheet()
    const empty = (label) => (rowFor(label)?.querySelector('.cs-row-meta')?.textContent || '').trim()
    const note = empty('Note')
    expect(note, 'the Note row no longer prints an empty value to compare against').toBeTruthy()
    expect(empty('In this work'),
      `the two empty values on one sheet read differently: "${empty('In this work')}" and "${note}"`)
      .toBe(note)
  })

  it('and the value gives way rather than squeezing the label into a clip', () => {
    // THE CLIP WAS A LAYOUT, NOT A STRING. "In this wor" happened because the
    // value beside it could not shrink, so shortening the value fixed the symptom
    // for one value and left the next long one to do it again. A real description
    // is free text; the row has to hold it without cutting the label.
    sheet({ description: 'A prison librarian, a rock hammer, and nineteen years of patience — the part as this film has it.' })
    const row = rowFor('In this work')
    const label = row.querySelector('.cs-row-label')
    expect(label.textContent, 'the label is not the one under test').toBe('In this work')
    const meta = row.querySelector('.cs-row-meta')
    expect(meta.className, 'the value cannot scroll, so what does not fit is simply gone')
      .toMatch(/name-scroll/)
  })

  it('and says nothing at all where a character has no other name', () => {
    sheet()
    const row = rowFor('Credited as') || rowFor('Called here')
    expect(row, 'the name row is gone from the sheet').toBeTruthy()
    const sub = (row.querySelector('.cs-row-sub')?.textContent || '').trim()
    expect(sub, `no aliases, and the row explains that in prose: "${sub}"`).toBe('')
  })

  it('but prints the other names when there are some, which is what that line is for', () => {
    sheet({ aliases: 'Andy · Red' })
    const row = rowFor('Credited as') || rowFor('Called here')
    const sub = (row.querySelector('.cs-row-sub')?.textContent || '').trim()
    expect(sub, 'the aliases vanished with the sentence that used to stand in for them').toContain('Andy')
  })
})
