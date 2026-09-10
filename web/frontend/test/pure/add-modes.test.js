// The first question the add surface asks, and what each answer can reach.
//
// THE OWNER'S CORRECTION: "now i cannot choose if i want to add a work, a board
// for quote, an anthology, a quote, or import stuff. that should be the first
// screen. if a work/board/anthology is chosen, i will also need to select the
// work/board/anthology there."
//
// The bug this table guards against is a mode that leads nowhere — a door on the
// first screen that opens onto an empty panel. That cannot be seen by reading the
// chooser, because the chooser only knows the list; it needs the mapping.
import { describe, expect, it } from 'vitest'
import { ADD_MODES, doorsFor, modeIsHeld, modeNeedsTarget, soleDoor } from '../../src/addModes.js'
import { QUOTE_KIND_DOORS } from '../../src/addFields.js'

describe('the five modes', () => {
  it('are the five the owner named, in the order they were named', () => {
    expect(ADD_MODES).toEqual(['work', 'board', 'anthology', 'quote', 'import'])
  })

  // EVERY MODE MUST GO SOMEWHERE. A mode reaches a form, or it is held with a
  // reason, or it owns its own surface — and a mode that is none of those three is
  // a button that opens nothing.
  it('and every one of them leads somewhere', () => {
    for (const mode of ADD_MODES) {
      const reaches = doorsFor(mode, { type: 'book' }).length > 0 || modeIsHeld(mode) || mode === 'import'
      expect(reaches, `${mode} opens onto nothing`).toBe(true)
    }
  })
})

describe('which modes must name something first', () => {
  // A highlight belongs to a book and a proverb sits on a board, so the form
  // cannot open until the reader has said which one.
  it('a work and a board do', () => {
    expect(modeNeedsTarget('work')).toBe(true)
    expect(modeNeedsTarget('board')).toBe(true)
  })

  // A standalone quote's board is a field ON its form, where the owner put it, so
  // there is nothing to name up front. Import has nothing to name at all.
  it('and a quote, an anthology and import do not', () => {
    for (const mode of ['quote', 'anthology', 'import']) {
      expect(modeNeedsTarget(mode), mode).toBe(false)
    }
  })
})

describe('what a settled mode reaches', () => {
  // NAMING THE BOOK IS CHOOSING THE FORM. A book reaches exactly one, so the
  // reader is not asked a second question — the half of the old design worth
  // keeping, expressed as a list of length one rather than a special case.
  it('a book reaches the highlight form and nothing else', () => {
    expect(doorsFor('work', { type: 'book' })).toEqual(['annotation'])
    expect(soleDoor('work', { type: 'book' })).toBe('annotation')
  })

  // A game and a show are `movies` rows like a film (0040), so all three reach the
  // one dialogue form and the medium picks the locator inside it.
  it('a film, a show and a game all reach the line form', () => {
    for (const target of [{ type: 'movie' }, { type: 'movie', media_type: 'show' }, { type: 'movie', media_type: 'game' }, { kind: 'screen' }]) {
      expect(doorsFor('work', target)).toEqual(['dialogue'])
    }
  })

  // 0037 gives a board two kinds and argues against a third; exactly one of them
  // has behaviour behind it.
  it('a proverb board knows its kind, and a plain board asks', () => {
    expect(doorsFor('board', { kind: 'proverb' })).toEqual(['proverb'])
    expect(soleDoor('board', { kind: 'proverb' })).toBe('proverb')
    expect(doorsFor('board', { kind: 'plain' })).toEqual(QUOTE_KIND_DOORS)
    expect(soleDoor('board', { kind: 'plain' })).toBeNull()
  })

  it('a standalone quote reaches all seven kinds', () => {
    expect(doorsFor('quote')).toEqual(QUOTE_KIND_DOORS)
    expect(soleDoor('quote')).toBeNull()
  })

  // Named rather than left to fall through: an unnamed container reaches nothing,
  // which is what keeps the chooser from advancing before the reader has answered.
  it('and nothing at all until the container is named', () => {
    expect(doorsFor('work', null)).toEqual([])
    expect(doorsFor('board', null)).toEqual([])
    expect(soleDoor('work', null)).toBeNull()
  })

  it('and import and a held anthology draw no quote form', () => {
    expect(doorsFor('import')).toEqual([])
    expect(doorsFor('anthology')).toEqual([])
    expect(modeIsHeld('anthology')).toBe(true)
    expect(modeIsHeld('import')).toBe(false)
  })
})

// A RETURNED ARRAY MUST NOT BE THE TABLE'S OWN. `QUOTE_KIND_DOORS` is a
// module-level constant several screens read; handing it out unspread would let a
// caller that sorted or spliced its result reorder the chooser for everybody.
it('hands back a copy, not the shared list', () => {
  const got = doorsFor('quote')
  got.push('nonsense')
  expect(doorsFor('quote')).not.toContain('nonsense')
})
