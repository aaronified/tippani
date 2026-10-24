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

// pngMagic sniffs as image/png and clears the minImageBytes floor (padded).
var pngMagic = append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, make([]byte, 700)...)

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

// TestBookLookupQuota: a quota error from the search seam becomes a helpful
// "add a key" message, not a generic failure.
func TestBookLookupQuota(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, fmt.Errorf("google books: %w", metadata.ErrQuota)
	}
	h := srv.Handler()
	c := signupAdmin(t, h)
	rec := c.do("POST", "/books/lookup", map[string]any{"title": "anything"})
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("quota lookup: got %d, want 502", rec.Code)
	}
	// It names the screen the key is added on, Metadata › Sources.
	if !strings.Contains(rec.Body.String(), "Google Books") || !strings.Contains(rec.Body.String(), "Metadata › Sources") {
		t.Fatalf("quota message not helpful: %s", rec.Body)
	}
}

// TestRefetchEnriches: refetch backfills empty metadata + a cover for a book
// with a reliable identifier (ISBN), and never overwrites existing fields.
func TestRefetchEnriches(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{{
			Source: "openlibrary", Title: "Dune", Author: "Frank Herbert",
			Description: "Desert planet.", PublishedYear: 1965, Genres: []string{"sci-fi"},
			CoverURL: "https://covers.openlibrary.org/b/id/1-L.jpg",
		}}, nil
	}
	srv.fetchImage = func(context.Context, string, string) (string, error) {
		return "aaaaaaaaaaaaaaaa.jpg", nil
	}
	h := srv.Handler()
	admin := signupAdmin(t, h)
	// One book missing everything, one that already has an author (must be kept).
	if _, err := srv.Store.DB.Exec(`INSERT INTO books (user_id, title, isbn) VALUES (1, 'Dune', '9780441172719')`); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`INSERT INTO books (user_id, title, isbn, author) VALUES (1, 'Dune2', '9780593099322', 'Existing Author')`); err != nil {
		t.Fatal(err)
	}

	res := driveRefetch(t, admin)
	if res.Enriched < 1 || res.Fetched < 1 {
		t.Fatalf("counts: %+v", res)
	}
	var author, desc, cover string
	var year int
	if err := srv.Store.DB.QueryRow(
		`SELECT author, description, published_year, cover_path FROM books WHERE title = 'Dune'`).
		Scan(&author, &desc, &year, &cover); err != nil {
		t.Fatal(err)
	}
	if author != "Frank Herbert" || desc != "Desert planet." || year != 1965 || cover != "aaaaaaaaaaaaaaaa.jpg" {
		t.Fatalf("backfill: author=%q desc=%q year=%d cover=%q", author, desc, year, cover)
	}
	var genres int
	srv.Store.DB.QueryRow(`SELECT count(*) FROM book_genres bg JOIN books b ON b.id = bg.book_id WHERE b.title = 'Dune'`).Scan(&genres)
	if genres != 1 {
		t.Fatalf("genres backfilled = %d, want 1", genres)
	}
	// The pre-filled author is preserved, not overwritten.
	var kept string
	srv.Store.DB.QueryRow(`SELECT author FROM books WHERE title = 'Dune2'`).Scan(&kept)
	if kept != "Existing Author" {
		t.Fatalf("existing author overwritten: %q", kept)
	}
}
