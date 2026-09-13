// EVERY QUOTE SLOT IS SET THE SAME WAY, AND THIS IS WHAT SAYS SO.
//
// WHY IT EXISTS. The app draws a quote on SEVENTEEN surfaces — fifteen through an
// inline style, two through CSS — and each one used to write its own type out by
// hand. They drifted, in two directions at once: thirteen said `italic` and four
// had picked up `var(--font-display-style)`, which resolves to `inherit` and
// renders UPRIGHT. One of the four is the film CARD, so a film line and a book
// highlight set the same words differently on two screens this repo spent a
// release making behave alike; another is `.anthology-quote`, which is what the
// EXPORT and the print stylesheet draw. Leading was worse: three at 1.55, ten at
// 1.5, one at 1.42 and three with none at all — and SearchPage held both answers
// ten lines apart (1701 italic, 1711 upright), the two branches of one result
// row. `QUOTE_TEXT` (fonts.js) and `--quote-leading` (index.css) are the one copy;
// this is the guard that keeps them the only one.
//
// AND THE GUARD IS NOT THEORETICAL. The commit that introduced `QUOTE_TEXT`
// rewrote the inline sites with a regex, and at the two MULTI-LINE ones the regex
// deleted the property list without inserting the spread — so `FavouriteTile` and
// the quiz card's `QuoteBlock` silently lost their face entirely. Two DOM tests
// caught those two. Nothing would have caught the rest, which is the hole this
// file fills: it asks the question of every slot rather than of the slots
// somebody happened to render.
//
// WHAT MARKS A SLOT, because the first draft of this file got it wrong and passed.
// A quote slot is an element that carries a LANGUAGE CLASS: either `languageClass(`
// at the site, or one of `quoteTexts`' `*Script` fields, which is the same call
// made one layer up (text.js:257) for the cards that let a translation lead. The
// draft looked for the first only, so the two board cards — which take their type
// from a named constant and their class from `bodyScript` — were invisible to it,
// and a mutation that broke one of them passed. Both forms are walked here.
//
// THE FOUR QUESTIONS, and each is a different way to re-introduce the drift:
//
//   A  Nobody but fonts.js names QUOTE_FACE. A slot that writes its own
//      `fontFamily: QUOTE_FACE` has opted out of everything else in QUOTE_TEXT
//      while looking like it opted in — which is how every one of the seventeen
//      came to carry the same face and disagree about the style around it.
//   B  Every quote slot's type comes from QUOTE_TEXT, spread at the site or
//      through a named constant in the same file.
//   C  No spread restates a property QUOTE_TEXT already carries. Size is the one
//      thing that genuinely differs by surface and is deliberately not in the
//      object, so a restatement is a disagreement rather than an override.
//   D  The slots that draw through CSS read the leading token. There are two and
//      they are named below; a third arriving with a number of its own is what
//      this catches.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { QUOTE_FACE, QUOTE_TEXT } from '../../src/fonts.js'
import { SRC, sourcesUnder } from '../src-files.js'

const SPREAD = '...QUOTE_TEXT'
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const jsx = sourcesUnder((n) => n.endsWith('.jsx')).filter((f) => f !== 'fonts.js')
const CSS = read('index.css')

// THE TWO SLOTS THAT DRAW THROUGH CSS, keyed by the element that renders them.
// Neither is an exemption from the TYPE — question D holds both to the same
// leading token — only from carrying it inline, and each is proved below by
// reading the class out of the component and the rule out of the stylesheet
// rather than taking this map's word for either.
const DRAWN_BY_CSS = {
  blockquote: {
    cls: 'anthology-quote',
    declaredIn: 'anthologies.jsx',
    why: 'the anthology page is exported and printed, so its type has to survive leaving the app',
  },
  TranslationLine: {
    cls: 'quote-translation',
    declaredIn: 'ui.jsx',
    why: 'one component draws every translation, so the type belongs to the component and not to its callers',
  },
}

// COMMENTS ARE SKIPPED, and that is not a nicety — it is a defect this file had.
// A JSX prop list is full of `//` comments (this repo's are long), and one of them
// contained the literal text `<textarea>`. The forward scan below read that `>` as
// the end of the tag and stopped before the `style` attribute, so the walk reported
// a slot as bare when it was not. The FALSE POSITIVE is the harmless direction; the
// same slice could just as easily end a tag early and MISS a real violation, which
// is the whole failure this file exists to prevent. So both scanners step over
// comments rather than reading punctuation inside them.
//
// The scan is deliberately not a parser. It needs to answer one question — where
// does this tag end — and a tag ends at the first `>` that is not inside braces,
// a string, or a comment.
function skipNoise(src, i) {
  if (src[i] === '/' && src[i + 1] === '/') {
    const nl = src.indexOf('\n', i)
    return nl < 0 ? src.length : nl
  }
  if (src[i] === '/' && src[i + 1] === '*') {
    const end = src.indexOf('*/', i + 2)
    return end < 0 ? src.length : end + 2
  }
  if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
    const q = src[i]
    for (let j = i + 1; j < src.length; j++) {
      if (src[j] === '\\') { j++; continue }
      if (src[j] === q) return j + 1
    }
    return src.length
  }
  return i
}

// The enclosing JSX tag for an index into a source file: back to the `<` that
// opens it, forward to the `>` that closes it, with `{…}` depth ignored so an
// arrow function inside an attribute cannot end the tag early.
function tagAround(src, at) {
  let start = -1
  for (let i = at; i >= 0; i--) {
    if (src[i] === '<' && /[A-Za-z]/.test(src[i + 1] || '')) { start = i; break }
  }
  if (start < 0) return ''
  let depth = 0
  for (let i = start; i < src.length; i++) {
    const skipped = skipNoise(src, i)
    if (skipped !== i) { i = skipped - 1; continue }
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    else if (src[i] === '>' && depth === 0) return src.slice(start, i + 1)
  }
  return src.slice(start)
}

// The enclosing object literal for an index: the nearest `{` with nothing
// unbalanced between, out to its match.
function objectAround(src, at) {
  let depth = 0
  let start = -1
  for (let i = at; i >= 0; i--) {
    if (src[i] === '}') depth++
    else if (src[i] === '{') { if (depth === 0) { start = i; break } depth-- }
  }
  if (start < 0) return ''
  depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1) }
  }
  return src.slice(start)
}

const lineOf = (src, at) => src.slice(0, at).split('\n').length
const hits = (src, needle) => {
  const out = []
  for (let at = src.indexOf(needle); at >= 0; at = src.indexOf(needle, at + 1)) out.push(at)
  return out
}

// Every element carrying a language class, as {file, line, tag, names}, where
// `names` is the constants in that file bound to a QUOTE_TEXT spread.
const slots = jsx.flatMap((file) => {
  const src = read(file)
  const names = [...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*\{\s*\.\.\.QUOTE_TEXT/g)].map((m) => m[1])
  const marks = [...hits(src, 'languageClass(')]
  for (const m of src.matchAll(/className=\{\w*Script\}/g)) marks.push(m.index)
  return marks
    .sort((a, b) => a - b)
    .map((at) => ({ file, line: lineOf(src, at), tag: tagAround(src, at), names }))
})

// Every QUOTE_TEXT spread in the tree, with the object it sits in.
const spreads = sourcesUnder().flatMap((file) => {
  const src = read(file)
  return hits(src, SPREAD).map((at) => ({ file, line: lineOf(src, at), obj: objectAround(src, at) }))
})

describe('one way to set a quote', () => {
  // THE FLOOR. Every list below is compared against `[]`, so a walk that finds no
  // quote slots passes all four questions while checking nothing — the same
  // failure src-files.js's own header was written for, one level up.
  it('found the quote slots to ask about', () => {
    expect(slots.length, 'the walk found no quote slots — languageClass moved, or the tree did')
      .toBeGreaterThanOrEqual(16)
    expect(spreads.length, 'nothing spreads QUOTE_TEXT, so questions B and C are asking about an empty list')
      .toBeGreaterThanOrEqual(12)
    expect(slots.filter((s) => !s.tag.trim().startsWith('<')).map((s) => `${s.file}:${s.line}`),
      'a slot’s enclosing tag could not be read, so its answer below means nothing').toEqual([])
  })

  it('reads a tag whose props carry a comment that mentions another tag', () => {
    // THE BUG THIS WALK HAD. A `//` comment in a prop list containing `<textarea>`
    // ended the tag at that `>`, so everything after it — including the `style`
    // that answers question B — was invisible. Asserted on a built string rather
    // than on a file, so it goes on meaning something after the tree moves.
    const src = [
      '<textarea',
      '  className={`a ${languageClass(x)}`}',
      '  // a <textarea> is a replaced element, and 1 > 0',
      "  style={{ ...QUOTE_TEXT, fontSize: 'x' }}",
      '/>',
    ].join('\n')
    const tag = tagAround(src, src.indexOf('languageClass('))
    expect(tag, 'the tag was cut short at a > inside a comment').toContain(SPREAD)
  })

  it('A — QUOTE_FACE is fonts.js’s alone', () => {
    const named = sourcesUnder().filter((f) => f !== 'fonts.js' && read(f).includes('QUOTE_FACE'))
    expect(named, 'a module names the face directly; it reaches a slot through QUOTE_TEXT or not at all')
      .toEqual([])
  })

  it('B — every quote slot’s type comes from QUOTE_TEXT', () => {
    const bare = slots
      .filter((s) => !s.tag.includes(SPREAD))
      .filter((s) => !s.names.some((n) => s.tag.includes(`={${n}}`)))
      .filter((s) => !Object.keys(DRAWN_BY_CSS).some((el) => s.tag.startsWith(`<${el}`)))
      .map((s) => `${s.file}:${s.line}`)
    expect(bare, 'a quote slot writes its own type; spread QUOTE_TEXT, or draw it in CSS and say so in DRAWN_BY_CSS')
      .toEqual([])
  })

  it('B — and a slot exempted as CSS-drawn really is one', () => {
    for (const [el, { cls, declaredIn }] of Object.entries(DRAWN_BY_CSS)) {
      const used = slots.filter((s) => s.tag.startsWith(`<${el}`))
      expect(used.length, `<${el}> is listed as CSS-drawn and draws no quote any more`).toBeGreaterThan(0)
      expect(read(declaredIn), `${declaredIn} does not put .${cls} on anything, so <${el}>'s type comes from nowhere`)
        .toContain(cls)
      const rule = CSS.match(new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`))
      expect(rule, `index.css has no .${cls} rule, so <${el}>'s quote is set by nothing`).toBeTruthy()
      expect(rule[0], `.${cls} does not give the quote its language’s face`).toContain('var(--font-quote')
    }
  })

  it('C — and no spread restates what QUOTE_TEXT already says, bar one named override', () => {
    // `fontSize` is not in QUOTE_TEXT at all, so a caller adding one cannot clash;
    // everything the object DOES carry is the app's answer for every surface.
    //
    // THE ONE EXCEPTION, named here so it cannot quietly become two. The capture
    // <textarea> is a REPLACED element, so the measure would reach it at any
    // display and narrow the box a reader TYPES in — 45ch inside a 620px modal,
    // beside fields that stay full width. It declines the measure and keeps
    // everything else. A second entry in this map is a design decision and should
    // be argued for, not added.
    const ALLOWED = { 'AddSurface.jsx': { maxWidth: 'the capture box is written in, not read in — see the site' } }
    const said = []
    for (const s of spreads) {
      const after = s.obj.slice(s.obj.indexOf(SPREAD))
      for (const k of Object.keys(QUOTE_TEXT)) {
        if (!after.includes(`${k}:`)) continue
        if (ALLOWED[s.file]?.[k]) continue
        said.push(`${s.file}:${s.line} restates ${k}`)
      }
    }
    expect(said, 'a slot overrides part of QUOTE_TEXT; if a surface genuinely differs, the object is the place to say so')
      .toEqual([])
  })

  it('C — and the one override is still there, so the exemption is not stale', () => {
    // An allowance for something that has gone is an allowance that will let the
    // next thing through unnoticed. Same reason DRAWN_BY_CSS proves each of its
    // entries above.
    expect(read('AddSurface.jsx'), 'the capture box no longer declines the measure — drop it from ALLOWED')
      .toContain("maxWidth: 'none'")
  })

  it('D — a quote slot drawn in CSS reads both reading-comfort tokens', () => {
    const face = QUOTE_FACE.replace(/\s+/g, ' ')
    const rules = CSS.match(/[^{}]+\{[^}]*\}/g) || []
    const quoteRules = rules.filter((r) => r.replace(/\s+/g, ' ').includes(`font-family: ${face}`))
    expect(quoteRules.length, 'no CSS rule draws a quote any more — move this guard or the stylesheet, not silently')
      .toBeGreaterThanOrEqual(2)
    // Both dials, because a CSS slot that reads one and not the other is the
    // half-working control this whole file exists to stop: the reader moves a
    // setting, most of the app answers, and the anthology or the translation does
    // not — which reads as the setting being broken rather than as one rule.
    for (const [what, decl] of [['leading', 'line-height: var(--quote-leading)'], ['measure', 'max-width: var(--quote-measure)']]) {
      const own = quoteRules
        .filter((r) => !r.includes(decl))
        .map((r) => r.slice(0, r.indexOf('{')).trim())
      expect(own, `a CSS quote slot does not read the ${what} token, so the reading-comfort dial does not reach it`)
        .toEqual([])
    }
  })
})
