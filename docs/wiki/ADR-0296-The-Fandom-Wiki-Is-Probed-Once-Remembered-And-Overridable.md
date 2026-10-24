# ADR-0296: The Fandom wiki is probed once, remembered, and overridable

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 2.3.0

**Decided.** `FandomWikiCandidates` walks a truncation ladder — the full title slug, then
without the subtitle, then without the trailing instalment number or roman numeral — and
`FandomResolveWiki` stops at the first wiki that answers. The winner is written to
`movies.fandom_wiki` (0055) and every later lookup uses it. The column is also writable by
the reader, and a value it holds is never overwritten by a probe.

**Why, measured.** Over nine real titles the plain title-derived slug found six wikis. All
three misses were the same shape — a numbered or subtitled entry whose wiki carries the
FRANCHISE name: `witcher3wildhunt` against `witcher`, `masseffect3` against `masseffect`,
`elderscrollsvskyrim` against `elderscrolls`. Games and long-running series are
overwhelmingly that shape, and they are also the works with no other source of character
art at all: TheTVDB has no games, and Wikipedia has an article for a character only when
the character is notable outside their own story.

**Why remembered rather than re-derived.** Probing costs up to four requests, which is
affordable exactly once. Storing the answer turns every later character search on that
title into one request, and writing it inside a request already talking to Fandom means
nothing has to come back for it later — nothing here wakes on a timer, and the queue runs
only what a person or the app's own lookup started. A FAILED probe is deliberately not
remembered: a wiki that did not exist last month may exist now, and asking again costs one
404.

**Why typed as well.** The ladder cannot resolve every work — Star Wars characters live on
`starwars` and on `wookieepedia`, and no derivation from a title picks between them. One
column serves both because they are the same fact; what distinguishes them is only who
last wrote it, which nothing needs to know. Rejected: a second column recording provenance
of the wiki name, which would exist solely to be ignored.

**FANDOM SUPPLIES CHARACTERS FROM A CATEGORY, NOT AN INFOBOX.** A wiki's character list is
`Category:Characters`, which is a MediaWiki primitive that works identically everywhere;
an infobox is per-wiki markup and reading it would be the scraping the rest of this
package refuses. Two requests, not one per character: `categorymembers` names them and one
`pageimages` call takes fifty titles at once. No actor names — who voices a character
lives in that same infobox — so these are cast rows with a character and no actor, which
is the right way round for a game, where the character is what anybody quotes.

**AND FANDOM LEADS THE CHARACTER LADDER FOR GAMES.** For `media_type=game` the order is
fandom → wikimedia → google; films and shows keep tvdb → wikimedia → fandom → google.
TheTVDB has no games at all, and asking Wikipedia first for a game character spends a
request to be told nothing before reaching the supplier that has the thing.

<sub>2.3.0 — `internal/store/migrations/0055_fandom_wiki.sql` · `internal/metadata/fandom_images.go` · `internal/metadata/fandom_details.go` · `internal/httpapi/image_search_tiers.go`</sub>

**FANDOM IS A GUESS AND SAYS SO.** Wikipedia has an article for a character only when
the character is notable outside their story; Fandom has one for the rest, which is most
of a cast list. The obstacle is that Fandom is not one MediaWiki but tens of thousands,
addressed by a slug with no published mapping — "V for Vendetta" is `vforvendetta`, "The
Expanse" is `expanse`. So the slug is derived from the work's title, a leading article
dropped, and being wrong costs one 404 and contributes nothing. Deliberately
fragile-proof rather than robust, the same bargain already recorded for the Amazon and
Hardcover scrapes. The fetch itself is not a guess: every Fandom wiki is a MediaWiki, so
it is the same `prop=pageimages` call the Wikipedia rung makes. `static.wikia.nocookie.net`
joins `coverHosts` and the CSP `img-src` — one host serves every wiki, so it is one entry
rather than a pattern.

**THE CUSTOM SEARCH RUNG IS RETIRED, AND ITS KEY FIELDS WITH IT.** Google closed the
Custom Search JSON API to new customers and set it to retire on 1 January 2027
(confirmed against Google's own overview page). A key field for an API nobody can
register for is worse than no field: it asks a reader to go and fail, and then to lose
what they had. Both halves are gone from Settings, from the settings table and from the
client. Reading the results page is what remains of Google, and the ladder was already
built so this is not load-bearing — TheTVDB, Wikimedia and Fandom need no key and answer
on their own. `imageSearchConfigured` becomes a constant `true` for the same reason: it
was written when every rung needed a credential, and the question it asks no longer has
a false answer.

**THE GOOGLE SCRAPE IS THE ONLY OPT-IN HERE THAT IS NOT A CREDENTIAL, and that is the
whole design note.** Every other agreement in this app rides on a secret: you cannot use
the Amazon scrape without storing the cookie, so the key field *is* the consent. Scraping
Google's image results needs nothing, so the consent has nowhere to live and becomes a
setting of its own (`google_image_scrape`), with a control on the Settings card — a
setting with no control is a feature nobody can reach. It is worth asking for rather than
defaulting on: the requests leave the SERVER's address, so a rate-limit or a consent wall
is a consequence for the whole household rather than for the reader who pressed the
button. It sits below Programmable Search, which is the same index with a contract
attached, so anybody who configured that never reaches this. Only the
`encrypted-tbn*.gstatic.com` thumbnail is taken — an already-allowed host, and a far more
stable target than the page around it — and `URL` and `Thumb` are deliberately the same
value, because a results page has no original to offer and the picker must draw exactly
what it will store.

**A STORED ARTICLE BEATS ANY SEARCH.** A person resolved through Open Library carries
`links["wikipedia"]`, so the exact article is known and no name is ever handed to a search
engine. The search is the floor, not the method.

**AMAZON IS A SHOP, SO IT IS ASKED ONLY ABOUT THINGS SOMEBODY SELLS.** The search-page
scrape answers `cover` and `poster` and nothing else. It was originally asked for every
kind, on the reasoning that a configured supplier should be allowed to contribute — and
that is wrong for a face in a way it is not wrong for a work. Amazon indexes PRODUCTS, so
"Hugo Weaving as V" returns the DVD, a mask and a T-shirt, and an author returns their
books: not an empty answer, which would be harmless, but a confident and well-lit wrong
one, arriving early enough to spend the strip's cap on. A whitelist rather than a
blacklist, so a `kind` added later gets no Amazon until somebody decides it should. The
keyless ISBN/ASIN CDN probe is a different supplier and is untouched — it was never a
search. Rejected: ranking Amazon last for faces instead of excluding it, which still
spends requests to produce merchandise, and leaves the reader deciding whether a T-shirt
is a portrait.

**Storage is unchanged.** A picked candidate goes through the existing user-typed-URL path (`fetchUserImage`) — no host allowlist, every other guard intact — which is what makes an image from an arbitrary host storable at all, and is the same path a pasted address has always taken.

**A ROLE IS A FOURTH KIND, and it is the one with no supplier at all.** `kind: "character"` searches for the person IN the part: "ACTOR as CHARACTER in TITLE the movie", because "as" is how a still is captioned wherever pictures of one are published — the character and the title alone find the poster, and the actor alone finds a red carpet. Without a credited actor (a book's character, a game's typed cast) the sentence loses its subject and the role is named as a role: "CHARACTER character in TITLE the book". TheTVDB has an image per role and is the only supplier that has ever had one, so before this every TMDB-sourced row, every game and every book character could only be given a picture by pasting an address.

**Approved.** The reader's, in the form "image search (cover, poster, people images) need to fetch posters etc from amazon and google as well. They are already supposed to do that but I see no options from them ever." Half of that was true and worth stating: Amazon was reachable only with an ASIN typed by hand, and Google was reachable only as a books catalogue.

<sub>v3.0.0 — `internal/metadata/image_search.go` · `internal/metadata/image_search_test.go` · `internal/httpapi/image_search_handlers.go` · `internal/httpapi/image_search_test.go` · `web/frontend/src/CoverPicker.jsx` · `web/frontend/src/people.jsx` · `web/frontend/src/cast.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
