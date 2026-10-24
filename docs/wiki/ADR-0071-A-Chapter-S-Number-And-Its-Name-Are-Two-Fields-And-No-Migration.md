# ADR-0071: A chapter's number and its name are two fields, and no migration guesses which is which

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 2.0.1

**Decided.** 0044 adds `annotations.chapter_no REAL` (and the same column on `staged_quotes`); `chapter` keeps its name and becomes the chapter's NAME. Both optional, independently. One formatter renders the pair wherever it is printed — `chapterHeading` in Go, `chapterLabel` in `text.js` — and the two produce the identical string, `7 · The Fall`.

**Why one text field was not enough.** It was holding two facts, and the evidence was already in the interface: the capture form's placeholder read *"e.g. 3"* under a label saying **Chapter**, so the app was asking for a number and filing it as a name. The consequences were a table column that sorted chapter 10 between 1 and 2, three separate copies of the heuristic `/^\d/.test(ch) ? 'CH. ' + ch : ch` — one per screen, each guessing which of the two facts it had been handed — and a reader who wanted both having to invent punctuation and then retype it identically forever.

**REAL, not INTEGER**, for the reason `series_index` is: 12.5 is where an interlude, an appendix or a part boundary goes, and a column that cannot hold one pushes the reader back into the text field this exists to empty. Zero means absent, which is that column's convention one table over; the stated cost is that a chapter deliberately numbered 0 has to live in the name.

**Nothing is backfilled, and that is the whole of the risk management.** Every existing row holds a number, a name or both in whatever punctuation its reader or its importer chose, and nothing records which. A migration parsing `"3. The Fall"` into `3` + `"The Fall"` would be right most of the time and silently wrong for a chapter named `"1984"` or a locator like `"3:16"` — and a wrong value written by a migration carries the authority of having been migrated. That is 0042's argument about the game publisher, applied unchanged. Existing values stay whole, in the name.

**The separator is the round trip, and the printed convention could not be it.** A book export writes the pair as its `## ` heading and the importer reads that heading back, so the join has to be unambiguous. `7. The Fall` — how a book prints it — cannot be parsed once numbers may be fractional: `7.5` is either chapter 7.5 or chapter 7 named "5", and no rule can tell. The middle dot this app already uses to join facts has no such collision, and a number cannot contain one.

**One heuristic was unavoidable and it is bounded.** A heading that is nothing but a small number — `## 7` — is read as a number, because that is what the export writes for a numbered chapter with no name and that is most chapters; without it the commonest shape would be the one that cannot come home. `chapterNoCeiling = 1000` is what keeps it from swallowing a numeric NAME (`## 1984`, `## 2001`): no book has a thousandth chapter and every year-shaped title is above it. Deliberately tighter than the 10,000 the API refuses at, because the two are different jobs — one rejects what a person typed in the wrong box, the other resolves an ambiguous string with nobody to ask. A consequence worth stating: an older file whose chapter was the text `"3"` re-imports as the *number* 3, which is the same fact in the right field and the only place anything here moves existing data.

**What is deliberately not parsed:** `## 3. The Fall`, `## Chapter 7`, `## 1984` and `## 3:16` all stay names, whole, exactly as before 0044 — asserted by a test, because a parse tuned to the exporter's own output is how a reader's hand-written file gets mangled. The anthology importer makes the same argument about not splitting an em dash out of a heading.

**One rule for what a number may be**, in `chapterNoProblem`, shared by the single-quote form and both bulk editors — a number the details form accepts and the selection bar refuses is a rule nobody can learn. The bulk path refuses junk rather than letting `nullableMeasure` null it, because clearing the chapter number on forty rows and reporting success is the worst answer available.

**Approved.** The reader's, who asked for it as *"separate chapter number and chapter names, both optional"*, chose REAL-with-decimals over free text or integers, and chose to leave existing values alone rather than split what parses.

<sub>2.0.1 — `internal/store/migrations/0044_chapter_number.sql` · `internal/httpapi/annotation_handlers.go` · `internal/httpapi/export_handlers.go` · `internal/importer/markdown.go` · `web/frontend/src/text.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
