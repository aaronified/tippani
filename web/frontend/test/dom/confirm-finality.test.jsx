// A QUESTION THAT DESTROYS SOMETHING DOES NOT LOOK LIKE ONE THAT DOES NOT.
//
// THE SPECIFICATION, the prototype's own words over its alertdialog
// (`book-detail.dc.html:4135`): "FINALITY IS DRAWN, NOT JUST WORDED. An
// error-coloured rule across the top, the warning set in mono above the title,
// and a filled destructive button — three signals, because the one thing this
// dialog must not look like is the ordinary Cancel/Save pair two sheets away
// from it."
//
// AND THE PACK DISTINGUISHES TWO KINDS OF FINAL. A move to the bin is
// destructive AND undoable — "Can be undone… It waits in the bin until you empty
// it" — while a delete is neither. Logging out is the third case and the pack
// makes the point by breaking its own pattern for it: amber, an ordinary button,
// "You will sign in again", because "LOGGING OUT IS NOT DESTRUCTION, and it must
// not borrow destruction's clothes."
//
// The app drew none of the three, so "Delete this person" and "Rename this tag"
// were one picture.
//
// SAYING NOTHING IS A THIRD STATE, and it has to stay one. Several dozen confirms
// in this app are neither destructive nor undoable; a default of "Cannot be
// undone" would put a false sentence in every one of their mouths, which is the
// same mistake in the other direction.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ConfirmDialog } from '../../src/ui.jsx'
import { t } from '../../src/i18n.js'

const ask = (props) => render(
  <ConfirmDialog open title="Delete this person?" body="They leave the library." confirmLabel="Delete" onConfirm={() => {}} onCancel={() => {}} {...props} />,
)
// EITHER ROLE, because the role is itself one of the things under test: a
// destructive or final confirm is an `alertdialog` and an ordinary one is a
// `dialog`. A helper pinned to one of them would make every case about the other
// fail for a reason that has nothing to do with what it asserts.
const DIALOG = '[role=dialog], [role=alertdialog]'
const dialog = () => document.querySelector(DIALOG)
const verb = () => [...document.querySelectorAll(`${DIALOG} button`)].find((b) => /delete/i.test(b.textContent))

afterEach(() => cleanup())

describe('a confirm that destroys something', () => {
  it('is announced as an alert, where an ordinary question is not', () => {
    // The pack's own role on this dialog (`book-detail.dc.html:562`), and the case
    // the role exists for: it tells a screen reader to interrupt rather than wait
    // its turn. The distinction is the point — a role that interrupts for "discard
    // three unsaved fields?" as well teaches the reader to ignore it.
    ask({ danger: true, reversible: false })
    expect(document.querySelector('[role=alertdialog]'), 'a deletion asks like an ordinary question').toBeTruthy()
    cleanup()
    ask({})
    expect(document.querySelector('[role=alertdialog]'), 'an ordinary confirm interrupts like an alarm').toBeNull()
    expect(document.querySelector('[role=dialog]')).toBeTruthy()
  })

  it('says what happens to the thing, not only whether it can be undone', () => {
    // The pack's fourth line (`:568`, `:4128-4131`). The tag above is the verdict;
    // this is the instructions — where it goes, and whether anything offers it
    // back. Asserted as a DIFFERENCE between the two answers rather than as a
    // sentence, so the copy can change and the rule cannot quietly go.
    ask({ danger: true, reversible: false })
    const final = dialog().querySelector('.confirm-note')?.textContent || ''
    cleanup()
    ask({ danger: true, reversible: true })
    const undoable = dialog().querySelector('.confirm-note')?.textContent || ''
    expect(final, 'a final act says nothing about what happens to it').not.toBe('')
    expect(undoable, 'an undoable act says nothing about where it goes').not.toBe('')
    expect(final, 'both kinds of finality are given the same sentence').not.toBe(undoable)
  })

  it('and stays silent about a bin the caller never mentioned', () => {
    // `reversible` is three-valued on purpose: leaving it out is the honest
    // default for the several dozen confirms that are neither destructive nor
    // undoable, and this note must not put "it waits in the bin" into their mouth.
    ask({})
    expect(dialog().querySelector('.confirm-note'), 'a confirm that stated no reversibility was given one').toBeNull()
  })

  it('draws a rule the ordinary one does not', () => {
    ask({ danger: true, reversible: false })
    expect(dialog().querySelector('.confirm-rule'), 'no rule across the top').toBeTruthy()
  })

  it('says whether it can be undone, in the locale’s words', () => {
    ask({ danger: true, reversible: false })
    expect(screen.getByText(t('common.confirm.final.tag')), 'the dialog does not say this is final').toBeTruthy()
    cleanup()
    ask({ danger: true, reversible: true })
    expect(screen.getByText(t('common.confirm.undoable.tag')), 'a move to the bin does not say it can be undone').toBeTruthy()
  })

  it('and its verb is filled in the danger colour, not the accent', () => {
    ask({ danger: true, reversible: false })
    expect(verb().className, 'the destructive verb draws as an ordinary primary').toMatch(/danger/)
  })

  it('draws the two kinds of final differently from each other', () => {
    ask({ danger: true, reversible: false })
    const final = dialog().querySelector('.confirm-rule').className
    cleanup()
    ask({ danger: true, reversible: true })
    const undoable = dialog().querySelector('.confirm-rule').className
    expect(undoable, 'a bin move and a delete draw the same rule').not.toBe(final)
  })
})

describe('an ordinary confirm', () => {
  it('says nothing about undoing, because it has nothing to say', () => {
    ask({})
    expect(dialog().querySelector('.confirm-rule'), 'an ordinary question wears destruction’s rule').toBeFalsy()
    expect(screen.queryByText(t('common.confirm.final.tag')),
      'a question that destroys nothing claims it cannot be undone').toBeNull()
    expect(screen.queryByText(t('common.confirm.undoable.tag'))).toBeNull()
  })

  it('and its verb keeps the accent', () => {
    ask({})
    expect(verb().className, 'an ordinary confirm draws as a destructive one').not.toMatch(/danger/)
  })
})

describe('the destructive verbs in the app', () => {
  it('are asked with a kind stated, not bare', () => {
    // AN INVENTORY, and the half that would have caught this: the dialog being
    // right is worth nothing while every caller asks it the old way. A confirm
    // whose title key names a delete, a revoke or an emptying has to say which
    // kind of question it is.
    const { readdirSync, readFileSync } = require('node:fs')
    const { join } = require('node:path')
    const SRC = process.env.TIPPANI_SRC
    // WIDER THAN THE LITERAL. The first cut matched `await ask(t('…delete…'))`
    // and nothing else — so four call sites that build their question into a
    // variable first, which is what every one with a used/unused pair does, were
    // green over the same gap. What makes a confirm destructive is what the code
    // AROUND it does, so the window either side of the press is what is read.
    const bare = []
    const DESTROYS = /'DELETE'|deleteWithUndo|\.delete\.|\.remove\.|revoke|empty-the-bin/
    for (const f of readdirSync(SRC).filter((x) => x.endsWith('.jsx'))) {
      const src = readFileSync(join(SRC, f), 'utf8')
      for (const m of src.matchAll(/await ask\([\s\S]{0,200}?\)\)/g)) {
        if (/danger\s*:/.test(m[0])) continue
        const window = src.slice(Math.max(0, m.index - 700), m.index + 700)
        if (!DESTROYS.test(window)) continue
        const line = src.slice(0, m.index).split('\n').length
        bare.push(`${f}:${line}`)
      }
    }
    expect(bare, 'these destroy something and ask like an ordinary question:\n  ' + bare.join('\n  '))
      .toEqual([])
  })
})
