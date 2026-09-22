// gestures.jsx — the touch gestures, drawn rather than described.
//
// A gesture is the one thing help cannot say in words without sounding like a
// manual: "press and hold for half a second" is four times longer than the fact it
// is delivering and it talks to the reader as though they had never held a phone.
// So the gesture is a picture and the words beside it are only ever the OUTCOME —
// "the card's menu", "closes the drawer".
//
// THESE WERE ANIMATED CLIPS AND THE OWNER RETIRED THEM. The eleven were abstract
// by design — a disc for the fingertip, a trail for the travel, a ring for the
// wait — and each one moved, with a `prefers-reduced-motion` rule that left the
// held pose behind. The argument for that art is still in the history and it was
// not a bad argument. It was simply beaten: "the static icons look better than our
// existing animations. retire them."
//
// WHAT THAT TRADE ACTUALLY COST, recorded so nobody reinstates the clips by
// accident thinking something was overlooked. Gone: the motion, and with it the
// reduced-motion branch, which is now moot rather than unhandled — there is
// nothing left to stop. Gained: a hand. The abstract discs never showed WHICH
// hand shape a gesture wanted, and a reader who has not met a two-finger swipe
// learns more from one drawing of two fingers than from two discs travelling.
//
// THE ART IS VENDORED, NOT DRAWN HERE. Atlas Icons' hand-gesture pack, 50 icons by
// Ramy Wafaa, MIT — the owner chose it and named the source. Their own files carry
// a `.cls-1` stylesheet hardcoding #020202, which is black on a dark screen; the
// class is stripped and the stroke is `currentColor` like every other glyph in
// this app, so one file is correct in paper-light and film-dark alike. See
// `docs/wiki/Provider-marks.md` for how this repo records vendored artwork.
//
// SEVEN, NOT ELEVEN, AND THE FOUR THAT WENT ARE THE POINT. Atlas has no
// directional two-finger icon — a generic `two-finger` and a `two-finger-point`,
// and nothing that says left from right. Mapping all four onto the one drawing
// would put four identical pictures against four different names, which is this
// repo's own "a row says a thing once" broken four ways at once. None of the four
// was ever bound, so nothing on any screen lost a picture; what went was data
// waiting for a day that would have arrived without art. The day a two-finger
// swipe IS bound, it needs an icon before it needs a key.

import { t } from './i18n.js'

// IMPLEMENTED — what the app binds today, and where.
//
//   long-press   ui.jsx (500ms, three outcomes by target) and every card's menu
//   swipe-left   App.jsx's drawer, and ONLY leftward: swipe-to-open is deliberately
//                absent because the left screen edge belongs to the OS back gesture
//   swipe-up     ui.jsx's `useSheetDrag`, on a phone sheet: a pull upward from the
//   swipe-down   grip, the header, or the TOP of the body grows the sheet to its
//                next anchor and a pull downward shrinks it, because a drag lower
//                in the body is the reader scrolling. From the smallest anchor a
//                downward release dismisses, through the same guarded exit as the
//                ✕ — so unsaved typing asks its question before the sheet goes
//
// A drawing's presence in GESTURES is not permission to show it. This is.
export const IMPLEMENTED = ['long-press', 'swipe-left', 'swipe-up', 'swipe-down']

// The seven. `label` is what the gesture is called, never an instruction.
export const GESTURES = [
  'long-press',
  'swipe-left',
  'swipe-right',
  'swipe-up',
  'swipe-down',
  'pinch-in',
  'pinch-out',
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
}

// THE PINCH PAIR READS BACKWARDS FROM THE FILE NAMES, on purpose. A pinch IN — two
// fingers drawn together — is what makes a picture SMALLER, which the pack calls
// zoom-out; a pinch out is zoom-in. Naming the key after what the hand does and the
// file after what the screen does is the right way round for both, and this comment
// is here because the mapping looks like a mistake until you think about it.
const ART = {
  // long-press — atlas/hold
  'long-press': (
    <>
      <path d="M7.24,22.52,2.09,17.38a2,2,0,0,1,1.44-3.47,2,2,0,0,1,1.43.6l1.32,1.32V6.37A2,2,0,0,1,8,4.35a1.94,1.94,0,0,1,2.08,1.91V12l5.05.72a1.92,1.92,0,0,1,1.64,1.9h0A17.25,17.25,0,0,1,15,22.34l-.09.18"/>
      <path d="M10.11,10.64a4.54,4.54,0,0,0,1.47-1,4.79,4.79,0,1,0-6.77,0,4.54,4.54,0,0,0,1.47,1"/>
      <path d="M20,5.14l-.33.16-.32-.16a2.86,2.86,0,0,1-1.59-2.57V1.48h3.83V2.57A2.88,2.88,0,0,1,20,5.14Z"/>
      <line x1="15.85" y1="1.48" x2="23.5" y2="1.48"/>
      <path d="M19.35,5.47l.32-.17.33.17A2.87,2.87,0,0,1,21.59,8v1.1H17.76V8A2.85,2.85,0,0,1,19.35,5.47Z"/>
      <line x1="23.5" y1="9.13" x2="15.85" y2="9.13"/>
    </>
  ),
  // swipe-left — atlas/move-left
  'swipe-left': (
    <>
      <path d="M13,22.5,7.82,17.36a2,2,0,0,1-.59-1.43,2,2,0,0,1,2-2,2,2,0,0,1,1.43.59L12,15.82V6.38a2,2,0,0,1,1.74-2,1.87,1.87,0,0,1,1.51.56,1.83,1.83,0,0,1,.57,1.34V12l5,.72a1.91,1.91,0,0,1,1.64,1.89h0a17.18,17.18,0,0,1-1.82,7.71l-.09.18"/>
      <polyline points="4.36 7.23 1.5 4.36 4.36 1.5"/>
      <line x1="9.14" y1="4.36" x2="1.5" y2="4.36"/>
    </>
  ),
  // swipe-right — atlas/move-right
  'swipe-right': (
    <>
      <path d="M8,23,2.62,17.62a2.12,2.12,0,0,1,3-3L7,16V6.11A2.08,2.08,0,0,1,8.82,4,2,2,0,0,1,11,6v6l5.28.75a2,2,0,0,1,1.72,2h0a18,18,0,0,1-1.91,8.09L16,23"/>
      <polyline points="19 7 22 4 19 1"/>
      <line x1="14" y1="4" x2="22" y2="4"/>
    </>
  ),
  // swipe-up — atlas/move-up
  'swipe-up': (
    <>
      <path d="M13,22.52,7.82,17.39A2,2,0,0,1,7.23,16a2.07,2.07,0,0,1,.59-1.44,2,2,0,0,1,1.43-.59,2,2,0,0,1,1.43.59L12,15.84V6.4a2,2,0,0,1,1.74-2A1.87,1.87,0,0,1,15.25,5a1.84,1.84,0,0,1,.57,1.35V12l5,.72a1.91,1.91,0,0,1,1.64,1.89h0a17.25,17.25,0,0,1-1.82,7.72l-.09.17"/>
      <polyline points="1.5 5.34 4.36 2.48 7.23 5.34"/>
      <line x1="4.36" y1="12.02" x2="4.36" y2="2.48"/>
    </>
  ),
  // swipe-down — atlas/move-down
  'swipe-down': (
    <>
      <path d="M13,22.48,7.82,17.34a2,2,0,0,1,2.86-2.86L12,15.8V6.36a2,2,0,0,1,1.74-2,1.92,1.92,0,0,1,2.08,1.9V12l5,.72a1.91,1.91,0,0,1,1.64,1.89h0a17.18,17.18,0,0,1-1.82,7.71l-.09.18"/>
      <polyline points="7.23 7.21 4.36 10.07 1.5 7.21"/>
      <line x1="4.36" y1="0.52" x2="4.36" y2="10.07"/>
    </>
  ),
  // pinch-in — atlas/zoom-out
  'pinch-in': (
    <>
      <path d="M12.87,22,8,17.13a1.91,1.91,0,0,1-.57-1.37,1.94,1.94,0,0,1,3.31-1.37L12,15.65v-9A1.89,1.89,0,0,1,13.62,4.7a1.84,1.84,0,0,1,2,1.82V12l4.82.69A1.83,1.83,0,0,1,22,14.5h0a16.54,16.54,0,0,1-1.74,7.37l-.09.17"/>
      <polyline points="10.13 5.61 6.48 5.61 6.48 1.96"/>
      <polyline points="1 7.43 4.65 7.43 4.65 11.09"/>
      <line x1="4.65" y1="7.43" x2="1" y2="11.09"/>
      <line x1="6.48" y1="5.61" x2="10.13" y2="1.96"/>
    </>
  ),
  // pinch-out — atlas/zoom-in
  'pinch-out': (
    <>
      <path d="M13,22.5,7.82,17.36a2,2,0,0,1-.59-1.43,2,2,0,0,1,2-2,2,2,0,0,1,1.43.59L12,15.82V6.38a2,2,0,0,1,1.74-2,1.87,1.87,0,0,1,1.51.56,1.83,1.83,0,0,1,.57,1.34V12l5,.72a1.91,1.91,0,0,1,1.64,1.89h0a17.18,17.18,0,0,1-1.82,7.71l-.09.18"/>
      <polyline points="5.32 10.09 1.5 10.09 1.5 6.27"/>
      <polyline points="6.27 1.5 10.09 1.5 10.09 5.32"/>
      <line x1="5.32" y1="6.27" x2="1.5" y2="10.09"/>
      <line x1="6.27" y1="5.32" x2="10.09" y2="1.5"/>
    </>
  ),
}

// Gesture draws one hand.
//
// `kind` is a key from GESTURES. Unknown keys render nothing rather than a box with
// a question mark in it: a missing asset should be invisible, not an error message
// aimed at the reader.
//
// `size` is the CSS box. The default is the help-entry size, where a gesture is
// something a reader studies; GestureChip overrides it down to label height.
//
// STROKE 1.4 AND NOT THE APP'S 1.85. These carry far more line than a nav glyph —
// a whole hand, knuckles and all — so at the app's own weight the fingers close up
// into a blob at chip size. Verified by eye at 28px, which is the smallest this is
// ever drawn.
export function Gesture({ kind, size = 68, className = '' }) {
  if (!GESTURES.includes(kind)) return null
  return (
    <svg
      className={`gesture ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={t(GESTURE_LABEL[kind])}
    >
      {ART[kind]}
    </svg>
  )
}

// isGestureClip — whether a help entry's picture is one of these.
//
// Derived rather than declared: help.jsx says what an entry's picture IS, and how
// wide a picture may be is a layout fact, not a help fact.
export function isGestureClip(node) {
  return !!node && node.type === Gesture
}

// GestureChip — the drawing with its name beside it, which is how it appears in help.
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
