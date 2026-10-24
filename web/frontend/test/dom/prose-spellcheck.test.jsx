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

})
