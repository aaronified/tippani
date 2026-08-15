// Every <IconSomething /> a screen renders is actually imported into it.
//
// THE BUG THIS EXISTS FOR. MetadataPage rendered <IconOpen /> without importing
// it. Nothing caught it: the reference sits inside a conditional branch, so the
// module parses, the bundle builds, the page loads, and the ReferenceError only
// arrives when somebody clicks the control — which was the count filters. There
// is no lint step in this project, and the DOM tests mount screens with every
// request refused, so they never reach the branch either.
//
// A whole class of bug, found by reading rather than by running: an identifier
// used in JSX and absent from the file's imports and its own declarations.
// Scoped to Icon* deliberately — they are the ones passed as props and buried in
// branches, and the narrow rule is one nobody has to argue with.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// TIPPANI_SRC, not cwd — the same seam infodot-copy uses.
const SRC = process.env.TIPPANI_SRC
const FILES = readdirSync(SRC).filter((f) => f.endsWith('.jsx')).sort()

// Used as a JSX element (<IconX ...>) or handed over as a prop value ({<IconX />}
// is the first; icon={IconX} would be the second).
const USED = /<\s*(Icon[A-Z]\w*)/g
// Anything the file brings in or declares itself: an import specifier, a
// function/const declaration, or a destructured local.
const declaredIn = (src) => {
  const names = new Set()
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(' as ').pop().trim()
      if (name) names.add(name)
    }
  }
  for (const m of src.matchAll(/^\s*(?:export\s+)?(?:function|const|let|var)\s+(Icon[A-Z]\w*)/gm)) {
    names.add(m[1])
  }
  return names
}

describe('icons used in JSX are imported', () => {
  it('found files to check, so a passing suite is not an empty one', () => {
    expect(FILES.length).toBeGreaterThan(15)
  })

  it('has no undefined Icon reference in any screen', () => {
    const missing = []
    for (const file of FILES) {
      const src = readFileSync(join(SRC, file), 'utf8')
      const have = declaredIn(src)
      const seen = new Set()
      for (const m of src.matchAll(USED)) {
        const name = m[1]
        if (have.has(name) || seen.has(name)) continue
        seen.add(name)
        missing.push(`${file}: <${name} /> is used and never imported`)
      }
    }
    // Named rather than counted: the fix is always "add it to the import", and
    // knowing which file and which glyph is the whole of the work.
    expect(missing).toEqual([])
  })
})
