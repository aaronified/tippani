// The visible part of a help entry has a budget, and the tail cannot grow back.
//
// The measurement that started this: 157 entries, 49,738 characters, ~8,000 words.
// The median was 233 characters — fine — and the tail was not: 40 entries over 400,
// 8 over 800, and the worst 1,911 characters and fifteen sentences. Worse, the
// longest entries were the SHELL ones, which every screen's panel appends, so the
// copy a reader met most often was the copy that read least.
//
// A budget on prose is a blunt instrument and it is the only one that works here.
// Nothing else noticed: no test failed, no gate fired, and each entry grew by one
// reasonable sentence at a time until the panel was a document nobody opened twice.
//
// WHAT IS BUDGETED IS WHAT IS VISIBLE. `what` and `how` are on screen the moment
// the panel opens, so they are capped; `more` is behind a fold and is deliberately
// NOT capped, because the reasoning this project writes down is worth keeping — it
// is only not worth being the first thing somebody meets. That asymmetry is the
// whole design, and a cap on `more` would quietly turn the collapse decision into
// the delete-it-all one.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HELP, helpFor, helpGuide } from '../../src/help.jsx'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')

// WHAT_MAX — one sentence, front-loaded. 200 rather than 120: this app's sentences
// carry em dashes and clauses, and a cap that forces "Search across your library."
// buys density by throwing away the half of the sentence that was useful.
const WHAT_MAX = 200
// HOW_MAX / HOW_LINES — a verb-first line, and at most three of them. Three is the
// number that still reads as a set at a glance; the fourth is where a list becomes
// a procedure, and a procedure belongs in `more`.
const HOW_MAX = 120
const HOW_LINES = 3

const allEntries = () => {
  const seen = new Map()
  for (const touch of [false, true]) {
    for (const sec of helpGuide(touch)) {
      for (const e of sec.entries) seen.set(`${sec.id}·${e.term}`, e)
    }
  }
  return [...seen.entries()]
}

describe('the visible part of an entry', () => {
  it('there are entries, so this is measuring something', () => {
    // The sweep's own failure mode, and this file is a sweep.
    expect(allEntries().length).toBeGreaterThan(100)
  })

  it('says what it is in one sentence, inside the budget', () => {
    const over = allEntries()
      .filter(([, e]) => (e.what || '').length > WHAT_MAX)
      .map(([k, e]) => `${k} (${e.what.length})`)
    expect(over, `over ${WHAT_MAX} characters — move the rest into \`more\``).toEqual([])
  })

  it('and it is one sentence, not a paragraph with the full stops taken out', () => {
    // Counting sentence-ending punctuation followed by a capital: the cheap proxy
    // for "this is a paragraph". Two is allowed — a short second sentence that
    // qualifies the first is often the clearest shape — three is a paragraph.
    const wordy = allEntries()
      .filter(([, e]) => ((e.what || '').match(/[.?!]\s+[A-Z“]/g) || []).length > 1)
      .map(([k]) => k)
    expect(wordy, 'three or more sentences in `what`').toEqual([])
  })

  it('keeps its how-to lines short and few', () => {
    const bad = []
    for (const [k, e] of allEntries()) {
      if (!e.how) continue
      if (!Array.isArray(e.how)) bad.push(`${k}: how is not an array`)
      else if (e.how.length > HOW_LINES) bad.push(`${k}: ${e.how.length} lines`)
      for (const line of e.how || []) {
        if (line.length > HOW_MAX) bad.push(`${k}: a line of ${line.length}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('does not put a whole entry behind the fold and leave nothing in front', () => {
    // `more` with no `what` is an entry whose visible half is its own name.
    const empty = allEntries()
      .filter(([, e]) => e.more && !(e.what || '').trim())
      .map(([k]) => k)
    expect(empty, 'nothing visible above the fold').toEqual([])
  })
})

describe('the register', () => {
  // Not taste-policing: these are the specific tics that made the old copy long.
  // "Simply" and "just" are always deletable; "you can" is a sentence starting two
  // words before its verb; and an instruction about how to operate a touch screen
  // is written for somebody who has never held a phone, which the reader has.
  const BANNED = [
    [/\bsimply\b/i, '"simply" — delete it and the sentence is shorter and truer'],
    [/\bjust\s/i, '"just" — same'],
    [/\byou can\b/i, '"you can" — say what it does, not that you are permitted to'],
    [/press and hold/i, 'the reader has held a phone before'],
    [/\bin order to\b/i, '"in order to" is "to"'],
  ]

  it('avoids the words that made it long', () => {
    const hits = []
    for (const [k, e] of allEntries()) {
      const visible = `${e.what || ''} ${(e.how || []).join(' ')}`
      for (const [re, why] of BANNED) {
        if (re.test(visible)) hits.push(`${k}: ${why}`)
      }
    }
    expect(hits).toEqual([])
  })
})

describe('the guide', () => {
  it('gives every screen in HELP a rail section', () => {
    const railed = new Set(helpGuide(false).map((s) => s.id))
    const missing = Object.keys(HELP).filter((k) => !railed.has(k))
    expect(missing, 'screens with help but no rail entry — see GUIDE_ORDER').toEqual([])
  })

  it('ends with the shell, because it is the longest and the least specific', () => {
    const ids = helpGuide(false).map((s) => s.id)
    expect(ids[ids.length - 1]).toBe('everywhere')
  })

  it('describes one shell, never both', () => {
    const terms = (touch) =>
      helpGuide(touch)
        .find((s) => s.id === 'everywhere')
        .entries.map((e) => e.term)
    expect(terms(true)).toContain('Menu (☰)') // the phone has a drawer
    expect(terms(false)).toContain('Tab strip') // a pointer has a tab strip
    expect(terms(true)).not.toContain('Tab strip')
    expect(terms(false)).not.toContain('Menu (☰)')
  })

  // helpFor is still the per-screen answer, and two callers depend on it.
  it('leaves helpFor alone for the callers that want one screen', () => {
    const h = helpFor('library', false)
    expect(h.title).toBeTruthy()
    expect(h.entries.some((e) => e.term === 'Tab strip')).toBe(true)
  })
})

describe('assets', () => {
  const src = readFileSync(join(SRC, 'help.jsx'), 'utf8')

  it('draws a gesture only where the app has one', () => {
    // gestures.test.jsx owns the library's own rules; this owns the help file's use
    // of it. Anything referenced here has to be in IMPLEMENTED.
    const used = [...src.matchAll(/<Gesture kind="([^"]+)"/g)].map((m) => m[1])
    expect(used.length).toBeGreaterThan(0)
    for (const k of used) {
      expect(['long-press', 'swipe-left'], `${k} is not a gesture the app binds`).toContain(k)
    }
  })
})
