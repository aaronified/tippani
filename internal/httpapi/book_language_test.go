package httpapi

// A book's two languages (0047).
//
// The oddest gap this pass closes: a standalone quote has carried a language
// since 1.14, the board it sits on carries a whole LIST of them, and the book of
// a translated novel could not say which language it was read in. Two columns and
// not one plus a flag, because "read in English, written in Bengali" is the
// ordinary case in this library and neither value follows from the other.
//
// DETAIL ONLY. The list row deliberately does not carry them — the same call
// translator and editor made — so the assertion is that GET /books/:id has them
// and that GET /books is unchanged.

import (
	"net/http"
	"testing"
)

func TestABookCarriesItsTwoLanguages(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	created := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Gora", "author": "Rabindranath Tagore",
		"language": "English", "orig_language": "Bengali",
	}, http.StatusCreated))
	if created.Language != "English" || created.OrigLanguage != "Bengali" {
		t.Fatalf("create: language=%q orig_language=%q", created.Language, created.OrigLanguage)
	}

	// The single fetch, which is a different SELECT from the create response's
	// reload only in the sense that it is the same one — asserted anyway, because
	// the create path reloads through fetchBook and a future one might not.
	fetched := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(created.ID), nil, http.StatusOK))
	if fetched.Language != "English" || fetched.OrigLanguage != "Bengali" {
		t.Fatalf("fetch: language=%q orig_language=%q", fetched.Language, fetched.OrigLanguage)
	}

	// Full-state PUT: changed, then cleared.
	updated := decode[bookDetail](t, c.mustDo("PUT", "/books/"+itoa(created.ID), map[string]any{
		"title": "Gora", "author": "Rabindranath Tagore",
		"language": "Bengali", "orig_language": "Bengali",
	}, http.StatusOK))
	if updated.Language != "Bengali" {
		t.Fatalf("the PUT did not update the language: %q", updated.Language)
	}
	cleared := decode[bookDetail](t, c.mustDo("PUT", "/books/"+itoa(created.ID), map[string]any{
		"title": "Gora",
	}, http.StatusOK))
	if cleared.Language != "" || cleared.OrigLanguage != "" {
		t.Fatalf("a full-state PUT with no languages left %q/%q behind", cleared.Language, cleared.OrigLanguage)
	}
}

func TestALanguageTooLongToStoreIsRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	long := make([]byte, 101)
	for i := range long {
		long[i] = 'x'
	}
	c.mustDo("POST", "/books",
		map[string]any{"title": "A", "language": string(long)}, http.StatusBadRequest)
	c.mustDo("POST", "/books",
		map[string]any{"title": "B", "orig_language": string(long)}, http.StatusBadRequest)
}
