# ADR-0745: The match picker's "By id", and why it shows rather than edits

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The prototype's second tool on the picker surface is "By id", said as "TMDB, TVDB or IGDB
id" — a control you type an id into.*

- **It SHOWS the pinned ids and says where to change them.** A typed id there would be a
  third editor for columns the Ids strip on the Details panel already owns, and two
  editors of one field is how they come to disagree — which is the whole argument that
  strip was built on ("Ids saved — every one in a single request"). The mode therefore
  prints what the search is pinned to and names the strip, and its Search button is
  disabled when there is nothing pinned. The reader still gets what the tool promises,
  which is a search that names one record exactly rather than a title that cannot tell
  two films apart.
- **The rejected alternative is the prototype's literal shape**: an id field on this
  surface, saving on blur. It was rejected for the reason above and for a second one —
  a lookup is not a save, and this is the one surface in the panel where nothing writes.
  The pack's own note on it is "the picker — a match is proposed, never applied".
- **A director on a candidate row is the other departure, and it is a cost question.** The
  pack's meta line is `2011 · film · David Yates`. A lookup response carries no credits:
  TMDB serves them from a second endpoint per title, so naming the director on nine hits
  is nine extra outbound calls for a line nobody has asked to sort by. The year and the
  medium are drawn, which is the pair that actually separates a film from a game of one
  name.

<sub>Unreleased — `web/frontend/src/CoverPicker.jsx` · `WorkDetails.jsx` ·
`internal/i18n/en.txt`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
