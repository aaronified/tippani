// THE RECALL MARK'S VERB LIVES IN THE MARK, NOT IN THE SCREENS.
//
// Moved from dom/recall-panel.test.jsx, where these were the source-reading half.
// The repo's directive: "A control drawn by one component on two screens has ONE
// behaviour, and it lives in one function that both screens call." Read off the
// source because the failures are OMISSIONS and a call site that decides for
// itself: a screen that opens the panel on its own, a quote-card action row that
// forgot the mark, a bare px box under the 44px touch floor.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { rulesNaming } from '../css-rules.js'
import { sourcesUnder } from '../src-files.js'

describe('the behaviour is the mark\'s', () => {
  const src = (f) => readFileSync(join(process.env.TIPPANI_SRC || 'src', f), 'utf8')

  // THE FILES COME FROM THE TREE, NOT FROM A LIST HERE. A hard-coded five was
  // both too many and too few: two of them draw no mark at all, so the loop was
  // reading files to skip them, and a SIXTH screen added next year would not have
  // been read at all. `sourcesUnder` walks the source and throws if the walk comes
  // back implausibly small, so an empty sweep cannot report a clean one.
  const jsx = () => sourcesUnder((n) => n.endsWith('.jsx'), 20)

  it('is handed nothing by any screen that draws it', () => {
    const offenders = []
    const drawn = jsx().filter((f) => /<ReviewDot\b/.test(src(f)))
    expect(drawn.length, 'no file in the tree draws the recall mark, so this sweep is passing over nothing').toBeGreaterThan(1)
    for (const f of drawn) {
      const body = src(f)
      for (const m of body.matchAll(/<ReviewDot\b([^>]*)>/g)) {
        // `item` says WHICH quote and `side` is where the tooltip points. Anything
        // else is a screen deciding what the mark does.
        const props = [...m[1].matchAll(/([A-Za-z][A-Za-z0-9]*)=/g)].map((p) => p[1])
        const extra = props.filter((p) => p !== 'item' && p !== 'side')
        if (extra.length) offenders.push(`${f}: <ReviewDot ${extra.join(' ')}>`)
      }
    }
    expect(offenders, 'a screen is telling the recall mark what to do, so the other screens drawing it do something else').toEqual([])
  })

  // A NEW CONTROL MAY NOT LAND UNDER THE TOUCH FLOOR.
  //
  // `scripts/screenshots/controls-baseline.json` holds the backup shelf at 300
  // controls under 44px at 390px — the narrowed in-card marks are most of them —
  // and that count is a ratchet: it may fall and never rise. The mark BECAME a
  // control in this change, drawn on every quote card across five surfaces, so a
  // short box on it would push that number past its ceiling on its own.
  //
  // WHAT IS CHECKED AND WHY IT IS THIS AND NOT "44 EVERYWHERE". The floor is a
  // PHONE rule — `controls.mjs` measures it at 390 and not at 1280, because a
  // desk pointer does not need it — so the mark's desktop box is deliberately
  // smaller and written as `max(<px floor>, <em>)`, the repo's pattern for a box
  // that must hold scaling text. What may not exist is a BARE px box under the
  // floor: that shape applies at every width, phone included, and there is no
  // narrower rule for the phone one to override. The 44px phone box itself is the
  // next case's business, and the browser probe is what proves the count held.
  //
  // AND THE SELECTOR IS READ WHOLE. Both cases below went through `cssRules`
  // after a rater slid `.hand-card .status-mark` into the MIDDLE of an existing
  // selector list and every one of 3,584 tests stayed green: the old split took
  // the last line of the list, so a selector with anything after it was
  // invisible. `test/css-rules.js` carries the argument.
  it('is never given a bare px box under the touch floor', () => {
    const FLOOR = 44
    const bad = []
    for (const r of rulesNaming(src('index.css'), 'status-mark')) {
      for (const d of r.body.matchAll(/\b(width|height|min-width|min-height)\s*:\s*([^;]+)/g)) {
        const px = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(d[2])
        if (px && Number(px[1]) < FLOOR) bad.push(`${r.sel} { ${d[1]}: ${d[2].trim()} }`)
      }
    }
    expect(bad,
      'these size the recall mark under the 44px floor at every width — the backup shelf already holds 300 controls under that floor as a ratchet, and a control added to the app may not raise it')
      .toEqual([])
  })

  // AND THE PHONE BOX IS THE FULL FLOOR, which is where the ratchet is measured.
  // The narrowing the ♥ takes at that width is what puts 300 marks under the
  // floor; this one may not join them, so it wears the pair rule's 44 and skips
  // the narrowing — 10px of reach the eye cannot see, in the direction the pack
  // asks for.
  // EVERY QUOTE-CARD ACTION ROW CARRIES IT, and the guard is a sweep because the
  // failure is an OMISSION. Library's `ActionRow`, Movies' `Frame` and Home's
  // favourite tile each draw the same row — ♥, copy, share, the colour dots and
  // the ⋯ — and Home's own comment already records what happens when they drift:
  // "a reader who has learned the row on a book's page should not have to
  // re-learn it here — which is exactly what shipped for one release". It
  // happened again here: the mark moved into that row on two of the three and
  // Home kept the old one, with no way to reach a quote's history from the
  // favourites board.
  //
  // Read off the source, because rendering those three needs three screens' worth
  // of props and the claim is about which files draw the mark at all.
  it('is drawn on every action row that draws the rest of that row', () => {
    // The row is identified by the two controls that have always been in it,
    // rather than by a class: `Hearts` beside `QuoteActions` is that row and
    // nothing else in the app is. Over the whole tree, so a screen added later is
    // swept rather than needing to be remembered here.
    const rows = jsx().filter((f) => {
      const body = src(f)
      return /<Hearts\b/.test(body) && /<QuoteActions\b/.test(body)
    })
    expect(rows.length, 'no file draws that action row, so this sweep is measuring nothing').toBeGreaterThan(1)
    const missing = rows.filter((f) => !/<ReviewDot\b/.test(src(f)))
    expect(missing,
      'these draw a quote card\'s action row without the recall mark, so the history is reachable from some screens and not others')
      .toEqual([])
  })

})

