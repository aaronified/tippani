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
  it('gives each layout as many columns as its name says', () => {
    // useColumnCount returns 1 (mobile / narrow), 2 (>=768) or 3 (>=1280).
    // toHaveLength throws on a missing layout, so this is also the check that
    // one exists for every count useColumnCount can return.
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

  it('shows the single column in the canonical order', () => {
    expect(SETTINGS_LAYOUT[1][0]).toEqual(SETTINGS_CARDS)
  })

  it('does not lay out a metadata card, because there is not one any more', () => {
    // The card moved to the Metadata screen's Sources section, where the keys sit
    // beside the works they fetch for. A key left in a layout for a card that no
    // longer exists renders nothing and fails nothing — the render walks the
    // layout, so the gap is invisible until somebody counts columns.
    expect(SETTINGS_CARDS).not.toContain('meta')
    for (const n of WIDTHS) expect(flat(n), String(n)).not.toContain('meta')
  })

  it('leads a column with colours, which used to be the second half of a pair', () => {
    // Not decoration, and it is what is LEFT of a rule rather than the rule. The
    // pairing existed because both cards answered "what is this thing labelled
    // with"; with the other half gone, what survives is that Colours is a heading
    // a reader scans for, so it starts a column rather than sitting under one.
    for (const n of WIDTHS) {
      const col = SETTINGS_LAYOUT[n].find((c) => c.includes('colors'))
      expect(col, `${n}: no column holds colors`).toBeTruthy()
      if (n > 1) expect(col[0], `${n} columns`).toBe('colors')
    }
  })
})
