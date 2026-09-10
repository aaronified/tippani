// WHAT YOU ARE ADDING, ASKED BEFORE ANYTHING ELSE.
//
// THE OWNER'S, and it is a correction of the surface I built two days ago: "now i
// cannot choose if i want to add a work, a board for quote, an anthology, a quote,
// or import stuff. that should be the first screen. if a work/board/anthology is
// chosen, i will also need to select the work/board/anthology there."
//
// What the previous chooser got wrong was the LEVEL it asked at. It offered eleven
// doors in three groups — book, film, show, game, board, highlight, line, and the
// seven quote kinds — which is a list of FORMS. But the first thing a reader knows
// is not which form they want; it is what they are putting a quote into. Asking
// for the form first meant "a highlight" and "a book" sat side by side as though
// they were alternatives, when one is a thing you add to the other.
//
// So there are two questions, in the order a person actually answers them:
//
//   1. WHICH MODE, and for a work, a board or an anthology, WHICH ONE — both on the
//      first screen, because "a work" with no work named is not an answer.
//   2. WHAT TO ADD INTO IT, on the second, whose header says what was chosen.
//
// A PURE TABLE, import-free, for the reason addFields.js is one: the mapping from a
// mode to the forms it can reach is the sort of fact a test should be able to read
// without mounting a modal, and the bug it guards against is a mode that leads
// nowhere — a door in the chooser that opens onto an empty panel.

import { QUOTE_KIND_DOORS } from './addFields.js'

// The five, in the order the first screen offers them: the three containers
// first — a work, a board, an anthology — then the standalone quote, then the
// bulk path. Machine values; the words are the locale file's.
export const ADD_MODES = ['work', 'board', 'anthology', 'quote', 'import']

// WHICH MODES CANNOT ACT UNTIL SOMETHING IS NAMED. A work and a board are
// containers: a highlight belongs to a book and a proverb sits on a board, so the
// form cannot open until the reader has said which. A standalone quote has no
// container to choose (its board is a field ON the form, where the owner put it —
// "for quotes, board will always be just below quote and spoken by/written by"),
// and import has nothing to choose at all.
//
// ANTHOLOGY IS HERE ON THE SAME REASONING and answers false all the same, because
// it has nowhere to go yet — see `modeIsHeld`.
export function modeNeedsTarget(mode) {
  return mode === 'work' || mode === 'board'
}

// A MODE THAT IS OFFERED AND CANNOT YET ACT, which is exactly one of them.
//
// The owner set anthologies aside earlier — "anthology is due for a revamp. we
// will tackle that later" — and then asked for the mode in the chooser anyway.
// Both are right: leaving it out makes the first screen lie about what the app
// holds, and wiring it to a half-built form ships something misleading. So it is
// listed, it is pressable, and what it opens says plainly that it is coming.
//
// The alternative was a disabled button, and this app's own rule is against it: a
// control that cannot be pressed cannot say why, and "why is this grey" is the one
// question a reader cannot answer for themselves.
export function modeIsHeld(mode) {
  return mode === 'anthology'
}

// WHICH FORMS A SETTLED MODE REACHES. [] means the mode draws no quote form at
// all — import has its own surface and an anthology is held.
//
// The one-door cases matter as much as the many: a book reaches exactly one form,
// so naming the book IS choosing the form and the reader is not asked again. That
// is the half of the old design worth keeping — "nobody is asked twice" — and it
// is expressed here as a list of length one rather than as a special case.
export function doorsFor(mode, target) {
  if (mode === 'work') {
    if (!target) return []
    // A game and a show are `movies` rows like a film (0040), so the medium picks
    // the locator inside the dialogue form rather than picking a different form.
    return [target.type === 'movie' || target.kind === 'screen' ? 'dialogue' : 'annotation']
  }
  if (mode === 'board') {
    if (!target) return []
    // 0037 gives a board two kinds and argues against a third, and exactly one of
    // them has behaviour behind it: a proverb board knows what its next line is,
    // and a plain board genuinely does not know whether it is a letter or a song.
    return target.kind === 'proverb' ? ['proverb'] : [...QUOTE_KIND_DOORS]
  }
  if (mode === 'quote') return [...QUOTE_KIND_DOORS]
  return []
}

// The door to open with no further asking, or null when the reader must choose.
// One place, so the form-opens-immediately rule cannot drift from the list above.
export function soleDoor(mode, target) {
  const doors = doorsFor(mode, target)
  return doors.length === 1 ? doors[0] : null
}
