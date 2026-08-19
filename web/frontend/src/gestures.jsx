// gestures.jsx — the touch gestures, drawn rather than described.
//
// A gesture is the one thing help cannot say in words without sounding like a
// manual: "press and hold for half a second" is four times longer than the fact it
// is delivering and it talks to the reader as though they had never held a phone.
// So the gesture is a picture and the words beside it are only ever the OUTCOME —
// "the card's menu", "closes the drawer".
//
// WHY INLINE SVG AND NOT A GIF, which is what was asked for and what this is
// visually indistinguishable from:
//
//   1-2 KB each instead of 10-30, and it lives in a diff rather than in git-lfs.
//   ONE FILE PER CLIP, not one per theme: every stroke is currentColor, so a clip
//   is correct in paper-light and film-dark without anybody exporting twice.
//   IT CAN STOP. A playing GIF ignores prefers-reduced-motion completely; here the
//   media query is inside the component, and what it leaves behind is the held
//   pose — still legible, because the animation was never carrying the meaning on
//   its own.
//
// WHY THE ART IS ABSTRACT — a disc for the fingertip, a trail for the travel, a
// ring for the wait — and never a screenshot with a hand over it: an abstract clip
// is not tied to the interface, so it cannot go stale in a restyle and one clip
// serves every context that gesture ever appears in. That is the whole reason this
// file can be a fixed library rather than a maintenance surface.
//
// ELEVEN CLIPS, TWO OF THEM REACHABLE. `IMPLEMENTED` is the list the app actually
// binds, and gestures.test.jsx fails if the interface references anything else —
// the rule keys.js already enforces on the shortcut sheet, where five keys with no
// handler behind them were caught before they shipped. The other nine are data,
// costing a few hundred bytes each, so that the day a swipe is bound the help for
// it is a one-line reference and not a new asset pipeline.

import { t } from './i18n.js'

const VB = 72 // one square viewBox for every clip, so they line up in a row

// IMPLEMENTED — what the app binds today, and where.
//
//   long-press   ui.jsx (500ms, three outcomes by target) and every card's menu
//   swipe-left   App.jsx's drawer, and ONLY leftward: swipe-to-open is deliberately
//                absent because the left screen edge belongs to the OS back gesture
//
// A clip's presence in GESTURES is not permission to show it. This is.
export const IMPLEMENTED = ['long-press', 'swipe-left']

// The eleven. `label` is what the gesture is called, never an instruction.
export const GESTURES = [
  'long-press',
  'swipe-left',
  'swipe-right',
  'swipe-up',
  'swipe-down',
  'pinch-in',
  'pinch-out',
  'two-finger-left',
  'two-finger-right',
  'two-finger-up',
  'two-finger-down',
]

// Keys, not words: this table is built at import, before the language is known,
// and both readers below resolve it through t() as they draw.
export const GESTURE_LABEL = {
  'long-press': 'vocab.gesture.long-press.label',
  'swipe-left': 'vocab.gesture.swipe-left.label',
  'swipe-right': 'vocab.gesture.swipe-right.label',
  'swipe-up': 'vocab.gesture.swipe-up.label',
  'swipe-down': 'vocab.gesture.swipe-down.label',
  'pinch-in': 'vocab.gesture.pinch-in.label',
  'pinch-out': 'vocab.gesture.pinch-out.label',
  'two-finger-left': 'vocab.gesture.two-finger-left.label',
  'two-finger-right': 'vocab.gesture.two-finger-right.label',
  'two-finger-up': 'vocab.gesture.two-finger-up.label',
  'two-finger-down': 'vocab.gesture.two-finger-down.label',
}

// The travel vector per swipe, in viewBox units. One table, so a direction cannot
// be drawn one way in the trail and another in the animation.
const DIR = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
}

// dirOf resolves a kind to the [x, y] the animation travels along.
//
// A PINCH IS A DIRECTION TOO, and it has to be handled here rather than left to
// the fallback: `pinch-in` matches none of the swipe prefixes, so the first cut of
// this returned DIR.right for both pinch kinds and the two clips animated
// identically — the one difference between them lost to a default. +1 draws the
// tips toward each other (in), -1 apart (out); the keyframes read it as a sign.
const dirOf = (kind) => {
  if (kind === 'pinch-in') return [1, 0]
  if (kind === 'pinch-out') return [-1, 0]
  const d = kind.replace('swipe-', '').replace('two-finger-', '')
  return DIR[d] || DIR.right
}

// Gesture draws one clip.
//
// `kind` is a key from GESTURES. Unknown keys render nothing rather than a box with
// a question mark in it: a missing asset should be invisible, not an error message
// aimed at the reader.
//
// `size` is the CSS box, and the DRAWING is smaller than it: the surface rect is
// inset 8 of 72 viewBox units a side, so the frame a reader actually sees is 56/72
// of the box. The default is the help-entry size, because that is where a clip is
// something you watch — 68 leaves a ~53px frame, which is a finger-sized thing
// rather than a mark. GestureChip overrides it down to label height.
export function Gesture({ kind, size = 68, className = '' }) {
  if (!GESTURES.includes(kind)) return null
  const label = t(GESTURE_LABEL[kind])
  const two = kind.startsWith('two-finger')
  const pinch = kind.startsWith('pinch')
  const swipe = kind.startsWith('swipe') || two
  const [dx, dy] = dirOf(kind)

  return (
    <svg
      className={`gesture ${className}`}
      viewBox={`0 0 ${VB} ${VB}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      // The surface the finger is on: a rounded rectangle at low opacity, which is
      // what makes a disc read as a fingertip rather than as a dot.
      style={{ '--gd': `${dx}`, '--gdy': `${dy}` }}
    >
      <rect
        x="8"
        y="8"
        width={VB - 16}
        height={VB - 16}
        rx="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.22"
      />

      {/* The travel trail, drawn for the swipes: a dashed line the finger runs
          along, so the direction is legible in the still frame too. */}
      {swipe && (
        <line
          x1={36 - dx * 16}
          y1={36 - dy * 16}
          x2={36 + dx * 16}
          y2={36 + dy * 16}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.35"
        />
      )}

      {/* Long press: the ring is the wait. It is the only clip whose meaning is
          duration rather than travel, which is why it gets a growing ring rather
          than a trail — and why its reduced-motion pose is the ring at full size. */}
      {kind === 'long-press' && (
        <circle className="g-ring" cx="36" cy="36" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
      )}

      {/* The fingertips. Two discs for a two-finger gesture and for a pinch; one
          otherwise. A pinch moves them along one axis toward or away from each
          other, which is the whole of what distinguishes in from out. */}
      {pinch || two ? (
        <>
          <circle className={`g-tip g-a ${pinch ? 'g-pinch' : 'g-move'}`} cx="24" cy="36" r="7" fill="currentColor" />
          <circle className={`g-tip g-b ${pinch ? 'g-pinch' : 'g-move'}`} cx="48" cy="36" r="7" fill="currentColor" />
        </>
      ) : (
        <circle className={`g-tip ${swipe ? 'g-move' : 'g-hold'}`} cx="36" cy="36" r="8" fill="currentColor" />
      )}
    </svg>
  )
}

// isGestureClip — is this help asset a clip? The one question a help entry's layout
// has to ask about its asset, and it lives here because the answer is "is it this
// component". A clip is square and small, so the prose can wrap around it; the other
// assets help carries are wide (a swatch row, a 240px import schematic) and would
// leave an unreadable ribbon of text beside them.
//
// Derived rather than declared: help.jsx says what an entry's picture IS, and how
// wide a picture may be is a layout fact, not a help fact.
export function isGestureClip(node) {
  return !!node && node.type === Gesture
}

// GestureChip — the clip with its name beside it, which is how it appears in help.
//
// The NAME and not an instruction, and the caller supplies the outcome:
//
//   <GestureChip kind="long-press" /> a card's own menu
//
// reads "Long press — a card's own menu", which is the shortest true sentence
// available and assumes a reader who has used a phone before.
export function GestureChip({ kind, className = '' }) {
  if (!GESTURES.includes(kind)) return null
  return (
    <span className={`gesture-chip ${className}`}>
      <Gesture kind={kind} size={28} />
      <span className="gesture-chip-label">{t(GESTURE_LABEL[kind])}</span>
    </span>
  )
}
