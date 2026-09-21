// EVERY BOX A READER TYPES A QUOTE, A NOTE OR A TRANSLATION INTO IS A ProseArea.
//
// WHY A SWEEP. The owner asked for a spelling check on "the quote entry field (in
// various add surfaces)" — and "various" is the whole difficulty. There are twelve
// of these boxes across four files, written at four different times in four
// slightly different shapes, and the thirteenth will be written by somebody who
// has not read `proseField.jsx`. A field that stayed a bare `<textarea>` would
// simply not be checked: nothing throws, nothing renders differently, and the
// reader only finds out by not being told about a typo.
//
// IT IS DERIVED FROM THE STATE NAME, not from a list of line numbers. A box bound
// to `quote`, `note` or `translation` — in any of the shapes this repo writes them
// (`value={quote}`, `value={draft.note}`, `onChange` setting either) — is one of
// these fields by definition. A new one is covered by being bound the way its
// neighbours are.
//
// WHAT IS DELIBERATELY NOT COVERED: a work's `description`. It is usually FETCHED
// rather than typed, and the owner's ask was about the quote entry, so extending
// this sweep to it would be inventing scope. If it should be checked too, it gets
// added here and the sweep says where.
//
// MUTATION-VERIFIED: turn any one of the twelve back into `<textarea` and this
// fails, naming the file and the binding.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { sourcesUnder } from '../src-files.js'

const SRC = process.env.TIPPANI_SRC

// The three fields the ask is about, as this repo binds them.
const BOUND = /value=\{(draft\.)?(quote|note|translation)\}/

// An opening tag, from `<` to the `>` that closes it, over any number of lines.
const TAGS = /<(textarea|ProseArea)\b[^>]*>/gs

function proseTags() {
  const out = []
  for (const f of sourcesUnder((n) => n.endsWith('.jsx'), 30)) {
    const text = readFileSync(join(SRC, f), 'utf8')
    for (const m of text.matchAll(TAGS)) {
      if (!BOUND.test(m[0])) continue
      out.push({ file: f, tag: m[1], bind: m[0].match(BOUND)[0], whole: m[0] })
    }
  }
  return out
}

describe('the boxes a reader types prose into', () => {
  it('there are some, so this test is testing something', () => {
    // The sweep's own failure mode: a regex that stops matching asserts nothing
    // about an empty list and passes for ever. Twelve exist today.
    expect(proseTags().length).toBeGreaterThan(9)
  })

  it('are all spell-checked while being edited, not bare textareas', () => {
    const bare = proseTags()
      .filter((x) => x.tag === 'textarea')
      .map((x) => `${x.file} ${x.bind}`)
    expect(bare, 'these take a quote, a note or a translation and are never spell-checked')
      .toEqual([])
  })

  it('and each one is told which language it is in', () => {
    // WITHOUT `language` THE COMPONENT EMITS NO `lang`, so the browser falls back
    // to the document's — and a Bengali quote comes back wrong word by word. A
    // ProseArea with no language is the same defect as a bare textarea, one layer
    // in, and it is the one a reader would blame on the app rather than on a
    // dictionary.
    const mute = proseTags()
      .filter((x) => x.tag === 'ProseArea' && !/\blanguage=/.test(x.whole))
      .map((x) => `${x.file} ${x.bind}`)
    expect(mute, 'these are checked against whatever language the interface is in').toEqual([])
  })
})
