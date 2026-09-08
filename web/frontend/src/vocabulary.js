// THE READER'S OWN VOCABULARY, fetched once and held for the session.
//
// IT LIVED IN SearchPage.jsx AND NOW LIVES HERE, because a second screen needs
// it: Settings' readable-languages chips have to know which languages the
// library actually uses, and SearchPage is lazy-loaded — importing it from
// Settings would pull the whole search screen into the Settings chunk to get one
// list. A capability two screens share is a module, not a screen's export.
import { json } from './api.js'
import { registerSessionCache, sessionEra } from './sessionCaches.js'

// ---- the vocabulary, fetched once and held for the session ------------------
//
// ONE REQUEST, NOT ONE PER KEYSTROKE. A personal library's vocabulary is a few
// hundred names — small enough to filter in the browser and far too small to be
// worth a round trip behind every character typed into a box that is already a
// typeahead over the whole library.
//
// The cache is at MODULE scope rather than in the hook, so leaving Search and
// coming back does not re-fetch, and the two places that will want this (the
// box, and the filter sheets) share one copy. `pending` deduplicates the case
// that actually happens: two components focusing in the same tick.
let vocabCache = null
let vocabPending = null

// AND IT IS EMPTIED WHEN THE READER CHANGES. `GET /search/vocabulary` is nine
// queries each scoped by `user_id` — every author, performer, tag, colour and
// shelf name in ONE library — and this held it "for the session" with nothing
// clearing it anywhere. Signing out does not reload the document (App's Log out is
// `setUser(null)`), so on a shared browser the next account was offered the
// previous one's vocabulary in its search box. The pending promise goes with it: a
// request the previous reader started must not land in this cache afterwards.
registerSessionCache(() => {
  vocabCache = null
  vocabPending = null
})

// What is already in hand, for a hook that wants to render before it asks. A
// FUNCTION rather than the binding itself: the cache is reassigned on each fetch
// and nulled on sign-out, so an importer holding the value would go on showing
// the previous reader's vocabulary.
export function cachedVocabulary() {
  return vocabCache
}

export function primeSearchVocabulary() {
  if (vocabCache) return Promise.resolve(vocabCache)
  if (!vocabPending) {
    // WHOSE VOCABULARY THIS IS GOING TO BE. Captured before the request goes out,
    // because a request outlives the reader who started it: sign out while this is
    // in the air and the continuation below still runs, and without this check it
    // writes the previous account's authors, performers and tags into the cache
    // AFTER somebody else has signed in. Emptying the cache on sign-out is not
    // enough on its own — the request that refills it was already gone.
    const era = sessionEra()
    vocabPending = json('GET', '/search/vocabulary').then((r) => {
      if (era !== sessionEra()) return {}
      vocabPending = null
      // A vocabulary that would not load is an empty dropdown, never a broken
      // search box: the grammar still parses and the chips still work, you just
      // do not get offered the values.
      if (r.ok && r.data) vocabCache = r.data
      return vocabCache || {}
    })
  }
  return vocabPending
}
