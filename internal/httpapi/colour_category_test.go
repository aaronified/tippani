package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// Colour categories: what slot N is called, what it looks like, and whether it
// is offered at all. The stored TOKEN never moves — that is the whole design,
// and the test at the bottom of this file is the one that matters most, because
// an export that quietly stopped round-tripping would be discovered by somebody
// re-importing a year of highlights.

type catPrefs struct {
	Preferences prefs `json:"preferences"`
}

func getPrefs(t *testing.T, c *testClient) prefs {
	t.Helper()
	return decode[catPrefs](t, c.mustDo("GET", "/auth/me", nil, 200)).Preferences
}

func TestCategoryNamesAndColoursRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"catName2": "Fact", "catName3": "Disagreed", "catName4": "Inspirational",
		"catColor2": "#5AA8B5", "catHidden4": true,
	}, 200)

	p := getPrefs(t, c)
	if p.CatName2 != "Fact" || p.CatName3 != "Disagreed" || p.CatName4 != "Inspirational" {
		t.Fatalf("names did not survive: %+v", p)
	}
	if p.CatColor2 != "#5AA8B5" {
		t.Fatalf("colour did not survive: %q", p.CatColor2)
	}
	if !p.CatHidden4 {
		t.Fatal("hidden did not survive")
	}
	// Untouched slots stay at the built-in, which is "" — an account that has
	// never opened the card stores nothing at all.
	if p.CatColor3 != "" || p.CatHidden2 || p.CatHidden3 {
		t.Fatalf("an untouched slot picked up a value: %+v", p)
	}
}

// The first slot is the DEFAULT, not a category. The column default is 'yellow'
// and an import with no colour writes 'yellow' too, so a yellow quote may be
// yellow because someone chose it or because nobody chose anything. Naming it
// would silently relabel every unmarked quote ever imported; hiding it would
// hide the bucket most quotes are in.
func TestTheDefaultColourCannotBeNamedOrHidden(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"catName1": "Inspirational"}, http.StatusBadRequest)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"catHidden1": true}, http.StatusBadRequest)

	// Its COLOUR is presentation and stays editable — what a slot is CALLED is a
	// claim about the quotes in it; what it looks like is not.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"catColor1": "#B0806B"}, 200)
	if got := getPrefs(t, c).CatColor1; got != "#B0806B" {
		t.Fatalf("the default slot refused a recolour: %q", got)
	}
}

// A stored row that no longer passes must not reach the UI. The write path
// refuses these, so the only way in is a restored archive, a hand-edited
// database, or a preference written by a version that allowed something this one
// does not — all of which are real, and none of which should be able to name the
// default bucket.
func TestBadStoredCategoriesAreNormalisedOnRead(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	if _, err := srv.Store.DB.Exec(`UPDATE users SET preferences = ?`,
		`{"catName1":"Inspirational","catHidden1":true,"catColor2":"not a colour","catName3":"`+
			strings.Repeat("x", 200)+`"}`); err != nil {
		t.Fatal(err)
	}
	p := getPrefs(t, c)
	if p.CatName1 != "" || p.CatHidden1 {
		t.Fatalf("the default slot kept a name or a hide: %+v", p)
	}
	if p.CatColor2 != "" {
		t.Fatalf("a bad colour survived the read: %q", p.CatColor2)
	}
	if p.CatName3 != "" {
		t.Fatalf("an over-long name survived the read: %q", p.CatName3)
	}
}

func TestCategoryColourRules(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	for _, bad := range []string{"red", "#GGGGGG", "#12345", "#1234567", "rgb(1,2,3)"} {
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"catColor2": bad}, http.StatusBadRequest)
	}
	// A category colour may not BE a theme accent. The rule exists so a category
	// can never be mistaken for the app's own accent, and an exact match is the
	// case worth refusing outright.
	for _, accent := range []string{"#B4482D", "#c8992b", "#3F7D5A", "#2f6d8f"} {
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"catColor3": accent}, http.StatusBadRequest)
	}
	// Empty means "back to the built-in", and must be accepted — it is how a
	// reader undoes a recolour.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"catColor2": "#5AA8B5"}, 200)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"catColor2": ""}, 200)
	if got := getPrefs(t, c).CatColor2; got != "" {
		t.Fatalf("a colour could not be cleared: %q", got)
	}
}

func TestCategoryNameLength(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	ok := strings.Repeat("a", catNameMax)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"catName2": ok}, 200)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"catName2": ok + "a"}, http.StatusBadRequest)
	// Refused, not truncated: the stored value is still the one that fitted.
	if got := getPrefs(t, c).CatName2; got != ok {
		t.Fatalf("a rejected name changed the stored one: %q", got)
	}
	// The cap counts RUNES, so a name of accented letters is not silently
	// shorter than a name of plain ones.
	c.mustDo("PUT", "/auth/me/preferences",
		map[string]any{"catName3": strings.Repeat("é", catNameMax)}, 200)
}

// THE ONE THAT MATTERS. Naming a category is presentation; the token is
// storage. A Markdown export written after a rename must still say
// `color: blue`, or a year of highlights stops round-tripping and nobody finds
// out until they re-import.
func TestRenamingACategoryDoesNotTouchTheExport(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Earthsea"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "The mark is the making", "color": "blue",
	}, http.StatusCreated)

	before := c.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, 200).Body.String()
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"catName2": "Fact", "catColor2": "#5AA8B5",
	}, 200)
	after := c.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, 200).Body.String()

	if before != after {
		t.Fatalf("renaming a category changed the export:\n--- before ---\n%s\n--- after ---\n%s", before, after)
	}
	if !strings.Contains(after, "color: blue") {
		t.Fatalf("the export lost its colour token:\n%s", after)
	}
	if strings.Contains(after, "Fact") || strings.Contains(after, "5AA8B5") {
		t.Fatalf("a display name leaked into the export:\n%s", after)
	}
}
