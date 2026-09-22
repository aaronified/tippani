// A glyph may be solid only if it can name which of the four reasons lets it be.
//
// WHY THIS IS A TEST AND NOT A PARAGRAPH. "The app is wireframe" was true by accident for
// most of its life — every glyph used `iconStroke` because that is what the one beside it
// used, and nothing would have objected to a filled one arriving. The moment a pack of 82
// filled icons is on hand, "only four arguments count" stops being an observation about
// the set and becomes a rule somebody has to keep — which is the kind of rule that lasts
// exactly as long as the person who wrote it is the one adding glyphs.
//
// So the exceptions are declared, with their reason, and anything else that fills fails.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as ui from '../../src/ui.jsx'
import { CONTENT_TABS, DRAWER_TABS, UTILITY_TABS } from '../../src/routes.js'

// The declared exceptions. The KEY is the exported glyph; the VALUE is which of the four
// arguments it is making. Adding a row here is the deliberate act the rule asks for.
const FILLED = {
  // 1 — it is the ON state of a pair.
  IconHeartOn: 'on-state',
  // 2 — the glyph names a PLACE rather than a job. Five of these are the drawing the tab
  // already had, because nothing outside the rail was using it; eight have a Nav twin
  // because their outline is still doing verb duty elsewhere.
  IconHome: 'place', IconRecords: 'place', IconImport: 'place', IconStats: 'place',
  IconSliders: 'place', IconNavLibrary: 'place', IconNavCatalogue: 'place',
  IconNavQuotes: 'place', IconNavAnthologies: 'place', IconNavTags: 'place',
  IconNavSearch: 'place', IconNavProfile: 'place', IconNavUsers: 'place',
  // The metadata console's own doors are places in the same sense the rail's are: its
  // sections have addresses, a rail of their own and counts beside them. IconNavMasks
  // is Characters and IconNavWorks is books-and-films; IconPerson and IconBooks keep
  // their outlines for the rows where a person or a book is the SUBJECT.
  IconNavMasks: 'place', IconNavWorks: 'place', IconNavSources: 'place',
  // The rail's two foot rows are destinations too — Checks is a place you go to
  // look things over, the Bin is a place things wait. IconDelete stays an OUTLINE
  // beside them, because that one is the verb on a row rather than a door.
  IconChecks: 'place', IconBin: 'place',
  // 3 — the subject is a silhouette in life. A mortarboard is recognised by its outer
  // shape; at 19px an outline turns that shape into a ring.
  IconPractise: 'silhouette',
  // A grip is six dots, and a dot is the one shape an outline destroys: at r=1.7
  // a stroked circle is a ring with a hole in it, which at 18px reads as noise
  // rather than as the six-dot handle everybody already recognises.
  IconGrip: 'silhouette',
  // 4 — the fill carries information: the palette's wells hold the category colours.
  IconPalette: 'carries-information',
  // The shelf marks are the ON state of a work: this one is underway. Same argument as
  // the heart, applied to three media rather than one.
  IconReading: 'on-state', IconWatching: 'on-state', IconPlaying: 'on-state',
  // The share sheet's five, and they are silhouettes for two different reasons that
  // land in the same place. WhatsApp and Reddit are SERVICE MARKS: a logo is its solid
  // shape, and a brand redrawn as an outline is no longer the brand — the same argument
  // `providerMarks.js` makes for every supplier mark in the app. The three file shapes
  // beside them are filled because they SIT beside those two: five options in one row
  // are five equals, and two solid marks next to three hollow ones would make the pair
  // look like a different kind of choice from the trio.
  //
  // They are also the only glyphs here authored outside the app, in a 1088 box with the
  // y axis flipped, and renormalising somebody's path data to fit the house grid is how
  // a curve quietly changes shape. See the note above ShareMark in ui.jsx.
  IconShareWhatsApp: 'silhouette', IconShareReddit: 'silhouette',
  IconSharePlain: 'silhouette', IconShareImage: 'silhouette', IconShareMarkdown: 'silhouette',
}
const REASONS = new Set(['on-state', 'place', 'silhouette', 'carries-information'])

const glyphs = Object.entries(ui)
  .filter(([n, v]) => /^Icon[A-Z]/.test(n) && typeof v === 'function' && n !== 'IconButton')

const isFilled = (Comp) => {
  const { container, unmount } = render(<Comp />)
  const svg = container.querySelector('svg')
  const filled = (svg.getAttribute('fill') || 'none') !== 'none'
  unmount()
  return filled
}

describe('the fill rule', () => {
  it('every solid glyph names one of the four reasons', () => {
    const undeclared = glyphs.filter(([n, C]) => isFilled(C) && !FILLED[n]).map(([n]) => n)
    expect(undeclared, 'a glyph filled without an argument for it').toEqual([])
  })

  it('and every declared reason is one of the four', () => {
    expect(Object.entries(FILLED).filter(([, r]) => !REASONS.has(r))).toEqual([])
  })

  it('a glyph that stops being filled is removed from the list', () => {
    // The other direction, and the one that rots quietly: a declaration outliving the
    // fill it excused turns the list into folklore.
    const stale = Object.keys(FILLED).filter((n) => ui[n] && !isFilled(ui[n]))
    expect(stale, 'declared as filled but drawn as an outline').toEqual([])
  })

  it('everything else is still drawn', () => {
    // The rule is that wireframe is the DEFAULT, so the count matters: if the exceptions
    // ever outnumbered the drawn glyphs, "the app is wireframe" would have stopped being
    // a description of it.
    const filled = glyphs.filter(([, C]) => isFilled(C)).length
    expect(filled).toBeLessThan(glyphs.length / 2)
  })
})

describe('the rail is filled all the way round', () => {
  // A rail where some tabs are solid and some are drawn teaches that the fill means
  // "this glyph happened to have a closed path" rather than "somewhere to go". Either
  // every destination wears it or the rule is not being applied.
  const tabs = [...new Set([
    ...CONTENT_TABS.map((t) => t[0]), ...UTILITY_TABS.map((t) => t[0]),
    ...DRAWER_TABS.filter(Boolean).map((t) => t[0]),
  ])].sort()

  it('every destination draws a solid glyph', () => {
    const drawn = []
    for (const tab of tabs) {
      const { container, unmount } = render(<ui.NavIcon name={tab} />)
      const svg = container.querySelector('svg')
      if (svg && (svg.getAttribute('fill') || 'none') === 'none') drawn.push(tab)
      unmount()
    }
    expect(drawn, 'a destination still wearing an outline').toEqual([])
  })
})
