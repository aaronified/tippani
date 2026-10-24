# ADR-0762: An empty picture strip stopped being silent, and a pasted address beats every guess

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**THE OWNER, TWICE:** "character pages silently fail the fetch images. it does not even show
whether it is trying correctly in fandom, which has alomost all images", and then "local
characters do not even have links to set the fandom or other linkage".

**THE RESPONSE COULD ONLY SAY WHICH SUPPLIERS WERE ASKED.** `sources` is a bool map, enough
to tell "nothing configured" from "nothing found" and nothing more — so three different
outcomes arrived as one blank strip: Fandom never reached, Fandom reached and no wiki
resolved, Fandom's wiki found and the page missed. Only the middle one is the reader's to
fix, and they could not see which they had. Each rung now carries a `note` it writes while it
runs, and the response carries `tried` — source, hit count, note — which the picker lists
under the strip.

**AND THE PASTED ADDRESS WAS NEVER READ.** `castPin` carried the WORK's `fandom_wiki` and
nothing about the character, so `characters.links` — which the global sheet's ＋ has always
been able to write — was invisible to the ladder. One address answers both questions the
guessing existed for: the wiki is its host and the article is its path. `FandomPageFromLinks`
reads it, `FandomLeadImageAt` fetches that page with no slug derivation and no name search,
and the wiki is remembered onto the work so the rest of that cast stops guessing.

**THE GUESS COULD NEVER HAVE REACHED IT, and that is asserted rather than asserted-in-prose.**
`TestTheTitleCouldNeverHaveGuessedThatWiki` walks `FandomWikiCandidates("Battlestar
Galactica")` and fails if `galactica` appears — so the day someone "improves" the derivation
into reaching it, the test says the feature's premise has changed rather than leaving a
paragraph claiming something untrue.

**ONE REAL BUG THE TESTS FOUND, in my own parser.** A localised wiki puts its language BEFORE
the article — `starwars.fandom.com/de/wiki/Yoda` — and I read the path by position, so every
non-English page reported no article. The segment is searched for now.

**THE OWNER'S RULING ON SCOPE:** "character links will be shared between local and global
ones." So the links are the RECORD's, one set, and both sheets show and edit the same thing —
which is what the implementation reads (`characters.links` behind the cast row) and revises a
note I wrote a few entries above, where I called the local sheet's absent links section
correct because "a link is a fact about the record, not about one work". The first half of
that is right and the conclusion was not: being the record's fact is exactly why both screens
may show it. **The local sheet's own links section is NOT in this change** and is the next
step; today the paste is made on the character's own page and the fetch honours it from
either.

**STILL NOT DONE from the original item 2:** TheTVDB routing through the performer to reach a
role, and trying a character's aliases. The TVDB rung reports what it matched against now,
which is the diagnosis rather than the fix.

<sub>Unreleased — `internal/metadata/fandom_images.go` · `fandom_links_test.go` (new) ·
`internal/httpapi/image_search_tiers.go` · `image_search_handlers.go` ·
`web/frontend/src/cast.jsx` · `internal/i18n/en.txt` · `bn.txt`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
