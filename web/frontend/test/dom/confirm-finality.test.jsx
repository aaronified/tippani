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
const dialog = () => document.querySelector('[role=dialog]')
const verb = () => [...document.querySelectorAll('[role=dialog] button')].find((b) => /delete/i.test(b.textContent))

afterEach(() => cleanup())

describe('a confirm that destroys something', () => {
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
    const bare = []
    for (const f of readdirSync(SRC).filter((x) => x.endsWith('.jsx'))) {
      const src = readFileSync(join(SRC, f), 'utf8')
      for (const m of src.matchAll(/await ask\(\s*t\('([^']*(?:delete|revoke|remove|empty)[^']*)'[\s\S]{0,160}?\)\)/g)) {
        if (!/danger\s*:/.test(m[0])) bare.push(`${f}: ${m[1]}`)
      }
    }
    expect(bare, 'these destroy something and ask like an ordinary question:\n  ' + bare.join('\n  '))
      .toEqual([])
  })
})
