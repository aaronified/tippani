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

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'

const traverse = traverseModule.default || traverseModule
const SRC = process.env.TIPPANI_SRC

function sourcesUnder(dir, base = '', out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) sourcesUnder(join(dir, e.name), rel, out)
    else if (/\.jsx?$/.test(e.name)) out.push(rel)
  }
  return out
}

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
const PLATFORM = new Set([
  'window', 'document', 'navigator', 'location', 'history',
  'console', 'fetch', 'Request', 'Response', 'Headers', 'AbortController', 'FormData',
  'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'Image', 'Audio',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
  'localStorage', 'sessionStorage', 'matchMedia', 'getComputedStyle',
  'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'PerformanceObserver',
  'performance', 'crypto', 'structuredClone', 'queueMicrotask', 'reportError',
  'Intl', 'Math', 'JSON', 'Date', 'Number', 'String', 'Boolean', 'Object', 'Array',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'BigInt', 'Proxy', 'Reflect',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'RegExp', 'Function',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'globalThis', 'undefined',
  'Uint8Array', 'Int32Array', 'Float64Array', 'ArrayBuffer', 'DataView', 'TextEncoder',
  'TextDecoder', 'CustomEvent', 'Event', 'KeyboardEvent', 'PointerEvent', 'DOMParser',
  'HTMLElement', 'Element', 'Node', 'NodeList', 'CSS', 'AbortSignal', 'Worker',
  'atob', 'btoa', 'scrollTo',
  'Infinity', 'NaN', 'XMLHttpRequest', 'FontFace', 'DOMMatrix', 'HTMLInputElement',
  'HTMLImageElement', 'HTMLCanvasElement', 'CanvasRenderingContext2D', 'OffscreenCanvas',
  'import',
])

function freeNamesIn(rel) {
  const code = readFileSync(join(SRC, rel), 'utf8')
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
  })
  const free = []
  traverse(ast, {
    Program(path) {
      for (const name of Object.keys(path.scope.globals)) {
        if (PLATFORM.has(name)) continue
        const node = path.scope.globals[name]
        free.push(`${name} (${rel}:${node.loc?.start?.line ?? '?'})`)
      }
    },
  })
  return free
}

describe('every name a module reads', () => {
  it('is bound somewhere it can see', () => {
    // ONE LIST, NOT ONE CASE PER FILE: a name that is not there is not a property
    // of the file it is in, and a reader wants every one of them at once.
    const free = sourcesUnder(SRC).flatMap(freeNamesIn)
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

  it('and it read the tree, so a green run is not an empty one', () => {
    // A WALK THAT FINDS NOTHING PASSES EVERYTHING, and this one is a walk over a
    // path from the environment: point `TIPPANI_SRC` somewhere else, or narrow
    // the extension, and both cases above stay green while nothing is checked.
    // The case beside them proves the ANALYSER on strings; only this one ties it
    // to the source tree. Same guard as `glyphs-are-drawn.test.js`.
    const files = sourcesUnder(SRC)
    expect(files.length, 'no source files found — TIPPANI_SRC is wrong or the walk stopped matching').toBeGreaterThan(60)
    expect(files, 'the walk is not reaching the app itself').toContain('App.jsx')
  })
})
