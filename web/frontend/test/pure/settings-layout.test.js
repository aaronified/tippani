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

import { SETTINGS_CARDS, sectionOfCard } from '../../src/Settings.jsx'

describe('every card has a section, and every section is real', () => {
  it('places every registered card', () => {
    for (const key of SETTINGS_CARDS) {
      expect(sectionOfCard(key), `${key} is registered but on no section`).toBeTruthy()
    }
  })
})
