package httpapi

// The offers pass, and the field it exists for: the one whose tag already names
// a supplier.

import (
	"context"
	"testing"

	"tippani/internal/metadata"
)

type offersResp struct {
	Items []struct {
		Status string   `json:"status"`
		Source string   `json:"source"`
		Diffs  []offRow `json:"diffs"`
		Offers []offRow `json:"offers"`
	} `json:"items"`
}

type offRow struct {
	Field  string `json:"field"`
	Stored any    `json:"stored"`
	Fresh  any    `json:"fresh"`
	Alts   []struct {
		Source string `json:"source"`
		Value  any    `json:"value"`
	} `json:"alts"`
}

func rowsByField(rows []offRow) map[string]offRow {
	out := map[string]offRow{}
	for _, r := range rows {
		out[r.Field] = r
	}
	return out
}

// THE CASE THE WHOLE FILE IS FOR. The description on the row came FROM Google
// Books, so it matches what Google Books says and re-verify reports no
// difference — while Open Library has a different description sitting right
// there. The reader taps a tag reading "Google Books" precisely to ask "what
// does the other one say", and the diff list is empty for that field by
// construction. Offers answers it; diffs cannot.
func TestAFieldWhoseSourceAgreesStillCarriesTheOtherSuppliersOffer(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{
			{Source: "google", Title: "Dune", Author: "Frank Herbert",
				ISBN13: "9780441013593", Description: "the stored description", Publisher: "Ace"},
			{Source: "openlibrary", Title: "Dune", Author: "Frank Herbert",
				ISBN13: "9780441013593", Description: "a second opinion", Publisher: "Chilton"},
		}, nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	if _, err := srv.Store.DB.Exec(`INSERT INTO books (user_id, title, author, isbn, description, publisher)
		VALUES (1, 'Dune', 'Frank Herbert', '9780441013593', 'the stored description', 'Ace')`); err != nil {
		t.Fatal(err)
	}
	var id int64
	srv.Store.DB.QueryRow(`SELECT id FROM books WHERE title = 'Dune'`).Scan(&id)

	res := decode[offersResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"book_ids": []int64{id}, "offers": true}, 200))
	if res.Items[0].Status != "ok" {
		t.Fatalf("item: %+v", res.Items[0])
	}
	// The diff says nothing about the description, and that is correct.
	if d, ok := rowsByField(res.Items[0].Diffs)["description"]; ok {
		t.Fatalf("the description should not differ from its own source: %+v", d)
	}
	off := rowsByField(res.Items[0].Offers)["description"]
	if len(off.Alts) != 2 {
		t.Fatalf("description offers %d supplier(s), want 2: %+v", len(off.Alts), off)
	}
	if off.Stored != "the stored description" {
		t.Fatalf("offers row lost the stored value: %+v", off)
	}
	bysrc := map[string]any{}
	for _, a := range off.Alts {
		bysrc[a.Source] = a.Value
	}
	if bysrc["google"] != "the stored description" || byss(bysrc["openlibrary"]) != "a second opinion" {
		t.Fatalf("offers are %+v", bysrc)
	}
	// SUPPLIERS THAT AGREE ARE STILL TWO ROWS. Collapsing them would hide that
	// both back the value, which is the strongest reason to accept one there is —
	// the same rule altsFor already states for the diff's alternatives.
	pub := rowsByField(res.Items[0].Offers)["publisher"]
	if len(pub.Alts) != 2 {
		t.Fatalf("publisher offers %+v", pub)
	}
}

func byss(v any) string {
	s, _ := v.(string)
	return s
}

// NOT ASKED, NOT SENT. The reviewer and the unattended filler never read offers,
// and a 15-item batch of them is the payload this flag exists to keep off the
// wire.
func TestOffersAreAbsentUnlessAskedFor(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{
			{Source: "google", Title: "Dune", ISBN13: "9780441013593", Description: "fresh"},
		}, nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	if _, err := srv.Store.DB.Exec(`INSERT INTO books (user_id, title, isbn, description)
		VALUES (1, 'Dune', '9780441013593', 'old')`); err != nil {
		t.Fatal(err)
	}
	var id int64
	srv.Store.DB.QueryRow(`SELECT id FROM books WHERE title = 'Dune'`).Scan(&id)

	res := decode[offersResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"book_ids": []int64{id}}, 200))
	if len(res.Items[0].Offers) != 0 {
		t.Fatalf("offers arrived unasked: %+v", res.Items[0].Offers)
	}
	// And one supplier IS a choice when the question is "what is on offer" —
	// unlike `alts`, which needs two because it is a choice between suppliers.
	res = decode[offersResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"book_ids": []int64{id}, "offers": true}, 200))
	if rowsByField(res.Items[0].Offers)["description"].Alts == nil {
		t.Fatalf("a single supplier offered nothing: %+v", res.Items[0].Offers)
	}
}

// A PICTURE IS NOT A FIELD and a cast is not a value: neither wears a
// provenance tag on the Details list, so neither has a door to open, and
// carrying them would put a whole cast list into a response for nothing.
func TestOffersLeaveOutWhatNoFieldRowCanOpen(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{
			{Source: "google", Title: "Dune", ISBN13: "9780441013593",
				CoverURL: "https://example.test/dune.jpg"},
		}, nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	if _, err := srv.Store.DB.Exec(`INSERT INTO books (user_id, title, isbn) VALUES (1, 'Dune', '9780441013593')`); err != nil {
		t.Fatal(err)
	}
	var id int64
	srv.Store.DB.QueryRow(`SELECT id FROM books WHERE title = 'Dune'`).Scan(&id)

	res := decode[offersResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"book_ids": []int64{id}, "offers": true}, 200))
	for _, o := range res.Items[0].Offers {
		if o.Field == "cover" || o.Field == "poster" || o.Field == "cast" {
			t.Fatalf("offered %q, which has no field row: %+v", o.Field, o)
		}
	}
	// The cover still reaches the reviewer as a diff — this is about the picker's
	// payload, not about the cover ceasing to be re-verifiable.
	if _, ok := rowsByField(res.Items[0].Diffs)["cover"]; !ok {
		t.Fatalf("the cover left the diff list: %+v", res.Items[0].Diffs)
	}
}

// EVERY OFFERED FIELD IS ONE THE APPLY ROUTE CAN WRITE. The picker's only
// gesture is "take this one", so a field offered but not writable is a button
// that fails — and the two lists live in different files, which is exactly how
// they would drift.
func TestEveryOfferedFieldIsWritable(t *testing.T) {
	for f := range bookAltPickers {
		if offersSkip[f] {
			continue
		}
		if !reverifyBookFields[f] {
			t.Errorf("book field %q is offered but the apply route will not write it", f)
		}
	}
	for f := range movieAltPickers {
		if offersSkip[f] {
			continue
		}
		if !reverifyMovieFields[f] {
			t.Errorf("movie field %q is offered but the apply route will not write it", f)
		}
	}
}
