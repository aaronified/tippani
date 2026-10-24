package httpapi

// The list of every attached source file, through the API only.
//
// WHAT THIS KNOWS: the upload and list routes and the fields the list answers with.

import "testing"

type listedSourcesAnswer struct {
	Sources []struct {
		Subject     string `json:"subject"`
		SubjectID   int64  `json:"subject_id"`
		Name        string `json:"name"`
		State       string `json:"state"`
		WithContext int    `json:"with_context"`
	} `json:"sources"`
}

func TestTheSourceListNamesEachFileAndHowManyQuotesItPlaced(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("Nineteen Eighty-Four")
	c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	c.newBook("A book with no file")

	empty := decode[listedSourcesAnswer](t, c.mustDo("GET", "/sources/all", nil, 200))
	if len(empty.Sources) != 0 {
		t.Fatalf("expected no sources before an upload: %+v", empty)
	}

	c.putSource(sourceFields("book", book), "1984.txt", []byte(prose))
	got := decode[listedSourcesAnswer](t, c.mustDo("GET", "/sources/all", nil, 200))
	if len(got.Sources) != 1 {
		t.Fatalf("expected one source: %+v", got)
	}
	s := got.Sources[0]
	if s.Subject != "book" || s.SubjectID != book || s.Name != "1984.txt" || s.State != "file" || s.WithContext != 1 {
		t.Fatalf("%+v", s)
	}
}
