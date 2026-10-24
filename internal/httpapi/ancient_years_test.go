package httpapi

import (
	"net/http"
	"testing"
)

// Years before the common era.
//
// The old floor was 1000, which is not a rounding error — it refused the
// Meditations, the Analects and the Gita outright, in an app whose entire
// purpose is keeping quotes from things worth quoting. A library assembled
// around old books could not record when its oldest books were written.
//
// The era boundary needed no sentinel and no new column. validYear has always
// read 0 as "no year recorded", and there is no year 0 between 1 BCE and 1 CE,
// so -1 is 1 BCE and every existing row keeps its meaning. That coincidence is
// worth a test of its own: it is the kind of thing a later refactor "tidies up"
// by making 0 a valid year, at which point every book with no year claims to
// have been written at the era boundary.

func TestABookCanBeOlderThanTheCommonEra(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	for _, tc := range []struct {
		name  string
		year  int
		circa bool
	}{
		{"Year Ninety-Nine", 99, false},      // the old floor of 1000 refused this
		{"Meditations", 180, false},          // CE, exact
		{"The Analects", -479, true},         // BCE, an estimate and honest about it
		{"Gilgamesh", -2100, true},           // about as old as anything gets
		{"Undated", 0, false},                // 0 still means "not recorded"
		{"Right At The Boundary", -1, false}, // 1 BCE, the value 0 would have stolen
	} {
		got := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
			"title": tc.name, "published_year": tc.year, "published_circa": tc.circa,
		}, http.StatusCreated))
		if got.PublishedYear != tc.year {
			t.Errorf("%s: published_year = %d, want %d", tc.name, got.PublishedYear, tc.year)
		}
		if got.PublishedCirca != tc.circa {
			t.Errorf("%s: published_circa = %v, want %v", tc.name, got.PublishedCirca, tc.circa)
		}
		// And it survives a reload, which is the half that catches a column
		// written but never selected.
		back := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(got.ID), nil, 200))
		if back.PublishedYear != tc.year || back.PublishedCirca != tc.circa {
			t.Errorf("%s: after reload year=%d circa=%v, want %d/%v",
				tc.name, back.PublishedYear, back.PublishedCirca, tc.year, tc.circa)
		}
	}
}

func TestAYearOutsideThePlausibleRangeIsStillRefused(t *testing.T) {
	// Widening the floor is not the same as removing it. A year of -99999 is a
	// typo, and accepting it puts a bucket 100,000 years wide on the timeline.
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	for _, bad := range []int{-4001, 3001, -100000} {
		c.mustDo("POST", "/books", map[string]any{
			"title": "Out Of Range", "published_year": bad,
		}, http.StatusBadRequest)
	}
	for _, bad := range []int{-4001, 3001} {
		c.mustDo("POST", "/movies", map[string]any{
			"title": "Out Of Range", "release_year": bad,
		}, http.StatusBadRequest)
	}
}

