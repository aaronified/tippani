# Anthology enhancements

Not built. Verified against `75e55ae` (main, 28 September 2026; its code is `ee4be1f`'s).
Builds after `episodes.md`, whose extended drag it uses. Each citation is `path:line` and the
text at that line. Tasks, one per ask:

- [ ] Re-verify before the first edit, then correct what moved:
      `git diff --stat 75e55ae..HEAD -- internal/store/migrations internal/httpapi internal/importer/anthology_markdown.go web/frontend/src/anthologies.jsx web/frontend/src/index.css`,
      then `git grep -n` each quoted anchor below.
- [ ] Remember a removed entry per anthology, so a rule never re-adds it. Today a removal is a
      plain delete (`anthology_handlers.go:1162`
      `func (s *Server) handleRemoveAnthologyEntry(w http.ResponseWriter, r *http.Request) {`)
      and a fill inserts whatever is not already there (`anthology_fill.go:295`
      `` `INSERT OR IGNORE INTO anthology_entries (anthology_id, position, kind, item_id) VALUES (?, ?, ?, ?)`, ``).
- [ ] Show a "Removed (n)" list on the anthology, where a removed entry can be brought back.
- [ ] Reorder entries by dragging a handle, on desktop and phone, with the drag `episodes.md`
      extends. Today an entry has move up and move down only (`anthologies.jsx:1366`
      `...(first ? [] : [{ id: 'up', icon: <IconChevron open />,`).
- [ ] Add "Move to…" a numbered position, for long anthologies.
- [ ] Let the reader insert their own section headings anywhere, with optional prose under each.
- [ ] Add automatic grouping by Work, by People, or by Character: each entry gets its group's
      header, and consecutive entries with the same header share one header row.
- [ ] Carry sections and group headers into Markdown export (`export_anthology.go:98`
      `func renderAnthologyExport(title, intro string, f anthologyFields, entries []anthologyEntryRow) string {`),
      EPUB as chapters, and print (`index.css:10575` `@media print {`).
- [ ] Make "Add N waiting" (`anthologies.jsx:1637`
      `<GhostButton icon={<IconPlus />} onClick={takeWaiting} disabled={filling}>`) open a
      preview of the N passages, all ticked, where unticking one records it as removed. The
      fill already answers a preview without writing (`anthology_fill.go:75`
      `` Preview bool `json:"preview"` ``).
- [ ] Write each entry's work identity (title, year, ISBN or source id) into the Markdown
      export, which today writes a book highlight as an attributed passage
      (`export_anthology.go:39` `// A BOOK HIGHLIGHT EXPORTS AS AN ATTRIBUTED PASSAGE, not as a record with an`).
- [ ] On import (`anthology_markdown.go:57`
      `func AnthologyMarkdown(r io.Reader) (Anthology, error) {`), re-link an entry to a work
      already in the library only on an exact match; otherwise keep it standalone, and say
      which in the import summary.
- [ ] Add optional front matter to an anthology: cover image, epigraph and dedication.
- [ ] Use the front matter on the reading view (`anthologies.jsx:1377`
      `function AnthologyPage({ id, onClose, onDeleted, onOpenBook, onOpenMovie }) {`), in
      print, and in EPUB, the cover as the EPUB cover.
- [ ] Add a continuous-scroll reading mode in book typography, with the app's chrome hidden.
- [ ] Improve print: page breaks at sections, a running title, and page numbers where the
      browser allows.
- [ ] Add a separate "Save PDF" (the browser's own PDF output is fine) whose text stays
      selectable.
- [ ] Not in this plan, at the owner's choice: publishing a read-only link, and saved searches.

The owner's answers, 27 September, each a task:

- [ ] Dragging a section heading carries every passage up to the next heading, as moving a
      chapter would.
- [ ] "Exact match" on import is an identifier: the same ISBN for a book (`anthology_registry.go:151`
      `{Key: "isbn", Kinds: []string{kindBook}, Binding: "isbn", Label: "common.field.isbn.label"},`),
      the same provider id for a screen work. Anything else stays standalone.

Decided while planning, so the build needs nothing further:

- [ ] In the next migration (`0079_jobs.sql` is the latest at the pin; the number is taken at
      build): a removed table keyed as an entry is (`0043_anthologies.sql:78`
      `PRIMARY KEY (anthology_id, kind, item_id)`), keeping the entry's note and position so
      bringing it back restores both; a sections table in the entries' position space
      (`0043_anthologies.sql:74` `position     REAL NOT NULL,`); and `group_by`, `cover_path`,
      `epigraph` and `dedication` on `anthologies`, each defaulting to empty.
- [ ] A removal lasts until it is brought back or the anthology is deleted, because a rule can
      run again at any time. The quote-delete triggers (`0043_anthologies.sql:105`
      `CREATE TRIGGER anthology_entries_book_del AFTER DELETE ON annotations BEGIN`) clear
      removed rows as they clear entries.
- [ ] Removed rows and sections travel wherever entries do: the bin's snapshot of a quote
      (`trash.go:445` `SELECT e.* FROM anthology_entries e`) and the account's table list
      (`trash.go:934` `"anthologies", "anthology_entries",`).
- [ ] A drag and a Move to… are one move and one request, the reorder route's "after this
      one" (`anthology_handlers.go:1218` `` After *entryRef `json:"after"` ``). Moving an entry
      writes one row (`anthology_handlers.go:66` `const anthologyPositionGap = 1e-6`); moving a
      section writes its run, in one transaction.
- [ ] Grouping is a display setting on the anthology, like its field switches
      (`anthologies.jsx:177` `const WORK_SWITCHES = [`): it reorders nothing, and a section
      heading ends a run.
- [ ] In Markdown a section is a heading one level above the entries' own
      (`export_anthology.go:30` `// THE HEADING IS AN ENTRY DELIMITER THAT HAPPENS TO READ AS AN ATTRIBUTION.`),
      and import reads it back as a section; in EPUB each section opens a chapter; in print
      each starts a page.
- [ ] The cover is an upload, stored like every other image and embedded in the EPUB the way its
      portraits are (`export_anthology_epub.go:346`
      `// THE NAME IS VALIDATED BEFORE IT IS OPENED.`). Markdown carries the epigraph and the
      dedication and leaves the cover out, as it leaves every image out.
- [ ] The reading mode is a full-screen view from the anthology page, closed by its ✕ or
      Escape; the type dials still apply.
- [ ] "Save PDF" opens the browser's print with the print stylesheet, so the text stays text.
- [ ] Keys in `en.txt` and `bn.txt` together.
- [ ] Tests: a fill after a removal adds nothing back; bringing one back restores its note and
      place; a drag and a Move to… land in the same place; a section drag carries its run;
      grouping draws one header per run; Markdown and EPUB round-trip sections and front
      matter; import links on an ISBN and not on a title; binning and restoring a quote keeps
      its removed rows; an account round trip keeps removed rows, sections and front matter.
      Each mutation-checked, the mutation named in the commit.
