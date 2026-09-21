// A NUMBER BESIDE A WORD HAS TO SAY WHAT IT COUNTS.
//
// "Works 44" is what a screen reader got off the metadata rail, and "Review 1" off
// Settings'; the phone's top bar repeated whichever one was open. The digit is all
// an EYE needs — it sits beside a word the reader has already read, in a colour
// that says whether it is a warning — and it is the whole of the fact to everything
// else. A comment in sectionRail.jsx claimed the opposite for months ("a screen
// reader still hears the whole sentence, because the count is labelled where it is
// rendered"), and it was labelled in neither place.
//
// THE NOUN GOES IN THE NAME, NOT INTO THE TEXT, on the control that has a name: an
// `sr-only` span is still `textContent`, which is how this repo's own tests and the
// journey tier's view of a screen read a tab. The first cut did exactly that and
// `settings-changed.test.jsx` went red on "Review1 changed" the same hour. The
// crumb is not a control and has no name of its own, so there the off-screen word
// IS the mechanism — which is why the two halves are guarded separately below.
//
// WHY A SOURCE SCANNER AND NOT A TEST. The rail's name is asserted for real in
// settings-changed.test.jsx, on a rendered screen. What that cannot reach is the
// shell: the crumb is drawn twice in App.jsx, once for a desk and once for a phone,
// and the pair has already drifted apart once in this file's history. This holds
// them together — two sites, one fact — which is what test/rules is for and is not
// a test of anything working.
//
// MUTATION-VERIFIED: drop `badgeWord` from either crumb site in App.jsx, or
// `aria-label={countedName(s)}` from either control in sectionRail.jsx, and the
// matching case goes red.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC
const APP = readFileSync(join(SRC, 'App.jsx'), 'utf8')
const RAIL = readFileSync(join(SRC, 'sectionRail.jsx'), 'utf8')

// Every element that draws the count plate in the top bar, whole.
const crumbBadges = () => [...APP.matchAll(/<span className="crumb-badge">[\s\S]*?<\/span>\s*(?:<\/span>)?/g)].map((m) => m[0])

describe('the number on a breadcrumb', () => {
  it('is drawn at both the sites this file has always had', () => {
    // A site renamed or deleted takes its guard with it, silently.
    expect(crumbBadges().length, 'App.jsx no longer draws two crumb badges — the desk and the phone').toBe(2)
  })

  it.each([0, 1])('site %i says what it counts', (i) => {
    expect(crumbBadges()[i], 'a crumb badge prints a bare figure — a screen reader gets a number with no noun')
      .toMatch(/badgeWord/)
  })
})

describe('the number on a section tab', () => {
  it('is drawn at both the sites this file has always had', () => {
    // The rail draws its rows twice: the phone's index of sections, and the tabs.
    const counts = [...RAIL.matchAll(/className=\{`meta-rail-count/g)]
    expect(counts.length, 'sectionRail.jsx no longer draws two counts — the phone index and the tab row').toBe(2)
  })

  it('names both controls that can carry one', () => {
    const named = [...RAIL.matchAll(/aria-label=\{countedName\(s\)\}/g)]
    expect(named.length, 'a control carrying a count has no name saying what the count is')
      .toBe(2)
  })

  it('puts the section word first, so the name still contains the label a reader sees', () => {
    // WCAG's Label in Name, and the practical half of it: every journey and every
    // probe in this repo presses by the words on the screen, so a name that did
    // not begin with the tab's own word would make "press Works" stop meaning
    // this tab.
    expect(RAIL, 'countedName no longer leads with the section label')
      .toMatch(/return `\$\{s\.label\}/)
  })
})
