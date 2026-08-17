// The shortcut registry.
//
// THE INVARIANT THE OWNER ASKED FOR, in their words: shortcuts "should be
// intuitive and must always be spelled out in the corresponding button's
// tooltip". Both halves are testable and both are here — a binding that no
// tooltip can render is a shortcut only its author knows about, and that is the
// state this feature replaces rather than the state it should reach.

import { describe, expect, it } from 'vitest'
import {
  SHORTCUTS,
  eventCombo,
  groupedShortcuts,
  isTypingTarget,
  matchShortcut,
  shortcutFor,
  shortcutLabel,
  withShortcut,
} from '../../src/keys.js'

describe('every binding can be spelled out', () => {
  it('renders a key cap for each one', () => {
    for (const s of SHORTCUTS) {
      expect(shortcutLabel(s), s.id).toBeTruthy()
    }
  })

  it('and a tooltip can ask for it by action id', () => {
    for (const s of SHORTCUTS) {
      expect(shortcutFor(s.id), s.id).toBe(shortcutLabel(s))
    }
  })

  // The join every control uses. A middle dot rather than brackets, because the
  // bubble already joins facts about a control with a dot everywhere else and
  // brackets read as optional.
  it('appending it to a label', () => {
    expect(withShortcut('Search', 'search')).toBe('Search · /')
    expect(withShortcut('Favourite', 'favourite')).toBe('Favourite · F')
  })

  // An action with no binding must pass through unchanged, or every existing
  // Tooltip would have to know whether it has one.
  it('and leaving a label alone when there is no binding', () => {
    expect(withShortcut('Export', 'export-markdown')).toBe('Export')
    expect(withShortcut('Export', undefined)).toBe('Export')
  })

  it('with no id used twice', () => {
    const ids = SHORTCUTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // Two actions on one key is a shortcut whose behaviour depends on which entry
  // the finder reaches first — which is a coin toss dressed as a feature.
  it('and no key bound to two actions', () => {
    const combos = SHORTCUTS.flatMap((s) => s.keys || [])
    expect(new Set(combos).size).toBe(combos.length)
    const seqs = SHORTCUTS.filter((s) => s.seq).map((s) => s.seq.join('+'))
    expect(new Set(seqs).size).toBe(seqs.length)
  })

  // A single key must not also be the first key of a sequence: pressing it would
  // have to either fire immediately or wait to find out, and both are wrong.
  it('and no single key that also starts a sequence', () => {
    const singles = new Set(SHORTCUTS.flatMap((s) => s.keys || []))
    for (const s of SHORTCUTS.filter((x) => x.seq)) {
      expect(singles.has(s.seq[0]), `${s.seq[0]} is both a shortcut and a prefix`).toBe(false)
    }
  })
})

describe('matching a key press', () => {
  it('finds a direct binding', () => {
    expect(matchShortcut('/')).toEqual({ id: 'search' })
    expect(matchShortcut('mod+k')).toEqual({ id: 'palette' })
    expect(matchShortcut('2')).toEqual({ id: 'grade-got' })
  })

  it('and waits for the second key of a sequence', () => {
    expect(matchShortcut('g')).toEqual({ pending: 'g' })
    expect(matchShortcut('l', 'g')).toEqual({ id: 'go-library' })
    // A prefix followed by nothing meaningful is simply not a shortcut — it must
    // not fall through to whatever the second key would have done alone.
    expect(matchShortcut('z', 'g')).toBeNull()
  })

  it('and answers nothing for an unbound key', () => {
    expect(matchShortcut('q')).toBeNull()
    expect(matchShortcut('')).toBeNull()
  })
})

describe('reading a keydown', () => {
  it('normalises the modifier, space and escape', () => {
    expect(eventCombo({ key: 'k', metaKey: true })).toBe('mod+k')
    expect(eventCombo({ key: 'k', ctrlKey: true })).toBe('mod+k')
    expect(eventCombo({ key: ' ' })).toBe('space')
    expect(eventCombo({ key: 'Escape' })).toBe('esc')
    expect(eventCombo({ key: 'F' })).toBe('f')
  })

  // `?` is Shift-/ on most layouts and `/` is not. Folding Shift into the combo
  // would make the help sheet open when somebody meant to search.
  it('keeping ? and / apart', () => {
    expect(eventCombo({ key: '?', shiftKey: true })).toBe('?')
    expect(eventCombo({ key: '/' })).toBe('/')
    expect(matchShortcut('?')).toEqual({ id: 'help' })
    expect(matchShortcut('/')).toEqual({ id: 'search' })
  })
})

describe('typing is not a shortcut', () => {
  // `n` is "capture a quote" and it is also the fourteenth letter of a quote
  // somebody is typing into a note. This is the rule that decides whether the
  // whole feature is usable or infuriating.
  it('in an input, a textarea or a select', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(isTypingTarget({ tagName: tag }), tag).toBe(true)
    }
  })

  // contenteditable is what a rich-text field is, and checking only the three
  // tags above would miss it entirely.
  it('and anywhere contenteditable', () => {
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('the help sheet’s view', () => {
  it('buckets every binding under a heading, losing none', () => {
    const groups = groupedShortcuts()
    expect(groups.length).toBeGreaterThan(1)
    expect(groups.flatMap((g) => g.items).length).toBe(SHORTCUTS.length)
    for (const g of groups) {
      expect(g.group).toBeTruthy()
      for (const i of g.items) expect(i.keys).toBeTruthy()
    }
  })
})
