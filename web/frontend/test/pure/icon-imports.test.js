// Every component a screen renders is actually imported into it.
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
//
// IT WAS SCOPED TO Icon* AND THE CLASS ESCAPED THROUGH THE GAP. The original
// note here said the narrow rule was "one nobody has to argue with" — glyphs are
// the ones passed as props and buried in branches. Then Settings' language-mark
// tray shipped <Field> with no import (1.15.x): same branch shape, same silence,
// same ReferenceError on the same kind of click, and this file watched it go past
// because the missing name did not begin with "Icon". A test that catches one
// spelling of a bug it has named as a class is not catching the class.
//
// So it reads every capitalised JSX tag now. That means the declaration side has
// to be read properly too — default imports, namespace imports and locally
// declared components are all real ways a name arrives, and treating any of them
// as missing would make this file cry wolf until somebody deleted it.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// TIPPANI_SRC, not cwd — the same seam infodot-copy uses.
const SRC = process.env.TIPPANI_SRC
const FILES = readdirSync(SRC).filter((f) => f.endsWith('.jsx')).sort()

// Used as a JSX element (<Foo ...>). A dotted tag (<Foo.Bar />) is captured at
// its root, which is the binding that has to exist.
const USED = /<\s*([A-Z]\w*)/g
// Anything the file brings in or declares itself. Every import form counts:
//   import { A, B as C } from …   named, renamed
//   import D from …               default
//   import D, { A } from …        both
//   import * as NS from …         namespace
// plus its own top-level function/const/let/var declarations, exported or not.
const declaredIn = (src) => {
  const names = new Set()
  for (const m of src.matchAll(/import\s+([^'"]+?)\s+from\s*['"]/g)) {
    const clause = m[1].trim()
    const named = clause.match(/\{([^}]*)\}/)
    if (named) {
      for (const part of named[1].split(',')) {
        const name = part.split(' as ').pop().trim()
        if (name) names.add(name)
      }
    }
    // Whatever sits outside the braces: the default binding, or `* as NS`.
    const rest = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ')
    for (const m2 of rest.matchAll(/(?:\*\s*as\s+)?([A-Za-z_$][\w$]*)/g)) {
      if (m2[1] !== 'as') names.add(m2[1])
    }
  }
  for (const m of src.matchAll(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Z]\w*)/gm)) {
    names.add(m[1])
  }
  // A component taken as a prop and renamed on the way in, which is how
  // AnnotationCard accepts its own form: `{ form: Form = AnnotationForm }`.
  // The `=` is required, and that is what makes this rule safe rather than a
  // hole: `key: Value = default` is not valid in an object LITERAL, only in a
  // destructuring pattern, so nothing here can quietly bless `{ icon: IconFoo }`
  // written without an import. A rename with no default is not matched, and that
  // is the right way round — it fails loudly and the fix is one line here.
  for (const m of src.matchAll(/[\w$]+\s*:\s*([A-Z][\w$]*)\s*=/g)) {
    names.add(m[1])
  }
  return names
}

describe('components used in JSX are imported', () => {
  it('found files to check, so a passing suite is not an empty one', () => {
    expect(FILES.length).toBeGreaterThan(15)
  })

  it('has no undefined component reference in any screen', () => {
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
    // knowing which file and which component is the whole of the work.
    expect(missing).toEqual([])
  })

  // The reported bug, pinned as itself. The generalised rule above would catch it
  // wherever it moved to, but the tray it broke is a control a reader reaches for
  // deliberately, and naming it keeps the reason this file was widened legible.
  it('the language-mark tray’s own file imports the Field it types into', () => {
    // It was Settings.jsx when the bug was reported; the sources block moved to
    // MetadataSources.jsx and took the tray with it. Named by the file that holds
    // it rather than by where it used to live — a case pinned to the wrong file
    // passes for ever and asserts nothing.
    const src = readFileSync(join(SRC, 'MetadataSources.jsx'), 'utf8')
    expect(src).toMatch(/<Field\b/)
    expect(declaredIn(src).has('Field')).toBe(true)
  })

  // The detector, checked against the bug rather than against the tree. A clean
  // tree passes this file whether the rule works or not — the same failure mode
  // that let the glossary inline its stylesheet inside a comment for two
  // releases. So the shape that got through is fed in directly.
  it('would have caught it: <Field /> rendered beside an import that is not it', () => {
    const broken = [
      "import { ErrorText, FieldIconButton } from './ui.jsx'",
      'export function Tray() {',
      '  return picking && <Field label="Or type one" maxLength={8} />',
      '}',
    ].join('\n')
    expect(declaredIn(broken).has('Field')).toBe(false)
    expect([...broken.matchAll(USED)].map((m) => m[1])).toContain('Field')
  })
})
