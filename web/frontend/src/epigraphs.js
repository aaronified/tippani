// epigraphs.js — the line above the sign-in box.
//
// A login screen is a locked door, and this app's whole subject is the sentence
// somebody kept. So it opens with one, and a different one each time you come back.
//
// UNATTRIBUTED, AND WRITTEN FOR THIS APP. That is the entire design decision, and it
// is the same rule greetings.js sets for festivals: nothing here can be
// confidently wrong. A login screen cannot fetch your library — there is no session
// yet — so the pool has to be bundled, and a bundled pool of FAMOUS quotes is a
// bundled list of attributions written from memory. Misquoting somebody, on the
// front door of an app that exists to quote people accurately, is worse than saying
// nothing. These are the app's own voice, so there is nobody to misquote.
//
// No dependency on the server, no network call, nothing stored. `pick` is random
// rather than seeded, because a different line on every visit is the point.
const EPIGRAPHS = [
  'A margin is a promise: that there is always room to answer back.',
  'The book is the author’s. The margin is yours.',
  'Nothing is really read until something is written beside it.',
  'A quote you cannot find again is a quote you did not keep.',
  'Reading twice is not repetition. It is the second half of reading once.',
  'Keep the line, and the book keeps you.',
  'Underlining is a question. A note is the answer.',
  'What you copied out by hand is what you actually read.',
  'A commonplace book is a memory you are allowed to lend.',
  'The margin is the only part of a book that is about you.',
]

// pickEpigraph returns one line. Exported for the login screen and for the test
// that keeps this file honest.
export function pickEpigraph(rand = Math.random) {
  return EPIGRAPHS[Math.floor(rand() * EPIGRAPHS.length) % EPIGRAPHS.length]
}

export { EPIGRAPHS }
