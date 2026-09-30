// THE LIBRARY'S GAPS, stated once: which works are missing what, and which person
// records a fetch could complete.
//
// FOUR PLACES COUNT WITH THESE, and each used to be a place a copy could drift:
// Metadata's consoles and its index, the rail's Metadata badge (App.jsx), and
// Settings › Jobs' Common jobs card, which says what each job has left to do. The
// owner, of the card: "This card should also know about what all are pending (from
// metadata)." A number that means the same thing on two screens is one function,
// or the day one of them changes the reader is told two different amounts of work.
//
// Pure: it reads the rows GET /metadata/library and GET /people/records answer
// and speaks to nobody.

// The gaps each half of the library can have, in the order they are drawn. The
// filter pills and the index walk these.
export const BOOK_GAPS = ['no_cover', 'low_res', 'no_author', 'no_series', 'no_year', 'no_genre', 'no_source']
export const MOVIE_GAPS = ['no_poster', 'low_res', 'no_cast', 'no_director', 'no_year', 'no_genre', 'no_source']

// `ok` IS "EVERY OTHER FILTER WOULD REJECT IT", not a predicate of its own, and
// that is the only definition that cannot drift. A hand-written "complete" test
// is a second list of what completeness means, and the day a gap is added it
// becomes the stale one — a work missing the new field would go on being called
// complete, which is the one answer this filter must never give wrongly.
const completeBy = (gaps, passes) => (x) => !gaps.some((g) => passes(x, g))

export function bookPasses(b, filter) {
  const p = {
    flagged: (b) => !b.has_cover || !b.has_ids, no_cover: (b) => !b.has_cover,
    low_res: (b) => b.low_res_cover, no_author: (b) => !b.has_author,
    no_series: (b) => !b.has_series, no_year: (b) => !b.has_year,
    no_genre: (b) => !b.has_genre, no_source: (b) => !b.has_ids,
    // A BOOK'S PEOPLE ARE ITS AUTHOR. The pack draws one "No people" over the
    // whole library; each shelf answers it with the credit it actually has.
    no_people: (b) => !b.has_author,
    no_synopsis: (b) => !b.has_description,
    ok: completeBy(BOOK_GAPS.concat('no_people', 'no_synopsis'), bookPasses),
    all: () => true,
  }[filter]
  // A FILM'S GAP ASKED OF A BOOK MATCHES NOTHING: a book has no poster to be
  // missing. The all-types view asks every gap of every row.
  return p ? p(b) : false
}
export function moviePasses(m, filter) {
  const p = {
    flagged: (m) => !m.has_poster || !m.has_cast || !m.has_source, no_poster: (m) => !m.has_poster,
    low_res: (m) => m.low_res_poster, no_cast: (m) => !m.has_cast,
    no_director: (m) => !m.has_director, no_year: (m) => !m.has_year,
    no_genre: (m) => !m.has_genre, no_source: (m) => !m.has_source,
    // A FILM'S PEOPLE ARE ITS CAST, not its director — the pack's own fixture
    // flags a Ray film with a director and no cast as `nopeople`
    // (`metadata.dc.html:464`). A film credited to nobody on screen is the row
    // worth reaching; one with no director is `no_director`, beside it.
    no_people: (m) => !m.has_cast,
    no_synopsis: (m) => !m.has_description,
    ok: completeBy(MOVIE_GAPS.concat('no_people', 'no_synopsis'), moviePasses),
    all: () => true,
  }[filter]
  return p ? p(m) : false
}

// A PERSON RECORD'S TWO GAPS A FETCH CAN FILL, the server's, read off the row
// (personLacks in internal/httpapi/jobs_common.go is the one statement of the rule)
// rather than worked out here. `fetchable` is the records with either: what the
// People console's Fetch missing fetches and what "Fetch missing people" walks.
export const lacksLinks = (p) => !!p.no_links
export const lacksPhoto = (p) => !!p.no_photo
export const fetchable = (p) => lacksLinks(p) || lacksPhoto(p)
