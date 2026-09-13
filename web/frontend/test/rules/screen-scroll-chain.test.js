// The screen that owns its scroll needs an UNBROKEN height chain, and one
// missing link costs the whole thing silently.
//
// WHAT ACTUALLY SHIPPED. `.container-tp { height: 100% }` was the whole of it. A
// percentage height resolves against a parent that has one, and that parent —
// Tailwind's `.min-h-screen` — has a min-height and nothing else, so the chain
// ended one element above where it began. Main grew to its content, every box
// below grew with it, and both columns finished exactly as tall as what was in
// them: `scrollHeight - clientHeight = 0`, no scrollbar, nothing to drag. The
// body's own `overflow: hidden` then cut off everything past the first screen.
// Measured in Firefox at 1440x900: a 900px body holding 1062px, and not one
// scrollable box anywhere in the chain. A book's quotes were unreachable.
//
// TWO LINKS WERE MISSING AND NEITHER LOOKED LIKE A LINK. `#root`, because
// index.html declares it and the app has never had a reason to style it; and the
// screen's own section, because a book detail is nested INSIDE the Library
// screen's `[data-screen-label]` — so a child combinator reached the wrapper and
// stopped one element short, which reads as correct in the stylesheet.
//
// WHY THIS TEST AND NOT ONLY THE BROWSER ONE. jsdom has no layout, so nothing in
// this suite can measure a scroll. What it CAN do is read the rules and fail when
// a link is deleted — which is the change that would break it. The real
// measurement is scripts/screenshots/frame-scroll.mjs, and it is named here so
// the next reader knows this file is not the whole guard.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
// Comments come out FIRST, whole-file. This stylesheet explains itself at
// length, and one of those explanations names the very selectors asserted below
// — parse the file with the prose still in it and a paragraph becomes a rule.
const css = readFileSync(join(SRC, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// Leaf rules only: walk the braces so @layer and @media nesting cannot be
// mistaken for a selector with a huge body.
function rules(text) {
  const out = []
  let i = 0
  while (i < text.length) {
    const open = text.indexOf('{', i)
    if (open === -1) break
    let depth = 1
    let j = open + 1
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++
      else if (text[j] === '}') depth--
      j++
    }
    const head = text.slice(i, open)
    const body = text.slice(open + 1, j - 1)
    const sel = head.slice(head.lastIndexOf('}') + 1).trim()
    if (body.includes('{')) {
      // an at-rule: descend into it rather than treating its body as declarations
      out.push(...rules(body))
    } else if (sel) {
      out.push({ sel, body })
    }
    i = j
  }
  return out
}

const ALL = rules(css)

// The declarations of every rule whose selector list contains EXACTLY `sel` as
// one of its parts.
//
// Exact, not substring: `.container-tp` is also a prefix of `.container-tp > *`,
// and that neighbouring rule carries a `min-height: 0` of its own — so a
// substring match reads main's missing min-height off its children's rule and
// reports a chain that is whole when it is not. (It did, on the first run.)
function declsFor(sel) {
  return ALL.filter((r) => r.sel.split(',').some((s) => s.trim() === sel))
    .map((r) => r.body.replace(/\s+/g, ' '))
    .join(' ; ')
}

const LOCKED = "html[data-scroll='screen']"

describe('the locked screen\u2019s height chain', () => {
  it('parses real rules out of the stylesheet', () => {
    // The anchor: without it every assertion below could pass on an empty list.
    expect(ALL.length).toBeGreaterThan(500)
    expect(
      ALL.filter((r) => r.sel.includes(`${LOCKED} body`)).map((r) => r.body).join(' '),
    ).toMatch(/overflow:\s*hidden/)
  })

  // Link by link, top to bottom. Each needs a definite height from above AND
  // permission to be shorter than its content.
  it('gives #root a height — the link the app never styles', () => {
    expect(declsFor(`${LOCKED} #root`)).toMatch(/height:\s*100%/)
  })

  it('makes the shell a bounded column', () => {
    const d = declsFor(`${LOCKED} .min-h-screen`)
    expect(d).toMatch(/height:\s*100%/)
    expect(d).toMatch(/display:\s*flex/)
  })

  it('makes main a flex child that may be shorter than its content', () => {
    const d = declsFor(`${LOCKED} .container-tp`)
    expect(d).toMatch(/flex:\s*1/)
    expect(d).toMatch(/min-height:\s*0/)
    expect(d).toMatch(/display:\s*flex/)
  })

  it('reaches the screen section wherever it is nested, not only as a child', () => {
    // `.tab-panel > [data-screen-label]` is the version that shipped and it
    // stopped at the Library wrapper. The descendant form is the fix.
    // EVERY rule that grants the section something must reach it, not just one of
    // them: the version that shipped had the descendant form in the display rule
    // and a child combinator in the one that hands down the height, which is the
    // half that matters and the half that was broken.
    const touching = ALL.filter(
      (r) => r.sel.includes(LOCKED) && r.sel.includes('[data-screen-label]'),
    )
    expect(touching.length, 'nothing reaches the screen section under the lock').toBeGreaterThan(0)
    for (const r of touching) {
      const parts = r.sel.split(',').map((x) => x.trim()).filter((x) => x.includes('[data-screen-label]'))
      for (const part of parts) {
        expect(
          /\.tab-panel\s+\[data-screen-label\]/.test(part),
          `a child combinator stops at the Library wrapper: ${part} { ${r.body.replace(/\s+/g, ' ').trim()} }`,
        ).toBe(true)
      }
    }
    const d = touching.map((r) => r.body.replace(/\s+/g, ' ')).join(' ; ')
    expect(d).toMatch(/flex:\s*1/)
    expect(d).toMatch(/min-height:\s*0/)
    expect(d).toMatch(/display:\s*flex/)
  })

  it('lets the frame itself fill what is left', () => {
    const d = declsFor(`${LOCKED} .tp-detail`)
    expect(d).toMatch(/flex:\s*1/)
    expect(d).toMatch(/min-height:\s*0/)
  })

  it('gives both columns their own scroller', () => {
    const d = ALL.filter((r) => r.sel.includes('.tp-detail-hero'))
      .map((r) => r.body.replace(/\s+/g, ' '))
      .join(' ; ')
    expect(d).toMatch(/overflow-y:\s*auto/)
    expect(d).toMatch(/min-height:\s*0/)
    // The standing rule: a scroller that can be flung must not move the page
    // behind it.
    expect(d).toMatch(/overscroll-behavior:\s*contain/)
  })
})
