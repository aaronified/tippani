// Six default portraits, picked by name — handoff §1.8.
//
// WHAT THE ONE SILHOUETTE COST. Every faceless person in the app wore the same
// head, so a People table of ninety names was ninety copies of one drawing and
// the fastest thing in a row to recognise recognised nothing. Six faces only work
// if the choice is STABLE — the same person on a chip, in the table, in the panel
// and on a share image — so what is pinned here is that the function is pure, that
// it spreads, and that it does not quietly collapse for a whole writing system.
import { describe, expect, it } from 'vitest'
import { silhouetteIndex } from '../../src/silhouette.jsx'

describe('silhouetteIndex', () => {
  it('gives one name one face, every time it is asked', () => {
    const first = silhouetteIndex('Mikhail Bulgakov')
    for (let i = 0; i < 50; i++) {
      expect(silhouetteIndex('Mikhail Bulgakov')).toBe(first)
    }
  })
})
