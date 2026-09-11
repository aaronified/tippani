// EVERY SCREEN THAT HAS A CONTAINER STATES ITS TEXT ORDER, and this is the half
// a render test cannot see.
//
// THE GAP THIS EXISTS FOR, found by mutating the tree rather than by reading it.
// `text-order-scope.test.jsx` renders a card inside a `TextOrderScope` and proves
// the hook reads it — and it goes on passing when `WorkDetail` stops passing the
// WORK's value, because the test supplies its own. So the component contract was
// guarded and the CALLERS were not: exactly the shape that shipped `useSheetDrag`
// writing a custom property no stylesheet read, and `resolveTextOrder` composing a
// scope no caller supplied for the whole of its life before 0073.
//
// SO THE LIST BELOW IS THE POINT. A screen that draws a container's rows appears
// here, and appearing here means the source is checked for a scope carrying that
// container's own column — not a constant, which is the mutation above.
import { describe, expect, it } from 'vitest'

import { readSource, sourcesUnder } from '../src-files.js'

// Each screen, and the expression its scope must carry. `holder` is the variable
// the screen has its container in, so the assertion is about THAT row's column
// rather than about the string "text_order" appearing anywhere in the file.
const SCREENS = [
  // One line covering a book, a film, a show and a game: `renderBoard` has two
  // call sites and this is the component both of them go through.
  { file: 'WorkDetail.jsx', holder: 'item' },
  // A standalone quote's container is its BOARD — the owner's ruling, because a
  // quote has no work row.
  { file: 'Quotes.jsx', holder: 'open' },
  // The search modal is the one surface whose container is a property of the HIT
  // rather than of the screen, so it wraps per row with the parent it fetched.
  { file: 'SearchPage.jsx', holder: 'parent' },
]

describe('the scope reaches the screens that have one', () => {
  it('names every file that opens a TextOrderScope', () => {
    // A new screen that wraps its rows must be listed here, or it is unguarded —
    // and a screen dropped from this list fails on the next line rather than
    // quietly going unchecked.
    // `<TextOrderScope>` and not `<TextOrderScopeContext.Provider>`, which is the
    // module that DEFINES it: a substring match counted textOrderHost.jsx as a
    // fourth screen, which is the definition rather than a caller.
    const opens = sourcesUnder().filter((rel) => /<TextOrderScope[\s>]/.test(readSource(rel)))
    expect(opens.sort(), 'a screen opens a TextOrderScope and is not listed in SCREENS')
      .toEqual(SCREENS.map((s) => s.file).sort())
  })

  for (const { file, holder } of SCREENS) {
    it(`${file} passes its container's own text_order`, () => {
      const src = readSource(file)
      // `value={item.text_order}` or `value={open?.text_order}` — the holder, an
      // optional chain or not, and that column. A constant, an empty string or
      // somebody else's row all fail here, which is the mutation that got past
      // the render test.
      const wired = new RegExp(`<TextOrderScope\\s+value=\\{${holder}\\??\\.text_order\\}`)
      expect(wired.test(src), `${file} opens a TextOrderScope without ${holder}'s text_order in it`)
        .toBe(true)
    })
  }
})
