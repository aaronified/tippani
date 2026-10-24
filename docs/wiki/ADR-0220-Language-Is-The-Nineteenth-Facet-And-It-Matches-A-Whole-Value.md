# ADR-0220: language is the nineteenth facet, and it matches a whole value rather than a word

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** Unreleased

**Decided.** The language model this release rebuilt gave every quote of all three kinds a
`language` of its own, put a mark beside it on the card, chose the face it is set in and
decided which of the two texts leads — and left it the one fact about a quote you could
not search by. So it becomes a facet, and three of its four properties are just the rule
above applied: it **unions** (`combine: 'or'`), because a line is in ONE language and
ANDing two asks for something nothing is; it reaches **all three quote kinds**
(`annotations`, `dialogues`, `utterances`), because all three carry the column; and it
appears in `/search/vocabulary` and in the count beside each chip like every other facet.

**The fourth is a departure, and it is the only real decision here: the match is
whole-value and case-folded, not tokenised.** The credit facets (`author`, `speaker`,
`actor`, `character`) split their column on the credit separators and ask whether it
*contains* each word, which is right for a column holding several names — "Gaiman &
Pratchett" must be findable as either. A language is not that shape. It is one value, and
a contains-match on it means `language:English` drags in every row written in **Old
English** — a wider answer that looks like a correct one, which is the exact failure
"never widen silently" was written against two entries down. The fold is the other half of
the same argument and comes from the same place `/search/vocabulary` already folds: the
column is free text, so one language gets stored two ways by a reader who typed it twice,
and a facet that did not fold would hand back a chip drawn from the folded list and then
find half the rows behind it.

**Instead of.** Tokenising it like a credit (one line's `language` is not a cast list), and
matching it exactly (a facet that is case-sensitive over free text finds half a library).

**Where the plan was wrong, recorded at the pass that found it.** Two guards were missing
and a rater's mutations found both: `/search/facets` was never asked for a language at
all, so the arm reading `<self>.language` could be repointed at the quote text and the
whole Go suite stayed green — the chips would have offered quote text as a language to
narrow by; and both of the facet's own tests passed a `q`, so `searchFacets.any()` could
drop `len(f.languages) > 0` and a bare `?language=Bengali` — pressing the chip without
also typing, which is how a facet is actually used — would answer 400 *q is required*.
Neither was a design error; both were a test that exercised the feature only in the shape
its author happened to write it in.

<sub>Unreleased — `internal/httpapi/search_facets.go` · `internal/httpapi/search_facet_counts.go` · `web/frontend/src/facets.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
