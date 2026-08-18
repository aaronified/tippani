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
export const SHORTCUTS = [
  // Global
  { id: 'search', keys: ['/'], label: 'Search', group: 'Anywhere' },
  { id: 'capture', keys: ['n'], label: 'Capture a quote', group: 'Anywhere' },
  { id: 'help', keys: ['?'], label: 'Keyboard shortcuts', group: 'Anywhere' },

  // Go to — a sequence, so the single letters stay free.
  { id: 'go-home', seq: ['g', 'h'], label: 'Go to Home', group: 'Go to' },
  { id: 'go-library', seq: ['g', 'l'], label: 'Go to Library', group: 'Go to' },
  { id: 'go-catalogue', seq: ['g', 'c'], label: 'Go to Catalogue', group: 'Go to' },
  { id: 'go-quotes', seq: ['g', 'q'], label: 'Go to Quotes', group: 'Go to' },
  { id: 'go-stats', seq: ['g', 's'], label: 'Go to Stats', group: 'Go to' },

  // Review. 1 and 2 are what anybody arriving from an SRS tool reaches for on
  // reflex, and space-to-reveal is the same reflex for a flip card.
  { id: 'grade-forgot', keys: ['1'], label: 'Forgot', group: 'Review' },
  { id: 'grade-got', keys: ['2'], label: 'Got it', group: 'Review' },
  { id: 'reveal', keys: ['space'], label: 'Reveal the answer', group: 'Review' },
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
  if (k === 'mod') return isMac ? '⌘' : 'Ctrl'
  if (k === 'space') return 'Space'
  if (k === 'esc') return 'Esc'
  if (k === 'shift') return 'Shift'
  return k.length === 1 ? k.toUpperCase() : k
}

// shortcutLabel renders one binding: "⌘K", "G then L", "F".
export function shortcutLabel(s) {
  if (!s) return ''
  if (s.seq) return s.seq.map(prettyKey).join(' then ')
  const combo = s.keys?.[0] || ''
  return combo.split('+').map(prettyKey).join(isMac ? '' : '-')
}

// shortcutFor is what a control calls to find out what key it is.
export function shortcutFor(id) {
  return id ? shortcutLabel(BY_ID.get(id)) : ''
}

// withShortcut appends the key to a tooltip label, and is the function that
// makes the registry visible.
//
// A MIDDLE DOT, NOT BRACKETS, because the bubble already uses the dot to join
// facts about a control everywhere else in this app, and because brackets read
// as optional. Returns the label unchanged when the action has no binding, so
// every existing Tooltip can pass an id it may not have one for.
export function withShortcut(label, id) {
  const k = shortcutFor(id)
  return k ? `${label} · ${k}` : label
}

// groupedShortcuts is the help sheet's view of the table: the same list, in the
// same order, bucketed by where it applies.
export function groupedShortcuts() {
  const out = []
  for (const s of SHORTCUTS) {
    let g = out.find((x) => x.group === s.group)
    if (!g) out.push((g = { group: s.group, items: [] }))
    g.items.push({ id: s.id, label: s.label, keys: shortcutLabel(s) })
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
  if (key === ' ') key = 'space'
  else if (key === 'Escape') key = 'esc'
  else if (key.length === 1) key = key.toLowerCase()
  parts.push(key)
  return parts.join('+')
}

// matchShortcut finds the action a combo runs, given the pending sequence prefix.
// Returns { id } for a hit, { pending } when the combo starts a sequence, or null.
export function matchShortcut(combo, pending = '') {
  if (!combo) return null
  if (pending) {
    const seq = SHORTCUTS.find((s) => s.seq && s.seq[0] === pending && s.seq[1] === combo)
    return seq ? { id: seq.id } : null
  }
  const direct = SHORTCUTS.find((s) => s.keys?.includes(combo))
  if (direct) return { id: direct.id }
  if (SHORTCUTS.some((s) => s.seq && s.seq[0] === combo)) return { pending: combo }
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
    const hit = matchShortcut(combo, pending)
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
    run(hit.id, e)
  }

  win.addEventListener('keydown', onKeyDown)
  return () => win.removeEventListener('keydown', onKeyDown)
}
