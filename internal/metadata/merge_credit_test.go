package metadata

import "testing"

// A MERGED BOOK SAYS WHICH SUPPLIER GAVE EACH FIELD, so taking it credits Open
// Library for the title and year it supplied rather than crediting Google, the
// merge's primary, with everything.
func TestAMergedCandidateSaysWhichSupplierGaveEachField(t *testing.T) {
	out := mergeSameBook([]BookCandidate{
		{Source: "google", SourceID: "g", Title: "Middlemarch", Author: "George Eliot", Pages: 880},
		{Source: "openlibrary", SourceID: "o", Title: "Middlemarch: A Study of Provincial Life", PublishedYear: 1871},
	})[0]
	if out.Sources["title"] != "openlibrary" || out.Sources["published_year"] != "openlibrary" {
		t.Errorf("Open Library's fields were not credited to it: %v", out.Sources)
	}
	if _, ok := out.Sources["author"]; ok {
		t.Errorf("the primary's own field was credited elsewhere: %v", out.Sources)
	}
}
