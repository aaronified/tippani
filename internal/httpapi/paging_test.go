package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

// A phone syncing a library needs to walk it in pages. Before this, /books and
// /movies had no limit at all (the whole library shipped on every call) and
// /annotations and /dialogues had a limit capped at 500 with no offset — so a
// library of 3,000 quotes could be fetched entirely, or its newest 500, and
// nothing else.
//
// The SPA passes none of these parameters, so the no-parameter response must
// stay exactly what it was. That guard matters more than the paging itself.

type pagedBooks struct {
	Books []struct {
		ID    int64  `json:"id"`
		Title string `json:"title"`
	} `json:"books"`
}

type pagedAnnotations struct {
	Annotations []annotationRow `json:"annotations"`
}

func seedBooks(t *testing.T, c *testClient, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		c.mustDo("POST", "/books", map[string]any{"title": fmt.Sprintf("Book %02d", i)}, http.StatusCreated)
	}
}

func seedAnnotations(t *testing.T, c *testClient, bookID int64, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": bookID, "quote": fmt.Sprintf("Quote number %02d", i),
		}, http.StatusCreated)
	}
}

// Walking with limit+offset must cover every row exactly once — no duplicates
// across page boundaries, no gaps. A client that silently loses a quote here
// would be worse than one that can't page at all.
func TestPagingWalksBooksExactlyOnce(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedBooks(t, c, 12)

	seen := map[int64]int{}
	for offset := 0; ; offset += 5 {
		page := decode[pagedBooks](t, c.mustDo("GET",
			fmt.Sprintf("/books?limit=5&offset=%d", offset), nil, http.StatusOK))
		if len(page.Books) == 0 {
			break
		}
		if len(page.Books) > 5 {
			t.Fatalf("page at offset %d returned %d rows, limit was 5", offset, len(page.Books))
		}
		for _, b := range page.Books {
			seen[b.ID]++
		}
		if offset > 100 {
			t.Fatal("paging did not terminate")
		}
	}

	if len(seen) != 12 {
		t.Fatalf("walked %d distinct books, want 12", len(seen))
	}
	for id, n := range seen {
		if n != 1 {
			t.Fatalf("book %d appeared %d times across pages", id, n)
		}
	}
}

func TestPagingWalksAnnotationsExactlyOnce(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")
	seedAnnotations(t, c, bookID, 12)

	seen := map[int64]int{}
	for offset := 0; offset < 20; offset += 5 {
		page := decode[pagedAnnotations](t, c.mustDo("GET",
			fmt.Sprintf("/annotations?limit=5&offset=%d", offset), nil, http.StatusOK))
		for _, a := range page.Annotations {
			seen[a.ID]++
		}
	}
	if len(seen) != 12 {
		t.Fatalf("walked %d distinct annotations, want 12", len(seen))
	}
	for id, n := range seen {
		if n != 1 {
			t.Fatalf("annotation %d appeared %d times", id, n)
		}
	}
}

// TestPagingDefaultsUnchanged is the SPA regression guard: no parameters must
// behave exactly as before, returning everything.
func TestPagingDefaultsUnchanged(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedBooks(t, c, 7)
	bookID := decode[pagedBooks](t, c.mustDo("GET", "/books", nil, http.StatusOK)).Books[0].ID
	seedAnnotations(t, c, bookID, 7)

	if got := decode[pagedBooks](t, c.mustDo("GET", "/books", nil, http.StatusOK)); len(got.Books) != 7 {
		t.Fatalf("unpaged /books returned %d, want all 7", len(got.Books))
	}
	if got := decode[pagedAnnotations](t, c.mustDo("GET", "/annotations", nil, http.StatusOK)); len(got.Annotations) != 7 {
		t.Fatalf("unpaged /annotations returned %d, want all 7", len(got.Annotations))
	}
}

func TestPagingRejectsBadParameters(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedBooks(t, c, 2)

	for _, path := range []string{"/books", "/movies", "/annotations", "/dialogues"} {
		for _, q := range []string{
			"?limit=0", "?limit=-1", "?limit=nope", "?limit=100000",
			"?offset=-1", "?offset=nope",
		} {
			t.Run(path+q, func(t *testing.T) {
				c.mustDo("GET", path+q, nil, http.StatusBadRequest)
			})
		}
	}
}

// Past the end is an empty list, not null — a client decoding into an array
// shouldn't have to special-case the last page.
func TestPagingOffsetPastEndIsEmptyArray(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedBooks(t, c, 3)

	rec := c.mustDo("GET", "/books?limit=10&offset=99", nil, http.StatusOK)
	if got := decode[pagedBooks](t, rec); len(got.Books) != 0 {
		t.Fatalf("offset past the end returned %d rows", len(got.Books))
	}
	if body := rec.Body.String(); !jsonHasEmptyArray(body, "books") {
		t.Fatalf("want an empty array, got %s", body)
	}
}

// jsonHasEmptyArray reports whether key maps to [] rather than null.
func jsonHasEmptyArray(body, key string) bool {
	return strings.Contains(body, `"`+key+`":[]`)
}

// Paging has to compose with the filters that already exist, not replace them.
func TestPagingComposesWithFilters(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")
	other := newTestBook(t, c, "Another Book")
	seedAnnotations(t, c, bookID, 6)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": other, "quote": "From the other book.",
	}, http.StatusCreated)

	page := decode[pagedAnnotations](t, c.mustDo("GET",
		fmt.Sprintf("/annotations?book_id=%d&limit=4", bookID), nil, http.StatusOK))
	if len(page.Annotations) != 4 {
		t.Fatalf("filtered page returned %d, want 4", len(page.Annotations))
	}
	for _, a := range page.Annotations {
		if a.BookID != bookID {
			t.Fatalf("filter dropped: annotation %d belongs to book %d", a.ID, a.BookID)
		}
	}

	rest := decode[pagedAnnotations](t, c.mustDo("GET",
		fmt.Sprintf("/annotations?book_id=%d&limit=4&offset=4", bookID), nil, http.StatusOK))
	if len(rest.Annotations) != 2 {
		t.Fatalf("second filtered page returned %d, want 2", len(rest.Annotations))
	}
}
