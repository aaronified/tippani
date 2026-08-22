// The scan: what does the tree ask the resolver for.
//
// Design §1 puts every user-facing string in a locale file and leaves the source
// holding keys, which splits one fact across two places. Two tests measure the
// two directions of that split — locale-complete.test.js checks the code against
// en.txt, token-coverage.test.js checks the token set against every language —
// and they need the same answer to the same question: which keys does the source
// reach.
//
// SO THE EXTRACTION LIVES HERE RATHER THAN IN EITHER OF THEM. This module was
// lifted out of locale-complete.test.js the day the second reader appeared, for
// the reason locale-file.js gives about the parser: two implementations of one
// extraction is how the two come to disagree, and a disagreement here is silent
// in the worst way — the stricter test condemns keys the looser one calls used,
// and whichever ran first wins the argument in the reviewer's head.
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
//      without either test listing 167 prefixes of its own.
//
// A PLURAL FAMILY IS ONE ENTRY. `t('unit.book', {count: n})` resolves
// unit.book.one or unit.book.other by the ACTIVE language's rules — Polish needs
// four forms, Arabic six — so which members exist is that language's grammar and
// not something a static scan can check. Naming any form of a family keeps the
// family. That is deliberately the loosest rule here, and it is the only one where
// the honest answer is "the code cannot know".
//
// WHAT THIS DOES NOT SEE, said plainly. It reads the source as text, so a key
// assembled at runtime out of data (a preference value, a server response) is
// invisible to it — and the app has none of those today. It also cannot tell that
// a key in a table is ever passed through t(): Home.jsx read STATUS_META's label
// raw for a while and rendered the key on screen, which this module would have
// called "used". The pseudo-locale gate (§9, test/dom/screens-i18n.test.jsx) is
// what catches that, because an unwrapped literal is the only plain text left on
// the screen.
//
// WHERE IT LOOKS: web/frontend/src, all of it, recursively. Nowhere else in the
// repository holds a token that renders — a sweep of every .go, .js, .html, .md
// and .json file outside src/ turns up locale keys in exactly two kinds of place,
// tests that assert about a specific string and design documents that quote one,
// and neither is a render site. The server does not resolve strings at all (see
// internal/i18n/i18n.go, "what this package does not do"), so its user-facing
// text is not in this catalogue and is not measured by it.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = process.env.TIPPANI_SRC

export function sources(dir = SRC, out = []) {
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

// A key: lower-kebab segments, at least two of them. The same shape the whole
// catalogue is written in, so a literal that is not a key (a CSS class, a path) is
// not read as one.
export const KEYSHAPE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/

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
  return {
    asked,
    literals,
    tails: [...tails].map((tail) => ({ t: tail, re: holeRe(tail) })),
    globs: [...globs.values()],
  }
}

// Scanned once per test process. The tree does not change under a run, and the
// walk is the expensive part of both files that read it.
export const SRC_KEYS = scan()

// The plural categories Intl.PluralRules can return. All six, not the two English
// uses: a bn.txt or a pl.txt may carry forms en.txt has no word for.
export const PLURALS = ['zero', 'one', 'two', 'few', 'many', 'other']

export const familyOf = (key) => {
  const cut = key.lastIndexOf('.')
  return cut > 0 && PLURALS.includes(key.slice(cut + 1)) ? key.slice(0, cut) : ''
}

// used answers the other direction: does anything in the tree reach this key.
export function used(key) {
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
