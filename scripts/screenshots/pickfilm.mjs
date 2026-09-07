// WHICH FILM A PROBE OPENS, DECIDED WITHOUT A BROWSER.
//
// WHY THIS IS ITS OWN FILE — the same argument `ratchet.mjs` and `dragverdict.mjs`
// make. `run-panel-depth.sh` passed `--movie-id 2`, a fact about the SEEDED fixture
// (`seed-cast.mjs --movie-id 2` is what puts a cast on it). Pointed at a restored
// archive the same flag asks for `/catalogue/2`, which need not be a film at all:
// measured, the probe sat on `waitForSelector('.tp-btn')` for thirty seconds and
// died with a message about a button. So the subject is resolved from the library
// that is actually loaded — and resolving it is a decision with two ways to be
// wrong, both of which cost a browser run to discover:
//
//   RETURNING A FILM THAT DOES NOT FIT. The first cut ended `return
//   String(list[0])` under a comment promising `null`, so a library whose first
//   twelve films had no cast handed `panel-depth.mjs` a film with none — exactly
//   the failure this function exists to prevent, one step later.
//
//   BEING STRICTER THAN THE CALLER NEEDS. `sheet-drag.mjs` reaches its sheet
//   through any film's Details and does not care about the cast; `panel-depth.mjs`
//   opens a cast face and cares a lot. One function, and the difference is passed
//   IN — the repo's directive about two things that look the same.
//
// The two lookups are injected, so this answers in a millisecond and the browser
// half is four lines in `capture.mjs`.

// { films, castCount, wantCast, limit } -> an id as a string, or null.
//
// `films()` yields the library's film ids, newest-first or however the API orders
// them; `castCount(id)` yields how many cast rows that film has. Null means the
// loaded library has nothing this probe can work on, and a caller that gets null
// should SKIP and say so rather than press on.
export async function pickFilm({ films, castCount, wantCast = false, limit = 12 }) {
  const ids = await films()
  if (!ids || !ids.length) return null
  if (!wantCast) return String(ids[0])
  for (const id of ids.slice(0, limit)) {
    // A LOOKUP THAT FAILS IS NOT A CAST. A 404 or a network error on one film must
    // not end the search — the next film may be the one.
    let n = 0
    try { n = await castCount(id) } catch { n = 0 }
    if (n > 0) return String(id)
  }
  return null
}
