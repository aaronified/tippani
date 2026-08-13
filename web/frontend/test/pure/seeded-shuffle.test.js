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

describe('the order it deals', () => {
  it('is a permutation — everything in, everything out, once', () => {
    const before = items(40)
    const after = shuffleSeeded(before, 12345)
    expect(after).toHaveLength(before.length)
    expect(new Set(keys(after)).size).toBe(before.length)
    expect([...keys(after)].sort()).toEqual([...keys(before)].sort())
  })

  it('does not reorder the array it was given', () => {
    // loadFavs builds its list and hands it over; a shuffle that sorted in place
    // would be a second, hidden order for anything else holding that array.
    const before = items(20)
    const snapshot = keys(before)
    shuffleSeeded(before, 7)
    expect(keys(before)).toEqual(snapshot)
  })

  it('actually shuffles, rather than handing the list back', () => {
    const before = items(40)
    expect(keys(shuffleSeeded(before, 99))).not.toEqual(keys(before))
  })

  it('deals a different wall for a different seed', () => {
    // Which is what makes arriving on Home worth doing twice.
    const before = items(40)
    expect(keys(shuffleSeeded(before, 1))).not.toEqual(keys(shuffleSeeded(before, 2)))
  })
})

describe('the order it holds', () => {
  it('is identical on a second call with the same seed', () => {
    // The reload an edit triggers. Same favourites, same seed, same wall.
    const before = items(40)
    expect(keys(shuffleSeeded(before, 5150))).toEqual(keys(shuffleSeeded(before, 5150)))
  })

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

  it('survives a card arriving, and does not move the ones already there', () => {
    // Hearting something on another screen and coming back mid-visit.
    const before = items(40)
    const grown = [...before, { key: 'quote:41' }]
    const was = keys(shuffleSeeded(before, 808))
    const now = keys(shuffleSeeded(grown, 808))
    expect(now.filter((k) => k !== 'quote:41')).toEqual(was)
  })

  it('ignores the order the list arrived in', () => {
    // The three fetches resolve together but the merge order is not guaranteed to
    // be stable across reloads, and a rank that depended on it would reshuffle for
    // that reason alone.
    const before = items(40)
    expect(keys(shuffleSeeded([...before].reverse(), 606))).toEqual(keys(shuffleSeeded(before, 606)))
  })
})

describe('the edges', () => {
  it('handles an empty list and a single card', () => {
    expect(shuffleSeeded([], 3)).toEqual([])
    expect(keys(shuffleSeeded(items(1), 3))).toEqual(['quote:1'])
  })

  it('is deterministic even when two keys collide, so a tie never flaps', () => {
    // Two identical keys cannot be told apart by rank; the sort must still return
    // the same thing every time rather than whatever the engine's sort did.
    const dupes = [{ key: 'a' }, { key: 'a' }, { key: 'b' }]
    expect(keys(shuffleSeeded(dupes, 11))).toEqual(keys(shuffleSeeded(dupes, 11)))
  })

  it('takes a key accessor for lists that are not shaped like favourites', () => {
    const rows = [{ id: 3 }, { id: 1 }, { id: 2 }]
    const out = shuffleSeeded(rows, 21, (r) => `row:${r.id}`)
    expect(out.map((r) => r.id).sort()).toEqual([1, 2, 3])
  })

  it('spreads adjacent keys, so consecutive ids do not land in a block', () => {
    // FNV-1a before the draw. Seeding straight off a numeric id would put
    // quote:11 and quote:12 next to each other, which is a shuffle in name only.
    const out = keys(shuffleSeeded(items(50), 31337))
    let adjacent = 0
    for (let i = 1; i < out.length; i++) {
      const a = Number(out[i - 1].split(':')[1])
      const b = Number(out[i].split(':')[1])
      if (Math.abs(a - b) === 1) adjacent++
    }
    expect(adjacent).toBeLessThan(8)
  })
})
