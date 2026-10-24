# ADR-0340: The clippings parser reads structure, never English keywords, and language words may only promote a highlight to a note

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** Everything deciding what a record *is* comes from structure: the `==========` separator, the leading `- `, the `|` field splits, digit runs, and whether the body is empty. Language keywords are only ever an enhancement — they can promote a highlight to a note, never rescue a block the structure rejected. Keywords are matched `\b`-delimited and only in the metadata line's first field.

**Why.** The format is undocumented and varies by device generation, firmware and — the part that hurts — the Kindle's UI language. Word-bounding and field-confining the keywords is not fussiness: `loc` otherwise matches "clock", `nota` matches "notary", `page` matches "pageant", and a chapter titled *NOTES ON THE CLOCK TOWER* would turn a highlight into a note and swallow the chapter. A missing language costs a less precise field, which is the safe failure — the text is still imported.

**Instead of.** Locales that could not be verified were left out rather than guessed at.

**Approved.** Mine, and the rule I approved is the ordering: structure decides, language only refines. It is what keeps an unknown locale from losing a quote.

<sub>1.0.0 — `internal/importer/kindle_clippings.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
