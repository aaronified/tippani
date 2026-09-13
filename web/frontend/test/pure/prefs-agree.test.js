// THE LISTS THAT EXIST IN TWO LANGUAGES MUST BE THE SAME LIST.
//
// WHAT WENT WRONG. `theme.js` shipped an eighth material set — `atrium`, the flat
// placeholder for the glass design that will replace it — gave it a label, and
// `en.txt` named it "Atrium". The server's `prefMaterialSets` stayed at seven. So
// Settings drew the option, a reader picked it, and `PUT /me/prefs` answered 400
// with a message that enumerated the seven and did not mention the one they had
// just chosen.
//
// NOTHING COULD HAVE CAUGHT IT, which is the actual defect. The client had a test
// that its sets render; the server had a test that an unknown set is refused. Both
// passed. A value that is valid on one side and invalid on the other is not visible
// to either side's tests — only to a test that reads both.
//
// SO THIS READS THE GO SOURCE. `ai-counts.test.js` already walks Go files from
// here, so a JS case reading Go is established rather than novel; and it has to be
// this direction, because the list is DECLARED in the client (a set is a design
// with four tiles) and merely ACCEPTED by the server.
//
// IT COVERS ACCENTS TOO, not because they have drifted but because they are the
// same shape: a short vocabulary written out in both languages, where adding to one
// is a natural change and adding to the other is the step you forget. A guard
// written for the one list that broke would leave the other waiting.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ACCENTS, MAT_SETS } from '../../src/theme.js'

// The repo root the way ai-counts.test.js finds it, and for its reason: under
// jsdom `import.meta.url` is an http URL and `process.cwd()` differs between
// `npm test` and `npx vitest --root web/frontend`. vitest.config.js sets
// TIPPANI_SRC because it is the only place that knows for certain.
const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const go = readFileSync(join(REPO, 'internal', 'httpapi', 'auth_handlers.go'), 'utf8')

// Pull the keys out of a `name = map[string]bool{ "a": true, ... }` literal. The
// name is matched, not the position, so the map can move within the file.
function goMapKeys(name) {
  const at = go.indexOf(`${name} = map[string]bool{`)
  expect(at, `${name} is no longer a map[string]bool in auth_handlers.go — this guard reads the declaration by name`).toBeGreaterThan(-1)
  const body = go.slice(at, go.indexOf('}', at))
  return [...body.matchAll(/"([^"]+)":\s*true/g)].map((m) => m[1]).sort()
}

describe('a preference the client offers is a preference the server accepts', () => {
  it('the material sets agree', () => {
    // Named as two sorted lists rather than set arithmetic, so a failure prints
    // WHICH value is on which side instead of "expected true to be false".
    expect(goMapKeys('prefMaterialSets')).toEqual(Object.keys(MAT_SETS).sort())
  })

  it('the accents agree', () => {
    expect(goMapKeys('prefAccents')).toEqual(Object.keys(ACCENTS).sort())
  })

  // AND THE REFUSAL NAMES EVERY VALUE IT REFUSES. The 400 the reader sees spells
  // the list out; a message that had gone stale alongside the map would have said
  // "must be … or quarry" while quarry was no longer the last one — which is worse
  // than no list, because it reads like an authoritative answer.
  // THE CONTRAST SWITCH IS THE THIRD OF THIS SHAPE, and it is here from the day it
  // shipped rather than after it breaks. Its list is declared in theme.js —
  // applyContrast is what decides an unknown value falls to 'auto' — and merely
  // accepted by the server, which is the direction this whole file reads in.
  it('the contrast settings agree', () => {
    expect(goMapKeys('prefContrasts')).toEqual(['auto', 'more'])
    // And the client really is the declaring side: applyContrast names both, and
    // a third value added to the server alone would fail the line above rather
    // than sit there unreachable.
    const theme = readFileSync(join(REPO, 'web', 'frontend', 'src', 'theme.js'), 'utf8')
    expect(theme, "applyContrast no longer names 'more'").toMatch(/pref === 'more' \? 'more' : 'auto'/)
  })

  it('the contrast refusal names both values', () => {
    const line = go.match(/"contrast must be ([^"]+)"/)
    expect(line, 'the contrast refusal no longer spells out its list').toBeTruthy()
    const named = line[1].replace(/\bor\b/g, ',').split(',').map((x) => x.trim()).filter(Boolean).sort()
    expect(named).toEqual(['auto', 'more'])
  })

  it('the error message names every material set', () => {
    const line = go.match(/"materialSet must be ([^"]+)"/)
    expect(line, 'the materialSet refusal no longer spells out its list').toBeTruthy()
    const named = line[1].replace(/\bor\b/g, ',').split(',').map((x) => x.trim()).filter(Boolean).sort()
    expect(named).toEqual(Object.keys(MAT_SETS).sort())
  })
})
