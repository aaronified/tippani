// NOTHING REACHES FOR A NAME THAT IS NOT THERE.
//
// THREE OF THESE SHIPPED IN THREE CONSECUTIVE COMMITS, all in one span of
// `StatsPage.jsx`, each a `ReferenceError` waiting inside an arm of a conditional
// that only runs when a picture exists. They compiled, bundled and passed three
// thousand tests, because the bundler resolves an unknown name as a global and
// says nothing, and because neither verification layer executes such an arm:
// `screens-mount` refuses every request on purpose, and `make controls` runs
// against a fixture with no artwork.
//
// AND THEN A RATER FOUND TWO MORE, live, in code nobody had touched this
// session: the Delete key on a row of the annotations table and of the dialogue
// table each called `setAsking`, which is bound in their PARENT and not in them.
// Both are reachable buttons. Both threw when pressed.
//
// THE NOTE THIS REPLACES SAID THE CLASS COULD NOT BE MECHANISED — that the only
// options were a smoke pass over invented payloads or per-branch rendering. That
// was wrong, and wrong in the one direction the owner's standing instruction
// forbids ("create mechanical controls … don't depend on your prompting"): it
// weighed two ways of RUNNING the code and never considered reading it. Babel is
// already in this project's `node_modules` — Vite's React plugin brings it — so
// the scope analysis costs no download and about a second. It is DECLARED all the
// same (`@babel/parser`, `@babel/traverse` in devDependencies): a transitive
// dependency is a fact about somebody else's package.json, not a promise, and a
// test that imports one breaks on the day that package drops it.
//
// WHAT IT DOES NOT DO. It is not a type checker and not a linter: it asks one
// question, whether every identifier a module reads is bound somewhere it can see
// — a declaration, a parameter, an import, or a global this environment really
// has. A name that exists but holds the wrong thing is not its business.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `@babel/parser` with the `jsx` plugin gives
// an AST; `path.scope.hasBinding(name)` answers the question, and
// `Program.scope.globals` collects everything unbound in one pass.

import { describe, expect, it } from 'vitest'

import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'

import { readSource, sourcesUnder } from '../src-files.js'

const traverse = traverseModule.default || traverseModule

// The globals this code really runs against: a browser, with the bits of the
// platform this app actually uses. Written out rather than pulled from a package,
// because the list IS the claim — anything not on it is a name nobody declared.
//
// AND NOTHING APP-SHAPED MAY BE ON IT. A browser's global namespace is full of
// ordinary English words — `open`, `close`, `print`, `screen`, `name`, `status`,
// `top`, `find`, `focus` — and this app binds several of them as props: `open` is
// its commonest one. Allow-listing such a word blinds the check to exactly the
// parent/child shape it was written for, and worse than a crash: `window.open` is
// truthy, so a child reading a missing `open` renders WRONG instead of throwing.
// Eight were on this list — `open`, `close`, `print`, `screen`, `alert`,
// `confirm`, `prompt` and `process` — and removing all eight changed nothing,
// because no file uses any of them bare. They were carrying no code and hiding a
// class. A window API is written `window.open`, which is what a reader wants to
// see anyway.
//
// `process` was the worst of them: Vite does not define it in a browser bundle at
// all, so it is not a global here — it is the exact crash this file exists to
// catch, whitelisted.
//
// AND THE PRUNING IS NOT A JUDGEMENT ANY MORE. Removing those eight by hand left
// `location` behind, and a rater found it the same afternoon — so the rule is now
// mechanical and the third case enforces it: THE LIST IS EXACTLY THE GLOBALS THE
// TREE READS. 57 of the 106 names here were excusing nothing at all. If you add
// the first use of `crypto.randomUUID()`, this file fails and you add `crypto` —
// which is the one line of upkeep the rule costs, and is the point: the name gets
// on the list on the day the app can be checked against it, not years before.
const PLATFORM = new Set([
  'window', 'document', 'navigator', 'console', 'fetch', 'Response', 'FormData', 'URL',
  'URLSearchParams', 'File', 'Image', 'setTimeout', 'clearTimeout',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'localStorage',
  'matchMedia', 'getComputedStyle', 'ResizeObserver', 'IntersectionObserver',
  'MutationObserver', 'Intl', 'Math', 'JSON', 'Date', 'Number', 'String', 'Boolean',
  'Object', 'Array', 'Map', 'Set', 'WeakMap', 'Promise', 'RegExp', 'parseInt',
  'parseFloat', 'encodeURIComponent', 'undefined', 'Uint8Array', 'TextDecoder',
  'CustomEvent', 'AbortSignal', 'Infinity', 'XMLHttpRequest', 'FontFace', 'DOMMatrix',
  'HTMLInputElement',
])

// EVERY unbound name in a file, before the allow-list is applied — because the
// list itself has to be checked against them (see the third case).
function unboundIn(rel) {
  const code = readSource(rel)
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
  })
  const found = []
  traverse(ast, {
    Program(path) {
      for (const name of Object.keys(path.scope.globals)) {
        found.push({ name, where: `${rel}:${path.scope.globals[name].loc?.start?.line ?? '?'}` })
      }
    },
  })
  return found
}

// One parse of the tree, read two ways.
const UNBOUND = sourcesUnder().flatMap(unboundIn)
const REACHED = new Set(UNBOUND.map((u) => u.name))

describe('every name a module reads', () => {
  it('is bound somewhere it can see', () => {
    // ONE LIST, NOT ONE CASE PER FILE: a name that is not there is not a property
    // of the file it is in, and a reader wants every one of them at once.
    const free = UNBOUND.filter((u) => !PLATFORM.has(u.name)).map((u) => `${u.name} (${u.where})`)
    expect(free, `these names have no binding — the bundler resolves each as a global and the app throws where it is read:\n  ${free.join('\n  ')}`)
      .toEqual([])
  })

  it('and the check can still see one when it is there', () => {
    // A SCOPE WALK THAT FINDS NOTHING PASSES EVERYTHING. The two shapes that
    // actually shipped are shown to it: a bare name in JSX, and a setter bound in
    // a parent component and read in a child.
    const shapes = {
      'a bare name in JSX': 'export const A = () => <img src={nowhere} />',
      'a parent’s setter read in a child': `
        function Parent() { const [x, setX] = useState(null); return <Kid /> }
        function Kid() { return <button onClick={() => setX(1)} /> }
      `,
      // THE ONE THE ALLOW-LIST USED TO SWALLOW. `open` is a window method AND
      // this app's commonest prop name, so a child that reads its parent's
      // `open` looks exactly like a call to `window.open` — and passes review
      // twice as easily, because it does not even throw.
      'a parent’s prop that shares a window method’s name': `
        function Parent({ open }) { return <Kid /> }
        function Kid() { return <button onClick={() => open('x')} /> }
      `,
    }
    for (const [what, code] of Object.entries(shapes)) {
      const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] })
      let found = []
      traverse(ast, { Program(path) { found = Object.keys(path.scope.globals).filter((n) => !PLATFORM.has(n)) } })
      expect(found.length, `${what} is invisible to the check`).toBeGreaterThan(0)
    }
  })

  it('and every global the list excuses is one this app really reaches for', () => {
    // THE AUDIT, MECHANISED, because doing it by hand left `location` behind — one
    // pass removed eight app-shaped names and a rater found the ninth the same
    // afternoon. An entry that excuses nothing is not a convenience: it is a word
    // this app may bind tomorrow, silently un-guarded on the day it does. So the
    // list is exactly the globals the tree reaches for, and adding a use of
    // `structuredClone` is what earns `structuredClone` its line.
    const idle = [...PLATFORM].filter((n) => !REACHED.has(n))
    expect(idle, `the allow-list excuses names nothing reads — each is a hole waiting for the day this app binds that word:\n  ${idle.join('\n  ')}`)
      .toEqual([])
  })

  it('and it read the tree, so a green run is not an empty one', () => {
    // A WALK THAT FINDS NOTHING PASSES EVERYTHING, and this one is a walk over a
    // path from the environment: point `TIPPANI_SRC` somewhere else, or narrow
    // the extension, and the cases above stay green while nothing is checked.
    // The case beside them proves the ANALYSER on strings; only this one ties it
    // to the source tree. `sourcesUnder` throws below its floor, so this is the
    // second lock rather than the only one.
    expect(sourcesUnder(), 'the walk is not reaching the app itself').toContain('App.jsx')
  })
})
