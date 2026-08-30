package httpapi

import (
	"net/http"
	"strconv"
	"testing"

	"tippani/internal/metadata"
)

type fieldSourceResp struct {
	FieldSources []struct {
		Field    string `json:"field"`
		Source   string `json:"source"`
		SourceID string `json:"source_id"`
		At       string `json:"at"`
	} `json:"field_sources"`
}

func sourcesByField(t *testing.T, c *testClient, id int64) map[string]string {
	t.Helper()
	got := decode[fieldSourceResp](t, c.mustDo("GET", "/movies/"+strconv.FormatInt(id, 10), nil, http.StatusOK))
	out := map[string]string{}
	for _, f := range got.FieldSources {
		out[f.Field] = f.Source
	}
	return out
}

// ADDING A FILM RECORDS WHO SAID WHAT — and, just as importantly, records nothing
// for the fields the supplier had no answer for.
//
// The failure this guards is subtle and would look like a working feature: a
// fetch that attributed EVERY field to whoever was asked last, including the
// columns that came back empty. Provenance is then a lie about the empty ones,
// and the reader cannot tell "TheTVDB says the director is unknown" from
// "TheTVDB was never asked about the director".
func TestAddingAFilmRecordsWhichSupplierFilledWhichField(t *testing.T) {
	srv := newTestServer(t)
	// A payload with a director and an overview but deliberately NO series and no
	// publisher, so the absent ones can be asserted absent.
	tvdb := newTVDBStub(t, `{"data":{"id":70,"name":"The Matrix","year":"1999",
		"overview":"A hacker learns the truth.","genres":[{"name":"Action"}],
		"characters":[{"name":"Neo","personName":"Keanu Reeves","peopleType":"Actor","peopleId":5},
		              {"name":"","personName":"The Wachowskis","peopleType":"Director"}]}}`)
	srv.TVDB = tvdb
	c := signupAdmin(t, srv.Handler())

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"source": "tvdb", "source_id": "70", "media_type": "movie"}, http.StatusCreated))

	got := sourcesByField(t, c, m.ID)
	for _, f := range []string{"title", "director", "description", "release_year", "genres"} {
		if got[f] != "tvdb" {
			t.Errorf("%s recorded as %q, want tvdb — got %v", f, got[f], got)
		}
	}
	// THE SUPPLIER HAD NO SERIES, so nothing is recorded for it. An entry here
	// would attribute an empty column to TheTVDB.
	if s, ok := got["series"]; ok {
		t.Errorf("series recorded as %q for a payload that carried none", s)
	}
	// And the id columns are never recorded: "tvdb_id came from TheTVDB" is a
	// tautology that would fill a third of the table.
	if _, ok := got["tvdb_id"]; ok {
		t.Error("an id column was recorded, which says nothing")
	}
}

// RE-VERIFY RECORDS WHAT THE READER ACCEPTED, NOT WHAT WAS OFFERED.
//
// The preview shows every difference and the reader ticks some of them. If
// provenance recorded the whole diff, a field they deliberately declined would be
// attributed to the supplier whose value they rejected — which is exactly
// backwards, and the reason the apply path is the one that writes this.
func TestReVerifyRecordsOnlyTheFieldsTheReaderApproved(t *testing.T) {
	srv := newTestServer(t)
	srv.TVDB = newTVDBStub(t, `{"data":{"id":70,"name":"The Matrix","year":"1999",
		"overview":"Fresh overview from TheTVDB.","characters":[]}}`)
	c := signupAdmin(t, srv.Handler())

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Matrix", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{
		"title": "The Matrix", "media_type": "movie", "tvdb_id": 70,
	}, http.StatusOK)

	// Approve the description and nothing else.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "movie", "id": m.ID,
			"set": map[string]any{"description": "Fresh overview from TheTVDB."},
		}},
	}, http.StatusOK)

	got := sourcesByField(t, c, m.ID)
	if got["description"] != "tvdb" {
		t.Errorf("the approved field is not attributed: %v", got)
	}
	if s, ok := got["release_year"]; ok {
		t.Errorf("release_year recorded as %q though it was never approved", s)
	}
}

// PROVENANCE IS PER READER, like every other query here. The table carries a
// user_id and the read is scoped by it, so one reader's record of where a value
// came from is not visible on another's copy of the same title.
func TestFieldSourcesAreScopedToTheReader(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	srv.TVDB = newTVDBStub(t, `{"data":{"id":70,"name":"The Matrix","year":"1999",
		"overview":"x","characters":[]}}`)
	owner := signupAdmin(t, h)
	m := decode[movieDetail](t, owner.mustDo("POST", "/movies",
		map[string]any{"source": "tvdb", "source_id": "70", "media_type": "movie"}, http.StatusCreated))
	if len(sourcesByField(t, owner, m.ID)) == 0 {
		t.Fatal("nothing recorded for the owner")
	}
	other := addUser(t, h, owner, "nosy")
	other.mustDo("GET", "/movies/"+strconv.FormatInt(m.ID, 10), nil, http.StatusNotFound)
}

// newTVDBStub answers /login and every extended record with one payload.
func newTVDBStub(t *testing.T, body string) *metadata.TVDB {
	t.Helper()
	stub, client, done := newTVDBCastStub(t, body)
	_ = stub
	t.Cleanup(done)
	return client
}

// A BOOK RECORDS ITS SUPPLIER TOO, and a book nobody fetched records the reader.
//
// The manual case is the one worth pinning. This route serves two arrivals —
// adopting a candidate, which names a supplier, and typing a book in by hand,
// which names nobody — and recording the second as `manual` is what keeps an
// ABSENT row meaning "we do not know". Collapse them and the reader's own work
// becomes indistinguishable from a gap, which is the single distinction this
// table exists to draw.
func TestABookRecordsItsSupplierAndAHandTypedOneRecordsTheReader(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	adopted := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{
		"title": "A Wizard of Earthsea", "author": "Ursula K. Le Guin",
		"description": "Sparrowhawk goes to Roke.", "published_year": 1968,
		"source": "openlibrary", "source_id": "OL1234W",
	}, http.StatusCreated))
	got := booksSourcesByField(t, c, adopted.ID)
	for _, f := range []string{"title", "author", "description", "published_year"} {
		if got[f] != "openlibrary" {
			t.Errorf("%s recorded as %q, want openlibrary — %v", f, got[f], got)
		}
	}
	// No ISBN was sent, so none is attributed.
	if v, ok := got["isbn"]; ok {
		t.Errorf("isbn recorded as %q though none was supplied", v)
	}

	typed := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{
		"title": "A notebook", "author": "Me",
	}, http.StatusCreated))
	if got := booksSourcesByField(t, c, typed.ID); got["title"] != "manual" || got["author"] != "manual" {
		t.Errorf("a hand-typed book is not recorded as the reader's own: %v", got)
	}
}

// THE ECHOED SOURCE IS VALIDATED, NOT TRUSTED. A book's supplier cannot be
// recomputed without repeating the fetch, so the apply request carries it — which
// means the vocabulary is the guard. Anything outside it records nothing, rather
// than writing whatever arrived into a field the reader reads as provenance.
func TestAnUnknownSourceOnTheWireRecordsNothing(t *testing.T) {
	if got := knownBookSource("openlibrary"); got != "openlibrary" {
		t.Errorf("a real supplier was rejected: %q", got)
	}
	for _, bad := range []string{"", "  ", "tvdb-ish", "<script>", "TMDB'; DROP TABLE"} {
		if got := knownBookSource(bad); got != "" {
			t.Errorf("knownBookSource(%q) = %q, want \"\"", bad, got)
		}
	}
}

func booksSourcesByField(t *testing.T, c *testClient, id int64) map[string]string {
	t.Helper()
	got := decode[fieldSourceResp](t, c.mustDo("GET", "/books/"+strconv.FormatInt(id, 10), nil, http.StatusOK))
	out := map[string]string{}
	for _, f := range got.FieldSources {
		out[f.Field] = f.Source
	}
	return out
}
