package httpapi

import (
	"testing"

	"tippani/internal/changelog"
)

// WHAT THE UPDATES CARD IS TOLD ABOUT THE BUILD'S AGE.
//
// The rule, not the lookup: the field a client will FORMAT must be a date that
// client can parse, or nothing at all. `Release.Date` is verbatim on purpose —
// the changelog file is the only thing that knows its own format — so the shape
// check belongs at the API boundary, and these cases are what makes that a
// contract rather than a comment.
func TestReleaseDateIsADateOrNothing(t *testing.T) {
	rs := []changelog.Release{
		{Version: "3.1.0", Date: "2026-09-01"},
		{Version: "3.0.0", Date: "2026-08-25"},
		// A heading that lost its date, or wrote it another way. Both reach here
		// because splitHeading is deliberately tolerant.
		{Version: "2.9.0", Date: ""},
		{Version: "2.8.0", Date: "25 August 2026"},
	}

	for _, c := range []struct {
		name    string
		version string
		want    string
	}{
		{"a release the history dates", "3.1.0", "2026-09-01"},
		{"another one, so the first is not a fixed answer", "3.0.0", "2026-08-25"},
		// EVERY ONE OF THESE IS A REAL BUILD THIS APP SHIPS. `dev` is what a local
		// build and every test carries; the edge shape is what a branch image gets
		// from CI; a release candidate is a published release that heads no entry.
		{"a local build", "dev", ""},
		{"a branch image", "3.0.0-edge.v3.a66ff6c", ""},
		{"a release candidate", "3.1.0-rc.1", ""},
		{"a version the history has never heard of", "9.9.9", ""},
		{"nothing at all", "", ""},
		// The two the shape check exists for: the version IS in the history, and
		// the date is still not one a client could format.
		{"a heading with no date", "2.9.0", ""},
		{"a heading whose date is prose", "2.8.0", ""},
	} {
		t.Run(c.name, func(t *testing.T) {
			if got := releaseDate(rs, c.version); got != c.want {
				t.Errorf("releaseDate(%q) = %q, want %q", c.version, got, c.want)
			}
		})
	}
}

// A DATELESS HEADING IS STILL A RELEASE. `current_listed` answers "does the
// history know this build" and this answers "does it know when it came out";
// folding one into the other would make the first lie about a build the history
// does list.
func TestKnowingTheReleaseAndKnowingItsDateAreTwoQuestions(t *testing.T) {
	rs := []changelog.Release{{Version: "2.9.0", Date: ""}}
	if !listed(rs, "2.9.0") {
		t.Error("a release with no date is not listed — the two questions have been folded together")
	}
	if releaseDate(rs, "2.9.0") != "" {
		t.Error("a dateless heading produced a date")
	}
}
