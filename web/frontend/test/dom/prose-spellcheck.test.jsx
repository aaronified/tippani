// SPELLCHECK WHILE EDITING, AND NOT AFTER.
//
// THE OWNER'S ASK: "in the quote entry field (in various add surfaces), can we add
// client side grammar/spelling check? … only when the user is editing the field."
//
// THE SECOND HALF IS WHAT MAKES IT SAFE ON A QUOTE. A quote is somebody else's
// words: an archaic spelling, a dialect form, a proper name and a transliteration
// are all correct and all unknown to a dictionary. Underlines under a faithful
// transcription tell the reader they made a mistake they did not make. So the
// check is advice while typing and silent afterwards, and BOTH states are asserted
// — "it is on" alone would pass a field that never turns it off.
//
// AND THE LANGUAGE, which is the part that would have been silently wrong. A
// browser picks its dictionary from `lang`; a quote field carried none, only a CSS
// class for the face. Without it a Bengali quote is checked against the
// interface's language and every word comes back misspelled — the app telling a
// Bengali reader their Bengali is wrong, in red, word by word.

import { describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach } from 'vitest'

const { ProseArea } = await import('../../src/proseField.jsx')

afterEach(cleanup)

const box = () => screen.getByRole('textbox')
// THE ATTRIBUTE, NOT THE IDL PROPERTY. jsdom does not implement
// `HTMLTextAreaElement.spellcheck`, so `box().spellcheck` is `undefined` whatever
// React rendered — three cases here asserted it and failed against a correct
// component. What React writes is the attribute, and it is what a browser reads.
const checking = () => box().getAttribute('spellcheck')

describe('a prose field', () => {
  it('is not spell-checked at rest', () => {
    render(<ProseArea defaultValue="" />)
    // EXPLICITLY false, never absent: left off, the element inherits from the
    // document and each engine decides for itself.
    expect(checking(), 'a field nobody is typing in should not be marked up').toBe('false')
  })

  it('is spell-checked while somebody is typing in it', () => {
    render(<ProseArea defaultValue="" />)
    fireEvent.focus(box())
    expect(checking(), 'the check should be on while the field is being edited').toBe('true')
  })

  it('and stops the moment they leave', () => {
    render(<ProseArea defaultValue="" />)
    fireEvent.focus(box())
    fireEvent.blur(box())
    expect(checking(), 'a quote is somebody else’s words and must not stay underlined').toBe('false')
  })

  it('names the language so the browser picks the right dictionary', () => {
    render(<ProseArea language="Bengali" defaultValue="" />)
    expect(box().getAttribute('lang'), 'without a lang the wrong dictionary marks every word wrong').toBe('bn')
  })

  it('and names none at all for a language it does not know', () => {
    // A GUESS IS WORSE THAN SILENCE: an unknown tag either does nothing or picks
    // a dictionary for a language the text is not in.
    render(<ProseArea language="Klingon" defaultValue="" />)
    expect(box().hasAttribute('lang')).toBe(false)
  })

  it('lets the text decide which way it reads', () => {
    render(<ProseArea defaultValue="" />)
    // `dir` IN MARKUP is the repo's standing rule, and `auto` is the honest answer
    // for a box that is empty until somebody types in it.
    expect(box().getAttribute('dir')).toBe('auto')
  })

  it('still runs the handlers the caller gave it', () => {
    // SEVERAL OF THESE BOXES BLUR TO SAVE. A wrapper that overwrote `onBlur` would
    // stop them committing and nothing would fail — the field would just stop
    // working. This is the case that says the composition happened.
    let focused = 0
    let blurred = 0
    render(<ProseArea defaultValue="" onFocus={() => { focused += 1 }} onBlur={() => { blurred += 1 }} />)
    fireEvent.focus(box())
    fireEvent.blur(box())
    expect([focused, blurred], 'the caller’s own handlers were swallowed').toEqual([1, 1])
  })

  it('passes everything else straight through to the field', () => {
    render(<ProseArea className="tp-input" rows={7} placeholder="type here" defaultValue="" />)
    expect(box().className).toBe('tp-input')
    expect(box().rows).toBe(7)
    expect(box().placeholder).toBe('type here')
  })
})
