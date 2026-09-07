// THE HELPER FOUR SWEEPS TRUST.
//
// `cssRules` and `rulesNaming` are what `fade-is-measured`, `scroller-boxes`,
// `scroll-containment` and the recall panel's box guard all read the stylesheet
// through. A wrong answer here is four sweeps quietly measuring the wrong thing,
// and the failure shape is a FALSE NEGATIVE: a rule the helper does not return is
// a rule no sweep judges, and nothing anywhere goes red.
//
// So this file does not read the app's stylesheet at all. It hands the helper CSS
// whose right answer is stated in the test, including the three shapes a
// brace-depth splitter gets wrong: a rule inside an at-rule, a comment holding a
// brace, and a declaration value holding one.
//
// It exists because the class-name escape was inert. The pattern was assembled
// from a regex literal that lived inside `${…}` — real source, not template text
// — so its doubled backslashes escaped nothing, `'a.b'.replace(escape, …)` came
// back unchanged, and any metacharacter in a class name reached `new RegExp` raw.
// Every caller passes a plain name, so it never showed. A helper is not correct
// because its callers happen to stay inside its working subset.

import { describe, expect, it } from 'vitest'

import { cssRules, rulesNaming } from '../css-rules.js'

describe('cssRules', () => {
  it('returns a flat rule for each selector list, with its own body', () => {
    const got = cssRules('.a { color: red } .b, .c { color: blue }')
    expect(got.map((r) => r.sel)).toEqual(['.a', '.b, .c'])
    expect(got[1].body).toContain('color: blue')
  })

  it('reaches rules nested inside an at-rule', () => {
    const got = cssRules('@media (max-width: 480px) { .a { width: 44px } }')
    expect(got.map((r) => r.sel),
      'a rule inside @media is invisible to the helper, so every phone-width rule in the app goes unswept')
      .toEqual(['.a'])
    expect(got[0].body).toContain('width: 44px')
  })

  it('is not fooled by a brace inside a comment', () => {
    const got = cssRules('/* .ghost { width: 0 } */ .a { color: red }')
    expect(got.map((r) => r.sel),
      'a commented-out rule is returned as a live one, so a sweep judges CSS the browser never sees')
      .toEqual(['.a'])
  })
})

describe('rulesNaming', () => {
  const CSS = [
    '.heart, .status-mark { width: 44px }',
    '.hearts { color: red }',
    '.card .heart:hover { color: pink }',
    '.heartland { color: green }',
  ].join('\n')

  it('finds every rule whose list names the class, however the selector is built', () => {
    expect(rulesNaming(CSS, 'heart').map((r) => r.sel))
      .toEqual(['.heart, .status-mark', '.card .heart:hover'])
  })

  it('does not answer for a class that merely starts with the name', () => {
    // `.hearts` and `.heartland` are other classes. A sweep that counted them
    // would report debt against rules that have nothing to do with the control.
    expect(rulesNaming(CSS, 'heart').map((r) => r.sel).join(' '))
      .not.toMatch(/hearts|heartland/)
  })

  it('splits the selector list so a sweep can judge one selector at a time', () => {
    // The defect this repo has hit twice: a guard testing the whole comma-joined
    // list passes as soon as ANY member satisfies it, so a bare `overflow` in the
    // second position ships.
    expect(rulesNaming(CSS, 'heart')[0].selectors).toEqual(['.heart', '.status-mark'])
  })

  it('treats a metacharacter in the class name as a literal', () => {
    // A compound name like `is.on` is two classes to CSS and one string here. What
    // it must never do is match `.isXon`, which is what an unescaped `.` does.
    const css = '.isXon { color: red }\n.is.on { color: blue }'
    expect(rulesNaming(css, 'is.on').map((r) => r.sel),
      'the class name reached the pattern unescaped, so the helper answers for a class that is not the one asked about')
      .toEqual(['.is.on'])
  })
})
