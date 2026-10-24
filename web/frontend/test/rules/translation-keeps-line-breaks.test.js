// THE READER'S OWN TEXT KEEPS THE LINE BREAKS IT WAS GIVEN.
//
// The owner's: "the translation needs to follow the linebreaks and spaces like the
// quote body." A poem's translation arrived as one run of prose beside an original
// that kept its shape, because `.quote-translation` had no `pre-wrap`. The same drift
// had left `.flow-fallback` and `.hand-note` without it. jsdom applies no stylesheet,
// so a declaration is a fact about index.css and is read from the file.
//
// Moved from dom/quote-translation-leads.test.jsx; comments are stripped first so a
// note explaining the rule cannot satisfy the assertion looking for it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { stripComments } from '../css-cascade.js'

const css = stripComments(readFileSync(join(process.cwd(), 'src/index.css'), 'utf8'))
const blockFor = (cls) => {
  const at = css.indexOf(`.${cls} {`)
  return at === -1 ? null : css.slice(at, css.indexOf('}', at))
}

describe('paragraphs of the reader’s own text', () => {
  it.each([
    ['quote-translation', "a poem's translation draws as prose"],
    ['flow-fallback', 'a poem run together into prose for every reader who asked for less motion'],
    ['hand-note', 'a note typed over several lines drawn as one run of prose'],
  ])('.%s keeps the line breaks it was given', (cls, breaks) => {
    const block = blockFor(cls)
    expect(block, `.${cls} is not declared in index.css at all`).not.toBeNull()
    expect(block, `.${cls} lost its white-space: ${breaks}`).toMatch(/white-space\s*:\s*pre-wrap/)
  })
})
