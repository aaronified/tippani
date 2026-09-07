// THE ONE WALK OVER src/, BECAUSE A WALK THAT FINDS NOTHING PASSES EVERYTHING.
//
// TWO DOZEN GUARDS IN THIS SUITE READ THE SOURCE TREE and assert something about
// every file in it — that no screen draws its own silhouette, that every glyph is
// drawn rather than typed, that no name is unbound. Every one of them is a list
// compared against `[]`, so every one of them passes when the list is empty. Point
// `TIPPANI_SRC` somewhere else, narrow an extension by one character, or move the
// screens into a folder a non-recursive read cannot see, and the guard goes green
// while checking nothing. It has happened: `no-free-names.test.js` and
// `one-stand-in.test.js` were both found this way, by a rater rather than by a run.
//
// A PER-FILE ASSERTION IS THE WRONG REPAIR. It is one line each, in two dozen
// files, and this repo's own directive says why that fails: "similar things should
// act similarly… it lives in one function that both screens call — not in a line
// each, which is how one of them goes on being right while the other quietly
// stops." So the floor lives in the walk. Nothing that calls this can return an
// empty list, because this throws first.
//
// WHAT A TEST WRITER NEEDS TO KNOW: call `sourcesUnder()` for every `.js`/`.jsx`
// under `src`, or pass a predicate. Paths come back relative to `src`, so a
// failure message names `panels/identity.jsx` rather than a machine path.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const SRC = process.env.TIPPANI_SRC

// TWO FLOORS, BECAUSE THERE ARE TWO WAYS TO WALK OVER NOTHING and they have
// different sizes. The TREE floor catches a wrong `TIPPANI_SRC` or a tree that
// moved: it is a long way below the truth on purpose — 79 modules ship today —
// because a number close to the real one would fail on every commit that deletes
// a file. The PREDICATE floor catches an extension narrowed by one character,
// which is the mutation that proved two of these guards silent; it defaults to
// "at least one" and a caller filtering to a subset may state its own.
const TREE_FLOOR = 60

function walk(dir, pred, base = '', out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) walk(join(dir, e.name), pred, rel, out)
    else if (pred(e.name, rel)) out.push(rel)
  }
  return out
}

// Every source file under `src` matching `pred` (default: any `.js` or `.jsx`),
// as paths relative to `src`. Throws rather than returning a short list.
export function sourcesUnder(pred = (n) => /\.jsx?$/.test(n), floor = 1) {
  if (!SRC) throw new Error('TIPPANI_SRC is not set — a guard reading the source tree would have checked nothing')
  const all = walk(SRC, (n) => /\.jsx?$/.test(n))
  if (all.length < TREE_FLOOR) {
    throw new Error(
      `the walk over ${SRC} found ${all.length} source files, below the floor of ${TREE_FLOOR} — ` +
      'a guard over an empty tree reports no violations and means nothing. ' +
      'TIPPANI_SRC is wrong, or the tree moved.',
    )
  }
  const out = walk(SRC, pred)
  if (out.length < floor) {
    throw new Error(
      `the walk over ${SRC} matched ${out.length} of ${all.length} files, below this guard's floor of ${floor} — ` +
      'the predicate stopped matching, so the guard is reading nothing while reporting no violations.',
    )
  }
  return out
}

// The text of one of them, by the relative path `sourcesUnder` returned.
export const readSource = (rel) => readFileSync(join(SRC, rel), 'utf8')
