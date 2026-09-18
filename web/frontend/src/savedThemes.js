// A LOOK YOU CAN COME BACK TO, and a file you can hand somebody.
//
// WHAT A SAVED THEME HOLDS, and why it is the whole look rather than one field:
// both grounds, the accent, the material set, the per-slot tile overrides and the
// material dials. Those six travel together — a ground chosen against one accent
// is a different decision against another — so switching between two looks is one
// press instead of six, which is the entire reason to have them.
//
// FOUR TO A PROFILE, and the cap is the design rather than a limitation. A fifth
// turns a set of looks you switch between into a list you maintain: you start
// naming them, then tidying them, then wondering which of two near-identical ones
// is the good one. The v3 pack says four and that is what this holds to.
//
// STORED AS ONE JSON STRING, like the material dials and the section order and for
// the same reason: every other field the preferences endpoint takes is a scalar,
// and a list would be the only one needing its own shape on both sides.
export const SAVED_THEME_CAP = 4

// The fields a look is made of. Named here rather than spread at each call site,
// because the failure mode of "saved everything" and "saved most of it" look
// identical until somebody switches back and one thing did not come with them.
const FIELDS = ['materialSet', 'accent', 'groundLight', 'groundDark', 'tiles', 'texTweak']

export function parseSaved(raw) {
  if (!raw) return []
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(v)) return []
    // A stored entry with no name is not a theme anybody can pick — it would draw
    // a nameless row — so it is dropped rather than rendered as a blank.
    return v.filter((x) => x && typeof x === 'object' && typeof x.name === 'string' && x.name)
      .slice(0, SAVED_THEME_CAP)
  } catch { return [] }
}

// themeFrom — the look currently applied, reduced to the fields a theme carries.
// `theme` (light/dark/system) is deliberately NOT one of them: which mode you are
// in is about the room you are sitting in rather than about the look, and a saved
// theme that dragged you into dark at noon would be a theme nobody saves twice.
export function themeFrom(resolved, name) {
  const out = { name }
  for (const key of FIELDS) out[key] = resolved[key]
  return out
}

// applyFields — what to hand `applyTheme` to wear a saved theme. The mode is
// carried through from what is applied now, for the reason above.
export function applyFields(saved, resolved) {
  const out = { theme: resolved.theme }
  for (const key of FIELDS) out[key] = saved[key] === undefined ? resolved[key] : saved[key]
  // texTweak travels as an object inside the saved theme and as a STRING through
  // the preferences endpoint, which is the seam this crosses — a theme applied
  // with the object form would silently wear the factory dials.
  if (out.texTweak && typeof out.texTweak !== 'string') out.texTweak = JSON.stringify(out.texTweak)
  return out
}

export function saveTheme(list, resolved, name) {
  const next = parseSaved(list).filter((x) => x.name !== name)
  // NEWEST LAST, and a re-save of an existing name replaces it in place at the
  // end rather than making a second row with the same word on it.
  next.push(themeFrom(resolved, name))
  return next.slice(-SAVED_THEME_CAP)
}

export function removeTheme(list, name) {
  return parseSaved(list).filter((x) => x.name !== name)
}

// ---- the file ---------------------------------------------------------------
//
// EXPORT IS ONE THEME, NOT THE LIST. A file called "my theme" that turns out to
// hold four of them is a file nobody can share a look with. What travels is what
// you are wearing.
export const THEME_FILE_KIND = 'tippani.theme'
export const THEME_FILE_VERSION = 1

export function toFile(resolved, name) {
  return JSON.stringify({ kind: THEME_FILE_KIND, version: THEME_FILE_VERSION, theme: themeFrom(resolved, name) }, null, 2)
}

// fromFile returns the theme, or null with a reason. A REASON RATHER THAN A
// THROW: this is somebody pasting a file into a box, and "that is not a tippani
// theme" is something the screen has to be able to say.
export function fromFile(text) {
  let v
  try { v = JSON.parse(text) } catch { return { error: 'parse' } }
  if (!v || typeof v !== 'object') return { error: 'parse' }
  if (v.kind !== THEME_FILE_KIND) return { error: 'kind' }
  // A FORWARD VERSION IS REFUSED RATHER THAN GUESSED AT. Reading a file written by
  // a later release as though it were this one produces a look nobody chose, which
  // is worse than saying no.
  if (typeof v.version !== 'number' || v.version > THEME_FILE_VERSION) return { error: 'version' }
  if (!v.theme || typeof v.theme !== 'object') return { error: 'shape' }
  return { theme: { ...v.theme, name: typeof v.theme.name === 'string' && v.theme.name ? v.theme.name : 'Imported' } }
}
