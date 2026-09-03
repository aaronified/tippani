// Every screen speaks the reader's language, and none of them leaks a key.
//
// TWO FAILURES, OPPOSITE IN SHAPE, AND BOTH INVISIBLE TO EVERY OTHER TEST HERE.
//
//   A KEY RENDERED RAW. A table holds `nav.section.library.what`, the screen draws
//   it without passing it through t(), and the reader sees the key. Three of these
//   shipped: the shortcut sheet's five headings, the Features card's three lines of
//   microcopy, and the review-scope chips.
//
//   A LITERAL NEVER TOKENISED. The English is still sitting in the JSX, so the
//   screen reads English in Bengali and there is no key to be missing.
//
// locale-complete.test.js catches neither, and says so in its own header: it asks
// whether every key the code NAMES exists and whether every key defined is named,
// and a key rendered raw passes both — it is right there in the source as a
// literal. A literal never tokenised has no key to check at all. Both questions
// are about a VALUE ON A SCREEN, which only a render can answer.
//
// SO THE PSEUDO-LOCALE IS THE INSTRUMENT, and this is the file design §9 was
// written for. i18n.js's own words: "the point is not to look like a language — it
// is that a string which came through t() is unmistakable, so an English literal
// still sitting in the JSX is the only plain text on the screen." Under qps every
// resolved string is accented and bracketed — ⟦Šëţţíñĝš···⟧ — so plain ASCII words
// on the screen are exactly the strings that never reached the resolver.
//
// IT RUNS OVER EVERY SCREEN, not over the card whose bug started it. The first
// draft of the raw-key scan was scoped to the Features card, and widening it to
// the whole of Settings immediately found a third leak in a different card that
// nobody was looking for. A key on screen is a key on screen; the card a case is
// filed under is not a reason to stop looking at the next one. So the list is
// test/screens.js — the same list screens-mount.test.jsx smoke-tests, which App
// itself is the authority on — and a screen added tomorrow is gated the day it
// joins the table.
//
// ATTRIBUTES COUNT. A title, a placeholder, an aria-label and an alt are all read
// by somebody — the last one by the reader who has the least choice about it. The
// i18n migration's final sweep was three untokenised `title=` props and one
// `placeholder="Note"`, found by hand; this is that sweep, mechanised.

import { afterAll, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { PSEUDO, applyLocale, pseudoTransform } from '../../src/i18n.js'
import { SCREENS } from '../screens.js'

// Refused, exactly as screens-mount refuses — the error branch is copy too, and
// it is the branch nobody reads by hand.
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: false, status: 500, error: 'refused by the mock' })),
  downloadPost: vi.fn(async () => ({ ok: false, status: 500, error: 'refused by the mock' })),
}))

// The accented alphabet, DERIVED FROM THE TRANSFORM rather than copied out of it.
// A second hand-maintained copy of PSEUDO_LETTERS is a table that drifts; asking
// pseudoTransform what it does to the alphabet cannot.
const ACCENTED = new Set(
  [...pseudoTransform('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')]
    .filter((c) => !'⟦⟧·'.includes(c)),
)

// A string that came through t(). The brackets alone are not enough: tNodes splits
// one resolved value around its interpolated nodes, so a middle segment carries no
// bracket at all — but every segment is accented, because the value was transformed
// before it was split.
const translated = (s) => [...s].some((c) => ACCENTED.has(c)) || /[⟦⟧]/.test(s)

// Two ASCII letters together are a word. One is an initial, a unit or an axis tick.
const hasWord = (s) => /[A-Za-z]{2,}/.test(s)

// A key rendered raw: dotted, lowercase, no spaces, the whole string.
const KEYSHAPE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/

// The attributes a human reads.
const SPOKEN = ['title', 'placeholder', 'aria-label', 'alt']

// GRAMMAR IS NOT COPY, and it is the one exemption this sweep has.
//
// The search box parses `tag:`, `author:`, `book:` — sixteen field names that are
// the QUERY LANGUAGE. They are identical in every locale by definition: translated
// into the pseudo-locale they would read `ŧäǧ:`, which the parser rejects, so
// "untranslated" is the correct state rather than an oversight. Anything the app
// marks `data-grammar` is skipped here.
//
// It is an ATTRIBUTE ON THE ELEMENT rather than a list of strings in this file,
// deliberately: a list would have to be kept in step with FACET_FIELDS, and the
// day somebody adds a seventeenth field the list is what would be forgotten. The
// screen declares what it is, and this reads the declaration.
const isGrammar = (node) => !!node?.parentElement?.closest?.('[data-grammar]')

// Everything on the page that a reader can see or hear, as {where, text}.
function spokenStrings() {
  const out = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const text = n.textContent.trim()
    if (text && !isGrammar(n)) out.push({ where: `<${n.parentElement?.tagName.toLowerCase() || '?'}>`, text })
  }
  for (const el of document.body.querySelectorAll('*')) {
    for (const attr of SPOKEN) {
      const text = el.getAttribute(attr)?.trim()
      if (text) out.push({ where: `<${el.tagName.toLowerCase()} ${attr}>`, text })
    }
  }
  return out
}

async function mount(load, name, props) {
  const Screen = (await load())[name]
  // The screens log their refused fetches; that is the mock working, not a fault.
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await act(async () => {
      render(<Screen {...props} />)
    })
  } finally {
    quiet.mockRestore()
  }
}

afterAll(() => {
  applyLocale('en')
})

describe('under the pseudo-locale, every screen', () => {
  for (const [key, [load, name, props]] of Object.entries(SCREENS)) {
    it(`${key} renders no unresolved key and no untokenised literal`, async () => {
      applyLocale(PSEUDO)
      await mount(load, name, props)
      const seen = spokenStrings()
      expect(seen.length, `${key} rendered nothing readable`).toBeGreaterThan(0)

      const keys = seen.filter((s) => KEYSHAPE.test(s.text))
      const plain = seen.filter((s) => !KEYSHAPE.test(s.text) && hasWord(s.text) && !translated(s.text))

      expect(
        [...keys, ...plain].map((s) => `${s.where} ${JSON.stringify(s.text)}`),
        `${key}: keys rendered raw, or English never tokenised`,
      ).toEqual([])
    })
  }
})
