// ONE FIELD, ONE DOOR — AND THE DOOR SAYS WHOSE FIELD IT IS.
//
// THE OWNER, over a work-level character sheet: "what is supposed to be the
// difference between 'in this work' and 'notes' fields? why do I need both?"
//
// THE ANSWER TURNED OUT TO BE THAT THEY DID NOT. The sheet-level `Note` row and
// the ✎ on the performer's own credit row BOTH edited `work_cast.credit_note`, on
// the same cast row, from two places on one screen — and the only thing telling
// them apart was a sub-line. That is the repo's own rule broken twice over: "a row
// says a thing once", and "two things that look the same behave the same".
//
// AND THE SURVIVING DOOR IS THE BETTER ONE, which is why this is a deletion
// rather than a move. `openCreditNote` titles its editor "Note on {name}'s
// credit", so it says WHOSE note it is; the sheet-level row structurally could not,
// because it sat four rows below the credits among the character's own fields. On
// a two-hander — Delia Surridge and V in one scene — that is the whole question.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `CharacterLocal` draws the work-level character
// screen; `works` is the character's credits across works and `creditsFor` narrows
// them to this one, so `here`'s own credit row is always in the list and the note
// is always reachable from it. `identity.row.local-desc.*` is the character's
// description in this work — a different field (`work_cast.description`) and a
// different subject, which is what the renamed label now says.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CharacterLocal } from '../../src/identityLocal.jsx'
import { t } from '../../src/i18n.js'

afterEach(() => cleanup())

const HERE = {
  cast_id: 9, kind: 'film', work_id: 1, character_id: 4,
  actor: 'Hugo Weaving', credit_as: 'V / William Rookwood',
  description: '', credit_note: '', part: '', first_appears: '', age_here: '',
}
// Two performers on one work, which is the case the sheet-level note could not
// speak to: a note four rows below two credits is a note about neither.
const WORKS = [
  HERE,
  { ...HERE, cast_id: 10, actor: 'Sinéad Cusack', credit_as: 'Delia Surridge', credit_note: 'uncredited' },
]

const draw = (over = {}) => render(
  <CharacterLocal
    record={{ id: 4, name: 'V' }}
    work={{ id: 1, title: 'V for Vendetta' }}
    scope={{ medium: 'film', title: 'V for Vendetta' }}
    here={HERE}
    works={WORKS}
    portraitActions={null}
    onCreditNote={vi.fn()}
    onDescription={vi.fn()}
    onPart={vi.fn()}
    onFirst={vi.fn()}
    onAge={vi.fn()}
    onCalled={vi.fn()}
    onRole={vi.fn()}
    onCreditPick={vi.fn()}
    onOpenCredit={vi.fn()}
    onCreditRemove={vi.fn()}
    onAddCredit={vi.fn()}
    onAddDub={vi.fn()}
    {...over}
  />,
)

describe('the note lives with the credit it is about', () => {

  it('and each credit’s note editor is handed that credit, not the sheet’s', () => {
    // The defect this replaced had a precedent in the same file: `onCreditNote`
    // was once an arrow taking NO parameter, so the credit the sheet handed it was
    // discarded and a dub's ✎ saved the performer's note. A note editor that does
    // not know whose note it is opening is the whole failure mode here.
    const notes = vi.fn()
    draw({ onCreditNote: notes })
    // BY ITS ACCESSIBLE NAME, which is the credit-note tooltip — "What is peculiar
    // about this casting". Not by a `title` attribute: `Tooltip` puts the label on
    // `aria-label`, and matching on the wrong attribute found nothing and called
    // that a missing control.
    const keys = screen.getAllByRole('button', { name: t('identity.credit.note.tip') })
    expect(keys.length, 'no per-credit note control at all').toBeGreaterThanOrEqual(2)
    keys[1].click()
    expect(notes, 'the credit’s ✎ opened nothing').toHaveBeenCalledTimes(1)
    expect(notes.mock.calls[0][0], 'the editor was opened without being told which credit')
      .toBeTruthy()
    expect(notes.mock.calls[0][0].cast_id, 'the wrong credit was handed to the editor').toBe(10)
  })
})

