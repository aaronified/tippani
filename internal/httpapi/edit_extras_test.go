package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"tippani/internal/metadata"
)

// pngMagic is enough for http.DetectContentType to sniff image/png.
var pngMagic = []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0}

func createBook(t *testing.T, c *testClient, title string) int64 {
	t.Helper()
	rec := c.mustDo("POST", "/books", map[string]any{"title": title}, 201)
	var b struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &b); err != nil {
		t.Fatal(err)
	}
	return b.ID
}

// TestBookCoverViaURL: PUT with cover_url fetches (user-URL seam) and stores the
// name; clear_cover drops it. The old file is removed on replace.
func TestBookCoverViaURL(t *testing.T) {
	srv := newTestServer(t)
	var gotURL string
	srv.fetchUserImage = func(_ context.Context, u, _ string) (string, error) {
		gotURL = u
		return "deadbeefdeadbeef.jpg", nil
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	id := createBook(t, c, "Homo Deus")

	rec := c.mustDo("PUT", fmt.Sprintf("/books/%d", id),
		map[string]any{"title": "Homo Deus", "cover_url": "https://images-na.ssl-images-amazon.com/x.jpg"}, 200)
	var got struct {
		CoverPath string `json:"cover_path"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if got.CoverPath != "deadbeefdeadbeef.jpg" {
		t.Fatalf("cover_path = %q", got.CoverPath)
	}
	if gotURL == "" {
		t.Fatal("fetchUserImage was not called")
	}

	rec = c.mustDo("PUT", fmt.Sprintf("/books/%d", id),
		map[string]any{"title": "Homo Deus", "clear_cover": true}, 200)
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if got.CoverPath != "" {
		t.Fatalf("clear_cover left cover_path = %q", got.CoverPath)
	}
}

// TestCoverUpload stores a multipart image and points the row at it.
func TestCoverUpload(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	id := createBook(t, c, "Dune")

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", "cover.png")
	_, _ = fw.Write(pngMagic)
	_ = mw.Close()

	rec := c.doRaw("POST", fmt.Sprintf("/books/%d/cover", id), &buf, mw.FormDataContentType())
	if rec.Code != 200 {
		t.Fatalf("upload: %d %s", rec.Code, rec.Body)
	}
	var got struct {
		CoverPath string `json:"cover_path"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if !strings.HasSuffix(got.CoverPath, ".png") {
		t.Fatalf("cover_path = %q, want .png", got.CoverPath)
	}
	if _, err := os.Stat(filepath.Join(srv.coversDir(), got.CoverPath)); err != nil {
		t.Fatalf("stored file missing: %v", err)
	}

	// A non-image is rejected.
	var buf2 bytes.Buffer
	mw2 := multipart.NewWriter(&buf2)
	fw2, _ := mw2.CreateFormFile("file", "x.txt")
	_, _ = fw2.Write([]byte("not an image"))
	_ = mw2.Close()
	rec = c.doRaw("POST", fmt.Sprintf("/books/%d/cover", id), &buf2, mw2.FormDataContentType())
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("non-image upload: got %d, want 400", rec.Code)
	}
}

// TestMetadataKeysPartialSave: a partial PUT never clears untouched secrets, the
// Amazon cookie is stored but never echoed, and the domain (not secret) is.
func TestMetadataKeysPartialSave(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("PUT", "/admin/metadata-keys",
		map[string]any{"amazon_cookie": "session-id=SECRET123", "amazon_domain": "www.amazon.de"}, 200)

	rec := c.mustDo("GET", "/admin/metadata-keys", nil, 200)
	body := rec.Body.String()
	if strings.Contains(body, "SECRET123") {
		t.Fatal("amazon cookie value leaked in GET response")
	}
	if !strings.Contains(body, `"amazon_cookie_set":true`) {
		t.Fatalf("amazon_cookie_set missing: %s", body)
	}
	if !strings.Contains(body, `"amazon_domain":"www.amazon.de"`) {
		t.Fatalf("amazon_domain missing: %s", body)
	}

	// A later PUT that only sets tmdb_key must leave the amazon cookie intact.
	c.mustDo("PUT", "/admin/metadata-keys", map[string]any{"tmdb_key": "k"}, 200)
	rec = c.mustDo("GET", "/admin/metadata-keys", nil, 200)
	if !strings.Contains(rec.Body.String(), `"amazon_cookie_set":true`) {
		t.Fatalf("partial PUT cleared the amazon cookie: %s", rec.Body)
	}
}

// TestBookLookupQuota: a quota error from the search seam becomes a helpful
// "add a key" message, not a generic failure.
func TestBookLookupQuota(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(context.Context, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, fmt.Errorf("google books: %w", metadata.ErrQuota)
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	rec := c.do("POST", "/books/lookup", map[string]any{"title": "anything"})
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("quota lookup: got %d, want 502", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Google Books") || !strings.Contains(rec.Body.String(), "Settings") {
		t.Fatalf("quota message not helpful: %s", rec.Body)
	}
}

// TestTitlesSimilar pins the fuzzy match the import flag relies on.
func TestTitlesSimilar(t *testing.T) {
	same := [][2]string{
		{"Homo Deus", "Homo Deus: The million-copy bestseller from the author of Nexus"},
		{"Dune", "Dune"},
		{"The Black Swan", "the black swan — the impact of the highly improbable"},
	}
	for _, p := range same {
		if !titlesSimilar(p[0], p[1]) {
			t.Errorf("titlesSimilar(%q, %q) = false, want true", p[0], p[1])
		}
	}
	diff := [][2]string{
		{"Dune", "Dune Messiah"},
		{"Homo Deus", "Sapiens"},
		{"It", "It Ends with Us"}, // 2-char stub must not match
	}
	for _, p := range diff {
		if titlesSimilar(p[0], p[1]) {
			t.Errorf("titlesSimilar(%q, %q) = true, want false", p[0], p[1])
		}
	}
}
