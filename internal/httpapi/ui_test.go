package httpapi

// Tests for the §10 backend surface: preferences, tags CRUD, stats,
// settings-managed metadata keys + status, and the admin cover re-fetch.

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"tippani/internal/metadata"
)

type meResp struct {
	Username    string `json:"username"`
	Preferences prefs  `json:"preferences"`
}

func TestPreferences(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Fresh user: defaults (theme system -> paper aesthetic, terracotta).
	me := decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences != (prefs{Aesthetic: "paper", Theme: "system", Accent: "terracotta", CreditSeparators: defaultCreditSeps, SRDaily: 8, SRReviewScope: "both", SRGrow: 2.5, SRShrink: 0.25, SRSeen: 1}) {
		t.Fatalf("default preferences: %+v", me.Preferences)
	}

	// A stored dark theme without an aesthetic defaults to film (§4); a stale
	// pre-0.4 "home" start-page key in the stored JSON is silently dropped.
	if _, err := srv.Store.DB.Exec(`UPDATE users SET preferences = '{"theme":"dark","home":"movies"}' WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences != (prefs{Aesthetic: "film", Theme: "dark", Accent: "terracotta", CreditSeparators: defaultCreditSeps, SRDaily: 8, SRReviewScope: "both", SRGrow: 2.5, SRShrink: 0.25, SRSeen: 1}) {
		t.Fatalf("dark default aesthetic: %+v", me.Preferences)
	}

	// Roundtrip.
	c.mustDo("PUT", "/auth/me/preferences",
		prefs{Aesthetic: "film", Theme: "light", Accent: "ochre"}, 200)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences != (prefs{Aesthetic: "film", Theme: "light", Accent: "ochre", CreditSeparators: defaultCreditSeps, SRDaily: 8, SRReviewScope: "both", SRGrow: 2.5, SRShrink: 0.25, SRSeen: 1}) {
		t.Fatalf("after PUT: %+v", me.Preferences)
	}

	// An older client still sending retired keys (pre-0.4 "home", pre-0.7
	// "navUtilities") gets them ignored.
	c.mustDo("PUT", "/auth/me/preferences",
		map[string]string{"aesthetic": "paper", "theme": "light", "accent": "olive", "home": "movies", "navUtilities": "menu"}, 200)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences != (prefs{Aesthetic: "paper", Theme: "light", Accent: "olive", CreditSeparators: defaultCreditSeps, SRDaily: 8, SRReviewScope: "both", SRGrow: 2.5, SRShrink: 0.25, SRSeen: 1}) {
		t.Fatalf("after PUT with stale retired keys: %+v", me.Preferences)
	}

	// Validation: all three fields are required enums.
	c.mustDo("PUT", "/auth/me/preferences", prefs{Aesthetic: "vellum", Theme: "light", Accent: "ochre"}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", prefs{Aesthetic: "paper", Theme: "auto", Accent: "ochre"}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", prefs{Aesthetic: "paper", Theme: "light", Accent: "mauve"}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", prefs{Aesthetic: "paper", Theme: "light"}, http.StatusBadRequest)

	// A failed PUT never clobbers the stored set.
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.Accent != "olive" {
		t.Fatalf("preferences changed by rejected PUT: %+v", me.Preferences)
	}

	// Spaced-repetition settings (v0.5.0): partial-merge, each in a clamped/
	// enumerated range; an out-of-range value is rejected and leaves the set
	// untouched. srPracticeCounts is a bool that toggles on its own.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srDaily": 5, "srReviewScope": "movies", "srGrow": 3.0, "srPracticeCounts": true}, 200)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.SRDaily != 5 || me.Preferences.SRReviewScope != "movies" || me.Preferences.SRGrow != 3.0 ||
		!me.Preferences.SRPracticeCounts || me.Preferences.Accent != "olive" {
		t.Fatalf("SR settings: %+v", me.Preferences)
	}
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srDaily": 99}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srDaily": 1}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srGrow": 9.0}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srShrink": 0.9}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": "bogus"}, http.StatusBadRequest)

	// creditSeparators: partial-merge, canonicalized on write ("and,comma" →
	// "comma,and"), "none" turns splitting off, unknown tokens are rejected and
	// leave the stored set untouched.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"creditSeparators": "and,comma"}, 200)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.CreditSeparators != "comma,and" || me.Preferences.Accent != "olive" {
		t.Fatalf("creditSeparators canonical: %+v", me.Preferences)
	}
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"creditSeparators": "none"}, 200)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.CreditSeparators != "none" {
		t.Fatalf("creditSeparators none: %+v", me.Preferences)
	}
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"creditSeparators": "pipe"}, http.StatusBadRequest)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.CreditSeparators != "none" {
		t.Fatalf("creditSeparators after rejected PUT: %+v", me.Preferences)
	}

	// Guided-tour state (0.8.5 onboarding): partial-merge like the rest.
	// "postponed" carries the resume step; step 0 is a valid resume point
	// (presence-based, unlike the zero-guarded ints); bad values are rejected
	// and leave the stored set untouched.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"tour": "postponed", "tourStep": 3}, 200)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.Tour != "postponed" || me.Preferences.TourStep != 3 || me.Preferences.CreditSeparators != "none" {
		t.Fatalf("tour postponed: %+v", me.Preferences)
	}
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"tourStep": 0}, 200)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.Tour != "postponed" || me.Preferences.TourStep != 0 {
		t.Fatalf("tourStep 0: %+v", me.Preferences)
	}
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"tour": "done"}, 200)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.Tour != "done" {
		t.Fatalf("tour done: %+v", me.Preferences)
	}
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"tour": "paused"}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"tourStep": -1}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"tourStep": 100}, http.StatusBadRequest)
	me = decode[meResp](t, c.mustDo("GET", "/auth/me", nil, 200))
	if me.Preferences.Tour != "done" || me.Preferences.TourStep != 0 {
		t.Fatalf("tour after rejected PUTs: %+v", me.Preferences)
	}
}

func TestTagCRUD(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.", "tags": []string{"reading"},
	}, http.StatusCreated))

	// setTags created "reading" with the defaults; usage counted.
	list := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if len(list.Tags) != 1 || list.Tags[0].Name != "reading" ||
		list.Tags[0].Color != "yellow" || list.Tags[0].Style != "sticker" ||
		list.Tags[0].Annotations != 1 || list.Tags[0].Dialogues != 0 {
		t.Fatalf("list: %+v", list.Tags)
	}

	// Create with explicit colour/style; name is trimmed.
	poetry := decode[tagRow](t, c.mustDo("POST", "/tags",
		map[string]string{"name": "  poetry ", "color": "pink", "style": "banner"}, http.StatusCreated))
	if poetry.Name != "poetry" || poetry.Color != "pink" || poetry.Style != "banner" ||
		poetry.Annotations != 0 || poetry.Dialogues != 0 || poetry.ID == 0 {
		t.Fatalf("created tag: %+v", poetry)
	}
	// Defaults when omitted.
	plain := decode[tagRow](t, c.mustDo("POST", "/tags", map[string]string{"name": "plain"}, http.StatusCreated))
	if plain.Color != "yellow" || plain.Style != "sticker" {
		t.Fatalf("default tag: %+v", plain)
	}

	// Duplicates are case-insensitive; validation is strict enums.
	c.mustDo("POST", "/tags", map[string]string{"name": "Poetry"}, http.StatusConflict)
	c.mustDo("POST", "/tags", map[string]string{"name": "READING"}, http.StatusConflict)
	c.mustDo("POST", "/tags", map[string]string{"name": "  "}, http.StatusBadRequest)
	c.mustDo("POST", "/tags", map[string]string{"name": "x", "color": "green"}, http.StatusBadRequest)
	c.mustDo("POST", "/tags", map[string]string{"name": "x", "style": "hologram"}, http.StatusBadRequest)

	// Over-long names are capped at 64 runes (shared cleanNames rule).
	long := decode[tagRow](t, c.mustDo("POST", "/tags",
		map[string]string{"name": strings.Repeat("é", 70)}, http.StatusCreated))
	if n := len([]rune(long.Name)); n != 64 {
		t.Fatalf("long name kept %d runes", n)
	}

	// Update is full state; renames collide case-insensitively.
	verse := decode[tagRow](t, c.mustDo("PUT", "/tags/"+itoa(poetry.ID),
		map[string]string{"name": "verse", "color": "blue", "style": "tape"}, 200))
	if verse.Name != "verse" || verse.Color != "blue" || verse.Style != "tape" {
		t.Fatalf("updated tag: %+v", verse)
	}
	c.mustDo("PUT", "/tags/"+itoa(poetry.ID),
		map[string]string{"name": "Reading", "color": "blue", "style": "tape"}, http.StatusConflict)
	c.mustDo("PUT", "/tags/99999",
		map[string]string{"name": "ghost", "color": "blue", "style": "tape"}, http.StatusNotFound)
	c.mustDo("PUT", "/tags/"+itoa(poetry.ID),
		map[string]string{"name": "verse", "color": "beige", "style": "tape"}, http.StatusBadRequest)

	// setTags attaches the existing managed tag by NAME and keeps its
	// colour/style; the tag= list filter still takes the name.
	c.mustDo("PUT", "/annotations/"+itoa(ann.ID), map[string]any{
		"quote": "Fear is the mind-killer.", "color": "yellow", "tags": []string{"verse"},
	}, 200)
	list = decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	for _, tag := range list.Tags {
		switch tag.Name {
		case "verse":
			if tag.Color != "blue" || tag.Style != "tape" || tag.Annotations != 1 {
				t.Fatalf("verse after attach: %+v", tag)
			}
		case "reading": // detached but persists at zero usage (no auto-GC)
			if tag.Annotations != 0 {
				t.Fatalf("reading after detach: %+v", tag)
			}
		}
	}
	byTag := decode[annList](t, c.mustDo("GET", "/annotations?tag=verse", nil, 200))
	if len(byTag.Annotations) != 1 || byTag.Annotations[0].ID != ann.ID {
		t.Fatalf("tag filter: %+v", byTag.Annotations)
	}

	// Delete: join rows cascade, the annotation itself keeps working.
	c.mustDo("DELETE", "/tags/"+itoa(poetry.ID), nil, 200)
	c.mustDo("DELETE", "/tags/"+itoa(poetry.ID), nil, http.StatusNotFound)
	if l := decode[annList](t, c.mustDo("GET", "/annotations?tag=verse", nil, 200)); len(l.Annotations) != 0 {
		t.Fatalf("filter after tag delete: %+v", l.Annotations)
	}
	all := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	if len(all.Annotations) != 1 || len(all.Annotations[0].Tags) != 0 {
		t.Fatalf("annotation after tag delete: %+v", all.Annotations)
	}

	// Ownership: another user's tags answer 404, and lists never leak.
	bob := addUser(t, h, c, "bob")
	bob.mustDo("PUT", "/tags/"+itoa(plain.ID),
		map[string]string{"name": "hijack", "color": "blue", "style": "tape"}, http.StatusNotFound)
	bob.mustDo("DELETE", "/tags/"+itoa(plain.ID), nil, http.StatusNotFound)
	if l := decode[tagsResp](t, bob.mustDo("GET", "/tags", nil, 200)); len(l.Tags) != 0 {
		t.Fatalf("bob tags: %+v", l.Tags)
	}
}

type nameCountResp struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type statsResp struct {
	Books         int       `json:"books"`
	Annotations   int       `json:"annotations"`
	Movies        int       `json:"movies"`
	Dialogues     int       `json:"dialogues"`
	Tags          int       `json:"tags"`
	Favorites     int       `json:"favorites"`
	Genres        int       `json:"genres"`
	MostAnnotated *statsTop `json:"most_annotated"`
	MostQuoted    *statsTop `json:"most_quoted"`
	BusiestMonth  *struct {
		Month string `json:"month"`
		Count int    `json:"count"`
	} `json:"busiest_month"`
	Colors        map[string]int  `json:"colors"`
	TopTags       []nameCountResp `json:"top_tags"`
	FirstSaved    *string         `json:"first_saved"`
	DailyActivity []struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	} `json:"daily_activity"`
	Recall struct {
		States      statusCounts `json:"states"`
		Reviewed    int          `json:"reviewed"`
		AvgHalfLife float64     `json:"avg_half_life"`
	} `json:"recall"`
	Breakdown map[string]statsKind `json:"breakdown"`
}

func TestStats(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Empty library: zero counts, null superlatives.
	empty := decode[statsResp](t, c.mustDo("GET", "/stats", nil, 200))
	if empty.Books != 0 || empty.Favorites != 0 || empty.MostAnnotated != nil ||
		empty.MostQuoted != nil || empty.BusiestMonth != nil {
		t.Fatalf("empty stats: %+v", empty)
	}

	// Seed: 3 authored books (2 + 1 + 1 annotations, one book co-authored so the
	// breakdown must split the credit), 1 movie with 2 dialogues, 1 favorite
	// annotation + 1 favorite dialogue, 2 distinct tags, a blue highlight.
	b1 := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Dune", "author": "Herbert"}, http.StatusCreated))
	b2 := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Emma", "author": "Austen"}, http.StatusCreated))
	b3 := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Good Omens", "author": "Gaiman & Pratchett"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": b1.ID, "quote": "q1", "tags": []string{"alpha", "beta"}, "favorite": true, "color": "blue"}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b1.ID, "quote": "q2"}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b2.ID, "quote": "q3"}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b3.ID, "quote": "q4"}, http.StatusCreated)
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca", "director": "Curtiz"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "d1", "actor": "Bogart", "tags": []string{"alpha"}, "favorite": true}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m.ID, "quote": "d2", "actor": "Bergman"}, http.StatusCreated)

	got := decode[statsResp](t, c.mustDo("GET", "/stats", nil, 200))
	if got.Books != 3 || got.Annotations != 4 || got.Movies != 1 || got.Dialogues != 2 ||
		got.Tags != 2 || got.Favorites != 2 {
		t.Fatalf("counts: %+v", got)
	}
	if got.Genres != 0 {
		t.Fatalf("genres: %+v", got)
	}
	// Breakdown people: the joined "Gaiman & Pratchett" credit lists as two
	// authors (multi-author separation), so 4 authors; Herbert leads on quotes.
	authors := got.Breakdown["authors"]
	if authors.Count != 4 || len(authors.Top) != 4 {
		t.Fatalf("breakdown authors: %+v", authors)
	}
	if authors.Top[0].Name != "Herbert" || authors.Top[0].Quotes != 2 || authors.Top[0].Works != 1 {
		t.Fatalf("breakdown top author: %+v", authors.Top)
	}
	names := map[string]bool{}
	for _, r := range authors.Top {
		names[r.Name] = true
	}
	if !names["Gaiman"] || !names["Pratchett"] || names["Gaiman & Pratchett"] {
		t.Fatalf("joined credit not split: %+v", authors.Top)
	}
	// Every quote was saved seconds ago — the new-item grace week reads them
	// all as remembered.
	if authors.Top[0].Remembered != 2 || authors.Top[0].Unseen != 0 {
		t.Fatalf("grace-week statuses: %+v", authors.Top[0])
	}
	actors := got.Breakdown["actors"]
	if actors.Count != 2 || actors.Top[0].Name != "Bergman" || actors.Top[1].Name != "Bogart" {
		t.Fatalf("breakdown actors: %+v", actors)
	}
	directors := got.Breakdown["directors"]
	if directors.Count != 1 || directors.Top[0].Name != "Curtiz" || directors.Top[0].Works != 1 || directors.Top[0].Quotes != 2 {
		t.Fatalf("breakdown directors: %+v", directors)
	}
	if got.Breakdown["books"].Count != 3 || got.Breakdown["books"].Top[0].Name != "Dune" ||
		got.Breakdown["films"].Count != 1 || got.Breakdown["shows"].Count != 0 || got.Breakdown["series"].Count != 0 {
		t.Fatalf("breakdown works: books=%+v films=%+v", got.Breakdown["books"], got.Breakdown["films"])
	}
	// Recall overview: 6 quotes, all inside the grace week, none reviewed yet.
	if got.Recall.States.Total != 6 || got.Recall.States.Remembered != 6 || got.Recall.Reviewed != 0 {
		t.Fatalf("recall: %+v", got.Recall)
	}
	// Highlight colours: q1 blue, q2–q4 default yellow.
	if got.Colors["yellow"] != 3 || got.Colors["blue"] != 1 || got.Colors["pink"] != 0 || got.Colors["orange"] != 0 {
		t.Fatalf("colors: %+v", got.Colors)
	}
	// Top tags: alpha on q1 + d1 = 2, beta on q1 = 1.
	if len(got.TopTags) != 2 || got.TopTags[0].Name != "alpha" || got.TopTags[0].Count != 2 ||
		got.TopTags[1].Name != "beta" || got.TopTags[1].Count != 1 {
		t.Fatalf("top_tags: %+v", got.TopTags)
	}
	if got.FirstSaved == nil || *got.FirstSaved == "" {
		t.Fatalf("first_saved: %v", got.FirstSaved)
	}
	// Daily activity: everything saved today, one bucket of 6.
	if len(got.DailyActivity) != 1 || got.DailyActivity[0].Count != 6 {
		t.Fatalf("daily_activity: %+v", got.DailyActivity)
	}
	if got.MostAnnotated == nil || got.MostAnnotated.ID != b1.ID ||
		got.MostAnnotated.Title != "Dune" || got.MostAnnotated.Count != 2 {
		t.Fatalf("most_annotated: %+v", got.MostAnnotated)
	}
	if got.MostQuoted == nil || got.MostQuoted.ID != m.ID || got.MostQuoted.Count != 2 {
		t.Fatalf("most_quoted: %+v", got.MostQuoted)
	}
	var month string
	if err := srv.Store.DB.QueryRow(`SELECT strftime('%Y-%m', 'now')`).Scan(&month); err != nil {
		t.Fatal(err)
	}
	if got.BusiestMonth == nil || got.BusiestMonth.Month != month || got.BusiestMonth.Count != 6 {
		t.Fatalf("busiest_month: %+v (want %s/6)", got.BusiestMonth, month)
	}

	// Stats are user-scoped.
	bob := addUser(t, h, c, "bob")
	if bs := decode[statsResp](t, bob.mustDo("GET", "/stats", nil, 200)); bs.Books != 0 || bs.Annotations != 0 || bs.MostAnnotated != nil {
		t.Fatalf("bob stats: %+v", bs)
	}
}

type keysResp struct {
	TMDBKeySet        bool   `json:"tmdb_key_set"`
	GoogleBooksKeySet bool   `json:"google_books_key_set"`
	TMDBSource        string `json:"tmdb_source"`
}

type statusResp struct {
	TMDB struct {
		Source string `json:"source"`
	} `json:"tmdb"`
	GoogleBooks struct {
		KeySet bool `json:"key_set"`
	} `json:"google_books"`
	BooksLookup struct {
		OK        *bool  `json:"ok"`
		Error     string `json:"error"`
		CheckedAt string `json:"checked_at"`
	} `json:"books_lookup"`
}

// Metadata key management is admin-only, never echoes stored keys, and the
// TMDB source enum follows the env > custom > builtin > none resolution —
// including for live lookups (the settings key takes effect per request).
func TestMetadataKeysAndResolution(t *testing.T) {
	srv := newTestServer(t)
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search/movie" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(`{"results":[{"id":603,"title":"The Matrix","release_date":"1999-03-31"}]}`))
	}))
	defer fake.Close()
	srv.TMDB.BaseURL = fake.URL // seam only; no key anywhere yet
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	// Admin only.
	bob.mustDo("GET", "/admin/metadata-keys", nil, http.StatusForbidden)
	bob.mustDo("PUT", "/admin/metadata-keys", map[string]string{"tmdb_key": "x"}, http.StatusForbidden)

	// Nothing configured: source none, lookup 503.
	if k := decode[keysResp](t, admin.mustDo("GET", "/admin/metadata-keys", nil, 200)); k.TMDBKeySet || k.GoogleBooksKeySet || k.TMDBSource != "none" {
		t.Fatalf("keys before: %+v", k)
	}
	admin.mustDo("POST", "/movies/lookup", map[string]any{"title": "Matrix"}, http.StatusServiceUnavailable)

	// Save custom keys; booleans flip, the secret itself is never echoed.
	admin.mustDo("PUT", "/admin/metadata-keys",
		map[string]string{"tmdb_key": "sekret-tmdb", "google_books_key": "sekret-google"}, 200)
	rec := admin.mustDo("GET", "/admin/metadata-keys", nil, 200)
	if strings.Contains(rec.Body.String(), "sekret") {
		t.Fatalf("stored key echoed: %s", rec.Body)
	}
	if k := decode[keysResp](t, rec); !k.TMDBKeySet || !k.GoogleBooksKeySet || k.TMDBSource != "custom" {
		t.Fatalf("keys after PUT: %+v", k)
	}
	if st := decode[statusResp](t, admin.mustDo("GET", "/metadata/status", nil, 200)); st.TMDB.Source != "custom" || !st.GoogleBooks.KeySet {
		t.Fatalf("status after PUT: %+v", st)
	}
	// The custom key is picked up per request — the lookup now works.
	admin.mustDo("POST", "/movies/lookup", map[string]any{"title": "Matrix"}, 200)

	// A direct/programmatic key outranks custom; built-in is the last fallback; "" clears.
	srv.TMDB.Key = "direct-key"
	if k := decode[keysResp](t, admin.mustDo("GET", "/admin/metadata-keys", nil, 200)); k.TMDBSource != "direct" {
		t.Fatalf("direct key should win: %+v", k)
	}
	srv.TMDB.Key = ""
	admin.mustDo("PUT", "/admin/metadata-keys", map[string]string{"tmdb_key": "", "google_books_key": ""}, 200)
	srv.TMDBBuiltin = "builtin-key"
	if k := decode[keysResp](t, admin.mustDo("GET", "/admin/metadata-keys", nil, 200)); k.TMDBKeySet || k.GoogleBooksKeySet || k.TMDBSource != "builtin" {
		t.Fatalf("builtin fallback: %+v", k)
	}
	srv.TMDBBuiltin = ""
	if st := decode[statusResp](t, admin.mustDo("GET", "/metadata/status", nil, 200)); st.TMDB.Source != "none" {
		t.Fatalf("cleared: %+v", st)
	}
}

// GET /metadata/status transitions: never tried (ok null) -> failing ->
// ok, driven through POST /books/lookup with the searchBooks seam. Also
// pins the google key plumbing from the settings table into SearchBooks.
func TestMetadataStatusLookupTransitions(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	st := decode[statusResp](t, c.mustDo("GET", "/metadata/status", nil, 200))
	if st.BooksLookup.OK != nil || st.BooksLookup.Error != "" || st.BooksLookup.CheckedAt != "" {
		t.Fatalf("never-tried status: %+v", st.BooksLookup)
	}

	c.mustDo("PUT", "/admin/metadata-keys", map[string]string{"google_books_key": "gkey"}, 200)
	gotKey := ""
	srv.searchBooks = func(_ context.Context, _, _, _, googleKey string) ([]metadata.BookCandidate, error) {
		gotKey = googleKey
		return nil, errors.New("google books: status 500\nopen library: boom")
	}
	c.mustDo("POST", "/books/lookup", map[string]string{"title": "dune"}, http.StatusBadGateway)
	if gotKey != "gkey" {
		t.Fatalf("google key not plumbed: %q", gotKey)
	}
	st = decode[statusResp](t, c.mustDo("GET", "/metadata/status", nil, 200))
	if st.BooksLookup.OK == nil || *st.BooksLookup.OK ||
		!strings.Contains(st.BooksLookup.Error, "google books") ||
		strings.Contains(st.BooksLookup.Error, "\n") {
		t.Fatalf("failing status: %+v", st.BooksLookup)
	}
	if _, err := time.Parse(time.RFC3339, st.BooksLookup.CheckedAt); err != nil {
		t.Fatalf("checked_at %q: %v", st.BooksLookup.CheckedAt, err)
	}

	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{{Source: "google", Title: "Dune"}}, nil
	}
	c.mustDo("POST", "/books/lookup", map[string]string{"title": "dune"}, 200)
	st = decode[statusResp](t, c.mustDo("GET", "/metadata/status", nil, 200))
	if st.BooksLookup.OK == nil || !*st.BooksLookup.OK || st.BooksLookup.Error != "" {
		t.Fatalf("ok status: %+v", st.BooksLookup)
	}
}

// refetchResp is the chunked POST /covers/refetch response shape.
type refetchResp struct {
	Fetched    int    `json:"fetched"`
	Failed     int    `json:"failed"`
	Enriched   int    `json:"enriched"`
	Skipped    int    `json:"skipped"`
	Total      int    `json:"total"`
	Remaining  int    `json:"remaining"`
	NextCursor string `json:"next_cursor"`
	Done       bool   `json:"done"`
}

// driveRefetch walks the refetch cursor protocol to completion the way the UI
// does — POST, follow next_cursor until done — and returns summed counters
// (Total/Remaining are the last chunk's values).
func driveRefetch(t *testing.T, c *testClient) refetchResp {
	t.Helper()
	var sum refetchResp
	body := map[string]any{}
	for i := 0; ; i++ {
		if i > 50 {
			t.Fatal("refetch did not finish within 50 chunks")
		}
		res := decode[refetchResp](t, c.mustDo("POST", "/covers/refetch", body, 200))
		sum.Fetched += res.Fetched
		sum.Failed += res.Failed
		sum.Enriched += res.Enriched
		sum.Skipped += res.Skipped
		sum.Total, sum.Remaining, sum.Done = res.Total, res.Remaining, res.Done
		if res.Done {
			if res.NextCursor != "" {
				t.Fatalf("done with non-empty next_cursor %q", res.NextCursor)
			}
			return sum
		}
		if res.NextCursor == "" {
			t.Fatal("not done but next_cursor is empty")
		}
		body = map[string]any{"cursor": res.NextCursor}
	}
}

// POST /covers/refetch is admin-only and runs over ALL users' rows: books
// re-fetch from the cover_url cached in source_metadata, movies rebuild the
// TMDB poster URL from the cached payload; rows without a usable URL are
// skipped and per-row failures don't abort the pass.
func TestCoversRefetch(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	bob.mustDo("POST", "/covers/refetch", nil, http.StatusForbidden)

	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(q, args...); err != nil {
			t.Fatal(err)
		}
	}
	// Admin's book: missing cover with a cached URL -> fetched.
	exec(`INSERT INTO books (user_id, title, source_metadata) VALUES (1, 'A', '{"cover_url":"https://books.google.com/a.jpg"}')`)
	// Bob's book: the fetch fails -> failed (and proves the all-users scope).
	exec(`INSERT INTO books (user_id, title, source_metadata) VALUES (?, 'B', '{"cover_url":"https://books.google.com/b.jpg"}')`, bobID)
	// Skipped rows: cover already present / no URL in metadata / no metadata.
	exec(`INSERT INTO books (user_id, title, cover_path, source_metadata) VALUES (1, 'C', '00000000000000ff.jpg', '{"cover_url":"https://books.google.com/c.jpg"}')`)
	exec(`INSERT INTO books (user_id, title, source_metadata) VALUES (1, 'D', '{"title":"D"}')`)
	exec(`INSERT INTO books (user_id, title) VALUES (1, 'E')`)
	// Movie: poster URL rebuilt from the raw TMDB payload -> fetched.
	exec(`INSERT INTO movies (user_id, title, source_metadata) VALUES (1, 'M', '{"id":603,"poster_path":"/p.jpg"}')`)
	// Movie without a poster_path in the payload -> skipped.
	exec(`INSERT INTO movies (user_id, title, source_metadata) VALUES (1, 'N', '{"id":604,"poster_path":""}')`)

	// No isbn/asin on these rows, so the metadata lookup yields nothing — stub it
	// to keep the test off the network. Covers still come from the cached URL.
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, nil
	}
	var urls []string
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		urls = append(urls, rawURL)
		if strings.Contains(rawURL, "/b.jpg") {
			return "", errors.New("boom")
		}
		return fmt.Sprintf("%016x", len(urls)) + ".jpg", nil
	}

	res := driveRefetch(t, admin)
	if res.Fetched != 2 || res.Failed != 1 {
		t.Fatalf("counts: %+v (urls %v)", res, urls)
	}
	// 5 books + 2 poster-less sourced movies were the workload; done leaves 0.
	if res.Total != 7 || res.Remaining != 0 {
		t.Fatalf("progress: %+v", res)
	}
	// The movie poster is rebuilt at storage size; cached Google covers are
	// upgraded to the hi-res fife render before fetching.
	for _, want := range []string{
		"https://image.tmdb.org/t/p/original/p.jpg",
		"https://books.google.com/a.jpg?fife=w1280-h1920",
	} {
		found := false
		for _, u := range urls {
			if u == want {
				found = true
			}
		}
		if !found {
			t.Fatalf("fetched urls missing %q: %v", want, urls)
		}
	}
	if len(urls) != 3 {
		t.Fatalf("fetched urls: %v", urls)
	}
	// The successful rows were updated; the failed one stays NULL for retry.
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM books WHERE cover_path IS NOT NULL`).Scan(&n); err != nil || n != 2 {
		t.Fatalf("books with covers: %d, %v", n, err)
	}
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM movies WHERE poster_path IS NOT NULL`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("movies with posters: %d, %v", n, err)
	}

	// Second pass: only bob's still-missing cover is attempted, fails again.
	res = driveRefetch(t, admin)
	if res.Fetched != 0 || res.Failed != 1 {
		t.Fatalf("second pass: %+v", res)
	}
}

// Chunking protocol: limit=1 walks one row per call, the cursor hands over
// from books to movies, remaining counts down to zero, and a malformed cursor
// is a 400.
func TestCoversRefetchChunking(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, nil
	}
	n := 0
	srv.fetchImage = func(context.Context, string, string) (string, error) {
		n++
		return fmt.Sprintf("%016x", n) + ".jpg", nil
	}
	h := srv.Handler()
	admin := signupAdmin(t, h)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(q, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO books (user_id, title, source_metadata) VALUES (1, 'A', '{"cover_url":"https://covers.openlibrary.org/b/id/1-L.jpg"}')`)
	exec(`INSERT INTO books (user_id, title) VALUES (1, 'B')`) // nothing to do, still cursor-walked
	exec(`INSERT INTO movies (user_id, title, source_metadata) VALUES (1, 'M', '{"id":603,"poster_path":"/p.jpg"}')`)

	res := decode[refetchResp](t, admin.mustDo("POST", "/covers/refetch", map[string]any{"limit": 1}, 200))
	if res.Fetched != 1 || res.Done || res.NextCursor != "books:1" || res.Total != 3 || res.Remaining != 2 {
		t.Fatalf("first chunk: %+v", res)
	}
	calls := 1
	for !res.Done {
		if calls++; calls > 10 {
			t.Fatal("cursor never finished")
		}
		res = decode[refetchResp](t, admin.mustDo("POST", "/covers/refetch",
			map[string]any{"cursor": res.NextCursor, "limit": 1}, 200))
	}
	if res.Remaining != 0 {
		t.Fatalf("done with remaining=%d", res.Remaining)
	}
	var covers, posters int
	srv.Store.DB.QueryRow(`SELECT count(*) FROM books WHERE cover_path IS NOT NULL`).Scan(&covers)
	srv.Store.DB.QueryRow(`SELECT count(*) FROM movies WHERE poster_path IS NOT NULL`).Scan(&posters)
	if covers != 1 || posters != 1 {
		t.Fatalf("stored: %d covers, %d posters", covers, posters)
	}

	admin.mustDo("POST", "/covers/refetch", map[string]any{"cursor": "bogus"}, http.StatusBadRequest)
	admin.mustDo("POST", "/covers/refetch", map[string]any{"cursor": "books:x"}, http.StatusBadRequest)
}

// The default fetcher path: an off-allowlist URL fails the SSRF guard fast
// (no network) and is reported as failed, not a 500.
func TestCoversRefetchGuardFailure(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, nil // keep the metadata lookup off the network
	}
	h := srv.Handler()
	admin := signupAdmin(t, h)
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO books (user_id, title, source_metadata) VALUES (1, 'A', '{"cover_url":"https://not-allowlisted.example/x.jpg"}')`); err != nil {
		t.Fatal(err)
	}
	res := driveRefetch(t, admin)
	if res.Fetched != 0 || res.Failed != 1 {
		t.Fatalf("counts: %+v", res)
	}
}

// Low-res replacement: a stored cover narrower than the threshold is
// re-fetched; the new image sticks only when it is actually wider, and the
// old file is cleaned up on replace.
func TestCoversRefetchReplacesLowRes(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, nil
	}
	dir := srv.coversDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	writePNG := func(name string, w int) {
		t.Helper()
		var buf bytes.Buffer
		if err := png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, w, 10))); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, name), buf.Bytes(), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	const oldName = "00000000000000aa.png"
	writePNG(oldName, 100) // low-res: below the 500px threshold

	h := srv.Handler()
	admin := signupAdmin(t, h)
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO books (user_id, title, cover_path, source_metadata)
		 VALUES (1, 'A', ?, '{"cover_url":"https://covers.openlibrary.org/b/id/9-L.jpg"}')`, oldName); err != nil {
		t.Fatal(err)
	}

	// First pass: the "fetched" image is 800px wide — replaces the 100px one.
	n := 0
	srv.fetchImage = func(_ context.Context, _, _ string) (string, error) {
		n++
		name := fmt.Sprintf("%016x", n) + ".png"
		writePNG(name, 800)
		return name, nil
	}
	res := driveRefetch(t, admin)
	if res.Fetched != 1 || res.Failed != 0 {
		t.Fatalf("first pass: %+v", res)
	}
	var cover string
	if err := srv.Store.DB.QueryRow(`SELECT cover_path FROM books WHERE title = 'A'`).Scan(&cover); err != nil {
		t.Fatal(err)
	}
	if cover == oldName {
		t.Fatalf("low-res cover was not replaced")
	}
	if _, err := os.Stat(filepath.Join(dir, oldName)); !os.IsNotExist(err) {
		t.Fatalf("old low-res file not cleaned up: %v", err)
	}

	// 800px is above the threshold now — a second pass must not touch it.
	res = driveRefetch(t, admin)
	if res.Fetched != 0 || res.Failed != 0 {
		t.Fatalf("second pass touched a good cover: %+v", res)
	}

	// Force it low-res again (300px) and make the stub fetch a WORSE image
	// (200px): the fetch happens but the downgrade is discarded.
	writePNG(cover, 300)
	prev := cover
	srv.fetchImage = func(_ context.Context, _, _ string) (string, error) {
		n++
		name := fmt.Sprintf("%016x", n) + ".png"
		writePNG(name, 200)
		return name, nil
	}
	res = driveRefetch(t, admin)
	if res.Fetched != 0 || res.Failed != 0 {
		t.Fatalf("downgrade pass: %+v", res)
	}
	// The worse image was discarded and the low-res original kept — that's a
	// skip, and it must be reported (not silently dropped) so the UI can say
	// "left as-is, no higher-res source".
	if res.Skipped != 1 {
		t.Fatalf("downgrade should report 1 skipped, got %+v", res)
	}
	if err := srv.Store.DB.QueryRow(`SELECT cover_path FROM books WHERE title = 'A'`).Scan(&cover); err != nil || cover != prev {
		t.Fatalf("cover changed to a worse image: %q (err %v)", cover, err)
	}
}
