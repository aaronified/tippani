// A CONTRACT BETWEEN A HOOK AND A STYLESHEET, WITH NOTHING CHECKING IT.
//
// `useSheetDrag` does not move a sheet. It MEASURES the anchors and publishes the
// height it wants into a custom property, `--tp-sheet-h`, on the element it was
// handed — and the stylesheet is what turns that number into a box. Both halves
// are individually correct code, and the drag does nothing at all unless the
// element's own rule reads the property.
//
// THAT IS EXACTLY WHAT SHIPPED. `MobileSheet` was given the hook and its card was
// `height: 100%`; the only rule in the file reading `--tp-sheet-h` was
// `.tp-panel`. So the sheet measured, wrote, and stayed the height of the screen:
// a gesture that translated the card and sprang back, and a grip that was a dead
// control. No test in 344 files could see it, because neither half was wrong on
// its own — a rater reading the two files side by side found it.
//
// So the contract gets a guard. THE LIST BELOW IS THE POINT: a surface that takes
// the hook has to appear here, and appearing here means the stylesheet is checked
// for it. A tenth sheet wired up without a rule fails on the first line.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { rulesNaming } from '../css-rules.js'

const SRC = process.env.TIPPANI_SRC
const css = readFileSync(join(SRC, 'index.css'), 'utf8')
const ui = readFileSync(join(SRC, 'ui.jsx'), 'utf8')

// The property the hook writes. Spelled once, here, and read out of the hook
// below rather than trusted — a rename on one side is the same failure again.
const PROP = '--tp-sheet-h'

// Every surface that takes the drag, and the class its sheet element wears.
// `component` is what `useSheetDrag` is called inside; `cls` is what the
// stylesheet has to have a rule for.
const SHEETS = [
  { component: 'PanelHost', cls: 'tp-panel' },
  { component: 'MobileSheet', cls: 'mobile-sheet-card' },
]

// The body of a component, from its declaration to the next top-level one.
function bodyOf(name) {
  const at = ui.indexOf(`function ${name}(`)
  expect(at, `${name} is not declared in ui.jsx`).toBeGreaterThan(-1)
  const next = ui.indexOf('\nexport function ', at + 1)
  return ui.slice(at, next === -1 ? ui.length : next)
}

// THE WHOLE OPENING TAG THAT CARRIES A CLASS, so the ref can be looked for in it
// wherever the author put it. `className` and `ref` are attributes of one element
// and their ORDER is nobody's business: PanelHost writes the class first and the
// ref four lines later, MobileSheet writes the ref first. A regex that assumed
// either way round reports a wiring failure that is a formatting difference.
//
// Brace depth is tracked because a JSX attribute holds JavaScript, and a callback
// ref — `ref={(el) => { setBox(el); sheetRef.current = el }}` — has a `>` inside
// it that is an arrow and not the end of the tag.
//
// AND THE CLASS IS A WHOLE TOKEN, not a `\b`-bounded substring. `\btp-panel\b`
// matches inside `tp-panel-scrim`, because a hyphen is a word boundary — so the
// first version of this helper found the SCRIM's opening tag, reported that
// PanelHost's ref was not on its own panel, and was right about the wrong
// element.
function tagWith(body, cls) {
  let at = -1
  for (const m of body.matchAll(/className="([^"]*)"/g)) {
    if (m[1].split(/\s+/).includes(cls)) { at = m.index; break }
  }
  if (at < 0) return ''
  const open = body.lastIndexOf('<', at)
  if (open < 0) return ''
  let depth = 0
  for (let i = open; i < body.length; i++) {
    const ch = body[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '>' && depth === 0 && i > open) return body.slice(open, i + 1)
  }
  return ''
}

describe('the sheet drag reaches the stylesheet', () => {
  it('writes the property this test names, and no other', () => {
    // If the hook is renamed to write something else, every assertion below
    // would keep passing against a property nothing writes any more.
    expect(ui).toContain(`setProperty("${PROP}"`)
  })

  it('names every surface that takes the hook', () => {
    // The hook is called once per draggable surface. A new caller that is not in
    // SHEETS fails here rather than silently going unguarded.
    // `= useSheetDrag({`, so the hook's own declaration is not counted as a
    // caller of itself.
    const callers = [...ui.matchAll(/=\s*useSheetDrag\(\{/g)].length
    expect(callers, 'a surface takes useSheetDrag and is not listed in SHEETS')
      .toBe(SHEETS.length)
  })

  for (const { component, cls } of SHEETS) {
    it(`${component}'s sheet is .${cls}, and the stylesheet sizes it from ${PROP}`, () => {
      const body = bodyOf(component)
      // The hook is given a ref; that same ref is on the element wearing `cls`.
      // Asserting both ends is what makes this a wiring test rather than two
      // independent spellings that happen to agree today.
      const wiring = body.match(/useSheetDrag\(\{[\s\S]*?sheet:\s*(\w+)/)
      expect(wiring, `${component} does not hand a sheet ref to useSheetDrag`).toBeTruthy()
      const ref = wiring[1]
      const tag = tagWith(body, cls)
      expect(tag, `${component} draws no element with className .${cls}`).not.toBe('')
      expect(tag.includes(ref), `${component}'s ${ref} is not on .${cls}`).toBe(true)

      // AND THE OTHER HALF. A rule naming this class has to take its height from
      // the property — otherwise every frame the hook paints lands on nothing.
      const declared = rulesNaming(css, cls)
        .map((r) => r.body)
        .join('\n')
      expect(declared, `.${cls} has no rule at all in index.css`).not.toBe('')
      expect(
        new RegExp(`height:\\s*var\\(\\s*${PROP}`).test(declared),
        `.${cls} does not read ${PROP}, so useSheetDrag cannot resize it`,
      ).toBe(true)
    })
  }
})
