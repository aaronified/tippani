# ADR-0357: The cast round-trips on one line, and the line carries who wrote each row

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `internal/httpapi/export_handlers.go` · `internal/importer/importer.go`

**Decided.** `cast:` on a title and `characters:` on a book, one frontmatter line shaped after `reads:`: `cast: GLaDOS — Ellen McLain; Chell (reader); Wheatley — Stephen Merchant (corrected); Cave Johnson — J.K. Simmons (removed)`. The provider's own rows carry no marker, the dash is dropped when nobody is named beside a character, and either key is accepted on either side. Fill-empty-only on the way back, whole-list-or-nothing.

**Why.** The full argument is in §3's `work_cast` entry; the part that belongs here is the format. One line rather than a YAML list because `writeFrontmatter` is a flat key/value writer with no YAML dependency and `parseReads` already reads a list of small records out of one line. The origin markers are on the wire because they are the half that cannot be re-derived — without them an export restores a library with every correction demoted to the provider's and every deletion undone by the next lookup. `provider` writes as nothing at all, so a title nobody has edited exports as a plain list and a work with no cast exports byte-identically to before. `person_id` and `image_url` stay out: an id inside a supplier's namespace and a portrait URL do not belong in a file somebody reads, and the next lookup takes both back on every row regardless of who has touched it. The separator bet is `reads:`' bet — an em dash, with a hyphen and an en dash accepted on read — and its cost is a character whose name genuinely contains one.

<sub>`internal/httpapi/export_handlers.go` · `internal/importer/importer.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
