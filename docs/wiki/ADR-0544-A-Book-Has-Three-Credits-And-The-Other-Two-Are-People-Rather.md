# ADR-0544: A book has three credits, and the other two are people rather than strings

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.12.0

**Decided.** Migration 0034 adds `translator` and `editor` to `books` (and to `staged_works`). Both are `people` kinds alongside author, actor, director and speaker, so they carry portraits, bios, links, renames and the orphan sweep. They appear on the book's own page, role-labelled `tr.` and `ed.`, and on no other screen. `api_revision` 4, feature `book-credits`.

**Why.** A book has carried exactly one credit since 0001, and for a library built around reading in translation that is the wrong number: the Garnett Dostoevsky and the Pevear Dostoevsky are different books to read and were identical books to this schema. An anthology's editor is the same gap facing the other way — the person who chose what is in it is often the reason you own it.

**Two columns, not a `book_credits` join table.** The textbook shape was rejected because `author` would stay where it is — forty query sites read `books.author`, and the FTS index is built on it — so the result is one credit in a column and two in a table: two mechanisms for one idea, and the join table is the one that rots, being the one nothing else reads. A third role would change the argument; two does not carry it.

**Where they DON'T appear is the requirement, not an omission.** Not on the Library board (a tile has room for one credit); not on a quote's chips (a quote belongs to whoever wrote it); not as stats categories. The list endpoint does not even serialise them, so the board cannot draw them by accident, and a test asserts their absence — putting them there later has to be a decision made against a failing test.

**Four silent-loss sites, and the last one nearly shipped.**

1. The full-state PUT. `bookState()` on the client feeds the ♥ on the detail header; a field missing from it is a field cleared by favouriting a book.
2. `handlePeopleNames` was `q := <books.author>` followed by overrides — the exact default-plus-overrides shape `orphanRefQuery`'s own twenty-line header warns about, still live in a third function nobody had swept. Asking for translators would have answered with every AUTHOR in the library, tallied, named as translators, and offered for renaming.
3. `resolvePersonPortrait` falls through to the Open Library path, disambiguated by `authorBookTitles` — books whose AUTHOR matches the name. A translator gets an empty title list and resolves undisambiguated, which looks exactly like the provider having no record of them. It takes a column now.
4. **`staged_works`.** The reasoning against it was nearly convincing: no third-party importer carries a translator, so the column could only ever move an empty string. What that skips is that Tippani's OWN export is an importer's source and EVERY import is staged — so the field survived the export, survived the parse, and was dropped on the way into the queue. Export a library, import it back, lose every translator, with a successful import and matching counts saying nothing happened.

**Deliberately NOT in `books_fts`.** Adding a column to an FTS5 external-content table is a DROP and CREATE of the virtual table, its three triggers and its vocab shadow plus a full reindex — and `store.Recover()` and `rebuildFTSTable` both find FTS objects by name pattern, so a rebuild has to land exactly on the old names or it breaks a repair path nobody exercises until they need it. Real risk for scope nobody asked for. Translators are `people`, so the People console finds them.

**Also not filled by re-verify or fill-the-gaps.** No provider reliably carries a translator, so what is there is what you typed.

**Instead of.** A `book_credits` join table (above). A generic "contributors" free-text field (unsearchable, un-renameable, not people).

**Approved.** The reader's, in their own words, including the rule about where the chips may and may not appear.

<sub>1.12.0 — `internal/store/migrations/0034_book_credits.sql` · `internal/httpapi/people_handlers.go` · `internal/httpapi/portrait_handlers.go` · `internal/httpapi/import_staging.go` · `internal/httpapi/book_credits_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
