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
// EVERYTHING IS BUDGETED, the fold included. The first pass capped only what was on
// screen and argued that `more` should stay free, so the reasoning survived. The
// owner overruled it — "clip long texts as much as possible without compromising
// utility" — and was right: a fold is not a licence, it is a second chance to be
// long. MORE_MAX is looser than WHAT_MAX because that is what the fold is FOR, and
// tight enough that opening one is still reading a note rather than an essay.
//
// ---------------------------------------------------------------------------
// IT NOW MEASURES THE LOCALE FILE, and that is the only thing that changed.
//
// The registry in help.jsx used to hold 167 English strings, and this file imported
// it and measured them. The words moved to internal/i18n/en.txt (design §1) and the
// registry became keys and shapes — so importing it and reading `e.what` would
// measure whatever the ACTIVE language resolved to, through a fallback chain, with
// a missing key silently becoming a five-character stub that passes every cap.
// A budget that a missing string satisfies is not a budget.
//
// So the copy comes from the file, selected BY ROLE: `.what` is one sentence
// wherever it appears, `.how.N` is one line, `.more` is the fold. That is design
// §2's naming doing real work — the last segment says what the string is, so the
// selection is mechanical rather than a list somebody maintains.
//
// AND IT MEASURES EVERY LANGUAGE IN THE BOX, not the English alone. A Bengali
// entry overflows the same box; the header above says the budget is enforced
// against whatever is rendering, and now it is. What it does NOT do is fail because
// a language is incomplete — §7 — so a key a file lacks is skipped, not counted.
//
// THE REGISTRY IS STILL THE SUBJECT, though: it declares which of the four fields
// each row has (`entry(base, { how: 3, more: true })`), and that declaration is
// what the file is checked against in both directions. A row whose `.what` nobody
// wrote and a `.what` no row asks for are both failures, and the first one is how
// a screen ends up with a heading and no sentence.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HELP, helpFor, helpGuide } from '../../src/help.jsx'
import { BUILTINS, EN, enKeys } from '../locale-file.js'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')

// WHAT_MAX — one sentence, front-loaded. 160: tight enough that it cannot become a
// paragraph, loose enough for the clause after an em dash, which is usually where
// this app's sentences say the useful half.
const WHAT_MAX = 160
// HOW_MAX / HOW_LINES — a verb-first line, and at most three of them. Three is the
// number that still reads as a set at a glance; the fourth is where a list becomes
// a procedure, and a procedure belongs in `more`.
const HOW_MAX = 120
const HOW_LINES = 3
// MORE_MAX — the fold is a note, not an essay. See the header.
const MORE_MAX = 420

// declared() is the registry, flattened: one row per control, with the roles that
// row says it has. Both shells are walked and the rows are keyed by their own key,
// so the shell entries every screen appends are measured once rather than sixteen
// times — and the key is the row's identity, which a renamed heading no longer
// changes.
function declared() {
  const rows = new Map()
  for (const touch of [false, true]) {
    for (const sec of helpGuide(touch)) {
      for (const e of sec.entries) rows.set(e.key, e.roles)
    }
  }
  return rows
}

const ROWS = declared()

// Every key the registry asks the file for, as `<base>.<role>`.
const wanted = () => [...ROWS].flatMap(([base, roles]) => roles.map((r) => `${base}.${r}`))

// The file's side of the same set. A HELP ROLE, not the whole `*.help.*` namespace:
// a section heading (`bin.help.title`), the panel's own chrome
// (`common.help.sheet.title`) and the import schematic's box labels are all in that
// namespace and none of them is an entry's prose.
const ROLE_RE = /\.help\..+\.(?:term|what|more|how\.\d+)$/
const inFile = () => enKeys().filter((k) => ROLE_RE.test(k))

// values(role) — every string playing that role, in every language that has one,
// as [language, key, string].
function values(match) {
  const out = []
  for (const [code, file] of BUILTINS) {
    for (const key of Object.keys(file.keys)) {
      if (ROLE_RE.test(key) && match(key)) out.push([code, key, file.keys[key]])
    }
  }
  return out
}

const whats = () => values((k) => k.endsWith('.what'))
const hows = () => values((k) => /\.how\.\d+$/.test(k))
const mores = () => values((k) => k.endsWith('.more'))
const where = (code, key) => `${code}.txt ${key}`

describe('the registry and the file hold the same entries', () => {
  it('there are entries, so this is measuring something', () => {
    // The sweep's own failure mode, and this file is a sweep.
    expect(ROWS.size).toBeGreaterThan(100)
    expect(inFile().length).toBeGreaterThan(300)
  })

  it('every field a row declares has a string in en.txt', () => {
    // A row that declares `more: true` with no `<base>.more` written renders the
    // humanised last segment — a fold whose body is the word "More".
    const missing = wanted().filter((k) => !EN.keys[k])
    expect(missing.sort(), 'the registry asks for these and en.txt does not have them').toEqual([])
  })

  it('and every help string in en.txt belongs to a row that declares it', () => {
    // The other direction: prose for a row that was deleted, or for a `how.4` on a
    // row that says it has three lines. Nothing renders either.
    const asked = new Set(wanted())
    const stray = inFile().filter((k) => !asked.has(k))
    expect(stray.sort(), 'no row in help.jsx asks for these').toEqual([])
  })
})

describe('the visible part of an entry', () => {
  it('says what it is in one sentence, inside the budget', () => {
    const over = whats()
      .filter(([, , v]) => v.length > WHAT_MAX)
      .map(([c, k, v]) => `${where(c, k)} (${v.length})`)
    expect(over, `over ${WHAT_MAX} characters — move the rest into \`more\``).toEqual([])
  })

  it('and it is one sentence, not a paragraph with the full stops taken out', () => {
    // Counting sentence-ending punctuation followed by more text: the cheap proxy
    // for "this is a paragraph". Two is allowed — a short second sentence that
    // qualifies the first is often the clearest shape — three is a paragraph.
    //
    // THE PROXY IS PER-SCRIPT, because a sentence boundary is. English looks for a
    // capital after the stop, which is what makes "e.g. this" and "TMDB id." cost
    // nothing. Bengali has no case, so that pattern finds nothing in a Bengali
    // paragraph — it ends its sentences with a দাঁড়ি instead, and that mark does the
    // same job unambiguously.
    //
    // Bengali's rule counts ONLY the danda, not `?` or `!`, and that is deliberate
    // rather than lazy: Bengali borrows both marks from Latin punctuation, and this
    // app's help copy also NAMES them as keys — `common.help.keyboard.what` opens
    // with "? চাপলে", the ? being the key you press. Counting it read that entry as
    // two sentences when it is one sentence about a question mark. The danda has no
    // such double life.
    //
    // A built-in with no rule here is a failure, not a skip: adding a third
    // compiled-in language should make somebody answer this question rather than
    // silently exempt it. Config-only languages (§4) are outside BUILTINS and so
    // outside this check — nothing can be enforced against a file that may not exist.
    const SENTENCE_BREAK = {
      en: /[.?!]\s+[A-Z“]/g,
      bn: /।\s+\S/g,
    }
    const unruled = BUILTINS.map(([c]) => c).filter((c) => !SENTENCE_BREAK[c])
    expect(unruled, 'a compiled-in language with no sentence rule — add one above').toEqual([])

    const wordy = whats()
      .filter(([c, , v]) => (v.match(SENTENCE_BREAK[c]) || []).length > 1)
      .map(([c, k]) => where(c, k))
    expect(wordy, 'three or more sentences in `what`').toEqual([])
  })

  it('keeps its how-to lines short and few', () => {
    const bad = []
    for (const [code, key, v] of hows()) {
      if (v.length > HOW_MAX) bad.push(`${where(code, key)}: a line of ${v.length}`)
      const n = Number(key.split('.').pop())
      if (n > HOW_LINES) bad.push(`${where(code, key)}: line ${n}, past the ${HOW_LINES}-line limit`)
    }
    expect(bad.sort()).toEqual([])
  })

  it('numbers those lines from 1 with no gap, because the number is the order', () => {
    // A gap is not a shorter list: help.jsx asks for how.1 … how.N by count, so a
    // missing how.2 renders as a stub between two real lines.
    const bad = []
    for (const [code, file] of BUILTINS) {
      const bases = new Set(
        Object.keys(file.keys)
          .filter((k) => /\.how\.\d+$/.test(k))
          .map((k) => k.replace(/\.how\.\d+$/, '')),
      )
      for (const base of bases) {
        const ns = Object.keys(file.keys)
          .filter((k) => k.startsWith(`${base}.how.`))
          .map((k) => Number(k.split('.').pop()))
          .sort((a, b) => a - b)
        const want = ns.map((_, i) => i + 1)
        if (String(ns) !== String(want)) bad.push(`${code}.txt ${base}.how.* is [${ns}]`)
      }
    }
    expect(bad.sort()).toEqual([])
  })

  it('keeps the fold to a note, not a second essay', () => {
    const over = mores()
      .filter(([, , v]) => v.length > MORE_MAX)
      .map(([c, k, v]) => `${where(c, k)} (${v.length})`)
    expect(over, `over ${MORE_MAX} characters behind the fold`).toEqual([])
  })

  it('does not put a whole entry behind the fold and leave nothing in front', () => {
    // `more` with no `what` is an entry whose visible half is its own name. Checked
    // per language, so a translation that filled the fold and skipped the sentence
    // is caught in the file it happened in.
    const empty = []
    for (const [code, key] of mores()) {
      const base = key.replace(/\.more$/, '')
      const file = BUILTINS.find(([c]) => c === code)[1]
      if (!file.keys[`${base}.what`]) empty.push(where(code, key))
    }
    expect(empty.sort(), 'nothing visible above the fold').toEqual([])
  })
})

describe('the register', () => {
  // Not taste-policing: these are the specific tics that made the old copy long.
  // "Simply" and "just" are always deletable; "you can" is a sentence starting two
  // words before its verb; and an instruction about how to operate a touch screen
  // is written for somebody who has never held a phone, which the reader has.
  //
  // ENGLISH PATTERNS, APPLIED TO EVERY LANGUAGE, which costs nothing and catches
  // one real thing: a translation that left a clause in English. A language with
  // its own filler words is welcome to add its own rules here.
  const BANNED = [
    [/\bsimply\b/i, '"simply" — delete it and the sentence is shorter and truer'],
    [/\bjust\s/i, '"just" — same'],
    [/\byou can\b/i, '"you can" — say what it does, not that you are permitted to'],
    [/press and hold/i, 'the reader has held a phone before'],
    [/\bin order to\b/i, '"in order to" is "to"'],
  ]

  it('avoids the words that made it long', () => {
    // Deliberately NOT over `more`: the fold is where a consequence gets explained,
    // and the register rules are about the half that is always on screen.
    const hits = []
    for (const [code, key, v] of [...whats(), ...hows()]) {
      for (const [re, why] of BANNED) {
        if (re.test(v)) hits.push(`${where(code, key)}: ${why}`)
      }
    }
    expect(hits.sort()).toEqual([])
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
    // BY KEY, not by the English heading. The rule is about which control the panel
    // documents — a drawer or a tab strip — and that is what the key names; asserting
    // it against the word "Menu (☰)" made a copy edit look like a routing bug, and
    // made the rule untestable in any other language.
    const keys = (touch) =>
      helpGuide(touch)
        .find((s) => s.id === 'everywhere')
        .entries.map((e) => e.key)
    expect(keys(true)).toContain('common.help.topbar.menu') // the phone has a drawer
    expect(keys(false)).toContain('common.help.tab-strip') // a pointer has a tab strip
    expect(keys(true)).not.toContain('common.help.tab-strip')
    expect(keys(false)).not.toContain('common.help.topbar.menu')
  })

  // helpFor is still the per-screen answer, and two callers depend on it.
  it('leaves helpFor alone for the callers that want one screen', () => {
    const h = helpFor('library', false)
    expect(h.title).toBeTruthy()
    expect(h.entries.some((e) => e.key === 'common.help.tab-strip')).toBe(true)
  })

  it('resolves a heading for every section, aliased or its own', () => {
    // Nine sections point at nav.tab.<screen>.label and seven carry their own
    // <place>.help.title. Either way the key has to exist, or the rail draws a stub.
    const missing = helpGuide(false)
      .map((s) => s.titleKey)
      .filter((k) => !EN.keys[k])
    expect(missing, 'section headings with no string').toEqual([])
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
