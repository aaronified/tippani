import { t } from './i18n.js'

// keys.js — the shortcut registry, and the one place a key is bound to a name.
//
// There was no global registry at all, which for a text app with a large library
// is the biggest single desktop gap. Escape-to-close was implemented consistently
// across a dozen components and nothing else was implemented anywhere.
//
// ONE TABLE, AND THE TOOLTIP READS FROM IT. That is the rule the whole file
// exists to keep: a shortcut nobody can discover is a shortcut for the person who
// wrote it. Every binding here names the ACTION it runs, and `shortcutFor` lets
// any control ask "what key am I?" — so `<Tooltip label="Favourite">` becomes
// "Favourite · F" without the tooltip and the handler ever being edited
// separately. Bind a key here and the button that does the same thing starts
// saying so; change it here and the button changes with it.
//
// Strings in, values out — no React, no DOM — so it loads in the `pure` test
// project and the bindings can be asserted without a browser.

// THE BINDINGS. `id` is the action, and it is what a control matches on.
//
// Chosen to be guessable rather than clever: the first letter of the thing they
// do, the conventions every SRS tool already trained people on (1/2 to grade,
// space to reveal), and vim's j/k for a list because anybody who reaches for
// arrow keys still has them.
//
// `seq` is a two-key sequence ("g then l"), which is how a small alphabet covers
// navigation without stealing single letters that mean something else.
//
// NOTHING IS LISTED THAT DOES NOT WORK. The first draft of this table also bound
// a command palette, j/k to move through a list, f to favourite, e to edit and u
// to undo — every one of them a key with no handler behind it. That is worse than
// having no shortcut at all, because the sheet and the tooltips read from this
// table: an entry here is a PROMISE printed on a button and in a legend, and five
// of them would have been promises the app does not keep. They come back when
// something is wired to them.
// LABELS AND GROUP NAMES ARE KEYS. This table is built at import, so a word
// spelled here would be the one word in the legend that never translated; the
// sheet and every tooltip resolve them as they draw. `group` doubles as the
// bucketing identity in groupedShortcuts, which is another reason it is a stable
// key rather than a sentence.
export const SHORTCUTS = [
  // Global
  { id: 'search', keys: ['/'], label: 'shell.shortcut.search.label', group: 'shell.shortcut.group.anywhere.label' },
  { id: 'capture', keys: ['n'], label: 'shell.shortcut.capture.label', group: 'shell.shortcut.group.anywhere.label' },
  { id: 'help', keys: ['?'], label: 'shell.shortcut.help.label', group: 'shell.shortcut.group.anywhere.label' },

  // Go to — a sequence, so the single letters stay free. The letter is the first
  // letter of the destination wherever one is available, which is why Settings is
  // the exception: S is Stats, and the comma is what ⌘, has trained everybody to
  // reach for instead.
  { id: 'go-home', seq: ['g', 'h'], label: 'shell.shortcut.go-home.label', group: 'shell.shortcut.group.go-to.label' },
  { id: 'go-library', seq: ['g', 'l'], label: 'shell.shortcut.go-library.label', group: 'shell.shortcut.group.go-to.label' },
  { id: 'go-catalogue', seq: ['g', 'c'], label: 'shell.shortcut.go-catalogue.label', group: 'shell.shortcut.group.go-to.label' },
  { id: 'go-quotes', seq: ['g', 'q'], label: 'shell.shortcut.go-quotes.label', group: 'shell.shortcut.group.go-to.label' },
  { id: 'go-anthologies', seq: ['g', 'a'], label: 'shell.shortcut.go-anthologies.label', group: 'shell.shortcut.group.go-to.label' },
  { id: 'go-stats', seq: ['g', 's'], label: 'shell.shortcut.go-stats.label', group: 'shell.shortcut.group.go-to.label' },
  { id: 'go-metadata', seq: ['g', 'm'], label: 'shell.shortcut.go-metadata.label', group: 'shell.shortcut.group.go-to.label' },
  { id: 'go-profile', seq: ['g', 'p'], label: 'shell.shortcut.go-profile.label', group: 'shell.shortcut.group.go-to.label' },
  { id: 'go-settings', seq: ['g', ','], label: 'shell.shortcut.go-settings.label', group: 'shell.shortcut.group.go-to.label' },

  // ---- review, and the two things that make it different --------------------
  //
  // THE SAME KEY DOES A DIFFERENT JOB PER CARD, which is why bindings carry a
  // `ctx`. A quiz shows one of three kinds of question and they want different
  // answers: an MCQ wants "which of these four", a flip card wants "did you have
  // it", a cloze wants the caret in the blank. Binding 1 globally to "Forgot"
  // would mean pressing 1 on a four-option question graded it instead of picking
  // the first answer — a keystroke that silently marks a card wrong.
  //
  // So `ctx` is part of the identity of a binding: 1 is unique WITHIN mcq and
  // within flip, and the two never coexist on screen.
  { id: 'pick-1', ctx: 'mcq', keys: ['1'], label: 'shell.shortcut.pick-1.label', group: 'shell.shortcut.group.mcq.label' },
  { id: 'pick-2', ctx: 'mcq', keys: ['2'], label: 'shell.shortcut.pick-2.label', group: 'shell.shortcut.group.mcq.label' },
  { id: 'pick-3', ctx: 'mcq', keys: ['3'], label: 'shell.shortcut.pick-3.label', group: 'shell.shortcut.group.mcq.label' },
  { id: 'pick-4', ctx: 'mcq', keys: ['4'], label: 'shell.shortcut.pick-4.label', group: 'shell.shortcut.group.mcq.label' },

  { id: 'reveal', ctx: 'flip', keys: ['space'], label: 'shell.shortcut.reveal.label', group: 'shell.shortcut.group.flip.label' },
  { id: 'grade-forgot', ctx: 'flip', keys: ['1'], label: 'shell.shortcut.grade-forgot.label', group: 'shell.shortcut.group.flip.label' },
  { id: 'grade-got', ctx: 'flip', keys: ['2'], label: 'shell.shortcut.grade-got.label', group: 'shell.shortcut.group.flip.label' },

  // Space again, and legitimately: on a cloze there is nothing to reveal, and
  // "get on with this card" means put the caret where the typing goes. It only
  // fires while the field is NOT focused, so it can never eat a space you meant
  // to type.
  { id: 'focus-blank', ctx: 'cloze', keys: ['space'], label: 'shell.shortcut.focus-blank.label', group: 'shell.shortcut.group.cloze.label' },
]

const BY_ID = new Map(SHORTCUTS.map((s) => [s.id, s]))

// isMac decides which modifier word is shown. Read once — a keyboard does not
// change platform mid-session — and guarded because the pure test project has no
// navigator.
const isMac = (() => {
  try {
    return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || '')
  } catch {
    return false
  }
})()

// prettyKey turns a binding into what a reader should see on a key cap.
//
// `mod` IS THE POINT OF THIS FUNCTION. ⌘K on a Mac and Ctrl-K everywhere else is
// one binding and two labels, and a tooltip that says the wrong one is worse than
// a tooltip that says nothing — it teaches a key that does not work.
export function prettyKey(k) {
  if (k === 'mod') return t(isMac ? 'vocab.key.mod.mac.label' : 'vocab.key.mod.label')
  if (k === 'space') return t('vocab.key.space.label')
  if (k === 'esc') return t('vocab.key.esc.label')
  if (k === 'shift') return t('vocab.key.shift.label')
  return k.length === 1 ? k.toUpperCase() : k
}

// shortcutLabel renders one binding: "⌘K", "G then L", "F".
export function shortcutLabel(s) {
  if (!s) return ''
  // The joining word is resolved rather than spelled, and ui.jsx's Kbd SPLITS on
  // the same key — so the chord a legend draws and the chord this returns cannot
  // disagree about where one key cap ends and the next begins.
  if (s.seq) return s.seq.map(prettyKey).join(` ${t('common.kbd.then.label')} `)
  const combo = s.keys?.[0] || ''
  return combo.split('+').map(prettyKey).join(isMac ? '' : '-')
}

// shortcutFor is what a control calls to find out what key it is.
//
// `shifted` renders the PRACTICE form of a review key. Practice and the Daily
// Quiz show the same card with the same buttons, and the two are not the same
// act: the daily deck is the schedule and its grades are permanent, while
// Practice is study. A reader running through Practice on reflex with the daily
// keys in their fingers should not be able to move a schedule by accident, so
// Practice asks for Shift — one deliberate extra finger, on the mode where the
// stakes are lower but the muscle memory is identical.
export function shortcutFor(id, shifted = false) {
  const s = BY_ID.get(id)
  if (!s) return ''
  const label = shortcutLabel(s)
  return shifted && s.ctx ? t('common.shortcut.shifted.label', { key: label }) : label
}

// withShortcut appends the key to a tooltip label, and is the function that
// makes the registry visible.
//
// A MIDDLE DOT, NOT BRACKETS, because the bubble already uses the dot to join
// facts about a control everywhere else in this app, and because brackets read
// as optional. Returns the label unchanged when the action has no binding, so
// every existing Tooltip can pass an id it may not have one for.
export function withShortcut(label, id, shifted = false) {
  const k = shortcutFor(id, shifted)
  return k ? t('common.shortcut.suffix.label', { name: label, key: k }) : label
}

// groupedShortcuts is the help sheet's view of the table: the same list, in the
// same order, bucketed by where it applies.
//
// `omit` DROPS A ROW FROM THE LEGEND WITHOUT UNBINDING THE KEY, and the asymmetry
// is deliberate. A reader who has hidden the Catalogue (Settings → Features) has
// no visible door to it, so a sheet still printing "G then C · Go to Catalogue" is
// advertising a control that is not on screen. The key itself keeps working,
// because hiding is cosmetic and the URL — which is what G-then-C is, typed —
// still resolves. This file's own rule is that nothing may be LISTED that does not
// work; a key that works and is not listed breaks no promise.
//
// A SET OF ACTION IDS, NOT OF TABS. keys.js knows which key runs which action and
// deliberately nothing about screens, so the caller — which owns the tab-to-action
// map — decides what to leave out.
//
// BOTH STRINGS RESOLVE HERE, and the heading used to not. `label` went through
// t() and `group` was passed along raw, so the shortcuts sheet printed
// `shell.shortcut.group.anywhere.label` — the key itself — as a heading, in every
// language, for as long as the sheet has existed. Grouping BY THE KEY is still
// right (it is the stable identity; two languages must not split one group in
// two), so the key groups and the resolved words are what comes out.
export function groupedShortcuts(omit) {
  const out = []
  for (const s of SHORTCUTS) {
    if (omit?.has?.(s.id)) continue
    let g = out.find((x) => x.key === s.group)
    if (!g) out.push((g = { key: s.group, group: t(s.group), items: [] }))
    g.items.push({
      id: s.id,
      label: t(s.label),
      keys: shortcutLabel(s),
      // A review key answers to two decks; the sheet says both rather than
      // leaving somebody in Practice pressing a key that does nothing.
      practiceKeys: s.ctx ? shortcutFor(s.id, true) : '',
    })
  }
  return out
}

// ---- matching a keydown --------------------------------------------------
//
// TYPING IS NOT A SHORTCUT, and this is the rule that decides whether the whole
// feature is usable or infuriating. `n` is "capture a quote" and it is also the
// fourteenth letter of a quote somebody is typing into a note. So a key event
// inside any editable control is not a shortcut at all — and "editable" has to
// include contenteditable, which is what a rich-text field is, not just input and
// textarea.
export function isTypingTarget(el) {
  if (!el) return false
  const tag = (el.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}

// eventCombo normalises a keydown into the string form the table uses.
//
// It deliberately does NOT fold Shift into the combo for printable keys: `?` is
// Shift-/ on most layouts and `/` is not, and treating them as one binding would
// make the help sheet open when somebody meant to search.
export function eventCombo(e) {
  if (!e || !e.key) return ''
  const parts = []
  if (e.metaKey || e.ctrlKey) parts.push('mod')
  if (e.altKey) parts.push('alt')
  let key = e.key
  // THE PHYSICAL KEY, FOR DIGITS ONLY. Shift-1 reports `key: "!"` on a US
  // layout, "¡" on some others and something else again on a third — so a
  // Practice grade bound to `shift+1` would work on one keyboard and not the
  // next. `code` says Digit1 whichever layout is in front of you.
  //
  // Only digits, because `code` is the wrong answer for letters: it names the
  // physical position, so a Dvorak reader pressing the key labelled N would get
  // KeyB and the wrong action.
  if (e.shiftKey && /^Digit[0-9]$/.test(e.code || '')) key = e.code.slice(5)
  if (key === ' ') key = 'space'
  else if (key === 'Escape') key = 'esc'
  else if (key.length === 1) key = key.toLowerCase()
  if (e.shiftKey && (key === 'space' || /^[0-9]$/.test(key))) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

// matchShortcut finds the action a combo runs, given the pending sequence prefix.
// Returns { id } for a hit, { pending } when the combo starts a sequence, or null.
export function matchShortcut(combo, pending = '', ctx = null) {
  if (!combo) return null
  // Shift is stripped before matching and reported alongside, so one binding
  // covers both decks and the caller decides which mode it is in.
  let shift = false
  if (combo.startsWith('shift+')) {
    shift = true
    combo = combo.slice(6)
  }
  // A binding with a `ctx` is only live in that context; one without is global.
  const live = (b) => !b.ctx || b.ctx === ctx
  if (pending) {
    const seq = SHORTCUTS.find((b) => b.seq && b.seq[0] === pending && b.seq[1] === combo && live(b))
    return seq ? { id: seq.id, shift } : null
  }
  const direct = SHORTCUTS.find((b) => b.keys?.includes(combo) && live(b))
  // SHIFT ONLY EVER QUALIFIES A CARD BINDING. Without this, Shift-N would run
  // "capture a quote" — a global key silently gaining a second spelling, and one
  // that would fire whenever somebody shift-typed near a control.
  if (direct) return shift && !direct.ctx ? null : { id: direct.id, shift }
  if (shift) return null
  if (SHORTCUTS.some((b) => b.seq && b.seq[0] === combo && live(b))) return { pending: combo }
  return null
}

// ---- the listener --------------------------------------------------------
//
// ONE LISTENER FOR THE WHOLE APP, on the window, rather than a handler per
// screen. Two reasons: a shortcut that works on one screen and silently does
// nothing on another is worse than no shortcut, and a registry whose bindings
// are enforced in a dozen places is a registry that will disagree with itself.
//
// The sequence prefix ("g" then "l") lives here, with a timeout: a `g` you
// pressed a minute ago must not turn the next `l` into a navigation. Two seconds
// is long enough to be deliberate and short enough to be forgotten.
export const SEQUENCE_MS = 2000

// installShortcuts wires the window listener and returns its own remover.
//
// `run(id)` is the caller's dispatcher — this file knows which key means which
// ACTION and nothing about what the action does, which is what keeps the table
// readable and testable without a browser.
export function installShortcuts(run, opts = {}) {
  // `ctx` is which kind of card is on screen, or null for the shell. A function
  // rather than a value because the card changes under a listener that is
  // installed once — reading it at press time is what makes 1 mean "first
  // answer" on an MCQ and "Forgot" on the flip card that replaces it.
  const ctxOf = typeof opts.ctx === 'function' ? opts.ctx : () => opts.ctx || null
  const doc = opts.document || (typeof document !== 'undefined' ? document : null)
  const win = opts.window || (typeof window !== 'undefined' ? window : null)
  if (!win) return () => {}
  let pending = ''
  let pendingAt = 0

  const onKeyDown = (e) => {
    // TYPING IS NOT A SHORTCUT. `n` is "capture a quote" and the fourteenth
    // letter of a note somebody is writing.
    if (isTypingTarget(e.target) || isTypingTarget(doc?.activeElement)) return
    // A modifier the table does not use belongs to the browser: Ctrl-R is
    // reload, and stealing it to mean "review" would be indefensible.
    if (e.altKey) return

    const combo = eventCombo(e)
    if (pending && Date.now() - pendingAt > SEQUENCE_MS) pending = ''
    const hit = matchShortcut(combo, pending, ctxOf())
    if (!hit) {
      pending = ''
      return
    }
    if (hit.pending) {
      pending = hit.pending
      pendingAt = Date.now()
      // A prefix is swallowed so `g` does not also scroll or type anywhere.
      e.preventDefault()
      return
    }
    pending = ''
    // preventDefault only once something is actually going to happen — an
    // unbound key must behave exactly as it did before this file existed.
    e.preventDefault()
    run(hit.id, { shift: !!hit.shift, event: e })
  }

  win.addEventListener('keydown', onKeyDown)
  return () => win.removeEventListener('keydown', onKeyDown)
}
