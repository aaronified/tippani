package httpapi

// The book's own EPUB as a source of its metadata, through the API only.
//
// WHAT THIS KNOWS: PUT /sources to give a book its ebook, POST /metadata/fill and
// POST /metadata/reverify for the two ways a supplier is used (fill what is missing;
// offer a choice at any time), and GET /books/{id} for the stored values and the
// source each field is credited to.

import (
	"archive/zip"
	"bytes"
	"net/http"
	"strconv"
	"testing"
)

// epubWithMeta is an EPUB whose package document says things about the book. The
// mimetype entry is stored, not deflated, as the specification requires, so the file
// is recognised from its first bytes.
func epubWithMeta(t *testing.T, metadata string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	add := func(name, body string) {
		w, err := zw.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write([]byte(body))
	}
	add("mimetype", "application/epub+zip")
	add("META-INF/container.xml", `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`)
	add("OEBPS/content.opf", `<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0"><metadata>`+metadata+`</metadata><manifest><item id="a" href="c.xhtml"/></manifest><spine><itemref idref="a"/></spine></package>`)
	add("OEBPS/c.xhtml", `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>A paragraph of the book.</p></body></html>`)
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

const dustMeta = `<dc:title>Dust of Dreams</dc:title><dc:creator>Steven Erikson</dc:creator>
 <dc:publisher>Bantam Press</dc:publisher><dc:date>2009-09-22</dc:date>
 <dc:subject>Fantasy</dc:subject><dc:identifier>urn:isbn:9781409091530</dc:identifier>
 <dc:description>The ninth book.</dc:description>
 <meta name="calibre:series" content="The Malazan Book of the Fallen"/><meta name="calibre:series_index" content="9"/>`

type bookWithSources struct {
	Publisher     string  `json:"publisher"`
	PublishedYear int     `json:"published_year"`
	Series        string  `json:"series"`
	SeriesIndex   float64 `json:"series_index"`
	ISBN          string  `json:"isbn"`
	Description   string  `json:"description"`
	FieldSources  []struct {
		Field  string `json:"field"`
		Source string `json:"source"`
	} `json:"field_sources"`
}

func (c *testClient) bookNow(id int64) bookWithSources {
	c.t.Helper()
	return decode[bookWithSources](c.t, c.mustDo("GET", "/books/"+strconv.FormatInt(id, 10), nil, http.StatusOK))
}

// A BOOK PINNED TO NO ONLINE IDENTITY used to be refused ("no re-checkable identity").
// Its own file can still answer, with no network, and fills what is empty.
func TestFillGapsUsesTheBooksOwnEPUBWhenNothingOnlineCanBeAsked(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("Dust of Dreams")
	c.putSource(sourceFields("book", book), "dust.epub", epubWithMeta(t, dustMeta))

	res := decode[struct {
		Results []struct {
			Status string   `json:"status"`
			Source string   `json:"source"`
			Filled []string `json:"filled"`
		} `json:"results"`
	}](t, c.mustDo("POST", "/metadata/fill", map[string]any{"book_ids": []int64{book}}, 200))
	if len(res.Results) != 1 || res.Results[0].Status != "ok" || res.Results[0].Source != "epub" {
		t.Fatalf("%+v", res.Results)
	}
	got := c.bookNow(book)
	if got.Publisher != "Bantam Press" || got.PublishedYear != 2009 || got.Series != "The Malazan Book of the Fallen" ||
		got.SeriesIndex != 9 || got.ISBN != "9781409091530" || got.Description != "The ninth book." {
		t.Fatalf("not filled from the file: %+v", got)
	}
	// Each field says where it came from.
	by := map[string]string{}
	for _, f := range got.FieldSources {
		by[f.Field] = f.Source
	}
	if by["publisher"] != "epub" || by["series"] != "epub" {
		t.Fatalf("provenance should name the file: %+v", by)
	}
}

// Fill gaps fills GAPS: a value the reader already has is never replaced by the file.
func TestTheEPUBNeverOverwritesWhatTheBookAlreadyHas(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "Dust of Dreams", "publisher": "My Own Imprint"}, http.StatusCreated).Body.Bytes())
	c.putSource(sourceFields("book", book), "dust.epub", epubWithMeta(t, dustMeta))
	c.mustDo("POST", "/metadata/fill", map[string]any{"book_ids": []int64{book}}, 200)
	got := c.bookNow(book)
	if got.Publisher != "My Own Imprint" {
		t.Fatalf("the reader's publisher was overwritten: %q", got.Publisher)
	}
	if got.Series != "The Malazan Book of the Fallen" {
		t.Fatalf("but the gap beside it should fill: %+v", got)
	}
}

// AND IT IS A SOURCE THE READER CAN PICK AT ANY TIME: the field picker's offers list it
// beside the stored value, even for a field that already has one.
func TestTheEPUBIsOfferedAsAChoiceForAFieldThatAlreadyHasAValue(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "Dust of Dreams", "publisher": "My Own Imprint"}, http.StatusCreated).Body.Bytes())
	c.putSource(sourceFields("book", book), "dust.epub", epubWithMeta(t, dustMeta))

	res := decode[offersResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"book_ids": []int64{book}, "offers": true}, 200))
	if res.Items[0].Status != "ok" {
		t.Fatalf("%+v", res.Items[0])
	}
	pub := rowsByField(res.Items[0].Offers)["publisher"]
	if pub.Stored != "My Own Imprint" || len(pub.Alts) != 1 || pub.Alts[0].Source != "epub" || byss(pub.Alts[0].Value) != "Bantam Press" {
		t.Fatalf("the file should be on offer beside the stored value: %+v", pub)
	}
}
