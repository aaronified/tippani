// WHICH SECTION EACH SETTINGS CARD IS ON.
//
// WHAT THIS FILE USED TO BE, because the change is the point. Settings was one
// long page and this suite held a per-column-count layout table in agreement with
// the card list — the question being which of nine cards a reader scrolled past
// first. The page is five named sections now, so the packing question is gone and
// the one that replaced it is "is every card reachable at all": a card registered
// but placed on no section is a control nobody can find, and it fails silently
// because the section that would have drawn it simply draws one fewer.
import { describe, expect, it } from 'vitest'

import { SECTION_CARDS, SETTINGS_CARDS, SETTINGS_SECTIONS, sectionOfCard } from '../../src/Settings.jsx'

const PLACED = Object.values(SECTION_CARDS).flat()

describe('every card has a section, and every section is real', () => {
  it('places every registered card', () => {
    for (const key of SETTINGS_CARDS) {
      expect(sectionOfCard(key), `${key} is registered but on no section`).toBeTruthy()
    }
  })

  // The other direction, which is the one that rots quietly: a section naming a
  // card that no longer exists draws nothing and says nothing. 'appearance' and
  // 'language' are the two halves of the Appearance card, which takes a `part`
  // rather than being split into two components, so they are placed here without
  // being in SETTINGS_CARDS.
  it('names no card that nothing builds', () => {
    const known = new Set([...SETTINGS_CARDS, 'appearance', 'language'])
    for (const key of PLACED) {
      expect(known.has(key), `${key} is placed on a section but nothing builds it`).toBe(true)
    }
  })

  it('places no card twice', () => {
    expect(new Set(PLACED).size).toBe(PLACED.length)
  })

  it('gives every section in the rail something to draw', () => {
    for (const [id] of SETTINGS_SECTIONS) {
      expect((SECTION_CARDS[id] || []).length, `${id} is a door to an empty room`).toBeGreaterThan(0)
    }
  })

  // COLOURS LEFT THIS PAGE ALTOGETHER. What KIND of note a quote is is a fact
  // about the library rather than a preference about the app, so the card is a
  // section of the Metadata console now — the same move the language table and
  // the tags made. Asserted here because a stale entry would place a card this
  // file no longer builds.
  it('no longer claims the colour categories', () => {
    expect(SETTINGS_CARDS).not.toContain('colors')
    expect(PLACED).not.toContain('colors')
  })
})
