package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// The dashboard widget, driven the way gethomepage drives it: a GET with the
// key in a header, and four numbers back. The library is built through the API
// and the two recall numbers are earned by answering the quiz, so "mastered"
// and "forgot" here mean what a reader's own answers made them.
func TestWidgetReportsTheFourNumbers(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// Mastered is the top rung; srStart=mastered puts a first correct answer there.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srStart": startMastered}, http.StatusOK)
	book := createBook(t, c, "Meditations")
	c.mustDo("POST", "/books", map[string]any{"title": "Letters from a Stoic"}, http.StatusCreated)
	var ids []int64
	for _, q := range []string{
		"You have power over your mind, not outside events.",
		"The best revenge is not to be like your enemy.",
		"Waste no more time arguing what a good man should be.",
	} {
		ids = append(ids, idOf(t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": book, "quote": q}, http.StatusCreated).Body.Bytes()))
	}
	c.mustDo("POST", "/quotes", map[string]any{"quote": "Be the change.", "speaker": "Somebody", "occasion": "A speech"}, http.StatusCreated)
	ageSeededItems(t, srv)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusOK)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[1], "result": "forgot", "mode": "daily"}, http.StatusOK)
	// A line still on the top rung whose last answer was a miss: forgotten, and
	// so NOT mastered. Written directly because no single answer lands here —
	// which is exactly why the rung alone cannot be the test for "mastered".
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[2], "result": "got", "mode": "daily"}, http.StatusOK)
	if _, err := srv.Store.DB.Exec(`UPDATE item_reviews SET last_result = 'forgot' WHERE kind = ? AND item_id = ?`, kindBook, ids[2]); err != nil {
		t.Fatal(err)
	}

	// No key yet: the endpoint answers nobody.
	if rec := widgetGet(h, "Authorization", "Bearer tpw_nothing"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("unknown key: %d", rec.Code)
	}
	key := decode[struct{ Key string }](t, c.mustDo("POST", "/auth/widget-key", nil, 200)).Key

	for _, hdr := range []string{"Authorization", "X-API-Key"} {
		v := key
		if hdr == "Authorization" {
			v = "Bearer " + key
		}
		rec := widgetGet(h, hdr, v)
		if rec.Code != 200 {
			t.Fatalf("%s: %d %s", hdr, rec.Code, rec.Body)
		}
		got := decode[widgetCounts](t, rec)
		want := widgetCounts{Works: 2, Quotes: 4, Forgot: 2, Mastered: 1}
		if got != want {
			t.Fatalf("%s: got %+v, want %+v", hdr, got, want)
		}
	}

	// Never on the query string: the request log prints the URI.
	qreq := httptest.NewRequest("GET", "/api/widget?key="+key, nil)
	qrec := httptest.NewRecorder()
	h.ServeHTTP(qrec, qreq)
	if qrec.Code != http.StatusUnauthorized {
		t.Fatalf("a key in the query string was accepted: %d", qrec.Code)
	}

	// A key opens four numbers and nothing else.
	req := httptest.NewRequest("GET", "/api/books", nil)
	req.Header.Set("Authorization", "Bearer "+key)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("widget key reached /books: %d", rec.Code)
	}

	// Rotating replaces; revoking closes.
	key2 := decode[struct{ Key string }](t, c.mustDo("POST", "/auth/widget-key", nil, 200)).Key
	if widgetGet(h, "X-API-Key", key).Code != http.StatusUnauthorized || widgetGet(h, "X-API-Key", key2).Code != 200 {
		t.Fatal("a rotated key did not replace the old one")
	}
	c.mustDo("DELETE", "/auth/widget-key", nil, 200)
	if widgetGet(h, "X-API-Key", key2).Code != http.StatusUnauthorized {
		t.Fatal("a revoked key still answers")
	}
}

// Another reader's key sees another reader's library: the counts are per user.
func TestWidgetKeyIsPerUser(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	createBook(t, alice, "Only Alice's")
	key := decode[struct{ Key string }](t, bob.mustDo("POST", "/auth/widget-key", nil, 200)).Key
	if got := decode[widgetCounts](t, widgetGet(h, "X-API-Key", key)); got.Works != 0 {
		t.Fatalf("bob's widget counted alice's works: %+v", got)
	}
}

func widgetGet(h http.Handler, header, value string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", "/api/widget", nil)
	req.Header.Set(header, value)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// THE LIBRARY SCAN ON THE DASHBOARD (3.9.1). `found` counts the files the scan proposed that nobody has accepted
// or refused, as the Found files list on Checks does; `scanning` counts this reader's scans queued or running.
// Both are read from stored rows, for this reader only.
func TestWidgetCountsTheFilesTheScanFoundAndTheScansRunning(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	key := decode[struct{ Key string }](t, alice.mustDo("POST", "/auth/widget-key", nil, 200)).Key
	mine := createBook(t, alice, "The Fires of Heaven")
	other := createBook(t, alice, "Walden")
	theirs := createBook(t, bob, "Dune")
	uid := userIDOf(t, srv, "alice")
	bobID := userIDOf(t, srv, "bob")

	finding := func(user int64, mount string, work int64, rel string) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(`INSERT INTO library_scan_findings (user_id, mount_id, subject, work_id, episode, rel, format, title, how, bucket, pass)
			VALUES (?, ?, 'book', ?, '', ?, 'epub', 't', 'title', 'exact', 1)`, user, mount, work, rel); err != nil {
			t.Fatal(err)
		}
	}
	job := func(user int64, kind, state string) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(`INSERT INTO jobs (user_id, kind, state, created_at) VALUES (?, ?, ?, 1)`, user, kind, state); err != nil {
			t.Fatal(err)
		}
	}
	counts := func() widgetCounts { return decode[widgetCounts](t, widgetGet(h, "X-API-Key", key)) }

	if got := counts(); got.Found != 0 || got.Scanning != 0 {
		t.Fatalf("a quiet library reads found %d scanning %d, want 0 and 0", got.Found, got.Scanning)
	}

	finding(uid, "a", mine, "The Fires of Heaven.epub")
	finding(uid, "b", other, "Walden.epub")  // another folder: counted too
	finding(bobID, "a", theirs, "Dune.epub") // another reader's
	if got := counts().Found; got != 2 {
		t.Fatalf("found = %d, want 2 (both folders, not the other reader's)", got)
	}

	// accepted: the work has its file, so its proposal is no longer offered
	if _, err := srv.Store.DB.Exec(`INSERT INTO work_sources (user_id, subject, subject_id, role, format, path) VALUES (?, 'book', ?, 'text', 'epub', 'x')`, uid, mine); err != nil {
		t.Fatal(err)
	}
	// refused: the reader said no to this file
	if _, err := srv.Store.DB.Exec(`INSERT INTO cleanup_ignores (user_id, kind, item_id, field, rule, match_hash) VALUES (?, 'work-book', ?, 'source', 'source-attach', 'b:Walden.epub')`, uid, other); err != nil {
		t.Fatal(err)
	}
	if got := counts().Found; got != 0 {
		t.Fatalf("found = %d after one was accepted and one refused, want 0", got)
	}

	job(uid, libraryScanKind, "running")
	job(uid, libraryScanKind, "queued")
	job(uid, libraryScanKind, "succeeded")
	job(uid, "reverify", "running")
	job(bobID, libraryScanKind, "running")
	if got := counts().Scanning; got != 2 {
		t.Fatalf("scanning = %d, want 2 (this reader's queued and running scans only)", got)
	}
}
