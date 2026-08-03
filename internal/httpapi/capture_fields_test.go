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

func TestCreateAnnotationAcceptsNotedAt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	for _, tc := range []struct{ name, send, wantPrefix string }{
		{"date only", "2026-07-14", "2026-07-14"},
		{"sqlite datetime", "2026-07-14 09:30:00", "2026-07-14 09:30:00"},
		{"rfc3339 utc", "2026-07-14T09:30:00Z", "2026-07-14 09:30:00"},
		{"rfc3339 with offset", "2026-07-14T09:30:00+05:45", "2026-07-14 03:45:00"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := c.mustDo("POST", "/annotations", map[string]any{
				"book_id":  bookID,
				"quote":    "A quote noted on " + tc.name,
				"noted_at": tc.send,
			}, http.StatusCreated)
			got := decode[annotationRow](t, rec)
			if !strings.HasPrefix(got.NotedAt, tc.wantPrefix) {
				t.Fatalf("noted_at = %q, want prefix %q", got.NotedAt, tc.wantPrefix)
			}
		})
	}
}

func TestCreateAnnotationNotedAtDefaultsToNow(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	got := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "No date supplied.",
	}, http.StatusCreated))
	if got.NotedAt == "" {
		t.Fatal("noted_at should default to now when omitted")
	}
}

func TestCreateAnnotationRejectsBadNotedAt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	for _, tc := range []struct{ name, send string }{
		{"unparseable", "last Tuesday"},
		{"partial", "2026-07"},
		{"far future", "3000-01-01"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c.mustDo("POST", "/annotations", map[string]any{
				"book_id": bookID, "quote": "Bad date: " + tc.name, "noted_at": tc.send,
			}, http.StatusBadRequest)
		})
	}
}

// A phone in UTC+14 legitimately reports a local time ahead of the server's UTC
// clock, so "the future" needs a day of slack before it counts as nonsense.
func TestCreateAnnotationAllowsSmallClockSkew(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	var body struct {
		NotedAt string `json:"noted_at"`
	}
	_ = body
	// One hour ahead of the server: accepted.
	rec := c.do("POST", "/annotations", map[string]any{
		"book_id":  bookID,
		"quote":    "Captured on a phone whose clock runs fast.",
		"noted_at": nowPlus(t, srv, "+1 hours"),
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("an hour of skew should be tolerated: %d %s", rec.Code, rec.Body)
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

func TestCreateAnnotationAcceptsSource(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	sourceOf := func(quote string) string {
		t.Helper()
		var v string
		if err := srv.Store.DB.QueryRow(
			`SELECT source FROM annotations WHERE quote = ?`, quote).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}

	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "Photographed from the page.", "source": "ocr",
	}, http.StatusCreated)
	if got := sourceOf("Photographed from the page."); got != "ocr" {
		t.Fatalf("source = %q want ocr", got)
	}

	// Omitted still means manual, so nothing about the web UI changes.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "Typed by hand.",
	}, http.StatusCreated)
	if got := sourceOf("Typed by hand."); got != "manual" {
		t.Fatalf("source = %q want manual", got)
	}
}

// The allowlist stops a client inventing provenance — "source" is displayed and
// filtered on, so it has to mean something.
func TestCreateAnnotationRejectsUnknownSource(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "Dubious provenance.", "source": "definitely-real",
	}, http.StatusBadRequest)
}
