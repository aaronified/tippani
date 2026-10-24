# ADR-0338: Markdown import auto-detects two shapes from the first line, and every field is optional

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.0.1 (correction)

**Decided.** `Markdown()` looks at the first non-blank line: `---` is the Tippani frontmatter format, `# ` is a Readest "Highlights & Annotations" export, anything else is a clear error. A UTF-8 BOM and CRLF are tolerated. The handler peeks first to route between the quote, catalogue and book parsers.

**Why.** Two shapes, one decisive character each, decided before any parsing. Book boundaries in a multi-book file are the frontmatter `---` delimiters, and Tippani exports never emit a bare `---` in the body, so the open/close pairs alone locate each book.

**Reversal.** One detection rule was wrong and I fixed it: format auto-detection keyed off `director:` / `creator:` and the character/actor/timestamp bindings, all of which are optional, so a film with no director and no bound lines fell through to the book path. `collection:` is decisive now, since only the catalogue export writes it. What I got wrong was resting detection entirely on content that is allowed to be absent.

**Approved.** Mine, and the correction is mine; I approved moving detection onto a key the exporter always writes rather than one the data might happen to carry.

<sub>1.0.1 (correction) — `internal/importer/markdown.go` · `internal/httpapi/import_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
