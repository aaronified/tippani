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
    expect(withShortcut('Got it', 'grade-got')).toBe('Got it · 2')
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
    expect(matchShortcut('n')).toEqual({ id: 'capture' })
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

// ---- the legends ---------------------------------------------------------
//
// A LEGEND MAINTAINED BY HAND IS A LEGEND THAT IS WRONG BY THE SECOND RELEASE.
// The sheet, the drawer rows and the quiz buttons all read the registry rather
// than repeating it, and these are the assertions that keep that true — a
// hand-written list of keys in a component would pass every other test in this
// file while telling the reader something the app no longer does.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const read = (f) => readFileSync(join(SRC, f), 'utf8')

describe('the shortcut sheet', () => {
  const ui = read('ui.jsx')

  it('is built from the registry, not from a list of its own', () => {
    expect(ui).toMatch(/function ShortcutSheet\(/)
    expect(ui).toMatch(/groupedShortcuts\(\)/)
  })

  // Every key cap in the app goes through one component, so a sequence renders
  // as two caps and a joining word everywhere rather than in whichever places
  // somebody remembered.
  it('draws its caps with the shared Kbd', () => {
    expect(ui).toMatch(/export function Kbd\(/)
    expect(ui).toMatch(/<Kbd keys=/)
  })
})

describe('legends sit on the controls that share the job', () => {
  it('on the drawer’s destinations', () => {
    const app = read('App.jsx')
    expect(app).toMatch(/DRAWER_SHORTCUTS/)
    expect(app).toMatch(/<Kbd keys=\{shortcutFor\(DRAWER_SHORTCUTS\[t\[0\]\]\)\}/)
    // Every destination it maps must be a real action, or the row renders a
    // blank cap and teaches nothing.
    const ids = [...app.matchAll(/^\s+\w+: '([a-z-]+)',$/gm)].map((m) => m[1])
    const known = new Set(SHORTCUTS.map((s) => s.id))
    for (const id of ids.filter((x) => known.has(x) || x.startsWith('go-'))) {
      expect(known.has(id), `${id} is not a registered action`).toBe(true)
    }
  })

  it('and on the quiz’s own buttons', () => {
    const review = read('review.jsx')
    for (const id of ['grade-forgot', 'grade-got', 'reveal']) {
      expect(review, id).toContain(`shortcutFor('${id}')`)
    }
  })
})

// EVERY LISTED KEY IS ACTUALLY WIRED. The table feeds the tooltips and the
// sheet, so an entry is a PROMISE printed on a button — and the first draft of
// it bound a command palette, j/k, f, e and u with no handler behind any of
// them. This is the assertion that stops that coming back.
describe('nothing is listed that does not work', () => {
  it('every action is dispatched by the shell or by the quiz', () => {
    const wired = read('App.jsx') + read('review.jsx')
    for (const s of SHORTCUTS) {
      expect(wired.includes(`'${s.id}'`), `${s.id} is in the table with no handler`).toBe(true)
    }
  })
})
