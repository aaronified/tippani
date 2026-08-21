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
  // the finder reaches first — a coin toss dressed as a feature. Uniqueness is
  // PER CONTEXT, because that is the identity of a binding now: `1` is the first
  // MCQ answer and `Forgot` on a flip card, and the two never share a screen.
  it('and no key bound to two actions in the same context', () => {
    const byCtx = {}
    for (const s of SHORTCUTS) {
      const k = s.ctx || 'global'
      byCtx[k] = byCtx[k] || []
      byCtx[k].push(...(s.keys || []), ...(s.seq ? [s.seq.join('+')] : []))
    }
    for (const [ctx, combos] of Object.entries(byCtx)) {
      expect(new Set(combos).size, `${ctx} binds a key twice`).toBe(combos.length)
    }
  })

  // A context binding must never collide with a GLOBAL one: the global is live
  // on every screen, so the two would both be live together and the card would
  // win or lose depending on table order.
  it('and no context key that shadows a global one', () => {
    const global = new Set(SHORTCUTS.filter((s) => !s.ctx).flatMap((s) => s.keys || []))
    for (const s of SHORTCUTS.filter((x) => x.ctx)) {
      for (const k of s.keys || []) {
        expect(global.has(k), `${k} is both global and ${s.ctx}`).toBe(false)
      }
    }
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
    expect(matchShortcut('/')).toEqual({ id: 'search', shift: false })
    expect(matchShortcut('n')).toEqual({ id: 'capture', shift: false })
  })

  it('and waits for the second key of a sequence', () => {
    expect(matchShortcut('g')).toEqual({ pending: 'g' })
    expect(matchShortcut('l', 'g')).toEqual({ id: 'go-library', shift: false })
    expect(matchShortcut(',', 'g')).toEqual({ id: 'go-settings', shift: false })
    // A prefix followed by nothing meaningful is simply not a shortcut — it must
    // not fall through to whatever the second key would have done alone.
    expect(matchShortcut('z', 'g')).toBeNull()
  })

  // THE CARD DECIDES WHAT A KEY MEANS. Binding 1 globally to "Forgot" would mean
  // pressing it on a four-option question graded the card instead of answering
  // it — a keystroke that silently marks you wrong.
  it('and answers according to the card on screen', () => {
    expect(matchShortcut('1', '', 'mcq')).toEqual({ id: 'pick-1', shift: false })
    expect(matchShortcut('1', '', 'flip')).toEqual({ id: 'grade-forgot', shift: false })
    expect(matchShortcut('space', '', 'flip')).toEqual({ id: 'reveal', shift: false })
    expect(matchShortcut('space', '', 'cloze')).toEqual({ id: 'focus-blank', shift: false })
    // Outside a quiz none of them exist.
    expect(matchShortcut('1')).toBeNull()
    expect(matchShortcut('space')).toBeNull()
    // And a card cannot answer for a different card's key.
    expect(matchShortcut('3', '', 'flip')).toBeNull()
  })

  // Practice and the Daily Quiz show the same card with the same buttons, and
  // they are not the same act: the daily deck IS the schedule. Shift is the one
  // deliberate finger between reflex and a permanent grade.
  it('and reports Shift so the two decks can differ', () => {
    expect(matchShortcut('shift+1', '', 'mcq')).toEqual({ id: 'pick-1', shift: true })
    expect(matchShortcut('shift+space', '', 'flip')).toEqual({ id: 'reveal', shift: true })
    // Shift only ever qualifies a card binding; it does not invent global ones.
    expect(matchShortcut('shift+n')).toBeNull()
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
    expect(matchShortcut('?')).toEqual({ id: 'help', shift: false })
    expect(matchShortcut('/')).toEqual({ id: 'search', shift: false })
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

  // THE HEADING WAS THE KEY ITSELF, and for as long as the sheet existed. `label`
  // went through t() on its way out of here and `group` did not, so pressing ?
  // showed five headings reading `shell.shortcut.group.anywhere.label`,
  // `…go-to.label` and so on — in English and in Bengali alike.
  //
  // It survived because locale-complete.test.js cannot see it. That file asks
  // whether every key the code names exists and whether every key in the file is
  // named, and `shell.shortcut.group.anywhere.label` passes both: it is right
  // there in keys.js as a literal. What no scan of the source can tell is whether
  // the value ever reached t(). Its own header says so. This is that assertion,
  // made where the answer is a value rather than a grep.
  it('resolves the heading, and does not hand out the key', () => {
    const KEYSHAPE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/
    for (const g of groupedShortcuts()) {
      expect(KEYSHAPE.test(g.group), `heading is an unresolved key: ${g.group}`).toBe(false)
      // The key is still exposed, deliberately — React needs a stable identity
      // that does not move when the language does.
      expect(KEYSHAPE.test(g.key), `${g.key} should be the locale key`).toBe(true)
      for (const i of g.items) {
        expect(KEYSHAPE.test(i.label), `label is an unresolved key: ${i.label}`).toBe(false)
      }
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
    // `row[0]`, not `t[0]`: the drawer's map callback used to bind `t`, and a local
    // `t` shadows the imported resolver silently (see locale-shadow.test.js). The
    // fix was always going to be renaming the local, and this is the line that
    // knows what it was renamed to.
    expect(app).toMatch(/<Kbd keys=\{shortcutFor\(DRAWER_SHORTCUTS\[row\[0\]\]\)\}/)
    // Every destination it maps must be a real action, or the row renders a
    // blank cap and teaches nothing.
    const ids = [...app.matchAll(/^\s+\w+: '([a-z-]+)',$/gm)].map((m) => m[1])
    const known = new Set(SHORTCUTS.map((s) => s.id))
    for (const id of ids.filter((x) => known.has(x) || x.startsWith('go-'))) {
      expect(known.has(id), `${id} is not a registered action`).toBe(true)
    }
  })

  it('and on the quiz’s own buttons, in the mode’s own form', () => {
    const review = read('review.jsx')
    for (const id of ['grade-forgot', 'grade-got', 'reveal', 'focus-blank']) {
      // The second argument is the mode: a legend that always printed the daily
      // key would be wrong for half the app.
      expect(review, id).toContain("shortcutFor('" + id + "', mode === 'practice')")
    }
    // And the MCQ options number themselves from the same table.
    expect(review).toMatch(/shortcutFor\(`pick-\$\{idx \+ 1\}`, mode === 'practice'\)/)
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
      // A FAMILY COUNTS AS WIRED. pick-1..4 are dispatched by prefix rather than
      // by four identical cases, which is the right code and would otherwise
      // fail a test looking only for literals.
      const family = s.id.replace(/-\d+$/, '-')
      const ok = wired.includes(`'${s.id}'`) || wired.includes(`'${family}'`)
      expect(ok, `${s.id} is in the table with no handler`).toBe(true)
    }
  })
})

// ---- the legend and a section the reader has put away ----
//
// Settings -> Features hides a whole section, and the sheet is generated from this
// table precisely so it cannot fall behind it. That is the right property and it
// has one consequence nobody wanted: a reader who has hidden the Catalogue would
// still be shown "G then C - Go to Catalogue", beside a strip with no Catalogue in
// it. So the sheet can be asked to leave rows out.
//
// The asymmetry is deliberate and is the thing to keep straight: the BINDING stays.
// Hiding is cosmetic, and G-then-C is the URL typed, so the key still works. This
// file's rule is that nothing may be LISTED that does not work; a key that works
// and is not listed breaks no promise.
describe('the legend can leave out a door that is not on screen', () => {
  const idsOf = (groups) => groups.flatMap((g) => g.items.map((i) => i.id))

  it('drops exactly the rows it is asked for, and keeps the rest in order', () => {
    const all = idsOf(groupedShortcuts())
    const some = idsOf(groupedShortcuts(new Set(['go-catalogue', 'go-quotes'])))
    expect(all).toContain('go-catalogue')
    expect(some).not.toContain('go-catalogue')
    expect(some).not.toContain('go-quotes')
    // Asserted as the whole remaining list rather than as a count: "two fewer" is
    // just as true when the two are the wrong two.
    expect(some).toEqual(all.filter((id) => id !== 'go-catalogue' && id !== 'go-quotes'))
  })

  it('leaves the binding itself working', () => {
    expect(SHORTCUTS.some((s) => s.id === 'go-catalogue')).toBe(true)
    expect(shortcutFor('go-catalogue')).toBe('G then C')
    expect(matchShortcut('c', 'g')).toEqual({ id: 'go-catalogue', shift: false })
  })

  it('is a no-op for every caller that asks for nothing', () => {
    expect(groupedShortcuts(undefined)).toEqual(groupedShortcuts())
    expect(groupedShortcuts(new Set())).toEqual(groupedShortcuts())
  })

  it('takes the heading with the last row under it', () => {
    // A group is built when its first surviving row arrives, so emptying one leaves
    // no heading behind. Nothing can empty the go-to group today - Home, Stats,
    // Metadata, your profile and Settings are all unhideable - but a bare heading
    // over nothing is the kind of thing a later section would introduce silently.
    //
    // MATCHED ON THE KEY. This read `s.group === 'Go to'` and passed for the wrong
    // reason for as long as the i18n migration has existed: `group` became a locale
    // key, the filter matched nothing, `gone` was empty, and the assertion that a
    // heading had DISAPPEARED was satisfied by a heading that had never been asked
    // to go. It only went red when the heading started resolving to real words.
    const GO_TO = 'shell.shortcut.group.go-to.label'
    const gone = new Set(SHORTCUTS.filter((s) => s.group === GO_TO).map((s) => s.id))
    expect(gone.size, 'the go-to group has rows to remove').toBeGreaterThan(1)
    expect(groupedShortcuts(gone).some((g) => g.key === GO_TO)).toBe(false)
  })
})
