# ADR-0809: The upgrade that folds languages onto codes is not being built

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The queue's language work listed "a one-time upgrade: fold existing free-text languages
onto ISO codes", and building it would have contradicted two rules this app states out
loud:

- `internal/httpapi/board_handlers.go:196` — *"Case-insensitively unique, but the
  reader's own capitalisation is what is stored: 'bengali' typed second should not win
  over 'Bengali'."*
- `iso639.js`'s own header — a reader who typed "Sylheti" goes on seeing "Sylheti"
  everywhere, **because the display value has always been what they typed**.

A row that says `bn` where the reader wrote "Bengali" is a rewrite of their library to
suit a table, and `displayName()` already shows the autonym at display time without
touching a stored byte. The codes are for the app to reason with; the strings are the
reader's.

**WHAT WAS ACTUALLY BROKEN, found by measuring rather than by reasoning from the title.**
`/search/vocabulary`'s languages list deduplicated case-sensitively, so a library holding
"Bengali" and "bengali" sent both. A throwaway SQLite check over a three-row table:

```
3 rows ["Bengali" "bengali" "বাংলা"]   SELECT DISTINCT language …
2 rows ["Bengali" "বাংলা"]             … COLLATE NOCASE
```

That list feeds two screens. The board form's chip row drew a chip for each — and both
lit, because the on-test beside them has always folded. The language combobox did not,
because `Combo` folds every row list it is given. **One consumer coping is not the
endpoint being right**: a server that hands back one language twice is a defect every
caller has to know about, and one of the two did not.

**THE PICKER IS NOT `MIN`, AND THAT IS THE ONE THING THE SCRATCH TEST DISPROVED.** The
first attempt was `SELECT MIN(language) … GROUP BY language COLLATE NOCASE`, on the
assumption that MIN would land on the capitalised-normal spelling. Under BINARY
collation it returns `"BENGALI"` over `"Bengali"` — an all-caps spelling nobody wants,
and it would have shipped looking right on a library that happened not to contain one.
The rule is **the spelling written first**, which is what `board_handlers.go:196`
already promises, expressed as `GROUP BY language ORDER BY MIN(id)`. Both directions are
tested, because a fold that always kept the capitalised form passes half of them.

**AND ONLY THAT ONE LIST FOLDS.** `author:`, `tag:` and the other credit facets match a
stored value and there is no `NOCASE` collation anywhere in the schema, so "Poetry" and
"poetry" are two tag rows finding two different sets of quotes — offering one of them
would hide half a library behind a chip that looks complete. A language has an
app-wide canonical form already (`normalizeLanguageMarks` folds the key it stores,
`validateBoard` folds before deduping, `languages.jsx` keys its mark table by the
lowercased name) and no facet to match against yet, which is the entire difference.

**A COMMENT WRITTEN TWO WEEKS AGO WAS WRONG WHEN IT WAS WRITTEN.** `vocabulary_handler.go`
claimed the three unsplit lists "were relying on DISTINCT and UNION happening to emit
sorted rows"; `vocabList` had been sorting everything it returns since `2f8263c2`, two
and a half weeks before that sentence. The queries' own `ORDER BY` never decided the
dropdown's order and still does not — what it decides is which row arrives first, which
matters only now that one of the lists folds.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
