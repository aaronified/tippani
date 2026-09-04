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
//
// AND THE CLASS ESCAPED A SECOND TIME, THROUGH A CALL RATHER THAN A TAG. Moving the
// metadata sources block out of Settings into its own file left `toast(...)` behind
// its import: two call sites, both inside async handlers after a successful PUT, so
// every API-key save threw a ReferenceError AFTER writing the key and the field
// simply never showed as saved. Nothing caught it — the rule above reads `<Foo`
// and a helper is called, not rendered; the DOM tests that mount the block never
// press Save with a mocked-ok server; and the module parses, so the build is clean.
//
// The lesson is the one this file already learned once: a test that catches one
// SPELLING of a bug it has named as a class is not catching the class. A component
// and a helper arrive by exactly the same mechanism — an import — and go missing
// the same way. So the sweep reads calls too.
//
// IT IS A NAMED LIST AND NOT EVERY IDENTIFIER, deliberately. `foo()` in a file is
// usually a local, a method, or a built-in, and a rule that flagged all of them
// would need to model scope to be useful — which is a linter, and this project has
// none for a stated reason. What it checks instead is the app's own shared
// vocabulary: the helpers every screen imports from a handful of modules. A name on
// that list appearing in a file that does not declare it is never right.

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
  // TOP-LEVEL DECLARATIONS, ANY CASE. It read only capitalised names while it only
  // asked about components; the helper sweep below asks about `toast` and
  // `personImgURL`, and the file that DEFINES one of those must not be reported as
  // failing to import it. Lowercase locals are a real way a name arrives, exactly
  // as capitalised ones are.
  for (const m of src.matchAll(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
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

  // THE SHARED HELPERS, by name. Each of these is exported from exactly one module
  // and imported by many screens, so a call to one in a file that neither imports
  // nor declares it is a ReferenceError waiting for a click. Kept as a literal list
  // for the reason the header gives; adding to it is one line and is worth doing
  // whenever a helper starts being imported by more than about three files.
  const HELPERS = [
    'toast', 'json', 'errText', 'apiURL', 'coverImgURL', 'personImgURL',
    'tNodes', 'createPortal', 'normName', 'splitCommas', 'editDistance',
    'useEdgeScroll', 'useConfirm', 'useEscape', 'useIsMobileScreen',
    'usePersistedState', 'useScreenBar', 'usePanelStack',
  ]

  // COMMENTS ARE NOT CODE, and this scan read them as code until a header
  // explaining why `usePanelStack()` hands back a fresh object every render
  // reported personOpen.jsx as calling a helper it does not import. Explaining
  // itself in prose is what every file in this repo does, and naming the call it
  // is talking about is how that prose reads — so a checker that cannot tell the
  // two apart cries wolf on good comments, and a checker that cries wolf gets
  // switched off. The `[^:]` guard leaves `https://` alone.
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('has no undefined helper CALL in any screen', () => {
    // The same rule as above with the same shape of answer, over calls rather than
    // tags. `t(` is deliberately absent from the list: it is in every file and its
    // single letter matches too much to be read this way.
    const missing = []
    for (const file of FILES) {
      const raw = readFileSync(join(SRC, file), 'utf8')
      const src = stripComments(raw)
      const have = declaredIn(raw)
      for (const name of HELPERS) {
        if (have.has(name)) continue
        // A call, not a mention: the name followed by an opening bracket, with a
        // word boundary in front so `setToast(` and `.toast(` do not match.
        if (new RegExp(`(^|[^\\w.$])${name}\\s*\\(`, 'm').test(src)) {
          missing.push(`${file}: ${name}() is called and never imported`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('would have caught it: toast() called beside an import that is not it', () => {
    // The detector against the bug rather than against the tree, which is this
    // file's own habit — a clean tree passes whether the rule works or not.
    const broken = "import { Card, Toggle } from './ui.jsx'\nasync function save() { await put(); toast('saved') }"
    expect(declaredIn(broken).has('toast')).toBe(false)
    expect(/(^|[^\w.$])toast\s*\(/m.test(broken)).toBe(true)
    // And it does not fire on a local of a similar name, which is what would make
    // the rule noise rather than a guard.
    const fine = "const setToast = () => {}\nsetToast('x')\nthis.toast('y')"
    expect(/(^|[^\w.$])toast\s*\(/m.test(fine)).toBe(false)
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
