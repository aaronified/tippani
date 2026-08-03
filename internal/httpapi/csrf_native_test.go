package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// The mobile client (see the Android app under mobile/) authenticates with a
// bearer token and is not a browser: it sends neither Origin nor Sec-Fetch-Site.
// The whole native-client design rests on those requests surviving the
// http.NewCrossOriginProtection wrapper in Handler() — so this file pins that
// behaviour down instead of leaving it as an inference about stdlib internals.
//
// These are characterization tests: they describe what the server does today,
// before any bearer-auth code exists. They then stand as the regression guard
// that (a) a Go upgrade doesn't quietly start rejecting the app, and (b) the
// forthcoming bearer bypass doesn't widen the browser attack surface.

// postRaw sends a JSON POST through the full handler chain with explicit control
// over the browser fetch-metadata headers, which testClient.do deliberately
// never sets.
func postRaw(t *testing.T, h http.Handler, c *testClient, path string, body any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", apiPath(path), &buf)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if c.cookie != nil {
		req.AddCookie(c.cookie)
	}
	if c.bearer != "" {
		req.Header.Set("Authorization", "Bearer "+c.bearer)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// newTestBook creates a book and returns its id, for tests that need somewhere
// to hang an annotation.
func newTestBook(t *testing.T, c *testClient, title string) int64 {
	t.Helper()
	rec := c.mustDo("POST", "/books", map[string]any{"title": title}, http.StatusCreated)
	return decode[bookDetail](t, rec).ID
}

// TestCSRFAllowsHeaderlessPost is the load-bearing one: a non-browser client
// sending neither Origin nor Sec-Fetch-Site must be able to write. If this ever
// fails, the mobile app cannot save a capture and the bearer-auth approach needs
// rethinking before any client code is written.
func TestCSRFAllowsHeaderlessPost(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	rec := postRaw(t, h, c, "/annotations", map[string]any{
		"book_id": bookID,
		"quote":   "Cities, like dreams, are made of desires and fears.",
	}, nil)

	if rec.Code != http.StatusCreated {
		t.Fatalf("header-less POST: got %d want 201: %s", rec.Code, rec.Body)
	}
}

// TestCSRFAllowsSameOriginPost covers the browser path that the SPA actually
// uses, so the two allowed shapes are pinned side by side.
func TestCSRFAllowsSameOriginPost(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	rec := postRaw(t, h, c, "/annotations", map[string]any{
		"book_id": bookID,
		"quote":   "Memory's images, once they are fixed in words, are erased.",
	}, map[string]string{
		// httptest.NewRequest serves http://example.com.
		"Origin":         "http://example.com",
		"Sec-Fetch-Site": "same-origin",
	})

	if rec.Code != http.StatusCreated {
		t.Fatalf("same-origin POST: got %d want 201: %s", rec.Code, rec.Body)
	}
}

// TestCSRFBlocksCrossSitePost is the regression guard. A cookie is an ambient
// credential, so a cross-site write from a browser must stay blocked — the
// bearer bypass added later must not relax this.
func TestCSRFBlocksCrossSitePost(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	for _, tc := range []struct {
		name    string
		headers map[string]string
	}{
		{"cross-site fetch metadata", map[string]string{"Sec-Fetch-Site": "cross-site"}},
		{"foreign origin", map[string]string{"Origin": "https://evil.example"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := postRaw(t, h, c, "/annotations", map[string]any{
				"book_id": bookID,
				"quote":   "This should never be written.",
			}, tc.headers)

			if rec.Code != http.StatusForbidden {
				t.Fatalf("cross-site POST: got %d want 403: %s", rec.Code, rec.Body)
			}
		})
	}
}
