package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// Two fields a capture made offline needs on create.
//
// noted_at: create used to hardcode datetime('now'), so a quote photographed on
// Tuesday and flushed on Friday was dated Friday. Quietly wrong, and by the time
// anyone notices, the original date is gone. The column has existed since 0008
// and importers already populate it; only the create path lacked the plumbing.
//
// source: create hardcoded 'manual'. Distinguishing an OCR'd page from something
// typed by hand costs nothing here and can't be recovered later.

func TestCreateAnnotationNotedAt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	// The table is built here, after srv exists, so the clock-skew row can read the
	// server's own clock. Every row also sends a distinct quote, or the later ones
	// would 409 on the dedupe hash rather than exercise the date they carry.
	cases := []struct {
		name       string
		send       string
		omit       bool
		wantStatus int
		wantPrefix string // on a 201 row, "" means "stored, exact value unpinned"
	}{
		{"date only", "2026-07-14", false, http.StatusCreated, "2026-07-14"},
		{"sqlite datetime", "2026-07-14 09:30:00", false, http.StatusCreated, "2026-07-14 09:30:00"},
		{"rfc3339 utc", "2026-07-14T09:30:00Z", false, http.StatusCreated, "2026-07-14 09:30:00"},
		{"rfc3339 with offset", "2026-07-14T09:30:00+05:45", false, http.StatusCreated, "2026-07-14 03:45:00"},

		// Omitted is the web UI's case: no date supplied, so noted_at defaults to now.
		{"defaults to now when omitted", "", true, http.StatusCreated, ""},

		{"unparseable", "last Tuesday", false, http.StatusBadRequest, ""},
		{"partial", "2026-07", false, http.StatusBadRequest, ""},
		{"far future", "3000-01-01", false, http.StatusBadRequest, ""},

		// A phone in UTC+14 legitimately reports a local time ahead of the server's UTC
		// clock, so "the future" needs a day of slack before it counts as nonsense.
		// One hour ahead of the server: accepted.
		{"allows small clock skew", nowPlus(t, srv, "+1 hours"), false, http.StatusCreated, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]any{
				"book_id": bookID,
				"quote":   "A quote noted on " + tc.name,
			}
			if !tc.omit {
				body["noted_at"] = tc.send
			}
			rec := c.mustDo("POST", "/annotations", body, tc.wantStatus)
			if tc.wantStatus != http.StatusCreated {
				return
			}
			got := decode[annotationRow](t, rec)
			if got.NotedAt == "" {
				t.Fatal("noted_at should be stored, and should default to now when omitted")
			}
			if tc.wantPrefix != "" && !strings.HasPrefix(got.NotedAt, tc.wantPrefix) {
				t.Fatalf("noted_at = %q, want prefix %q", got.NotedAt, tc.wantPrefix)
			}
		})
	}
}

// nowPlus renders a SQLite-format timestamp offset from the server's clock, so
// the test doesn't depend on the test machine's timezone.
func nowPlus(t *testing.T, srv *Server, modifier string) string {
	t.Helper()
	var v string
	if err := srv.Store.DB.QueryRow(`SELECT datetime('now', ?)`, modifier).Scan(&v); err != nil {
		t.Fatal(err)
	}
	return v
}

func TestCreateDialogueAcceptsNotedAt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	movieID := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker"}, http.StatusCreated)).ID

	got := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movieID,
		"quote":    "Let everything that has been planned come true.",
		"noted_at": "2026-07-14",
	}, http.StatusCreated))
	if !strings.HasPrefix(got.NotedAt, "2026-07-14") {
		t.Fatalf("noted_at = %q", got.NotedAt)
	}
}

func TestCreateAnnotationSource(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	sourceOf := func(t *testing.T, quote string) string {
		t.Helper()
		var v string
		if err := srv.Store.DB.QueryRow(
			`SELECT source FROM annotations WHERE quote = ?`, quote).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}

	// One quote text per row, so sourceOf reads back exactly the row it posted.
	for _, tc := range []struct {
		name, quote, source string
		omit                bool
		wantStatus          int
		wantStored          string // "" means nothing was stored to read back
	}{
		{"ocr is kept", "Photographed from the page.", "ocr", false, http.StatusCreated, "ocr"},

		// Omitted still means manual, so nothing about the web UI changes.
		{"omitted means manual", "Typed by hand.", "", true, http.StatusCreated, "manual"},

		// The allowlist stops a client inventing provenance — "source" is displayed and
		// filtered on, so it has to mean something.
		{"invented provenance refused", "Dubious provenance.", "definitely-real", false, http.StatusBadRequest, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]any{"book_id": bookID, "quote": tc.quote}
			if !tc.omit {
				body["source"] = tc.source
			}
			c.mustDo("POST", "/annotations", body, tc.wantStatus)
			if tc.wantStored == "" {
				return
			}
			if got := sourceOf(t, tc.quote); got != tc.wantStored {
				t.Fatalf("source = %q want %s", got, tc.wantStored)
			}
		})
	}
}
