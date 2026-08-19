// The one trap in calling the resolver `t`.
//
// Twenty-one modules in src/ already use `t` as a LOCAL name — a toast record in
// ui.jsx, a timestamp in ui.jsx's date helper, a tag in TagsPage, a token in half
// a dozen `.map((t) => …)` callbacks. In JavaScript a local `t` shadows an
// imported one silently and legally, so a migrated call site inside one of those
// functions reads a toast object where it meant a string, renders `[object
// Object]` or throws, and nothing anywhere says why.
//
// It cannot be fixed by renaming the export: `t(key)` is the specified signature
// and a longer name at three thousand call sites is its own cost. So it is fixed
// by being IMPOSSIBLE TO SHIP INSTEAD OF EASY TO MISS. This reads the source and
// fails the build when one file both imports the resolver and binds the same
// letter locally.
//
// IT ARMS ITSELF. Today only locale.jsx imports `t`, so this checks one file. As
// the migration moves through the tree it checks each file the moment that file
// starts importing the resolver, which is exactly when the trap becomes live.
//
// THE FIX IS ALWAYS THE SAME AND IT IS ALWAYS THE LOCAL: rename it. `toast` for
// the toast, `tag` for the tag, `tok` for the token. The failure message says so,
// because the person reading it is halfway through a mechanical pass over forty
// files and should not have to work anything out.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const SRC = process.env.TIPPANI_SRC

// Files that import the resolver by its bare name. An aliased import (`t as tr`)
// is not shadowable and is not this test's business.
const IMPORTS_T = /import\s*\{[^}]*\bt\b(?!\s+as)[^}]*\}\s*from\s*['"]\.\/i18n\.js['"]/

// Local bindings called `t`. Deliberately a small, specific set rather than a
// clever one: every pattern here genuinely binds the name, so a match is a real
// shadow and never an argument about the regex. A pattern this misses is caught by
// the pseudo-locale instead — a shadowed `t` does not produce bracketed text.
const BINDS_T = [
  [/\b(?:const|let|var)\s+t\s*(?:=|,|\))/, 'a local declaration'],
  [/\bfunction\s+t\s*\(/, 'a local function'],
  [/\(\s*t\s*[,)]/, 'a parameter'],
  [/(?:^|[^\w.])t\s*=>/, 'an arrow parameter'],
  [/catch\s*\(\s*t\s*\)/, 'a caught error'],
]

function sources() {
  return readdirSync(SRC, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.jsx?$/.test(e.name) && e.name !== 'i18n.js')
    .map((e) => e.name)
}

describe('nothing shadows the resolver', () => {
  test('no file both imports t and binds t locally', () => {
    const problems = []
    for (const name of sources()) {
      const text = readFileSync(join(SRC, name), 'utf8')
      if (!IMPORTS_T.test(text)) continue
      for (const [re, what] of BINDS_T) {
        const lines = text.split('\n')
        for (let i = 0; i < lines.length; i += 1) {
          // Skip the comment lines, which talk about `t` constantly.
          const line = lines[i]
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue
          if (re.test(line)) problems.push(`${name}:${i + 1} — ${what} called t: ${line.trim()}`)
        }
      }
    }
    expect(
      problems,
      'These files import t() from i18n.js AND bind the name t locally, which shadows it\n' +
        'silently. Rename the LOCAL — toast, tag, tok, ts — never the import.\n\n' +
        problems.join('\n'),
    ).toEqual([])
  })

  test('and the guard is actually looking at something', () => {
    // A test that checks zero files passes for the wrong reason. locale.jsx
    // imports the resolver today, so if this finds nothing the regex has broken.
    const importers = sources().filter((n) => IMPORTS_T.test(readFileSync(join(SRC, n), 'utf8')))
    expect(importers).toContain('locale.jsx')
  })
})
