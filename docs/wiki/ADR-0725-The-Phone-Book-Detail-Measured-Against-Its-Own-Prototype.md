# ADR-0725: The phone book detail, measured against its own prototype

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner sent the phone prototype (`Book Detail Phone.dc.html`) and asked for "near
identical (only where it is not possible … due to a feature conflict)". A nine-agent
pass mapped both sides and produced a ranked, line-cited gap list; this is the first
three items off it, in the order a reader would notice them.*

- **The worst of them was not cosmetic.** The entire `board-head` is wrapped in
  `{!mobile && …}` and `GroupSortField` had exactly one call site, inside it. So the
  grouping, the sort column and the direction — all shipped, all tested — were reachable
  from one of two viewports, and a phone-only reader sat at whatever a desktop session
  had last written into localStorage. A feature that exists on one form factor is a
  feature half the readers do not have.
- **The strip is the pack's band, not a second toolbar.** "A strip that states the count
  should not be as tall as a toolbar, so both controls lose their boxes and keep only
  their words." So `GroupSortField` grew a `compact` trigger — underlined mono, stating
  both halves ("chapter · location") because it is the only thing on that band that can
  — and the direction is a bare 34×36 key beside it. Same menu behind both triggers, so
  the two viewports cannot end up offering different arrangements, and the phone's menu
  drops its Direction section because a bit that is one tap on the strip must not also
  be three taps inside a menu.
- **The count on the strip says what is HIDDEN, not what exists.** The pack's band
  carries "142 quotes"; the app's hero already says that beside how many are favourites,
  noted and tagged, and the desktop head dropped its own count for exactly that reason.
  What the hero cannot say is that a filter is holding half the board back, so that is
  what the strip says, and only while something is.
- **The hero's facts were captions claiming to be links.** `HeroFact` renders a button
  when handed an `onClick` and a flat span when not; `Library.jsx` handed it none, while
  the comment above that call site said "the language is a link because there is a board
  behind it". The code did the opposite of its own comment. Year, series and genre are
  doors now — each has a real facet — and a door REPLACES the work chip rather than
  narrowing it, because "books from 1967" means across the library and a year door
  carrying `book:this` would search one book for the year it was published in.
- **The language is the one that stays flat, and that is a server gap rather than a
  decision.** There is no `language` facet in `FACET_FIELDS`, so the door would be a
  control that can only fail. Adding the facet is its missing half.
- **The shelf strip was the accent, and vanished at 0%.** The pack spends a paragraph on
  the first — "an accent-coloured bar says 'this is Tippani', which the reader already
  knows, instead of 'you are reading this'" — and the second is worse: gated on
  `progress > 0`, a completed book, an abandoned one and one on the wishlist had no
  strip, which is exactly the three states the strip can report best. `StatusBar` has
  drawn every state correctly on the board's tiles since it was written (solid for a
  settled state, partial for one in flight); the hero was the one surface carrying its
  own copy of the idea. A book on no shelf at all keeps the neutral strip — there is no
  state for it to be the colour of.

**Still off the gap list, in rank order:** bulk selection sits in the page flow rather
than rebuilding the dock; the description expands inline instead of opening a sheet;
speakers are an unnamed face stack rather than named chips; the card's colour control is
six swatches rather than one palette glyph; a margin note never folds; no back-to-top
key; no Details/Practise buttons under the description; no "move this quote to another
work"; no Tags/Sticker rows on a card's ⋯; no merge from a book's own menu.

<sub>Unreleased — `web/frontend/src/Library.jsx` · `works.jsx` · `Movies.jsx` ·
`index.css` · `internal/i18n/{en,bn}.txt` · `test/dom/hero-facts.test.jsx` ·
`test/dom/annotation-group-sort.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
