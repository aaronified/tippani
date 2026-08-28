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

import { t } from './i18n.js'

// The question types, in the order the settings screen lists them.
//
// `universal: false` marks one that cannot be asked of every card. The two
// "who?" questions are the exceptions — `speaker` needs something with a
// recorded speaker and `author` needs a book — which is why "keep at least one"
// is not the same rule as "keep at least one universal one", and why the second
// is the one that matters.
//
// `decks` is where a type may be offered AT ALL, as against where it is on by
// default. Flip names only practice, and that is the 1.15.3 decision written
// down: the daily deck is server-marked from end to end, and one self-marked
// card in five does not make it slightly softer, it makes the score mean
// something else.
//
// TWO AXES, NAMED (3.0). `klass` is WHAT is being asked — which work, which
// quote, who, or the words themselves — and `form` is HOW you answer it: pick
// one, type it, or mark yourself. They were one undifferentiated list of five,
// which is why the list read as arbitrary rather than as a grid with holes in
// it: the same class asked a second way ("fill the blank, with choices") had
// nowhere to be, and a whole class ("who wrote this?") was missing without
// anything saying so. The two fields are what the chip tooltips say out loud,
// and what makes the next hole in the grid visible.
export const REVIEW_QUESTIONS = [
  {
    id: 'source',
    get label() { return t('quiz.question.source.label') },
    get hint() { return t('quiz.question.source.hint') },
    klass: 'work',
    form: 'choose',
    universal: true,
    decks: ['daily', 'practice'],
  },
  {
    id: 'quote',
    get label() { return t('quiz.question.quote.label') },
    get hint() { return t('quiz.question.quote.hint') },
    klass: 'quote',
    form: 'choose',
    universal: true,
    decks: ['daily', 'practice'],
  },
  {
    id: 'cloze',
    get label() { return t('quiz.question.cloze.label') },
    get hint() { return t('quiz.question.cloze.hint') },
    klass: 'words',
    form: 'type',
    universal: true,
    decks: ['daily', 'practice'],
  },
  {
    id: 'cloze-mcq',
    get label() { return t('quiz.question.cloze-mcq.label') },
    get hint() { return t('quiz.question.cloze-mcq.hint') },
    klass: 'words',
    form: 'choose',
    universal: true,
    decks: ['daily', 'practice'],
  },
  {
    id: 'speaker',
    get label() { return t('quiz.question.speaker.label') },
    get hint() { return t('quiz.question.speaker.hint') },
    klass: 'person',
    form: 'choose',
    universal: false,
    decks: ['daily', 'practice'],
  },
  {
    id: 'author',
    get label() { return t('quiz.question.author.label') },
    get hint() { return t('quiz.question.author.hint') },
    klass: 'person',
    form: 'choose',
    universal: false,
    decks: ['daily', 'practice'],
  },
  {
    id: 'flip',
    get label() { return t('quiz.question.flip.label') },
    get hint() { return t('quiz.question.flip.hint') },
    klass: 'work',
    form: 'self',
    universal: true,
    decks: ['practice'],
  },
]

// The two axes, as words. A chip's tooltip ends with them, so the panel says
// which of the six questions are the same question asked differently — which is
// the thing a flat list of chips cannot show.
export const QUESTION_CLASSES = {
  work: 'quiz.class.work.label',
  quote: 'quiz.class.quote.label',
  person: 'quiz.class.person.label',
  words: 'quiz.class.words.label',
}

export const QUESTION_FORMS = {
  choose: 'quiz.form.choose.label',
  type: 'quiz.form.type.label',
  self: 'quiz.form.self.label',
}

// taxonomy is the one line appended to a question's hint: "Who is behind it ·
// Pick one of four".
export function taxonomy(q) {
  if (!q?.klass || !q?.form) return ''
  return t('quiz.taxonomy.line', { klass: t(QUESTION_CLASSES[q.klass]), form: t(QUESTION_FORMS[q.form]) })
}

// A deck row is [id, label] and Settings destructures it, so the shape cannot
// change — but the label has to resolve at RENDER time, not at module scope,
// because a locale is applied after this file loads. So slot 1 is a getter.
function deckRow(id, key) {
  const row = [id, '']
  Object.defineProperty(row, 1, { get: () => t(key), enumerable: true, configurable: true })
  return row
}

export const REVIEW_DECKS = [
  deckRow('daily', 'quiz.daily.label'),
  deckRow('practice', 'quiz.practice.label'),
]

// The defaults, which have to match defaultReviewQuestions() in Go.
export const DEFAULT_QUESTIONS = {
  daily: ['source', 'quote', 'cloze', 'cloze-mcq', 'speaker', 'author'],
  practice: ['source', 'quote', 'cloze', 'cloze-mcq', 'speaker', 'author', 'flip'],
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
  return t('quiz.question.last-universal.info')
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

// ---- the numbers behind the schedule (1.16.0) ------------------------------
//
// review_questions.go handed over WHAT the deck asks. This is HOW HARD it is.
// Every one of these was a package constant until now, which made the review
// loop the one part of the app whose behaviour was an opinion you could not
// disagree with.
//
// The bounds mirror clampTuning in Go, and they are not decoration: these
// multiply a half-life on EVERY answer, so a bad one does not produce a wrong
// screen, it produces a quietly useless schedule. A grow below 1 shortens a card
// on every correct answer — a quote you know perfectly, asked more and more
// often, for ever. Nothing errors and nothing looks broken.
export const TUNING_FIELDS = [
  {
    key: 'grow', min: 1.1, max: 5, step: 0.1, format: 'common.slider.multiplier.format', decimals: 2,
    get label() { return t('quiz.tuning.grow.label') },
    get hint() { return t('quiz.tuning.grow.hint') },
  },
  {
    key: 'shrink', min: 0.1, max: 0.95, step: 0.05, format: 'common.slider.multiplier.format', decimals: 2,
    get label() { return t('quiz.tuning.shrink.label') },
    get hint() { return t('quiz.tuning.shrink.hint') },
  },
  {
    key: 'clozeGrow', min: 1, max: 3, step: 0.05, format: 'common.slider.multiplier.format', decimals: 2,
    get label() { return t('quiz.tuning.cloze-grow.label') },
    get hint() { return t('quiz.tuning.cloze-grow.hint') },
  },
  {
    key: 'clozeShrink', min: 0.2, max: 1, step: 0.05, format: 'common.slider.multiplier.format', decimals: 2,
    get label() { return t('quiz.tuning.cloze-shrink.label') },
    get hint() { return t('quiz.tuning.cloze-shrink.hint') },
  },
  {
    // 0 to 1, because a synonym cannot be worth MORE than the word it stood in
    // for. See clozeSynonymWeight in Go: this scales the stretch, not the result.
    key: 'clozeSynonym', min: 0, max: 1, step: 0.05, format: 'common.slider.multiplier.format', decimals: 2,
    get label() { return t('quiz.tuning.cloze-synonym.label') },
    get hint() { return t('quiz.tuning.cloze-synonym.hint') },
  },
  {
    key: 'clozeWords', min: 1, max: 100, step: 1, format: 'common.slider.days.format', decimals: 0,
    get label() { return t('quiz.tuning.cloze-words.label') },
    get hint() { return t('quiz.tuning.cloze-words.hint') },
  },
  { key: 'ladder1', min: 7, max: 100, step: 1, format: 'common.slider.days.format', decimals: 0,
    get label() { return t('quiz.tuning.ladder-1.label') },
    get hint() { return t('quiz.tuning.ladder-1.hint') } },
  { key: 'ladder2', min: 7, max: 100, step: 1, format: 'common.slider.days.format', decimals: 0,
    get label() { return t('quiz.tuning.ladder-2.label') },
    get hint() { return t('quiz.tuning.ladder-2.hint') } },
  { key: 'ladder3', min: 7, max: 100, step: 1, format: 'common.slider.days.format', decimals: 0,
    get label() { return t('quiz.tuning.ladder-3.label') },
    get hint() { return t('quiz.tuning.ladder-3.hint') } },
]

export const DEFAULT_TUNING = {
  grow: 2.5, shrink: 0.5, clozeGrow: 1.25, clozeShrink: 0.85, clozeSynonym: 0.5, clozeWords: 30,
  ladder1: 7, ladder2: 30, ladder3: 100,
}

export function parseTuning(blob) {
  const out = { ...DEFAULT_TUNING }
  if (!blob) return out
  try {
    const raw = JSON.parse(blob)
    if (raw && typeof raw === 'object') {
      for (const k of Object.keys(DEFAULT_TUNING)) {
        if (typeof raw[k] === 'number') out[k] = raw[k]
      }
    }
  } catch {
    return { ...DEFAULT_TUNING }
  }
  return out
}

// tuningBlob renders back to storage, empty when it matches the defaults — so an
// untouched account picks up any later change to them.
//
// THE LADDER MUST ASCEND. The server reverts a ladder that does not, silently,
// which would be a slider that moves and then does nothing; the panel refuses
// instead, the way the question toggles do.
export function tuningProblem(tune) {
  if (!(tune.ladder1 < tune.ladder2 && tune.ladder2 < tune.ladder3)) {
    return t('quiz.tuning.ladder.error')
  }
  return ''
}

export function tuningBlob(tune) {
  const same = Object.keys(DEFAULT_TUNING).every((k) => Number(tune[k]) === DEFAULT_TUNING[k])
  if (same) return ''
  return JSON.stringify(Object.fromEntries(Object.keys(DEFAULT_TUNING).map((k) => [k, Number(tune[k])])))
}
