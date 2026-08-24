// The daily deck, fetched once per load instead of twice.
//
// WHAT THIS IS FOR. `GET /review/daily` is the most expensive read in the app: it
// reads the reader's prefs, scans the whole library for the distractor pools, runs
// two bucketed candidate queries and then builds a question per card. Two
// different components asked for it on every load — the shell, which wanted the
// pending count and the streak for its badge, and Home's quiz card, which wanted
// the deck — so the deck was computed twice, back to back, and the SECOND one is
// the one the reader sits watching a "loading" line for.
//
// MEASURED BEFORE CHANGING ANYTHING, because the owner's report was that edits and
// the quiz "take a long time … probably waiting to establish two way connection to
// the server", and a guess about connections would have sent the fix in the wrong
// direction. On a library of 60 books and 1500 highlights, in-process:
//
//	PUT /books/{id}      2.1 ms
//	GET /books           0.75 ms
//	GET /annotations     5.8 ms
//	GET /review/daily    4.2 ms
//
// So the server is not the wait. What the reader is waiting for is round trips —
// and the way to spend fewer of them is not to make each one faster but to stop
// making the ones nobody needed. This is the one duplicate there was.
//
// A COALESCER, NOT A CACHE, and the difference is the whole safety argument. It
// holds the in-flight (or just-settled) promise for a few seconds so that two
// callers on one page load share one request. It is NOT a store of the deck: the
// deck changes the moment a card is answered, and a cache would then hand a
// remounted quiz card cards it has already been asked. So the window is short, an
// answer clears it explicitly (forgetDailyDeck), and a failed request is never
// held at all — a retry has to be a retry.

import { json } from './api.js'

// Long enough for a page load's two callers to meet — the shell's effect and
// Home's card mount are milliseconds apart — and far too short to be mistaken for
// state. Anything longer starts to be a cache, with a cache's staleness problem.
const WINDOW_MS = 5000

let inflight = null // { at, offset, promise }

// tzOffsetMinutes is the caller's business; the offset is part of the key because
// the deck IS the day, and a day that changed is a different deck.
export function dailyDeck(offset) {
  const now = Date.now()
  if (inflight && inflight.offset === offset && now - inflight.at < WINDOW_MS) {
    return inflight.promise
  }
  const promise = json('GET', `/review/daily?offset=${offset}`).then((r) => {
    // A REFUSAL IS NOT SHARED. Holding a failure for five seconds means the second
    // caller inherits an error it could have avoided, and the reader's retry does
    // nothing — which reads as the app being broken rather than the network.
    if (!r.ok) forgetDailyDeck()
    return r
  })
  inflight = { at: now, offset, promise }
  return promise
}

// Called whenever something has changed what the deck would contain, or WHO would
// be reading it: an answer grades a card and takes it out of today's list, and a
// sign-out means the next caller is somebody else.
//
// THE SIGN-OUT CASE IS NOT THEORETICAL, and it is the one this module could get
// wrong in the direction that matters. The key is the timezone offset, which two
// people on one machine share — so without this, signing out and straight back in
// as somebody else inside the window served them the first reader's deck, pending
// count and streak. Every query in this app is scoped by user_id; a cache in front
// of one has to be too, and the cheapest way to key a five-second window by user
// is to throw it away when the user changes.
export function forgetDailyDeck() {
  inflight = null
}
