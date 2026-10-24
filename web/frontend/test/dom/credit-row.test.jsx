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
import { t } from '../../src/i18n.js'

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

  it('and the name opens the record, not the picker', () => {
    const v = sheet()
    nameBtn().click()
    expect(v.onOpenCredit).toHaveBeenCalledTimes(1)
    expect(v.onCreditPick, 'the name went to the picker').not.toHaveBeenCalled()
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

