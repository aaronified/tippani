// The type SCALE, and the dials that move it.
//
// Every size on every screen comes from here. That is the requirement, in the
// owner's words: "every font on the screen should respond to the font size
// changes, either individually in the font section, or via the global size." So a
// hardcoded `font-size` anywhere is a piece of the interface that has opted out of
// the reader's choice, and typescale.test.js fails on one.
//
// ---- one multiplication, not two -------------------------------------------
//
// THE MODEL, and it was corrected from a worse one: `rendered = designed × factor`.
// One factor per role, and that is all. The earlier design multiplied a per-role
// dial by a global dial, which is a different thing and reads badly on screen:
// two controls that both mean "bigger" compose into a number neither of them
// shows, so 125% × 125% is 156% and the panel claims 125% twice.
//
// THE GLOBAL DIAL RENORMALISES INSTEAD. Moving it writes its value into every
// role, so "150%" means every role is now at 150% — which is what the words say.
// Each role can then be tuned away from that, and the global reads back as the
// value they share, or as nothing when they have been pulled apart. It is a bulk
// edit of four numbers rather than a fifth number multiplying them, so there is no
// second source of truth to disagree with the first.
//
// ---- zero fractional scaling ------------------------------------------------
//
// Every base size is an integer, every factor is a quarter, and every product is
// ROUNDED TO AN INTEGER PIXEL before it reaches the page. The owner's rule: "we
// should try for zero fractional scaling here."
//
// It is also why this is computed in JavaScript and written out as finished
// values, rather than emitted as `calc(13px * var(--factor))` for the browser to
// work out. calc() would hand the layout 16.25px, and a fractional font size is
// where hinting and stem weights land unevenly — visibly on some displays and not
// on others, which makes it the worst class of bug to be told about. A call site
// therefore reads ONE variable and does no arithmetic at all.
//
// ---- the tokens are named after the size they are ---------------------------
//
// `--type-ui-13` is "13 pixels at 100%, whatever the interface dial says now". Not
// `--type-ui-sm`: a t-shirt name has to be looked up, and the sweep that put 255
// call sites onto these tokens would have been 255 chances to pick the wrong one.
// Named for its default, the translation from what was there to what replaces it
// is mechanical and the diff is readable — `font-size: 13px` became
// `font-size: var(--type-ui-13)` and a reviewer can see that nothing moved.

// STEPS — ten, and the shape of the list is decided by the dials rather than by
// taste. The gaps are +2,+1,+1,+2,+2,+2,+3,+4,+4: fine at the bottom where one
// pixel is a tenth of the size, coarse at the top where it is a thirtieth.
//
// THERE IS NO 10, and −25% is why. 10 × 0.75 = 7.5 and 11 × 0.75 = 8.25, and both
// round to 8 — two designed sizes rendering identically, which is a step the scale
// has lost. Every pair here stays distinct at all six factors, and
// typescale.test.js asserts it, so adding a step is not a free decision.
export const TYPE_STEPS = [9, 11, 12, 13, 15, 17, 19, 22, 26, 30]

// FACTORS — what a dial can be set to, as a percentage. Integers, because the
// preference is an integer and 25% steps are exactly representable.
//
// 75 IS INCLUDED. The first sketch had increases only, on the reasoning that
// nobody wants the interface smaller than it was drawn; the owner's answer was
// "-25% is fine as well", and it is: a dense desktop at a high resolution has
// room for more than the default shows.
//
// 200 WAS REMOVED, and the reason is the rail rather than the type. At double
// size the nav rail needed 471px of a 1180px window to keep its words readable —
// two fifths of the screen spent on nine labels — and every list row that carries
// a title had lost the width to show one. 175 is the last step where the app is
// still the shape it was drawn as. The dial is a promise that the interface
// answers to it, and a step the interface cannot honour is worse than an absent
// one. Anyone parked on 200 is moved to 175 once, by the 3.1.0 one-time pass.
export const TYPE_FACTORS = [75, 100, 125, 150, 175]

// TYPE_FACTOR_MAX is the top of the dial, read rather than restated — the
// screenshot harness turns the type up to exactly this and would otherwise carry
// a second copy of the number to fall out of step with.
export const TYPE_FACTOR_MAX = TYPE_FACTORS[TYPE_FACTORS.length - 1]

export const TYPE_DEFAULT = 100

// The roles that own a SIZE. Four, not six: `bengali` and `devanagari` are scripts
// rather than places on the screen — their glyphs are drawn inside a display, ui,
// mono or hand element and take that element's size, so a size dial for them would
// be an optical adjustment against the Latin face beside them and not a scale step
// of its own. See fonts.js for the two script roles and what they do control.
export const SIZE_ROLES = ['display', 'ui', 'mono', 'hand']

// sizePrefKey — the preference field for a role's dial. Flat and repetitive for the
// same reason fonts.js's prefKey is: prefs is a comparable struct on the server, so
// four integer fields is the shape.
export const sizePrefKey = (role) => 'size' + role[0].toUpperCase() + role.slice(1)

// clampFactor keeps a stored value on the dial. An unknown number falls to 100
// rather than to the nearest step: a preference written by a newer client (a 225
// somebody added later) must render at the designed size rather than at a
// half-understood approximation of a bigger one.
export function clampFactor(value) {
  const n = Number(value)
  return TYPE_FACTORS.includes(n) ? n : TYPE_DEFAULT
}

// factorsFrom reads all four dials out of a preferences object.
export function factorsFrom(prefs) {
  const out = {}
  for (const role of SIZE_ROLES) out[role] = clampFactor(prefs?.[sizePrefKey(role)])
  return out
}

// scaled is the arithmetic, in one place so the panel's readout and the page agree.
// Math.round: 12.5 goes to 13, which is the direction a reader who asked for
// bigger text meant.
export const scaled = (px, factor) => Math.round((px * factor) / 100)

// globalOf is what the global dial shows: the value every role shares, or 0 when
// they have been pulled apart.
//
// DERIVED, NEVER STORED. A stored global would be a second answer to a question
// the four roles already answer, and the moment one role is tuned the two disagree
// — the panel would then have to choose which of them to believe, which is the
// shape of bug this app keeps finding in its own preferences.
export function globalOf(factors) {
  const first = factors[SIZE_ROLES[0]]
  return SIZE_ROLES.every((r) => factors[r] === first) ? first : 0
}

// renormalise is what the global dial writes: the same factor into every role.
export function renormalise(factor) {
  const out = {}
  for (const role of SIZE_ROLES) out[sizePrefKey(role)] = clampFactor(factor)
  return out
}

// typeTokens is the whole set of custom properties, as finished integer pixels.
// Returned as a plain object so the suite can assert the values without a DOM.
export function typeTokens(prefs) {
  const factors = factorsFrom(prefs)
  const out = {}
  for (const role of SIZE_ROLES) {
    for (const px of TYPE_STEPS) out[`--type-${role}-${px}`] = `${scaled(px, factors[role])}px`
  }
  return out
}

// RAIL_WORDS_MAX is the largest interface dial at which the nav rail still shows
// its words. Above it the rail keeps its glyphs — the icon-only mode it already
// has below 1180px — rather than growing to fit.
//
// MEASURED, NOT CHOSEN, in a real browser at 1280px in both shipped languages:
//
//   en  100% fits · 125% fits · 150% Catalogue +6, Metadata +24 · 175% +27, +47
//   bn  100% fits · 125% fits · 150% fits          · 175% মেটাডেটা +1
//
// So 125 is the last position where every label fits in every language, and the
// number had to be measured because guessing it wrong is invisible: the labels
// would clip by six pixels and read as slightly odd words rather than as a bug.
// English is the binding case, which is not the intuition — the Bengali labels are
// shorter here, not longer.
//
// THE ALTERNATIVE WAS LETTING THE RAIL GROW, and that was the wrong half of the
// trade: at 175% it wanted 413px of a 1180px window, a third of the screen for
// nine labels, while every row behind it had lost the width to show a title. A
// reader who turns the type up wants to read the page, not the navigation.
//
// IT LIVES HERE rather than in the stylesheet because CSS cannot ask what the dial
// says: a media query reads the viewport and nothing else, so the comparison has to
// happen where the factor is known and be handed to CSS as an attribute.
export const RAIL_WORDS_MAX = 125

// applyTypeScale writes them onto <html>, the same mechanism applyTheme,
// applyColors and applyFonts already use — which is why a size change needs no
// reload and no re-render: the properties change and the page re-lays itself out.
export function applyTypeScale(prefs) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const tokens = typeTokens(prefs)
  for (const name in tokens) root.style.setProperty(name, tokens[name])
  // The rail's words follow the INTERFACE dial, because that is the role the
  // labels are drawn in. An attribute rather than a class: it is a statement
  // about the document, and index.css keys the whole wide-rail block off it.
  const ui = factorsFrom(prefs).ui
  if (ui > RAIL_WORDS_MAX) root.dataset.rail = 'icons'
  else delete root.dataset.rail
}
