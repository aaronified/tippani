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
//
// THE POOL IS KEYS, NOT LINES. The copy lives in the locale files under
// greeting.epigraph.*, so a language can carry its own epigraphs rather than a
// translation of these; the index in the key IS the pool member's identity.
import { t } from './i18n.js'

const EPIGRAPHS = [
  'greeting.epigraph.1',
  'greeting.epigraph.2',
  'greeting.epigraph.3',
  'greeting.epigraph.4',
  'greeting.epigraph.5',
  'greeting.epigraph.6',
  'greeting.epigraph.7',
  'greeting.epigraph.8',
  'greeting.epigraph.9',
  'greeting.epigraph.10',
]

// pickEpigraph returns one line. Exported for the login screen and for the test
// that keeps this file honest.
export function pickEpigraph(rand = Math.random) {
  return t(EPIGRAPHS[Math.floor(rand() * EPIGRAPHS.length) % EPIGRAPHS.length])
}

export { EPIGRAPHS }
