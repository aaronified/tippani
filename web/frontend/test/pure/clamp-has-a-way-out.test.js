// EVERY CLAMP IN THE APP, AND HOW A READER GETS AT WHAT IT HID.
//
// WHY THIS EXISTS. `typescale.mjs` exempts a `-webkit-line-clamp` box from the
// type-scale ratchet, and the argument is sound: a clamp holds N LINES at every
// type size, so turning the dial up cannot break it — what changes is how many
// words fit on those lines. That is the clamp working. But the exemption leaves a
// real question unasked, and it was this file's whole reason for being written:
// **a clamp hides text, and something has to give it back.**
//
// THE PROBE CANNOT ASK IT, in either direction. It never presses anything, so it
// cannot see a chevron; and it visits routes at rest, so it cannot see a clamp
// behind a panel. It would answer wrongly both ways.
//
// AND "EVERY CLAMP HAS A BUTTON" IS THE WRONG RULE, which is why this is a
// ratchet with reasons rather than an assertion. Three of the app's clamps have a
// control that opens them in place. The others give the text back somewhere else —
// a tile that opens its own page, a top bar whose title is the hero heading
// underneath it — and the reader's way out is a different screen, not a chevron.
// Nothing mechanical tells those apart from a clamp that simply loses the words.
//
// SO THE ENFORCEABLE HALF IS THIS: adding a clamp is a deliberate act with an
// argument attached. A new one fails here by name, and the way to make it pass is
// to write down where the reader gets the text back. That is exactly the shape
// `one-walk.test.js` uses for its walks and `spacing-debt.test.js` for its steps.
//
// WHAT A TEST WRITER NEEDS TO KNOW: a clamp is `-webkit-line-clamp` in
// `index.css` or `WebkitLineClamp` in a JSX inline style. The count may fall and
// never rise. A clamp on a NAME is a different rule and a different guard —
// `no-truncated-names.test.js` — and that one is not a ratchet: it is a floor of
// two exceptions, each the owner's ruling.

import { describe, expect, it } from 'vitest'

import { SRC, readSource, sourcesUnder } from '../src-files.js'

// Every clamp, as `file:token` — the token being the CSS selector or the JSX
// identifier that names the line count, which is what a reader greps for.
function clamps() {
  const out = []
  const css = readSource('index.css')
  // The selector a clamp sits under: the nearest `{`-opening line above it.
  const lines = css.split('\n')
  lines.forEach((line, i) => {
    if (!/-webkit-line-clamp\s*:/.test(line)) return
    let sel = '?'
    for (let j = i; j >= 0; j--) {
      const m = /^\s*([^{}/][^{}]*)\{\s*$/.exec(lines[j])
      if (m) { sel = m[1].trim(); break }
    }
    out.push(`index.css:${sel}`)
  })
  for (const f of sourcesUnder((name) => /\.jsx?$/.test(name))) {
    const text = readSource(f)
    for (const m of text.matchAll(/WebkitLineClamp:\s*([A-Za-z0-9_.]+)/g)) {
      out.push(`${f}:${m[1]}`)
    }
  }
  return out.sort()
}

// WHAT EACH ONE HID AND WHERE IT COMES BACK. Nine, and every one of them has an
// answer — which is the point: the list is not a debt, it is the argument.
const KNOWN = {
  // A CONTROL IN PLACE. The clamp collapses and a chevron beside it opens.
  'Home.jsx:clampLines':
    'the favourite tile’s quote — `ClampMore` under it, and the tile head toggles `open`',
  'review.jsx:QUIZ_OPTION_LINES':
    'a quiz option — a `FieldIconButton` wearing `ClampMore`, drawn only when something is hidden',
  'ui.jsx:lines':
    '`useClamped`, the shared fold — `canToggle` and `clampProps` make the text itself the control',

  // THE TEXT COMES BACK ON ANOTHER SCREEN. No chevron, and none is wanted: the
  // clamped thing is a preview OF the screen that holds it in full.
  'index.css:.anthology-tile-intro':
    'two lines of an anthology’s introduction on its tile; the anthology’s own page prints all of it',
  'index.css:.mobile-topbar-title':
    'two lines of a work’s title in the phone top bar; the hero heading below it is the same string, unclamped',
  'index.css:.tl-gap-line':
    'one of the captions spread across an empty stretch of the reading timeline — the copy is '
    + 'this app\u2019s own line about a silence, so nothing of the reader\u2019s is hidden, and four lines of it '
    + 'would be a paragraph in a chart',

  // A DIFF, WHERE BOTH SIDES ARE SHOWN AT ONCE AND NEITHER MAY SET THE ROW HEIGHT.
  'index.css:.merge-old':
    'the value being replaced, in a merge review — its full text is the record it came from',
  'index.css:.merge-new':
    'the value replacing it, same row, same reason',
}

describe('every clamp says where the text comes back', () => {
  it('finds the source at all', () => {
    // THE FLOOR UNDER THE WALK, and it is not the ratchet. An empty inventory
    // passes every case below, so this asserts the search found something — and
    // it asserts BOTH HALVES separately, because the CSS scan and the JSX scan
    // are different code and either can come back empty on its own while the
    // total still looks plausible.
    //
    // It is deliberately not pinned to the exact count: that number FALLS every
    // time a clamp gets a proper fold (it went 9 → 8 when the re-verify diff took
    // `ExpandableDescription`), and a floor that has to be edited on every
    // improvement is a floor nobody trusts. The ratchet below is what watches the
    // total.
    expect(SRC, 'the source tree is not where this test thinks it is').toBeTruthy()
    const all = clamps()
    expect(all.filter((c) => c.startsWith('index.css:')).length,
      'no clamp found in the stylesheet; the CSS scan is broken, not the app').toBeGreaterThanOrEqual(3)
    expect(all.filter((c) => /\.jsx?:/.test(c)).length,
      'no inline clamp found in any component; the JSX scan is broken, not the app').toBeGreaterThanOrEqual(2)
  })

  it('and a new one has to be argued for', () => {
    const fresh = clamps().filter((c) => !(c in KNOWN))
    expect(fresh, `${fresh.join(', ')} clamps text with no note saying how a reader gets it back. `
      + 'Add it to KNOWN with the answer — a control beside it, or the screen that prints the whole thing.')
      .toEqual([])
  })

  it('and the count may fall and never rise', () => {
    expect(clamps().length, 'a clamp was added; the number may fall and never rise')
      .toBeLessThanOrEqual(Object.keys(KNOWN).length)
  })

  it('and each answer is an answer rather than a placeholder', () => {
    // A list of reasons is only worth keeping if the reasons are sentences. "TODO"
    // in this table would turn the whole guard into a rubber stamp.
    for (const [k, why] of Object.entries(KNOWN)) {
      expect(why.length, `${k}’s note is too short to be an argument`).toBeGreaterThan(30)
      expect(why, `${k}’s note is a placeholder`).not.toMatch(/TODO|FIXME|\?\?\?/)
    }
  })
})
