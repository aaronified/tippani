// EVERY DROPDOWN IN THE APP WEARS THE APP'S OWN THEME.
//
// THE RULE, in the owner's words: "app dropdowns shall all be app themed.
// Always." A native `<select>` does not draw its list — the operating system
// does. So the panel that opens is the platform's: its own face, its own row
// height, its own highlight colour, its own scroll, on iOS a wheel that takes
// over the bottom third of the screen. None of the app's type dials reach it,
// none of its material sets, none of its accent. The one control in a themed
// row that ignores the theme is the one that looks broken.
//
// AND IT IS NOT ONLY LOOKS. `Select` in `ui.jsx` carries the app's arrow keys,
// its drag-to-pick thumb, its Escape and outside-click rules, its ARIA, and a
// `filter` that a list of two hundred films needs and a native one cannot have.
// A screen that reaches for `<select>` gets none of that and nobody notices
// until the list is long.
//
// WHAT THIS DOES NOT TOUCH. `ui.jsx` itself, where `Select` is DEFINED — the
// component's own comment names the thing it replaces, and a guard that cannot
// tell a definition from a use would forbid the app from explaining itself.
// Comments everywhere else are prose for the same reason.
//
// THE MUTATION THAT PROVES IT FIRES: put `<select>` back into any screen under
// `src/` and this goes red naming that file and line. Verified by restoring the
// native element in `StatsPage.jsx` — one violation, named at its line.
//
// WHAT A TEST WRITER NEEDS TO KNOW: this is a source scanner, not a test. It
// reads spelling, not behaviour; the app can be entirely broken and it still
// passes. It is a BAN rather than a ratchet, because the count is zero and the
// replacement exists for every case — a screen that genuinely needs the native
// element has to argue for an exception here, where somebody reads the reason.
import { describe, expect, it } from 'vitest'

import { readSource, sourcesUnder } from '../src-files.js'

// Where `Select` lives. Its own doc comment says what it replaces, and the
// component beside it has to be allowed to name it.
const DEFINES_IT = new Set(['ui.jsx'])

// A `//` line comment, outside a string. The same reasoning as
// `glyphs-are-drawn.test.js`: cutting at the first `//` on a line truncates
// every URL in the file, and a violation sitting after one would vanish.
function withoutComments(text) {
  const noBlocks = text.replace(/\/\*[\s\S]*?\*\//g, '')
  return noBlocks.split('\n').map((line) => {
    let quote = null
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i]
      if (quote) {
        if (c === '\\') i += 1
        else if (c === quote) quote = null
        continue
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '/' && line[i + 1] === '/') return line.slice(0, i)
    }
    return line
  }).join('\n')
}

// `<select` opening a JSX element — `<select>` or `<select` followed by props.
// `<selection…>` is not one, which is why the character after the word is read.
const NATIVE = /<select(?=[\s/>])/

function violations() {
  const out = []
  for (const f of sourcesUnder((n) => n.endsWith('.jsx'), 20)) {
    if (DEFINES_IT.has(f)) continue
    withoutComments(readSource(f)).split('\n').forEach((line, i) => {
      if (NATIVE.test(line)) out.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`)
    })
  }
  return out
}

describe('every dropdown the app draws', () => {
  it('is the app\'s own Select, never the platform\'s', () => {
    const found = violations()
    expect(found, 'these open the operating system\'s list instead of the app\'s — ' +
      'use `Select` from ui.jsx:\n  ' + found.join('\n  ')).toEqual([])
  })

  it('and there is a Select for them to use', () => {
    // The other half of a ban: something to reach for instead. A rename in
    // ui.jsx would otherwise leave this guard forbidding the only alternative.
    expect(readSource('ui.jsx'), 'Select is gone from ui.jsx').toMatch(/export function Select\(/)
  })

  it('and the walk is actually reading the screens', () => {
    // The extraction's own failure mode: narrow the predicate by one character
    // and this reports no violations over nothing. `sourcesUnder` throws below
    // its floor; this names the file, which a count cannot.
    expect(sourcesUnder((n) => n.endsWith('.jsx'), 20), 'the walk is not reaching the app')
      .toContain('StatsPage.jsx')
  })
})
