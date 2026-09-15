// EVERY ANCHOR A TOUR STEP NAMES EXISTS, AND EVERY ANCHOR IN THE APP IS NAMED.
//
// THE TWO BUGS THIS EXISTS FOR, AND THEY ARE THE SAME BUG SEEN FROM EACH END.
//
// `tour.jsx` still named `[data-tour="search"]` a fortnight after the shell rewrite
// (046b9831) rebuilt the top bar without the attribute. `findVisible` returns null
// for a selector that matches nothing, and a null rect draws NEITHER the spotlight
// ring NOR the scrim — so the step about finding a line again opened over an
// undimmed page and pointed at nothing. Nobody noticed, because nothing throws: a
// CSS selector that matches nothing is a perfectly good selector.
//
// And `Settings.jsx` carried `data-tour="categories"` that no step had ever named —
// the same broken pair from the other side, costing nothing and doing nothing.
//
// WHY A SCANNER AND NOT A JOURNEY, which is the tier this repo prefers and says so.
// A journey may know what is on the screen and what a person can do to it. The
// spotlight is an `aria-hidden` div with no text and no role, so there is nothing
// for `see` to read or `press` to press, and its ABSENCE is the whole symptom. The
// vocabulary cannot ask the question, and widening it to reach a class would be the
// thing that directory's header forbids. This is a contract between two files —
// exactly what `test/rules` is for — so it lives here and out of `npm test`.
//
// IT READS THE APP'S OWN SOURCE, which is the declared exception this file is
// allowed: the pair being checked IS a pair of source texts, and there is no
// observable behaviour that differs when one half is missing.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { sourcesUnder } from '../src-files.js'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const files = sourcesUnder((n) => n.endsWith('.jsx') || n.endsWith('.js'), 60)

// COMMENTS ARE BLANKED BEFORE ANYTHING IS COUNTED, and that is not fastidiousness:
// the first run of this file failed on a comment that QUOTED the orphan it was
// reporting, in the very edit that removed the attribute. A scanner that reads prose
// as code reports a defect that is not there, and the next person's fix is to delete
// the scanner. Blanked rather than deleted so every line number still points at the
// line it came from.
//
// String-aware, because `'//'` inside a quoted string is not a comment and a URL in
// a comment is not a string. Regex literals are not tracked: none of these files
// opens one, and a tracker for a case that does not arise is a second thing to get
// wrong.
function withoutComments(src) {
  let out = ''
  let i = 0
  let quote = ''
  while (i < src.length) {
    const c = src[i]
    const next = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') { out += next ?? ''; i += 2; continue }
      if (c === quote) quote = ''
      i++
      continue
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; out += c; i++; continue }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++ }
      continue
    }
    if (c === '/' && next === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++ }
      out += '  '
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

// What the steps ask for: `anchor: '[data-tour="add"]'`.
const wanted = new Map()
// What the app actually marks: `data-tour="add"`.
const marked = new Map()

for (const f of files) {
  const src = withoutComments(readFileSync(join(SRC, f), 'utf8'))
  const at = (i) => `${f}:${src.slice(0, i).split('\n').length}`
  for (const m of src.matchAll(/anchor:\s*'\[data-tour="([^"]+)"\]'/g)) {
    if (!wanted.has(m[1])) wanted.set(m[1], at(m.index))
  }
  for (const m of src.matchAll(/(?<!anchor:\s*'\[)data-tour="([^"]+)"/g)) {
    if (!marked.has(m[1])) marked.set(m[1], at(m.index))
  }
}

describe('a tour anchor', () => {
  it('is used at all, so this file cannot pass by finding nothing', () => {
    // THE VACUITY GUARD. A regex that stopped matching would make both sets empty
    // and every assertion below trivially true — which is the failure mode of every
    // scanner in this directory and the reason each one opens with this.
    expect(wanted.size, 'no tour step names an anchor; the scan is broken').toBeGreaterThan(3)
    expect(marked.size, 'nothing in the app carries data-tour; the scan is broken').toBeGreaterThan(3)
  })

  it('matches an element that actually carries it', () => {
    const dangling = [...wanted].filter(([name]) => !marked.has(name))
    expect(
      dangling.map(([name, where]) => `${where} spotlights [data-tour="${name}"] and nothing carries it`),
      'a step points at an element that does not exist',
    ).toEqual([])
  })

  it('is named by a step, rather than sitting on an element nobody points at', () => {
    const orphans = [...marked].filter(([name]) => !wanted.has(name))
    expect(
      orphans.map(([name, where]) => `${where} carries data-tour="${name}" and no step names it`),
      'an element is marked for a tour step that does not exist',
    ).toEqual([])
  })
})
