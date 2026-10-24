# ADR-0765: The decade search reaches the quotes it was already counting

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**Reported as a gap in the note above, and the owner's answer was "plug it!!"** So this
is the same change finished rather than a new one: making a quote datable to 399 BCE and
then leaving the one search that asks about 399 BCE unable to find it is half a feature.

**THE SAME DEFECT IN TWO PLACES, ARRIVED AT INDEPENDENTLY.** `searchDecadeFacet` took
`wantBooks, wantMovies bool` — two of the five kinds — and `SearchPage`'s decade section
summed two arrays for its heading and rendered two arrays in its body. Neither knew about
`occasion_date`, which is the only date a row carries that is not borrowed from a parent
work: a book highlight and a film line arrive inside the book or the film they came from,
and a standalone quote has nowhere to arrive.

**AND THE CHART HAD BEEN AHEAD OF BOTH OF THEM.** `timelineYears`'s UNION has a branch
reading `substr(occasion_date, 1, 5)` for exactly these quotes, and `bucketQuery` makes
every decade tick a door into this facet — with a zero-padded query, deliberately, so a
column for the 50s CE does not open the 1950s. So a library holding one quote from 399 BCE
drew a bar over that decade and the door under the bar opened an empty page. The chart was
right; the facet it linked to was two kinds short.

**THE FIX FOR THE SECTION IS A DELETION.** The date facet's section already handled all
five kinds correctly, thirty lines from the decade one that handled two. That is the
repo's own directive — a control on two screens lives in one function — so there is one
`FacetSection` now, taking its heading as a function, and the decade facet is the date
facet with a different question. `facetCount` is separate because the heading is the part
that goes stale: a facet learns a kind, the body renders it, and the number above it goes
on saying "2 works" over a page holding three things.

**ONE GUARD IS LOAD-BEARING AND IT IS NOT OBVIOUS.** `CAST('' AS INTEGER)` is 0 in SQLite,
and `0s` is a legal decade query whose range is 0-9 — so without `u.occasion_date <> ''`
that single search returns every undated quote in the library as though it were from the
first decade of the era. Verified by removing the clause and watching the case fail rather
than by reasoning about it.

**AND THE ORDER IS BY THE NUMBER, NOT THE COLUMN,** for the reason the Quotes screen's
"said" sort now is: within a BCE decade the padded text runs backwards, because a minus
sign reverses the order it prefixes, so 380 BCE would file itself before 389 BCE.

**TWO OF MY OWN TEST EXPECTATIONS WERE WRONG and the code was right both times.** `40s`
means the 1940s — the two-digit shorthand `TestParseDecade` has pinned since the facet
shipped — so a year under 1000 is queried in the padded form, which is what the timeline
links with anyway. And the scope value is `quotes`, not `utterances`: the struct field is
`utterances` and the wire word is not.

<sub>Unreleased — `internal/httpapi/search_handler.go` · `search_decade_test.go` ·
`web/frontend/src/SearchPage.jsx` · `test/dom/decade-quotes.test.jsx` (new)</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
