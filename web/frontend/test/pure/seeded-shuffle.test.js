// A wall that reorders when you arrive and holds still while you work.
//
// Home's favourites are shuffled on purpose — the section is a re-surfacing wall,
// not a feed. They were shuffled with Fisher–Yates on every LOAD, and every
// in-place edit reloads them, so recolouring one quote redealt the whole wall:
// the four tiles on screen became four different tiles and the card you had just
// acted on was gone. That reads as the app losing the change.
//
// "Shuffle less often" only moves the problem to whichever reload is left. The
// property that actually fixes it is the one asserted here: A CARD'S POSITION
// DEPENDS ONLY ON THE SEED AND ITS OWN KEY. Nothing about the rest of the list can
// move it — which is precisely what a walk-the-list shuffle cannot promise, since
// dropping one member changes the permutation entirely.

import { describe, expect, it } from 'vitest'
import { shuffleSeeded } from '../../src/ui.jsx'

const items = (n) => Array.from({ length: n }, (_, i) => ({ key: `quote:${i + 1}` }))
const keys = (list) => list.map((x) => x.key)

describe('the order it holds', () => {
  it('survives a card leaving — everything else stays in the same relative order', () => {
    // THE ONE FISHER–YATES CANNOT DO, and the reason this is a per-item rank.
    // Un-hearting a favourite removes it from the next load's list; every other
    // tile must stay where the reader last saw it.
    const before = items(40)
    const full = keys(shuffleSeeded(before, 4242))
    const gone = full[7]
    const rest = keys(shuffleSeeded(before.filter((x) => x.key !== gone), 4242))
    expect(rest).toEqual(full.filter((k) => k !== gone))
  })
})
