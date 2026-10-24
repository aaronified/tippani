# ADR-0295: A stored title is re-read from the DEFAULT source, and that rule lives in one function

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 2.3.0

**Decided.** `preferredSourceFor(tmdbID, tvdbID, igdbID)` is the single answer to "which
supplier does this work read from": TheTVDB, then TMDB, then Wikidata for a game's people
namespace. `reverifyMovie` and `castSourceForWork` both defer to it.

**Why.** The precedence was written out twice and 2.2.0 updated neither, so both said TMDB
first — while the lookup route, the Settings card and the keyless-install message all said
TheTVDB is the default film and show source. A title carrying BOTH ids therefore went on
reading from TMDB for ever and never saw the per-role art the default moved for. Worse, a
title *acquires* both ids by ordinary use: re-verify offers a `tvdb_id` diff whenever
TheTVDB's record carries one, so accepting that diff was how a reader took their own title
out of the new default. The "still on TMDB" notice counts `tvdb_id IS NULL`, so those rows
left the count at the same moment — still on TMDB, and the app had stopped saying so.

**The second case is a fallback and not a second preference.** A work pinned to TheTVDB on
an install whose TheTVDB key is missing re-verifies against TMDB rather than reporting
itself broken. Rejected: failing such a row with "the pinned source needs its key", which
is true of the preferred source and useless when another one can answer.

**Blast radius, deliberately bounded.** Re-verify is preview-then-approve, so nothing is
overwritten without the reader ticking it, and `metadata/fill` writes only into fields
that are empty. The visible change is that a dual-pinned title now shows TheTVDB's facts
in the diff, which is the change that was wanted.

<sub>2.3.0 — `internal/httpapi/cast.go` · `internal/httpapi/reverify_handlers.go` · `internal/httpapi/dual_pin_test.go`</sub>

**THE SUPPLIERS ARE AN ORDERED LADDER, NOT A FLAT MERGE.** `character` climbs TheTVDB
first and then the web search; `portrait` climbs TheTVDB, then TMDB, then the web search;
`cover` and `poster` keep the keyless Amazon CDN probe at the top. Order is priority and
**every rung that applies still runs** — a picker exists so somebody can reject the first
picture, so short-circuiting on the best tier would be a picker with one thing in it.
What the ordering buys is that the 18-hit cap is spent from the top rather than by
whichever supplier answered fastest. A rung that cannot run — no key, no pinned id, wrong
media type — is simply absent, which is why the tiers are assembled into a slice before
any of them runs rather than being a chain of ifs.

**Why it had to change at all:** `kind: "character"` could reach Google Custom Search and
the Amazon scrape and nothing else, so the supplier that actually holds character art was
never asked. On an install without a Custom Search key — which needs a key AND an engine
id — the strip came back empty and the control fell through to opening a browser tab, the
behaviour the strip was built to replace.

**THE LADDER IS ADDRESSED WITH OUR IDS AND NEVER A SUPPLIER'S.** The two new rungs need a
TheTVDB work id (to find a role on it) and a TheTVDB person id (to find a face), and the
client sends neither: it sends `cast_id` and `person_id`, which the server reads back
scoped by `user_id`. A request carrying a raw `tvdb_id` could name a work in somebody
else's library; one carrying a cast row id can only ever name its own, and a row that is
not theirs costs the ladder its top rung rather than confirming the row exists. The
TheTVDB *person* id needs no new setting at all — it has been arriving on every cast
fetch as `work_cast.person_id` and being discarded for want of a client to hand it to.

**MATCHING A TYPED ROLE AGAINST A RECORD IS WORD-WISE, NEVER A SUBSTRING.** "Smith" should
find "Agent Smith", which argues for containment — and containment answers a request for
**V** with every role whose name contains the letter v, which is how V for Vendetta
returned Evey Hammond. One-letter and very short role names are a convention rather than
an edge case (V, M, Q, Neo), so every word of the shorter name must appear as a *word* in
the longer one. Found by running the app, not by reading it.

**THE WIKIMEDIA RUNG SEARCHES WIKIPEDIA, NOT WIKIDATA, AND THEN DISBELIEVES IT.** Both
fetches already existed (`WikipediaImageURL`, `WikidataImageURL`); what was missing was
getting from a NAME to the right entity, and this package warns twice that a bare-name
Wikidata search lands on namesakes. `wbsearchentities` matches labels, so "V" ranks a
letter, a vitamin and a Roman numeral above the character. Wikipedia's search ranks
ARTICLES and takes free text, so the work's title goes in as context and the
disambiguation is one editors have already done.

The answer is then checked three ways, because a search engine always answers: the title
must name the subject, must not BE the work (whose lead image is the poster — the wrong
answer that looks most like a right one), and its parenthesised qualifier must fit.
Trinity is a character in The Matrix and also a nuclear test; without the qualifier check
the rung offers a photograph of an atomic bomb. Name-matching is directional here and
deliberately unlike the cast-list fold: every word of the NAME must appear in the title,
so "Anna Kavan" is not satisfied by "Kavan (disambiguation)". Rejected: enumerating
Wikidata's fictional-character classes to filter by P31, which is a class hierarchy to
keep in step with for a judgement Wikipedia's own titles already encode.

**LETTERBOXD AND FANDOM ARE RECORD SOURCES ON THE SAME TERMS AS THEY ARE PICTURE ONES.**
Both are keyless, so what gates them is not a credential but the work being PINNED to
somebody first. Each finds its page by guessing a slug from the title, and a guess is
worth making beside a record that is already identified — the reader sees the two side by
side and can reject a wrong one. Offered as the ONLY answer on an unpinned row, the same
guess is a confident wrong record with nothing to check it against, which is the mistake
igdb_cast.go watched a fuzzy title search make with Hades.

Letterboxd publishes a schema.org Movie as JSON-LD on every film page, which is the same
bargain imdb.go strikes with `__NEXT_DATA__`: read the STRUCTURED thing other people's
crawlers depend on, not the markup around it. The release year is the one field outside
that document — it is read from the page's own year link, and if that moves the year is
dropped while every other field still arrives. Its `actor` list carries no roles, so the
cast arrives without character names rather than with invented ones. It is asked about
FILMS only: it catalogues cinema, so a series or a game spends a request to guarantee a
404 or, worse, finds a film sharing the name.

Fandom supplies exactly two fields — the lead extract and the page image — and refuses
the rest. A wiki article is prose; deriving a director or a year from an infobox means
reading markup that differs per wiki, and offering two fields honestly is worth more than
six unreliably. The per-field picker is built for precisely that: a supplier contributes
where it is good and is absent everywhere else.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
