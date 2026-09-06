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
// the scope analysis costs a devDependency of zero and about a second.
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
const PLATFORM = new Set([
  'window', 'document', 'navigator', 'location', 'history', 'screen',
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
  'atob', 'btoa', 'alert', 'confirm', 'prompt', 'print', 'open', 'close', 'scrollTo',
  'Infinity', 'NaN', 'XMLHttpRequest', 'FontFace', 'DOMMatrix', 'HTMLInputElement',
  'HTMLImageElement', 'HTMLCanvasElement', 'CanvasRenderingContext2D', 'OffscreenCanvas',
  'process', 'import',
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
    }
    for (const [what, code] of Object.entries(shapes)) {
      const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] })
      let found = []
      traverse(ast, { Program(path) { found = Object.keys(path.scope.globals).filter((n) => !PLATFORM.has(n)) } })
      expect(found.length, `${what} is invisible to the check`).toBeGreaterThan(0)
    }
  })
})
