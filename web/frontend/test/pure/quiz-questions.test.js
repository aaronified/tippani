// The in-depth quiz controls, and the seam where they could go wrong.
//
// TWO IMPLEMENTATIONS OF ONE RULE SET, which is a shape this repo distrusts on
// principle — facets.js opens by refusing to let the server re-parse its
// grammar for exactly this reason. Here the duplication is deliberate and the
// reasoning is different: the server MUST normalise, because a preference can
// arrive by PUT, by restore, or from somebody editing their own database. The
// client must ALSO know the rules, or a switch that would empty a deck is
// accepted, sent, silently corrected, and flips back under the reader's finger
// with no explanation.
//
// So both exist, and this file is what stops them drifting: it reads the Go
// source and checks the two tables say the same thing. A rule added on one side
// and not the other fails here rather than in somebody's deck.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  allowedIn,
  DEFAULT_QUESTIONS,
  lockedOff,
  parseQuestions,
  questionsBlob,
  questionsFor,
  REVIEW_QUESTIONS,
  toggle,
} from '../../src/quiz.js'

// Relative to THIS file rather than to cwd or TIPPANI_SRC: the Go source is
// outside the frontend tree, so neither of the usual seams reaches it.
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const goSrc = readFileSync(join(repo, 'internal', 'httpapi', 'review_questions.go'), 'utf8')

const goList = (name) => {
  const m = goSrc.match(new RegExp(`${name}:\\s*\\[\\]string\\{([^}]*)\\}`))
  return m ? [...m[1].matchAll(/dir(\w+)/g)].map((x) => x[1].toLowerCase()) : null
}

describe('the two implementations agree', () => {
  it('on the default daily deck', () => {
    expect(goList('daily')).toEqual(DEFAULT_QUESTIONS.daily)
  })

  it('on the default practice deck', () => {
    expect(goList('practice')).toEqual(DEFAULT_QUESTIONS.practice)
  })

  it('on which directions exist at all', () => {
    const m = goSrc.match(/reviewDirectionsAll = \[\]string\{([^}]*)\}/)
    const inGo = [...m[1].matchAll(/dir(\w+)/g)].map((x) => x[1].toLowerCase())
    expect(inGo).toEqual(REVIEW_QUESTIONS.map((q) => q.id))
  })

  it('on which of them can be asked of every kind of card', () => {
    const m = goSrc.match(/reviewDirectionUniversal = map\[string\]bool\{([\s\S]*?)\}/)
    const inGo = [...m[1].matchAll(/dir(\w+):/g)].map((x) => x[1].toLowerCase()).sort()
    const inJs = REVIEW_QUESTIONS.filter((q) => q.universal).map((q) => q.id).sort()
    expect(inGo).toEqual(inJs)
  })
})

describe('the three rules', () => {
  // RULE 2 — 1.15.3's decision, which making the repertoire configurable would
  // otherwise hand back by accident.
  it('never offer the flip card in the daily deck', () => {
    expect(allowedIn('flip', 'daily')).toBe(false)
    expect(allowedIn('flip', 'practice')).toBe(true)
    expect(questionsFor('daily').map((q) => q.id)).not.toContain('flip')
    // Not even if it is already in the stored blob.
    expect(parseQuestions('{"daily":["source","flip"]}').daily).not.toContain('flip')
  })

  // RULE 3, and its sharp half: a deck of nothing but "who said this?" is not
  // empty, and is empty for every book in the library.
  it('never leave a deck with no question it can ask of a book', () => {
    expect(parseQuestions('{"daily":["speaker"]}').daily).toEqual(DEFAULT_QUESTIONS.daily)
    expect(parseQuestions('{"daily":[]}').daily).toEqual(DEFAULT_QUESTIONS.daily)
  })

  // RULE 1 — forwards and backwards compatible, so a restore from a newer build
  // does not fail on a direction this one has never heard of.
  it('drop a direction they do not recognise rather than refusing the blob', () => {
    expect(parseQuestions('{"daily":["source","telepathy"]}').daily).toEqual(['source'])
  })

  it('and read anything unparseable as the defaults', () => {
    for (const blob of ['{', 'null', '[]', '{"daily":"source"}', 'not json']) {
      expect(parseQuestions(blob), blob).toEqual(DEFAULT_QUESTIONS)
    }
  })
})

describe('toggling', () => {
  const state = () => parseQuestions('')

  it('takes a type out and puts it back, in the table’s own order', () => {
    const off = toggle(state(), 'daily', 'quote')
    expect(off.daily).toEqual(['source', 'cloze', 'speaker'])
    // Back on, and NOT appended at the end — a canonical order is what lets the
    // stored blob be compared between two accounts.
    expect(toggle(off, 'daily', 'quote').daily).toEqual(DEFAULT_QUESTIONS.daily)
  })

  // REFUSES RATHER THAN REVERTS, which is the whole reason quiz.js exists. The
  // server would correct this on the way in; the reader would see a switch move
  // and then move back.
  it('refuses the last universal type, and says why', () => {
    let s = { daily: ['cloze', 'speaker'], practice: [...DEFAULT_QUESTIONS.practice] }
    expect(lockedOff(s, 'daily', 'cloze')).toMatch(/last one/)
    expect(toggle(s, 'daily', 'cloze')).toBe(s) // unchanged, same object
    // `speaker` is not universal, so dropping it is fine and leaves cloze alone.
    expect(lockedOff(s, 'daily', 'speaker')).toBe('')
    expect(toggle(s, 'daily', 'speaker').daily).toEqual(['cloze'])
  })

  it('never refuses turning something ON', () => {
    const s = { daily: ['cloze'], practice: ['flip'] }
    expect(lockedOff(s, 'daily', 'source')).toBe('')
    expect(toggle(s, 'daily', 'source').daily).toEqual(['source', 'cloze'])
  })
})

describe('what gets stored', () => {
  // Empty means "I never touched this", so a later change to the defaults
  // reaches the account instead of being frozen at signup — the same rule the
  // language marks follow.
  it('is nothing at all when the settings are the defaults', () => {
    expect(questionsBlob(parseQuestions(''))).toBe('')
    expect(questionsBlob(DEFAULT_QUESTIONS)).toBe('')
  })

  it('and round-trips otherwise', () => {
    const s = toggle(parseQuestions(''), 'daily', 'quote')
    const blob = questionsBlob(s)
    expect(blob).not.toBe('')
    expect(parseQuestions(blob)).toEqual(s)
  })
})

// ---- the numbers behind the schedule ---------------------------------------

import { DEFAULT_TUNING, TUNING_FIELDS, parseTuning, tuningBlob, tuningProblem } from '../../src/quiz.js'

const goTuning = readFileSync(join(repo, 'internal', 'httpapi', 'review_tuning.go'), 'utf8')

describe('the tuning defaults agree with Go', () => {
  it('on every value', () => {
    // defaultReviewTuning() builds from the package constants, so the numbers are
    // read from where they are DECLARED rather than from the struct literal.
    const constOf = (name) => {
      const m = readFileSync(join(repo, 'internal', 'httpapi', 'review_handlers.go'), 'utf8')
        .match(new RegExp(name + '\\s*=\\s*([0-9.]+)'))
      return m ? Number(m[1]) : null
    }
    expect(DEFAULT_TUNING.grow).toBe(constOf('reviewGrow'))
    expect(DEFAULT_TUNING.shrink).toBe(constOf('reviewShrink'))
    expect(DEFAULT_TUNING.clozeGrow).toBe(constOf('clozeGrowWeight'))
    expect(DEFAULT_TUNING.clozeShrink).toBe(constOf('clozeShrinkWeight'))
  })

  it('and every field the panel shows has a bound on both sides', () => {
    for (const f of TUNING_FIELDS) {
      expect(typeof f.min, f.key).toBe('number')
      expect(typeof f.max, f.key).toBe('number')
      expect(f.min, f.key).toBeLessThan(f.max)
      expect(DEFAULT_TUNING[f.key], `${f.key} default is inside its own bounds`)
        .toBeGreaterThanOrEqual(f.min)
      expect(DEFAULT_TUNING[f.key], f.key).toBeLessThanOrEqual(f.max)
    }
  })

  // THE BOUNDS ARE THE FEATURE, so they must not be looser than the server's.
  // A slider that offers a value the server then reverts is a control that moves
  // and does nothing.
  it('and no slider offers a value the server would refuse', () => {
    // Read WITHOUT a regex. The line is `t.Grow = pick(t.Grow, 1.1, 5, d.Grow)`,
    // and splitting it on its own punctuation is both shorter and impossible to
    // get subtly wrong in a way that silently matches nothing — which is how a
    // parity test passes while comparing two empty lists.
    const goRange = (name) => {
      const line = goTuning.split('\n').find((l) => l.includes('t.' + name + ' = pick('))
      if (!line) return null
      const args = line.slice(line.indexOf('pick(') + 5, line.lastIndexOf(')')).split(',').map((x) => x.trim())
      return [Number(args[1]), args[2]]
    }
    for (const [field, name] of [['grow', 'Grow'], ['shrink', 'Shrink'], ['clozeGrow', 'ClozeGrow'], ['clozeShrink', 'ClozeShrink']]) {
      const r = goRange(name)
      const f = TUNING_FIELDS.find((x) => x.key === field)
      expect(r, `${name} has a clamp in Go`).not.toBeNull()
      expect(f.min, `${field} min`).toBeGreaterThanOrEqual(r[0])
      if (/^[0-9.]+$/.test(r[1])) expect(f.max, `${field} max`).toBeLessThanOrEqual(Number(r[1]))
    }
  })
})

describe('the ladder', () => {
  // The server reverts a ladder that does not ascend — silently, because there is
  // nowhere to report it from. The panel refuses instead.
  it('must climb, and says so rather than being quietly undone', () => {
    expect(tuningProblem(DEFAULT_TUNING)).toBe('')
    expect(tuningProblem({ ...DEFAULT_TUNING, ladder2: 5 })).toMatch(/climb/)
    expect(tuningProblem({ ...DEFAULT_TUNING, ladder3: 2 })).toMatch(/climb/)
  })
})

describe('what gets stored for the tuning', () => {
  it('is nothing at all when it matches the defaults', () => {
    expect(tuningBlob(DEFAULT_TUNING)).toBe('')
    expect(tuningBlob(parseTuning(''))).toBe('')
  })

  it('and round-trips otherwise', () => {
    const t = { ...DEFAULT_TUNING, grow: 3 }
    expect(parseTuning(tuningBlob(t))).toEqual(t)
  })

  it('reading anything unparseable as the defaults', () => {
    for (const blob of ['{', 'null', '[]', '{"grow":"fast"}', 'nonsense']) {
      expect(parseTuning(blob), blob).toEqual(DEFAULT_TUNING)
    }
  })
})
