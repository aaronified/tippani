// A translated string is never cut to a fixed number of characters.
//
// THE BUG: the stats activity calendar labelled its x axis with
// `monthName(m).slice(0, 3)` — the full month name from the catalogue, cut to three.
// Three what? Three UTF-16 code units, which is "three letters" in English and
// nothing coherent anywhere else. In Bengali এপ্রিল cut at three gives এপ্ — a
// consonant, a vowel sign and a dangling hasant with no consonant to join — and
// অক্টোবর gives অক্. Ten of the twelve months happened to survive, so a screenshot
// would look fine unless you knew which two to check.
//
// It shipped for the same reason it always does: the slice was written when the app
// had one language, and adding a second does not make old arithmetic fail loudly.
//
// The fix was not a smarter cut. Any cut is wrong, because where a word may be
// shortened is a fact about the language, not about the string — so the app carries
// twelve WRITTEN abbreviations per language (`common.month.*.label`), which is also
// the only form a translator can correct without touching code. The date picker was
// already using them; the calendar now takes the same table, so the two can no
// longer disagree.
//
// Scraped from source because that is where the rule lives. A rendering test would
// need the calendar, a locale and a month whose abbreviation happens to break.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUILTINS } from '../locale-file.js'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const read = (f) => readFileSync(join(SRC, f), 'utf8')

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const graphemes = (s) => [...new Intl.Segmenter('bn', { granularity: 'grapheme' }).segment(s)].length

describe('the stats calendar axis', () => {
  const stats = read('StatsPage.jsx')

  it('takes its month names from the shared table, not from a cut', () => {
    // `toContain('MONTH_KEYS')` used to stand here and was satisfied by this
    // file's own COMMENT about MONTH_KEYS — so the guard would have survived the
    // import being deleted. `dom/month-axis.test.jsx` renders the calendar IN
    // BENGALI and looks at the labels, which is where the damage is: in English a
    // cut and the table produce the same "Jan" and no render can tell them apart.
    // What is left here is the narrower thing a render cannot state — that the cut
    // is not written anywhere in this file at all, in any of its spellings.
    expect(stats).not.toMatch(/monthName\([^)]*\)\s*\.\s*(?:slice|substring|substr)/)
    expect(stats, 'a month name is being cut to a fixed number of code units')
      .not.toMatch(/month[A-Za-z]*\([^)]*\)[^\n]{0,40}\.(?:slice|substring|substr)\(/)
  })

  it('and ui.jsx still owns that table, so there is one of it', () => {
    const ui = read('ui.jsx')
    expect(ui).toMatch(/export const MONTH_KEYS = \[/)
    // Every month, in calendar order — the order IS the calendar, per ui.jsx.
    const table = ui.slice(ui.indexOf('export const MONTH_KEYS = ['))
    const found = [...table.slice(0, table.indexOf(']')).matchAll(/common\.month\.([a-z]+)\.label/g)].map((m) => m[1])
    expect(found).toEqual(MONTHS)
  })
})

describe('no interface string is cut to a fixed length', () => {
  it('nothing slices the result of a t() call', () => {
    // The direct form of the same mistake, anywhere in the tree. The indirect form
    // — through a helper, which is how this one hid — is what the assertion above
    // pins for the one place it happened.
    const hits = []
    for (const file of ['StatsPage.jsx', 'ui.jsx', 'help.jsx', 'text.js']) {
      read(file)
        .split('\n')
        .forEach((line, i) => {
          if (/^\s*(\/\/|\*)/.test(line)) return
          if (/\bt(?:Nodes)?\([^)]*\)\s*\.\s*(?:slice|substring|substr)\s*\(/.test(line)) {
            hits.push(`src/${file}:${i + 1}  ${line.trim()}`)
          }
        })
    }
    expect(hits, 'cut a translated string and some language loses a letter it needed').toEqual([])
  })
})

describe('every language’s month abbreviations', () => {
  // The catalogue's side of the same rule: the strings the axis now trusts have to
  // be usable as abbreviations, in every language compiled in.
  for (const [code, file] of BUILTINS) {
    it(`${code}.txt has all twelve, short and whole`, () => {
      const missing = MONTHS.filter((m) => !file.keys[`common.month.${m}.label`])
      expect(missing, 'the calendar draws a stub for a month with no short name').toEqual([])

      const values = MONTHS.map((m) => file.keys[`common.month.${m}.label`])

      // Short enough for a column of a 53-week grid. Graphemes, not code units —
      // counting the other way is the bug this file is about.
      const long = values.filter((v) => graphemes(v) > 6).map((v) => `${v} (${graphemes(v)})`)
      expect(long, 'too wide for the axis').toEqual([])

      // And whole: a value must not end mid-cluster. The mark that says so is the
      // virama — হসন্ত (U+09CD) or ्  (U+094D) — which exists to JOIN the consonant
      // before it to the one after, so a string ending in one is missing its second
      // half. That is precisely what `slice(0, 3)` left behind in এপ্.
      //
      // A trailing VOWEL SIGN is not the same thing and is not an error: জানু, এপ্রি
      // and অক্টো all end in one and all are how Bengali actually abbreviates. The
      // first draft of this test banned those too and failed on correct data — the
      // rule is "not cut mid-conjunct", not "must end in a consonant".
      const cut = values.filter((v) => /[্्‍]$/u.test(v))
      expect(cut, 'ends on a virama — a fragment, not an abbreviation').toEqual([])
    })
  }
})
