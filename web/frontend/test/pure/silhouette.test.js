// Six default portraits, picked by name — handoff §1.8.
//
// WHAT THE ONE SILHOUETTE COST. Every faceless person in the app wore the same
// head, so a People table of ninety names was ninety copies of one drawing and
// the fastest thing in a row to recognise recognised nothing. Six faces only work
// if the choice is STABLE — the same person on a chip, in the table, in the panel
// and on a share image — so what is pinned here is that the function is pure, that
// it spreads, and that it does not quietly collapse for a whole writing system.
import { describe, expect, it } from 'vitest'
import { SILHOUETTE_COUNT, silhouetteIndex } from '../../src/silhouette.jsx'

describe('silhouetteIndex', () => {
  it('gives one name one face, every time it is asked', () => {
    const first = silhouetteIndex('Mikhail Bulgakov')
    for (let i = 0; i < 50; i++) {
      expect(silhouetteIndex('Mikhail Bulgakov')).toBe(first)
    }
  })

  it('ignores the case and the padding a name arrives with', () => {
    const want = silhouetteIndex('Mikhail Bulgakov')
    expect(silhouetteIndex('  mikhail bulgakov ')).toBe(want)
    expect(silhouetteIndex('MIKHAIL BULGAKOV')).toBe(want)
  })

  it('answers inside the range, for anything at all', () => {
    for (const n of ['', null, undefined, '   ', '๛', '🙂', 'a'.repeat(500)]) {
      const i = silhouetteIndex(n)
      expect(Number.isInteger(i)).toBe(true)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(SILHOUETTE_COUNT)
    }
  })

  // The point of six is that a list looks like six. A run of names that all landed
  // on face 0 would pass every test above and fail the only thing this is for.
  it('uses all six across a shelf of names', () => {
    const names = [
      'Mikhail Bulgakov', 'Ursula K. Le Guin', 'Italo Calvino', 'Toni Morrison',
      'Jorge Luis Borges', 'Marguerite Yourcenar', 'Anton Chekhov', 'Zadie Smith',
      'Haruki Murakami', 'Clarice Lispector', 'James Baldwin', 'Elena Ferrante',
      'Vladimir Nabokov', 'Doris Lessing', 'Kazuo Ishiguro', 'Octavia Butler',
      'Fyodor Dostoevsky', 'Iris Murdoch', 'Gabriel García Márquez', 'Han Kang',
    ]
    const seen = new Set(names.map(silhouetteIndex))
    expect(seen.size).toBe(SILHOUETTE_COUNT)
  })

  // THE TRAP THIS FILE EXISTS TO KEEP SHUT. `normName` — the app's own name fold,
  // and the obvious thing to hash — strips everything outside [a-z0-9], so every
  // Bengali name folds to the empty string. Hashing it would put the whole of a
  // bilingual library on one face while the English half looked fine.
  it('spreads Bengali names as well as Latin ones', () => {
    const names = [
      'রবীন্দ্রনাথ ঠাকুর', 'কাজী নজরুল ইসলাম', 'জীবনানন্দ দাশ', 'মানিক বন্দ্যোপাধ্যায়',
      'সত্যজিৎ রায়', 'আশাপূর্ণা দেবী', 'বিভূতিভূষণ বন্দ্যোপাধ্যায়', 'মহাশ্বেতা দেবী',
      'শরৎচন্দ্র চট্টোপাধ্যায়', 'সুকুমার রায়', 'হুমায়ূন আহমেদ', 'তসলিমা নাসরিন',
    ]
    const seen = new Set(names.map(silhouetteIndex))
    expect(seen.size).toBeGreaterThanOrEqual(4)
  })
})
