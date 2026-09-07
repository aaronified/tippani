// EVERY CACHE IN FRONT OF A PER-USER QUERY, AND ONE PLACE THAT EMPTIES THEM ALL.
//
// THE INVARIANT THIS SERVES, from CLAUDE.md: "Per-user isolation: every query
// scoped by `user_id`; another user's row is `404`, never `403`." DEVELOPMENT.md
// calls it a security property. A cache in front of such a query has to be scoped
// the same way, and the cheapest way to scope a module-scope cache by user is to
// throw it away when the user changes.
//
// AND SIGNING OUT DOES NOT RELOAD THE DOCUMENT. `App`'s Log out is `setUser(null)`,
// which swaps the shell for the login screen in place — so every module-scope
// binding in the app survives it, and a cache written by one reader is still there
// for the next one. (Switch account is different: it sets `window.location.href`,
// and a reload takes every cache with it. Log out is the path that leaks.)
//
// WHY A REGISTRY RATHER THAN A LIST OF CALLS. This has already gone wrong twice in
// the same shape. `daily.js` grew `forgetDailyDeck` because signing out and back in
// as somebody else inside a five-second window served the first reader's deck,
// pending count and streak; the fix was one call added to Log out by hand. Then
// `SearchPage.jsx` cached the search vocabulary "for the session" — nine queries
// each scoped by `user_id` — with no forget at all, and nothing anywhere noticed,
// because remembering to add the call is a habit and habits do not fail loudly.
//
// So a cache ENROLS ITSELF at module scope and Log out empties whatever is
// enrolled. A cache added next year cannot forget, because forgetting now means
// not calling `registerSessionCache` at all — which is the one thing
// `session-caches.test.js` sweeps for.
const forgets = new Set()

// THE ERA IS WHAT MAKES A FORGET STICK. Emptying a cache does not stop the request
// that was already out: its continuation still runs, and if it writes what it got
// into the cache, the previous reader's answer arrives AFTER the new reader signed
// in — so the cache is refilled by the very request the forget was meant to
// discard. Clearing the pending slot does not help either; the promise's `.then`
// holds its own references.
//
// Found by a test written for the forget and not for this: emptying
// `vocabCache` and `vocabPending` both, and the second reader was still served the
// first reader's authors, because the held request landed in between.
//
// So a cache whose continuation writes back captures `sessionEra()` when it starts
// the request and drops the answer if the era has moved. One counter for every
// cache, because "compare a generation" is one idea and a copy per module is how
// three of them end up with two spellings and one bug.
let era = 0

// registerSessionCache — called at module scope by anything holding a cache of a
// per-user response. `forget` must empty it AND drop any in-flight promise that
// would refill it, or the request the previous reader started lands in the new
// reader's cache.
export function registerSessionCache(forget) {
  forgets.add(forget)
  return forget
}

// sessionEra — which reader the caches currently belong to. Captured by a cache
// before it starts a request; compared when the answer lands.
export function sessionEra() {
  return era
}

// forgetSessionCaches — called when the reader changes. Every enrolled cache is
// emptied; a `forget` that throws does not stop the others, because a cache left
// full is the failure this exists to prevent and one broken module must not cause
// it in the rest.
export function forgetSessionCaches() {
  era++
  for (const forget of forgets) {
    try {
      forget()
    } catch {
      // Nothing to do about it here, and the remaining caches still have to go.
    }
  }
}

// Test seam only: how many caches are enrolled. A sweep that found no registered
// cache would otherwise pass over an app that had stopped registering them.
export function sessionCacheCount() {
  return forgets.size
}
