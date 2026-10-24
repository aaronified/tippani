# ADR-0738: The list you pick a link from, and the roster it is deliberately not

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner's ask: "complete 1.3, the provider list."* handoff §1.3's last clause, and the
third of the three gaps the prototype sweep named — the one it called "the only one that is
genuinely new work".

- **THE PACK ASKS FOR A LIST OF PROVIDERS AND §1.3 ALREADY REFUSED ONE.** The entry above
  says it in capitals: *the list is what is added, not what exists* — no fixed roster with
  "not linked" beside half of it, because a panel made mostly of absences decides for the
  reader which sites their record may have and is wrong about it. Twelve marks with eight
  of them inert is exactly that panel. So the clause could be built as drawn or built as
  meant, and it is built as meant.
- **A RECORD PINNED TO TheTVDB HAS A TheTVDB PAGE.** The id is sitting in the row. Making
  the reader open a browser, find the title and copy the address back is the app declining
  to do arithmetic it can do — and it is the same arithmetic the Details id rows have been
  doing since they learned to draw a number as a link. So the list is DERIVED: every site
  the record's own pinned ids can address, in the app's own provider order, minus what is
  already linked. A site with no id in the row is not in the list, so there is nothing inert
  in it and nothing for the reader to read past.
- **SOME SITES ARE ABSENT AND EACH FOR ITS OWN REASON**, written down because the next
  reader will otherwise "finish the table" with a template that looks plausible.
  Letterboxd and IGDB address a record by SLUG while the row stores a number — IGDB's API
  gives an id and its website wants `/games/dune`, and a guessed slug is a 404 that looks
  like a link. A work stores no Wikipedia, Wikidata or Wikimedia id at all: a person's
  arrive from a lookup and live in their own column, and a work's would have to be searched
  for, which produces a result rather than an address. And Amazon's marketplace is an admin
  setting this panel cannot see, so `.com` for a reader who buys on `.co.uk` is a real page
  for a different edition — wrong in the way that looks right. All four remain one paste
  away, which is the point of the box being untouched.
- **THE FANDOM OFFER IS THE WIKI AND NOT A PAGE ON IT.** 0055 remembers which wiki a work
  lives on and nothing stores its article title. The front page is the honest answer and the
  one the reader wanted — "the fandom wiki for this" — with its search box one press away; a
  derived article slug would be a guess wearing a mark.
- **IT IS INSIDE THE ADD PANEL, NOT A SECOND HEADER VERB.** §1.12 allows a panel one verb
  and Links spends it on `+`. Two ways to add a link are not two verbs — they are one verb
  done two ways — so both live behind the one press that means "add", cheap way first. This
  also settles §1.11 for this panel: pressing a derived page is a whole decision with
  nothing left to type, so it appends and pops.
- **ONE TABLE, AND THERE WERE ABOUT TO BE TWO.** The Details rows for a TMDB, TheTVDB or
  IMDb id each carried their template inline. `providerURL` is the one writer of a provider
  address now and those three specs call it, so "where does TheTVDB keep a series" has one
  answer in the codebase rather than two that agree until one is edited.
- **The rater's three non-defect findings are recorded rather than fixed.** A field with no
  provenance row still has no door (faithful to §1.2's "tapping *it*", and now said in the
  changelog); the lookup and cover rows keep bare supplier names, argued in the entry above;
  and the pack's `auto` · `you` per-link provenance stays unbuilt, though a derived page is
  the first work link the app itself wrote, so the question is now live.

<sub>Unreleased — `web/frontend/src/workLinks.jsx` · `WorkDetails.jsx` · `index.css` ·
`internal/i18n/{en,bn}.txt` · `scripts/glossary/catalogue.js` ·
`test/pure/provider-urls.test.js` · `test/dom/link-suggest.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
