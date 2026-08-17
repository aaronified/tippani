package httpapi

import (
	"encoding/json"
	"net/http"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// Annotations and dialogues were built as near-copies and drifted: dialogues
// arrived without tags and gained them later, arrived without noted_at and
// source and gained them in 0020, and never had colour at all until 0021. Each
// gap was invisible until somebody went looking for the feature on the wrong
// kind of quote.
//
// They now share quoteReq/quoteRow (quote.go) and differ only in how they point
// at their source. These tests pin that parity so the next field added to one
// cannot silently miss the other.

// sharedQuoteFields are the JSON keys every quote carries, whatever its kind.
// Adding a field to quoteRow means adding it here — which is the point: the
// test fails until both kinds actually return it.
var sharedQuoteFields = []string{
	"id", "quote", "note", "color", "favorite", "tags", "noted_at",
	"sticker_id", "sticker_x", "sticker_y", "created_at", "updated_at",
	"reviewed", "stability", "last_reviewed_at", "last_result",
}

func jsonKeys(t *testing.T, raw []byte) map[string]bool {
	t.Helper()
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("decode: %v (%s)", err, raw)
	}
	keys := map[string]bool{}
	for k := range m {
		keys[k] = true
	}
	return keys
}

// Both kinds must serialise every shared field — the embedded struct is
// anonymous precisely so the wire format stays flat, and a stray change to
// named embedding would nest them instead.
func TestQuoteKindsShareTheirFields(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := newTestBook(t, c, "Invisible Cities")
	annRec := c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "A quote from a book.",
	}, http.StatusCreated)

	movieID := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker"}, http.StatusCreated)).ID
	dlgRec := c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movieID, "quote": "A line from a film.",
	}, http.StatusCreated)

	for name, keys := range map[string]map[string]bool{
		"annotation": jsonKeys(t, annRec.Body.Bytes()),
		"dialogue":   jsonKeys(t, dlgRec.Body.Bytes()),
	} {
		for _, field := range sharedQuoteFields {
			if !keys[field] {
				t.Errorf("%s response is missing the shared field %q", name, field)
			}
		}
	}
}

// The Go types must agree too, not just this one response — a field added to
// quoteRow but scanned only on one side would pass the JSON check above with a
// zero value.
func TestQuoteRowEmbeddedInBothKinds(t *testing.T) {
	shared := reflect.TypeOf(quoteRow{})
	for name, typ := range map[string]reflect.Type{
		"annotationRow": reflect.TypeOf(annotationRow{}),
		"dialogueRow":   reflect.TypeOf(dialogueRow{}),
	} {
		field, ok := typ.FieldByName("quoteRow")
		if !ok {
			t.Fatalf("%s does not embed quoteRow", name)
		}
		if !field.Anonymous {
			t.Fatalf("%s embeds quoteRow by name — the JSON would nest instead of flatten", name)
		}
		if field.Type != shared {
			t.Fatalf("%s embeds %s, want quoteRow", name, field.Type)
		}
	}
}

// The locator fields are the *only* legitimate difference between the kinds.
// If a field lands on one side that isn't about pointing into a source, it
// should have gone into quoteRow instead.
func TestQuoteKindsDifferOnlyByLocator(t *testing.T) {
	// Embeds are flattened rather than skipped — with one exception, quoteRow
	// itself, which is the shared half this test is measuring the difference
	// against. Skipping every embed would let a whole struct of new fields (as
	// episodeRef was) ride onto one kind unnoticed, which is exactly what this
	// test exists to catch.
	var own func(reflect.Type) []string
	own = func(typ reflect.Type) []string {
		var names []string
		for i := 0; i < typ.NumField(); i++ {
			f := typ.Field(i)
			switch {
			case f.Type == reflect.TypeOf(quoteRow{}):
				continue
			case f.Anonymous && f.Type.Kind() == reflect.Struct:
				names = append(names, own(f.Type)...)
			default:
				names = append(names, f.Name)
			}
		}
		sort.Strings(names)
		return names
	}

	wantAnn := []string{"BookAuthor", "BookID", "BookTitle", "Chapter", "Location"}
	// Season/Episode are locators too: which episode of a show the line is from
	// (0025). A film leaves them null — its timestamp is the whole locator.
	wantDlg := []string{"Actor", "Character", "Episode", "MovieID", "Season", "Timestamp"}

	if got := own(reflect.TypeOf(annotationRow{})); !reflect.DeepEqual(got, wantAnn) {
		t.Errorf("annotationRow's own fields = %v, want %v\n"+
			"a new field here probably belongs in quoteRow, so dialogues get it too", got, wantAnn)
	}
	if got := own(reflect.TypeOf(dialogueRow{})); !reflect.DeepEqual(got, wantDlg) {
		t.Errorf("dialogueRow's own fields = %v, want %v\n"+
			"a new field here probably belongs in quoteRow, so annotations get it too", got, wantDlg)
	}
}

// ---- dialogue colour, the gap 0021 closed ----

func TestDialogueColorRoundTrips(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	movieID := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker"}, http.StatusCreated)).ID

	created := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movieID, "quote": "Let everything come true.", "color": "blue",
	}, http.StatusCreated))
	if created.Color != "blue" {
		t.Fatalf("created colour = %q want blue", created.Color)
	}

	updated := decode[dialogueRow](t, c.mustDo("PUT", "/dialogues/"+strconv.FormatInt(created.ID, 10), map[string]any{
		"movie_id": movieID, "quote": "Let everything come true.", "color": "pink",
	}, http.StatusOK))
	if updated.Color != "pink" {
		t.Fatalf("updated colour = %q want pink", updated.Color)
	}

	fetched := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues", nil, http.StatusOK))
	if fetched.Dialogues[0].Color != "pink" {
		t.Fatalf("listed colour = %q want pink", fetched.Dialogues[0].Color)
	}
}

// What the create handler does with the colour it is (or isn't) given. The
// ?color= FILTER validation lives in TestDialogueColorFilter — a different
// handler, and crud_test.go:355 documents why both halves exist separately.
func TestDialogueColorOnCreate(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	movieID := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker"}, http.StatusCreated)).ID

	for _, tc := range []struct {
		name, quote, color string
		omit               bool
		wantStatus         int
		wantColor          string
	}{
		// Same default as an annotation: a line you didn't colour is yellow, not blank,
		// so nothing looks categorised that wasn't.
		{"defaults to yellow when omitted", "No colour given.", "", true, http.StatusCreated, "yellow"},

		{"rejects a colour off the palette", "Chartreuse, please.", "chartreuse", false, http.StatusBadRequest, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]any{"movie_id": movieID, "quote": tc.quote}
			if !tc.omit {
				body["color"] = tc.color
			}
			rec := c.mustDo("POST", "/dialogues", body, tc.wantStatus)
			if tc.wantStatus != http.StatusCreated {
				return
			}
			if got := decode[dialogueRow](t, rec).Color; got != tc.wantColor {
				t.Fatalf("colour = %q want %s", got, tc.wantColor)
			}
		})
	}
}

// The ?color= filter now works on both kinds, from the same helper.
func TestDialogueColorFilter(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	movieID := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker"}, http.StatusCreated)).ID

	for _, tc := range []struct{ quote, color string }{
		{"A blue line.", "blue"},
		{"An orange line.", "orange"},
		{"Another blue line.", "blue"},
	} {
		c.mustDo("POST", "/dialogues", map[string]any{
			"movie_id": movieID, "quote": tc.quote, "color": tc.color,
		}, http.StatusCreated)
	}

	got := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?color=blue", nil, http.StatusOK))
	if len(got.Dialogues) != 2 {
		t.Fatalf("colour filter returned %d lines, want 2", len(got.Dialogues))
	}
	for _, d := range got.Dialogues {
		if d.Color != "blue" {
			t.Fatalf("filter leaked a %s line", d.Color)
		}
	}

	c.mustDo("GET", "/dialogues?color=chartreuse", nil, http.StatusBadRequest)
}

// The catalogue export round-trips through the importer, so a colour set on a
// line has to survive the trip out and back — otherwise exporting and
// re-importing silently resets every dialogue to yellow.
func TestDialogueColorSurvivesExportImport(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// A director makes the file route to the catalogue importer rather than the
	// book one (LooksLikeMovieMarkdown) — as a real export always would.
	movieID := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker", "director": "Andrei Tarkovsky"}, http.StatusCreated)).ID
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movieID, "quote": "Let everything come true.", "color": "pink",
	}, http.StatusCreated)
	// The default colour must stay implicit in the file, and come back as yellow.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movieID, "quote": "A line left at the default.",
	}, http.StatusCreated)

	md := c.mustDo("GET", "/movies/"+strconv.FormatInt(movieID, 10)+"/export", nil, http.StatusOK).Body.String()
	if !strings.Contains(md, "- color: pink") {
		t.Fatalf("export dropped the colour:\n%s", md)
	}
	if strings.Contains(md, "yellow") {
		t.Fatalf("export should leave the default colour implicit:\n%s", md)
	}

	// Re-import into a clean account: the colour comes back.
	other := addUser(t, h, c, "bob")
	rec := other.importApprove("/import/markdown", "stalker.md", []byte(md))
	if rec.Code != http.StatusOK {
		t.Fatalf("re-import: %d %s", rec.Code, rec.Body)
	}
	got := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, other.mustDo("GET", "/dialogues", nil, http.StatusOK))
	if len(got.Dialogues) != 2 {
		t.Fatalf("re-imported %d dialogues, want 2", len(got.Dialogues))
	}
	byQuote := map[string]string{}
	for _, d := range got.Dialogues {
		byQuote[d.Quote] = d.Color
	}
	if byQuote["Let everything come true."] != "pink" {
		t.Fatalf("colour lost in the round trip: %v", byQuote)
	}
	if byQuote["A line left at the default."] != "yellow" {
		t.Fatalf("default colour changed in the round trip: %v", byQuote)
	}
}

// A catalogue export has to say what kind of work it came from, and the importer
// has to read that back: each row exports one work and re-imports the server's
// own output into a clean account.
func TestExportStatesItsMediaTypeAndReimports(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	count := func(i int) *int { return &i }

	for _, tc := range []struct {
		name          string
		importer      string
		create        map[string]any
		quote         string
		file          string
		wantTypeLine  string
		wantTitle     string // "" = the original test did not pin the title
		wantMediaType string
		// wantBooks/wantDialogues are asserted only when set — the bare-film row
		// checks where the re-import landed; the show row never did.
		wantBooks     *int
		wantDialogues *int
	}{
		{
			// TestBareFilmExportReimportsAsFilm is the end-to-end version of the routing bug:
			// a film with no director, no collection, and no character/actor/timestamp on any
			// line used to re-import as a BOOK, because nothing in its own export said
			// "film". The catalogue export now always carries a type line.
			name:     "a bare film export re-imports as a film",
			importer: "bob",
			// Deliberately bare: only a title, and one unattributed line.
			create:        map[string]any{"title": "Stalker"},
			quote:         "Let everything that has been planned come true.",
			file:          "stalker.md",
			wantTypeLine:  "type: movie",
			wantTitle:     "Stalker",
			wantMediaType: "movie",
			wantBooks:     count(0),
			wantDialogues: count(1),
		},
		{
			// A show must round-trip its type too — the old exporter got this case right, so
			// this is the guard that making the line unconditional didn't break it.
			name:          "a show export keeps its media type",
			importer:      "carol",
			create:        map[string]any{"title": "Andor", "media_type": "show"},
			quote:         "One way out.",
			file:          "andor.md",
			wantTypeLine:  "type: show",
			wantMediaType: "show",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			movieID := decode[movieDetail](t, c.mustDo("POST", "/movies",
				tc.create, http.StatusCreated)).ID
			c.mustDo("POST", "/dialogues", map[string]any{
				"movie_id": movieID, "quote": tc.quote,
			}, http.StatusCreated)

			md := c.mustDo("GET", "/movies/"+strconv.FormatInt(movieID, 10)+"/export", nil, http.StatusOK).Body.String()
			if !strings.Contains(md, tc.wantTypeLine) {
				t.Fatalf("the export must state %q:\n%s", tc.wantTypeLine, md)
			}

			// Re-import into a clean account: it must land in the catalogue, not the
			// library. A FRESH importer per row (the admin's server is shared, the
			// importing account is not), so the second import cannot anchor onto the
			// first row's catalogue — the clean account is the point of both cases.
			other := addUser(t, h, c, tc.importer)
			rec := other.importApprove("/import/markdown", tc.file, []byte(md))
			if rec.Code != http.StatusOK {
				t.Fatalf("re-import: %d %s", rec.Code, rec.Body)
			}

			movies := decode[struct {
				Movies []struct {
					Title     string `json:"title"`
					MediaType string `json:"media_type"`
				} `json:"movies"`
			}](t, other.mustDo("GET", "/movies", nil, http.StatusOK))
			if len(movies.Movies) != 1 {
				t.Fatalf("expected exactly one re-imported work: %+v", movies.Movies)
			}
			if tc.wantTitle != "" && movies.Movies[0].Title != tc.wantTitle {
				t.Fatalf("did not re-import under its own title: %+v", movies.Movies)
			}
			if movies.Movies[0].MediaType != tc.wantMediaType {
				t.Fatalf("media_type = %q want %q", movies.Movies[0].MediaType, tc.wantMediaType)
			}

			if tc.wantBooks != nil {
				books := decode[pagedBooks](t, other.mustDo("GET", "/books", nil, http.StatusOK))
				if len(books.Books) != *tc.wantBooks {
					t.Fatalf("re-import leaked into the library as %d book(s): %+v", len(books.Books), books.Books)
				}
			}
			if tc.wantDialogues != nil {
				dlgs := decode[struct {
					Dialogues []dialogueRow `json:"dialogues"`
				}](t, other.mustDo("GET", "/dialogues", nil, http.StatusOK))
				if len(dlgs.Dialogues) != *tc.wantDialogues {
					t.Fatalf("expected %d line(s) to arrive as dialogue, got %d", *tc.wantDialogues, len(dlgs.Dialogues))
				}
			}
		})
	}
}
