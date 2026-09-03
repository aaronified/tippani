// A SCROLLER THAT CANNOT SCROLL, which is the other half of the omission
// `scroll-containment.test.js` sweeps for.
//
// THE BUG THIS PINS, found in the chip row on an annotation card. `Scroller`
// attaches `useEdgeScroll`, which MEASURES: it compares `scrollWidth` against
// `clientWidth` and writes `data-scroll-x` when there is more row than box, and
// the 26px mask hangs off that attribute. If the class on the box never declares
// an overflow, the box simply grows to fit its children — `scrollWidth ===
// clientWidth` for ever, no attribute is ever written, no fade appears and the
// press-and-drag has nothing to drag. Nothing throws. The row looks fine at every
// width the author happens to try, and wrong at the one width it was built for.
//
// AND WHY A STYLESHEET SWEEP RATHER THAN A CASE PER ROW. jsdom has no layout, so
// a rendered test cannot tell a scrolling box from a growing one — the row test
// that missed this asserted the box carried the right class, which is exactly the
// hollow half of the claim. What is checkable everywhere is the DECLARATION, and
// the declaration is the defect. Its sibling sweeps the boxes that DO scroll for
// containment; this one sweeps the boxes that were asked to.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

// Every rule block as { sel, body } — the same hand-rolled split
// scroll-containment.test.js uses, and for the same reason: the file nests one
// level (@layer / @media) and the blocks that matter never nest in each other.
function rules() {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(CSS))) {
    const sel = m[1].split('\n').pop().trim()
    if (!sel || sel.startsWith('@')) continue
    out.push({ sel, body: m[2] })
  }
  return out
}

// Every declaration that lands on `.cls` itself, from every block that names it
// — a rule at one width and a restatement in a media query both count, and so
// does a compound selector like `.a.cls`, which still styles this element.
function declarationsFor(cls) {
  const own = new RegExp(`(^|[\\s,>+~])\\.${cls}(?=$|[\\s,{:.\\[])`)
  return rules()
    .filter((r) => r.sel.split(',').some((s) => own.test(' ' + s.trim().replace(/::?[a-z-]+(\([^)]*\))?/g, ''))))
    .map((r) => r.body)
    .join(';')
}

// Every <Scroller> in the source, with the axis it was asked for and the class
// it was given. `axis` defaults to "x" in ui.jsx, so an omitted axis is sideways.
function scrollers() {
  const out = []
  for (const f of readdirSync(SRC).filter((n) => n.endsWith('.jsx'))) {
    const text = readFileSync(join(SRC, f), 'utf8')
    const re = /<Scroller\b([^>]*)>/g
    let m
    while ((m = re.exec(text))) {
      const attrs = m[1]
      // Either a plain literal, or the leading literal of an expression that
      // appends the caller's own classes — `className={('speaker-chips ' + extra)}`
      // — where the row's OWN class is the first quoted word. A className built
      // entirely from a prop (works.jsx's carousel takes one from its caller)
      // cannot be resolved here; counted, so the sweep says how many it skipped
      // rather than shrinking silently.
      const cls = attrs.match(/className="([^"]+)"/) || attrs.match(/className=\{[^}]*['"]([A-Za-z][\w-]*)/)
      if (!cls) {
        out.push({ file: f, cls: null })
        continue
      }
      const ax = attrs.match(/axis=(?:"([a-z]+)"|\{[^}]*'([a-z]+)'[^}]*\})/)
      out.push({
        file: f,
        cls: cls[1].trim().split(/\s+/)[0],
        axis: ax ? ax[1] || ax[2] : 'x',
        // An inline style may carry the overflow instead — the metadata tables
        // pair a `maxHeight` with an `overflowY` there, because the height is a
        // per-table decision and the two belong together.
        inline: /style=\{/.test(attrs) ? attrs : '',
      })
    }
  }
  return out
}

const AXES = { x: ['overflow-x', 'overflow'], v: ['overflow-y', 'overflow'], both: null }

describe('every box handed to Scroller', () => {
  const found = scrollers()

  it('there are some, and the sweep says how many it could not resolve', () => {
    expect(found.length, 'the <Scroller> match stopped matching').toBeGreaterThan(10)
    const unresolved = found.filter((s) => !s.cls).length
    // One today: works.jsx's carousel is handed its class by its caller. If this
    // number grows, the sweep is covering less than it looks like it is.
    expect(unresolved, 'more Scrollers now take their class from a prop').toBeLessThanOrEqual(1)
  })

  it('declares an overflow on the axis it was asked to scroll', () => {
    const dead = []
    for (const s of found) {
      if (!s.cls) continue
      const axes = s.axis === 'both' ? ['x', 'v'] : [s.axis]
      const decls = declarationsFor(s.cls)
      for (const a of axes) {
        const props = AXES[a]
        if (!props) continue
        const inCSS = props.some((p) => new RegExp(`${p}:\\s*(auto|scroll)`).test(decls))
        const inStyle = new RegExp(a === 'x' ? 'overflowX' : 'overflowY').test(s.inline)
        if (!inCSS && !inStyle) dead.push(`${s.file}: .${s.cls} (axis ${a})`)
      }
    }
    expect(dead, 'these can never scroll, so their fade can never appear').toEqual([])
  })
})
