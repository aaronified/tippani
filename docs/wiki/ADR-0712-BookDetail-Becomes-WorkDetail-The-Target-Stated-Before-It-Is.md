# ADR-0712: BookDetail becomes WorkDetail — the target, stated before it is built

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

*The owner's, in their own words: "the bookdetail will become workdetail. it will be
directly called for book, movie, show, game detail pages. the changes will be in some
token values (now reading vs now watching vs now playing, etc)."*

Recorded here now because the direction changes what is worth building in the meantime,
and it lands **after the whole of book-details has**, which is the owner's own sequencing:
"this refactor should land after the whole of bookdetails has landed… so that it can be
ported as a whole."

**Most of the per-kind vocabulary already exists as data rather than as branches**, which
is what makes the target reachable rather than a rewrite. `ACTIVE_STATUS` is
`{ book: 'reading', movie: 'watching', show: 'watching', game: 'playing' }`; `SHELF_CAPS`
is `{ book: 5, movie: 2, show: 5, game: 3 }`; `CAP_WORDS` maps each kind to its noun and
its settled past tense. The header is already one component for every kind — `WorkHero`,
with the kind word, the credit roles and the accent as parameters — and `HeroKindRow`
already draws "Book · 1967 · Russian" and "Game · 2011" from the same three lines.

**What is still two things** is the screen around it: `BookDetail` in `Library.jsx` and
`MovieDetail` in `Movies.jsx`, each with its own load, its own panel stack, its own board.
Converging them is one component taking a `kind`, and the differences it reads are the
maps above plus the endpoint (`/books/:id` vs `/movies/:id`) — which is the other half the
owner has named: "the sql schema needs to converge as well. all work shall share the same
base."

**The order that follows from that**: finish the book's detail (the board's head, the
table, the panels), then port the screen whole, then the schema. Porting a screen that is
still changing means porting it twice.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
