// The Bengali interface does not bring back a rendering the style sheet retired.
//
// A SOURCE SCANNER, NOT A TEST, which is why it lives here. docs/wiki/Bengali-style.md
// settles one word per idea, and #47 moved the file onto its words: ইমপোর্ট and
// এক্সপোর্ট for import and export (§4.2: "আমদানি / রপ্তানি are trade words. Comic
// here"), মেনে নিন for approve, দৈনিক অনুশীলনী for the daily quiz. Two sweeps moved
// 68 values onto those words (3930f8c2, 12cd0661) and still missed one (#52): the
// tour's first screen said রোজকার মনে রাখার কুইজ, with two words between the pair
// the sweep was looking for. The owner's ruling of 29 September then made the bare
// quiz অনুশীলনী too (a6c18e7e), where §4.2 had kept কুইজ as a loan. Nothing on screen says a word is the retired one; a Bengali
// reader sees a sentence that reads, and only the sheet says it is the wrong word.
//
// What it reads: every `key = value` line of internal/i18n/bn.txt, values only, so a
// `#` comment that quotes an old word to explain a choice is left alone. Each
// retired rendering is a pattern and the sheet's word beside it. A new one joins the
// list when the sheet retires it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SRC } from '../src-files.js'

const BN = readFileSync(join(SRC, '..', '..', '..', 'internal', 'i18n', 'bn.txt'), 'utf8')

const RETIRED = [
  { was: /আমদানি/u, now: 'ইমপোর্ট' },
  { was: /রপ্তানি/u, now: 'এক্সপোর্ট' },
  { was: /অনুমোদন/u, now: 'মেনে নিন' },
  // The quiz in any form, the daily one included (রোজকার … কুইজ was #52). §4.2 kept
  // কুইজ as a loan while v3.7 said অনুশীলনী, and the owner settled it on 29
  // September: "অনুশীলনী it is".
  { was: /কুইজ/u, now: 'অনুশীলনী' },
]

function values() {
  return BN.split('\n')
    .map((l) => l.match(/^([a-z][A-Za-z0-9.-]*) = (.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => ({ key, value }))
}

describe('the Bengali locale', () => {
  it('uses the style sheet’s word where the sheet retired another', () => {
    const found = []
    for (const { key, value } of values()) {
      for (const r of RETIRED) {
        const m = value.match(r.was)
        if (m) found.push(`${key}: "${m[0]}" is retired; the sheet says ${r.now}`)
      }
    }
    expect(found).toEqual([])
  })
})
