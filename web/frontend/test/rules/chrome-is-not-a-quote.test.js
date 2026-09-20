// THE APP'S OWN FURNITURE IS SET IN THE INTERFACE FACE. THE READER'S WORDS ARE
// NOT.
//
// WHAT THIS GUARDS, AND THE REPORT THAT FORCED IT. `--font-display` was ONE
// variable doing TWO jobs under one of their names: the reader's quote face, and
// the face of every heading, every panel title, the top bar and the wordmark. The
// picker row that set it was labelled "Quotes". So a reader who set their quotes
// in Newsreader got a serif top bar over an interface set in Atkinson Hyperlegible
// Next, and no control anywhere could separate them. The owner, on a phone: "the
// interface font is atkinson hyperlegible next. Why is the top bar using
// newsreader, which is set as the quote font".
//
// NOTHING FAILED WHILE IT WAS WRONG, which is the whole argument for a scanner
// here. Every one of those sites rendered; the variable resolved; the suites were
// green. The fault was only visible to somebody who had set the two to different
// faces and then looked at a heading — and that is a state no unit test was in.
//
// THE FIRST CASE IS THE REAL RATCHET, and it is derived rather than listed: the
// merged variable no longer exists, by name, anywhere. A guard that enumerated
// "these selectors must read --font-ui" would go stale on the next heading
// somebody adds; a guard that says the shared name is gone cannot, because the
// only way back to the old fault is to bring the name back — or to invent an alias
// for it, which the second case is about.
//
// MUTATION-VERIFIED: restoring `--font-display` on `.mobile-topbar-title` fails
// the first case; adding `--font-display: var(--font-quote-base)` to `:root` fails
// the second; pointing the top bar at the quote face fails the third.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { cssRules } from '../css-rules.js'
import { sourcesUnder } from '../src-files.js'

const SRC = process.env.TIPPANI_SRC
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

// `--type-display-*` is the TYPE SCALE and has nothing to do with this: it names
// sizes, not faces. Only the face variable is forbidden.
const MERGED = /--font-display\b(?!-)|--font-display-(weight|style|caps|case|figures)\b/

const sources = () =>
  sourcesUnder((n) => n.endsWith('.jsx') || n.endsWith('.js') || n.endsWith('.css'), 90)
    .map((f) => [f, readFileSync(join(SRC, f), 'utf8')])

describe('the variable that was doing two jobs', () => {
  it('is gone from every source, including as a comment nobody updated', () => {
    // COMMENTS COUNT. A comment naming a variable that no longer exists is how the
    // next reader learns the wrong model of this, and this file's own subject is a
    // name that lied.
    const named = sources()
      .filter(([, text]) => MERGED.test(text))
      .map(([f]) => f)
    expect(named, 'these still name --font-display, which was the merged face').toEqual([])
  })

  it('and no alias brings it back under another name', () => {
    // An alias is how the two jobs get merged again the first time somebody
    // reaches for a title face and finds something that answers.
    const aliases = cssRules(CSS)
      .filter((r) => /--font-(title|heading|display)\s*:/.test(r.body))
      .map((r) => r.sel)
    expect(aliases, 'these define a second name for the app title face').toEqual([])
  })
})

describe('the app’s own furniture', () => {
  // THE SITES THE OWNER NAMED, plus the three headings that sit beside them. A
  // short list on purpose: the sweep above is what catches the general case, and
  // this is the specific regression, named so a failure says which screen.
  const CHROME = ['.mobile-topbar-title', '.page-header h1', '.tp-panel-title', '.section-header h2']

  it('reads the interface face, not the quote face', () => {
    const rules = cssRules(CSS)
    const wrong = CHROME.map((sel) => {
      const r = rules.find((x) => x.sel === sel)
      if (!r) return `${sel} (no such rule any more)`
      if (/font-family:[^;}]*--font-quote/.test(r.body)) return `${sel} (quote face)`
      if (!/font-family:[^;}]*--font-ui\b/.test(r.body)) return `${sel} (no interface face)`
      return null
    }).filter(Boolean)
    expect(wrong, 'chrome is what you press, so it is set in the face you chose for pressing things')
      .toEqual([])
  })
})
