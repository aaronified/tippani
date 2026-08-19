// The code and the file say the same thing, in both directions.
//
// Design §1 puts every user-facing string in a locale file and leaves the source
// holding keys. That splits one fact across two places, and the two failure modes
// are silent in opposite ways:
//
//   A KEY THE CODE ASKS FOR AND THE FILE DOES NOT HAVE renders a humanised last
//   segment (i18n.js's placeholderFor) and a console.warn nobody is watching. The
//   button says "Label" and the app looks finished.
//
//   A KEY THE FILE HAS AND NOTHING ASKS FOR is dead copy. Worse than merely
//   useless: FULL_KEY_SET is the union of the built-ins, so a string nothing
//   renders still counts against every language's coverage — and design §7 says a
//   percentage that lies is worse than none. Thirty-seven such keys were deleted
//   when this test was written, all of them shared vocabulary published ahead of
//   the screens that will use it.
//
// So this is the test the mechanism cannot write for itself. i18n.js knows what it
// was asked for at runtime; only a scan of the tree knows what the tree asks for.
//
// HOW A KEY IS "ASKED FOR", and why it is not just `t('…')`. Three shapes reach
// the resolver, and all three are real code in this app rather than hypotheses:
//
//   1. `t('common.action.save.label')` — the literal argument. The bulk of them.
//   2. A KEY HELD IN A TABLE. `STATUS_META.remembered.label` is the string
//      'common.status.remembered.label', resolved at the dot that draws it;
//      routes.js's SECTIONS, quiz.js's getters and bulkOps.jsx's KIND_ROUTES all
//      do the same. So any key-shaped literal counts, wherever it sits.
//   3. A KEY BUILT FROM A STEM. help.jsx holds one prefix per row and appends
//      `.term` / `.what` / `.how.N` / `.more`; secret.js appends `.min` / `.max` /
//      `.charset`; Settings appends a `${name}` in the middle. Those are matched as
//      a stem plus a template, so `common.help.topbar.add` + `.term` is reached
//      without this file listing 167 prefixes of its own.
//
// A PLURAL FAMILY IS ONE ENTRY. `t('unit.book', {count: n})` resolves
// unit.book.one or unit.book.other by the ACTIVE language's rules — Polish needs
// four forms, Arabic six — so which members exist is that language's grammar and
// not something a static scan can check. Naming any form of a family keeps the
// family. That is deliberately the loosest rule here, and it is the only one where
// the honest answer is "the code cannot know".
//
// WHAT THIS DOES NOT CHECK, said plainly. It reads the source as text, so a key
// assembled at runtime out of data (a preference value, a server response) is
// invisible to it — and the app has none of those today. It also cannot tell that
// a key in a table is ever passed through t(): Home.jsx read STATUS_META's label
// raw for a while and rendered the key on screen, which this file would have
// called "used". The pseudo-locale (§9) is what catches that, because an unwrapped
// literal is the only plain text left on the screen.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EN, enKeys } from '../locale-file.js'

const SRC = process.env.TIPPANI_SRC

function sources(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sources(p, out)
    else if (/\.jsx?$/.test(name)) out.push(p)
  }
  return out
}

// A COMMENT IS NOT A CALL SITE. i18n.js documents its own signature with
// `t('bin.quotes', {count: n})` in a comment block, and the resolver's module is
// in this scan because it resolves locale.pseudo.name itself. Comment-only lines
// are blanked rather than the file being skipped, so the one real call site in it
// still counts.
const decommented = (text) =>
  text
    .split('\n')
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l))

// A key: lower-kebab segments, at least two of them. The same shape the whole file
// is written in, so a literal that is not a key (a CSS class, a path) is not read
// as one.
const KEYSHAPE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/

// A template hole stands for ONE segment: `${kind}` is 'book' or 'film', never a
// dotted path. Anchored at both ends, so a pattern cannot quietly match a whole
// namespace.
const holeRe = (raw) =>
  new RegExp(
    `^${raw
      .split(/\$\{[^}]*\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[a-z0-9-]+')}$`,
  )

function scan() {
  const asked = new Map() // key -> where, from a literal t() argument
  const literals = new Map() // key -> where, from any key-shaped literal
  const tails = new Set() // '.term', '.how.${i + 1}' — appended to a stem
  const globs = new Map() // 'common.shelf.${state}.${kind}.label'

  const note = (map, key, where) => {
    if (!map.has(key)) map.set(key, where)
  }

  for (const path of sources()) {
    const rel = path.replace(/\\/g, '/').split('/src/')[1]
    const lines = decommented(readFileSync(path, 'utf8'))
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      const where = `src/${rel}:${i + 1}`
      for (const m of line.matchAll(/\bt(?:Nodes)?\(\s*(['"])([^'"]+)\1/g)) note(asked, m[2], where)
      for (const m of line.matchAll(/['"`]([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+)['"`]/g)) {
        if (KEYSHAPE.test(m[1])) note(literals, m[1], where)
      }
      for (const m of line.matchAll(/`([^`]*\$\{[^`]*)`/g)) {
        const raw = m[1]
        // Prose interpolates too. A key has no spaces and no punctuation outside
        // its dots, which is what tells the two apart.
        if (/[^a-z0-9.-]/.test(raw.replace(/\$\{[^}]*\}/g, ''))) continue
        if (raw.startsWith('${')) {
          const tail = raw.slice(raw.indexOf('}') + 1)
          if (tail.startsWith('.')) tails.add(tail)
        } else if (/^[a-z][a-z0-9-]*\./.test(raw) && !globs.has(raw)) {
          globs.set(raw, holeRe(raw))
        }
      }
    }
  }
  return { asked, literals, tails: [...tails].map((t) => ({ t, re: holeRe(t) })), globs: [...globs.values()] }
}

const SRC_KEYS = scan()

// The plural categories Intl.PluralRules can return. All six, not the two English
// uses: a bn.txt or a pl.txt may carry forms en.txt has no word for.
const PLURALS = ['zero', 'one', 'two', 'few', 'many', 'other']

const familyOf = (key) => {
  const cut = key.lastIndexOf('.')
  return cut > 0 && PLURALS.includes(key.slice(cut + 1)) ? key.slice(0, cut) : ''
}

// used answers the second direction: does anything in the tree reach this key.
function used(key) {
  const { literals, tails, globs } = SRC_KEYS
  const candidates = [key]
  const family = familyOf(key)
  // The family, and every OTHER member of it. A call site that names one form by
  // hand — `t('unit.row.one')` for a bare singular noun — keeps the form its
  // language needs for the plural, which no scan of English source can see.
  if (family) candidates.push(family, ...PLURALS.map((c) => `${family}.${c}`))
  for (const k of candidates) {
    if (literals.has(k)) return true
    const parts = k.split('.')
    for (let n = parts.length - 1; n >= 2; n -= 1) {
      const stem = parts.slice(0, n).join('.')
      if (literals.has(stem) && tails.some(({ re }) => re.test(k.slice(stem.length)))) return true
    }
    if (globs.some((re) => re.test(k))) return true
  }
  return false
}

describe('the scan reaches the tree at all', () => {
  // Every assertion below is only as good as the extraction, and an extraction
  // that matches nothing passes both directions in silence. Floors, not exact
  // numbers: the migration adds call sites weekly.
  it('finds the call sites', () => {
    expect(SRC_KEYS.asked.size).toBeGreaterThan(1000)
    expect(SRC_KEYS.literals.size).toBeGreaterThan(1000)
  })

  it('finds the templates, which are how a third of the help panel is reached', () => {
    // `${base}.term` in help.jsx and `${stem}.min` in secret.js. Without these the
    // orphan half of this test would condemn 465 real keys.
    expect(SRC_KEYS.tails.map((x) => x.t)).toContain('.term')
    expect(SRC_KEYS.tails.map((x) => x.t)).toContain('.min')
    expect(SRC_KEYS.globs.length).toBeGreaterThan(0)
  })

  it('reads a file at all, and the file has the shape it should', () => {
    expect(enKeys().length).toBeGreaterThan(2000)
    expect(EN.bad, 'mangled lines in en.txt').toEqual([])
    expect(EN.empty, 'keys with nothing after the = ').toEqual([])
  })
})

describe('every key the code asks for is in en.txt', () => {
  it('resolves, or renders a humanised stub nobody wrote', () => {
    const missing = []
    for (const [key, where] of SRC_KEYS.asked) {
      if (EN.keys[key]) continue
      // t(key, {count}) asks for a family, and the family answers.
      if (PLURALS.some((c) => EN.keys[`${key}.${c}`])) continue
      missing.push(`${key}  (${where})`)
    }
    expect(missing.sort(), 'add these to internal/i18n/en.txt').toEqual([])
  })

  it('and so does every leaf secret.js appends to a stem', () => {
    // secretProblem() builds `${stem}.min` / `.max` / `.charset`, so a stem short
    // of one renders "Charset" in a validation field. The two stems are named here
    // rather than derived, because "every stem × every tail" is not a rule: the
    // stems in bulkOps.jsx take `.one` and would never take `.charset`. help.jsx's
    // 167 stems are checked the same way by help-budget.test.js, against the
    // registry that declares which fields each row actually has.
    const missing = []
    for (const stem of ['error.validate.password', 'error.validate.passphrase']) {
      for (const role of ['min', 'max', 'charset']) {
        if (!EN.keys[`${stem}.${role}`]) missing.push(`${stem}.${role}`)
      }
    }
    expect(missing).toEqual([])
  })
})

describe('every key in en.txt is asked for by the code', () => {
  it('is reachable from somewhere in src/', () => {
    const orphans = enKeys().filter((k) => !used(k))
    expect(
      orphans.sort(),
      'dead copy: nothing renders these, and they still count against every language’s coverage',
    ).toEqual([])
  })

  it('including the three the mechanism resolves itself', () => {
    // locale.pseudo.name is read by i18n.js rather than by a screen, and the
    // picker's own two rows by locale.jsx. They are the keys most likely to be
    // condemned by a scan that skips the resolver's own module, so they are named.
    for (const key of ['locale.pseudo.name', 'locale.picker.coverage', 'locale.picker.aria']) {
      expect(used(key), `${key} is not reached`).toBe(true)
    }
  })
})
