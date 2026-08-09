// The Settings page's fixed tile layout.
//
// Settings used to lay its cards out with the height-packing Masonry, which
// places them tallest-first onto the shortest column. Two cards on that page
// change height after they load — Updates when a check finds a release, Backup
// when an archive exists — so the page rearranged itself under you. On a phone,
// where there is only one column and the columns therefore cannot change, the
// tallest-first ORDER still could: you tapped "check for updates", the answer
// arrived, and the card moved somewhere else while you were reading it.
//
// The layout is written down now instead of measured. These tests exist because
// a hand-maintained layout has exactly one failure mode: someone adds a card and
// forgets a column.

import { describe, expect, it } from 'vitest'
import { SETTINGS_CARDS, SETTINGS_LAYOUT, settingsColumns } from '../../src/Settings.jsx'

const WIDTHS = [1, 2, 3]
const flat = (n) => SETTINGS_LAYOUT[n].flat()

describe('SETTINGS_LAYOUT', () => {
  it('offers a layout for every column count useColumnCount can return', () => {
    // useColumnCount returns 1 (mobile / narrow), 2 (>=768) or 3 (>=1280).
    for (const n of WIDTHS) expect(SETTINGS_LAYOUT[n], String(n)).toBeTruthy()
  })

  it('gives each layout as many columns as its name says', () => {
    for (const n of WIDTHS) expect(SETTINGS_LAYOUT[n], String(n)).toHaveLength(n)
  })

  it('places every card, at every width', () => {
    // The render walks the layout, not the card list, so a card missing from a
    // layout does not move — it does not appear at all.
    for (const n of WIDTHS) {
      expect([...flat(n)].sort(), String(n)).toEqual([...SETTINGS_CARDS].sort())
    }
  })

  it('places no card twice', () => {
    for (const n of WIDTHS) {
      const keys = flat(n)
      expect(new Set(keys).size, String(n)).toBe(keys.length)
    }
  })

  it('introduces no card the canonical list does not know', () => {
    const known = new Set(SETTINGS_CARDS)
    for (const n of WIDTHS) {
      for (const k of flat(n)) expect(known.has(k), `${n}: ${k}`).toBe(true)
    }
  })

  it('shows the single column in the canonical order', () => {
    expect(SETTINGS_LAYOUT[1][0]).toEqual(SETTINGS_CARDS)
  })

  it('keeps colours directly under metadata, in every layout', () => {
    // Not decoration. Both cards answer "what is this thing labelled with" —
    // where a work's facts come from, and what the colour on a highlight is
    // called — so one column reads as one subject. Nothing enforces that but
    // this: a later card added to the wrong slot separates them and the page
    // still renders perfectly.
    for (const n of WIDTHS) {
      const col = SETTINGS_LAYOUT[n].find((c) => c.includes('meta'))
      expect(col, `${n}: no column holds meta`).toBeTruthy()
      expect(col[col.indexOf('meta') + 1], `${n} columns`).toBe('colors')
    }
  })
})

describe('settingsColumns', () => {
  const ALL = SETTINGS_CARDS
  const NON_ADMIN = ALL.filter((k) => k !== 'upd' && k !== 'backup')

  it('returns one array per column', () => {
    for (const n of WIDTHS) expect(settingsColumns(n, ALL), String(n)).toHaveLength(n)
  })

  it('keeps every card an admin has', () => {
    for (const n of WIDTHS) {
      expect(settingsColumns(n, ALL).flat().sort(), String(n)).toEqual([...ALL].sort())
    }
  })

  it('drops the cards a non-admin does not have', () => {
    for (const n of WIDTHS) {
      const shown = settingsColumns(n, NON_ADMIN).flat()
      expect(shown, String(n)).not.toContain('upd')
      expect(shown, String(n)).not.toContain('backup')
      expect(shown.sort(), String(n)).toEqual([...NON_ADMIN].sort())
    }
  })

  it('leaves the other cards exactly where they were', () => {
    // The point of the whole change: losing a card must not slide the rest
    // around. Every card a non-admin does have keeps its column index.
    for (const n of WIDTHS) {
      const admin = settingsColumns(n, ALL)
      const plain = settingsColumns(n, NON_ADMIN)
      for (const key of NON_ADMIN) {
        const a = admin.findIndex((col) => col.includes(key))
        const p = plain.findIndex((col) => col.includes(key))
        expect(p, `${key} at ${n} columns`).toBe(a)
      }
    }
  })

  it('falls back to the single column for an unknown count', () => {
    // useColumnCount is capped at 3 today; a wide-mode change could raise it,
    // and a screen with no cards at all is worse than a narrow one.
    expect(settingsColumns(4, ALL)).toHaveLength(1)
    expect(settingsColumns(4, ALL).flat()).toEqual(SETTINGS_CARDS)
  })

  it('ignores a key that is not in the layout', () => {
    const cols = settingsColumns(2, [...ALL, 'not-a-card'])
    expect(cols.flat()).not.toContain('not-a-card')
  })
})
