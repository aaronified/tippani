// quiz.js — what the two decks are allowed to ask, and the rules that stop you
// switching them off entirely.
//
// The server owns this (review_questions.go) and normalises whatever arrives, so
// nothing here is a security boundary. What it is, is the difference between a
// control that refuses and a control that accepts and then silently undoes
// itself: turning off the last question type would come back from the PUT as the
// defaults, and the switch would flip back under the reader's finger with no
// explanation. So the rules are mirrored, the offending toggle is DISABLED with
// a reason, and the two implementations are kept honest by a test that asserts
// the same table on both sides.
//
// Strings in, values out — no React, no fetch — so it loads in the `pure` test
// project the way facets.js and languages.jsx do.

// The question types, in the order the settings screen lists them.
//
// `universal: false` marks one that cannot be asked of every card. `speaker`
// only applies to a line of dialogue — a book has no cast — which is why "keep
// at least one" is not the same rule as "keep at least one universal one", and
// why the second is the one that matters.
//
// `decks` is where a type may be offered AT ALL, as against where it is on by
// default. Flip names only practice, and that is the 1.15.3 decision written
// down: the daily deck is server-marked from end to end, and one self-marked
// card in five does not make it slightly softer, it makes the score mean
// something else.
export const REVIEW_QUESTIONS = [
  {
    id: 'source',
    label: 'Name the source',
    hint: 'Shows the quote and asks which book, film, show, game or speech it came from. Multiple choice.',
    universal: true,
    decks: ['daily', 'practice'],
  },
  {
    id: 'quote',
    label: 'Pick the quote',
    hint: 'The other way round: shows the work and asks which of these lines came out of it. Multiple choice.',
    universal: true,
    decks: ['daily', 'practice'],
  },
  {
    id: 'cloze',
    label: 'Fill in the blank',
    hint: 'Blanks a phrase out of the quote and asks you to type it back. Graded on the server, and forgiving about typos and punctuation. Worth more than a multiple choice, and costs less when you miss it.',
    universal: true,
    decks: ['daily', 'practice'],
  },
  {
    id: 'speaker',
    label: 'Who said this?',
    hint: 'Films, shows and games only — a book has no cast, so this is simply never asked of a highlight.',
    universal: false,
    decks: ['daily', 'practice'],
  },
  {
    id: 'flip',
    label: 'Flip and self-mark',
    hint: 'Shows the quote, reveals the source, and asks you whether you had it. Nothing checks the answer, so it is offered in Practice only — and drops out there too once Practice is scored.',
    universal: true,
    decks: ['practice'],
  },
]

export const REVIEW_DECKS = [
  ['daily', 'Daily quiz'],
  ['practice', 'Practice'],
]

// The defaults, which have to match defaultReviewQuestions() in Go.
export const DEFAULT_QUESTIONS = {
  daily: ['source', 'quote', 'cloze', 'speaker'],
  practice: ['source', 'quote', 'cloze', 'speaker', 'flip'],
}

const ORDER = REVIEW_QUESTIONS.map((q) => q.id)
const byId = (id) => REVIEW_QUESTIONS.find((q) => q.id === id) || null

// allowedIn is whether a type may appear in a deck at all — as against whether
// the reader has it switched on.
export function allowedIn(id, deck) {
  const q = byId(id)
  return !!q && q.decks.includes(deck)
}

export function questionsFor(deck) {
  return REVIEW_QUESTIONS.filter((q) => q.decks.includes(deck))
}

// clean applies the three rules, in the same order the server does: drop what
// this build does not know, drop what the deck may not ask, and fall back to the
// defaults when nothing universal survives.
function clean(list, deck) {
  const out = ORDER.filter((id) => list.includes(id) && allowedIn(id, deck))
  return out.some((id) => byId(id).universal) ? out : [...DEFAULT_QUESTIONS[deck]]
}

// parseQuestions reads the stored blob. Anything unreadable is the defaults — a
// corrupt preference must not be able to break the screen that would fix it.
export function parseQuestions(blob) {
  const def = { daily: [...DEFAULT_QUESTIONS.daily], practice: [...DEFAULT_QUESTIONS.practice] }
  if (!blob) return def
  let raw
  try {
    raw = JSON.parse(blob)
  } catch {
    return def
  }
  if (!raw || typeof raw !== 'object') return def
  const out = def
  // Absent and empty are different requests, exactly as on the server: an older
  // client that only knows one deck must leave the other alone.
  if (Array.isArray(raw.daily)) out.daily = clean(raw.daily, 'daily')
  if (Array.isArray(raw.practice)) out.practice = clean(raw.practice, 'practice')
  return out
}

// questionsBlob renders back to storage, and returns '' when it matches the
// defaults — so an account that has never customised this stores nothing and
// picks up any later change to the defaults, the same rule the language marks
// follow. '' is also exactly what Back to defaults sends.
export function questionsBlob(state) {
  const daily = clean(state.daily || [], 'daily')
  const practice = clean(state.practice || [], 'practice')
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
  if (same(daily, DEFAULT_QUESTIONS.daily) && same(practice, DEFAULT_QUESTIONS.practice)) return ''
  return JSON.stringify({ daily, practice })
}

// lockedOff is why a toggle cannot be turned off, or '' when it can be.
//
// THE MESSAGE IS THE POINT. A disabled switch with no reason reads as a bug, and
// this is the one place in the settings where a control legitimately refuses.
export function lockedOff(state, deck, id) {
  const list = state[deck] || []
  if (!list.includes(id)) return '' // turning something ON is never refused
  if (!byId(id)?.universal) return ''
  const others = list.filter((x) => x !== id && byId(x)?.universal)
  if (others.length > 0) return ''
  return 'Every deck needs at least one question it can ask of a book as well as a film — this is the last one.'
}

// toggle flips one type in one deck, and refuses rather than silently reverting.
export function toggle(state, deck, id) {
  if (!allowedIn(id, deck)) return state
  const list = state[deck] || []
  if (list.includes(id)) {
    if (lockedOff(state, deck, id)) return state
    return { ...state, [deck]: list.filter((x) => x !== id) }
  }
  return { ...state, [deck]: ORDER.filter((x) => list.includes(x) || x === id) }
}
