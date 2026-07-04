// Package importer parses bulk-import files into books + annotations.
// Pure parsing only — no DB, no HTTP; the httpapi layer owns persistence,
// dedupe, and ISBN normalization. Formats: markdown (frontmatter or Readest,
// auto-detected, PLAN 5b), Bookcision JSON (PLAN 5d), and saved Hardcover
// journal pages (PLAN 5e). Kindle My Clippings.txt is deferred.
package importer

// Book is the book header parsed from an import file.
type Book struct {
	Title  string
	Author string
	ISBN   string // as found in the file; callers normalize to ISBN-13
	ASIN   string
}

// Annotation is one parsed quote/note.
type Annotation struct {
	Quote    string
	Note     string
	Chapter  string
	Location string
	Color    string // "" -> caller defaults to yellow
	Tags     []string
	Favorite bool
	Rating   int // 0 = unrated, else 1-5 (PLAN §3)
}

// Result groups the annotations of one book.
type Result struct {
	Book        Book
	Annotations []Annotation
}
