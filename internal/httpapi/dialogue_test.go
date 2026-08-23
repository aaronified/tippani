package httpapi

import (
	"net/http"
	"testing"
)

// autofillActor maps the character(s) a line credits to who plays them in the
// work's CAST MAPPING (work_cast, 0048). A line can name several characters
// (comma-joined tokens), so the resolver splits, matches each on the folded name,
// and joins the unique actors in order — only when no actor was supplied.
//
// THE RULE IS THE SAME ONE AS BEFORE AND THE SOURCE IS NOT. Until 0048 this read
// `movies.cast_json`, which no screen could edit and which is empty for nearly
// every game; every case below used to be fed a JSON literal. They are now fed
// rows, which is the whole point: the last two cases could not be written at all
// against a blob, because there was no way to author or to remove an entry in it.
func TestAutofillActor(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film := createWork(t, c, "Two for the Road", "Stanley Donen", "movie")
	// The third row is a credit with no performer, which TMDB really does return
	// when a person's Roles array is empty — it must contribute nothing rather
	// than an empty string in a comma-joined list.
	seedProviderCast(t, srv, 1, "movie", film,
		[2]string{"Mark Wallace", "Albert Finney"},
		[2]string{"Joanna Wallace", "Audrey Hepburn"},
		[2]string{"Narrator", ""})

	cases := []struct {
		name      string
		character string
		actor     string
		want      string
	}{
		{"single character", "Mark Wallace", "", "Albert Finney"},
		{"case-insensitive", "mark wallace", "", "Albert Finney"},
		{"multiple characters", "Mark Wallace, Joanna Wallace", "", "Albert Finney, Audrey Hepburn"},
		{"order preserved", "Joanna Wallace, Mark Wallace", "", "Audrey Hepburn, Albert Finney"},
		{"dupe actors collapse", "Mark Wallace, Mark Wallace", "", "Albert Finney"},
		{"unmatched character drops", "Mark Wallace, Nobody", "", "Albert Finney"},
		{"cast member without actor", "Narrator", "", ""},
		{"no match at all", "Nobody", "", ""},
		{"explicit actor is preserved", "Mark Wallace", "Someone Else", "Someone Else"},
		{"empty character", "", "", ""},
		{"whitespace character", "  ", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := autofillActor(srv.Store.DB, "movie", film, tc.character, tc.actor); got != tc.want {
				t.Errorf("autofillActor(%q, %q) = %q, want %q", tc.character, tc.actor, got, tc.want)
			}
		})
	}

	// A work with no cast at all resolves nothing and is not an error — which is
	// the state every game was permanently in before this table existed.
	empty := createWork(t, c, "Disco Elysium", "ZA/UM", "game")
	if got := autofillActor(srv.Store.DB, "movie", empty, "Kim Kitsuragi", ""); got != "" {
		t.Errorf("an empty cast resolved %q, want empty", got)
	}

	// A ROW THE READER DELETED ANSWERS NOTHING. The delete leaves a tombstone
	// (origin='removed') so that a refetch cannot hand the row back; the autofill
	// has to agree that it is gone, or deleting a wrong credit would go on
	// stamping its actor onto every line that names the character.
	t.Run("a tombstoned row answers nothing", func(t *testing.T) {
		hand := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(film)+"/cast", map[string]any{
			"character": "Manchester Man", "actor": "Bill Nighy",
		}, http.StatusCreated))
		if got := autofillActor(srv.Store.DB, "movie", film, "Manchester Man", ""); got != "Bill Nighy" {
			t.Fatalf("a hand-typed row should resolve: got %q", got)
		}
		// Tombstoned rather than hard-deleted by making it a provider row first,
		// which is the only kind the delete keeps.
		if _, err := srv.Store.DB.Exec(
			`UPDATE work_cast SET provider_key = 'x', origin = 'provider' WHERE id = ?`, hand.ID); err != nil {
			t.Fatal(err)
		}
		c.mustDo("DELETE", "/cast/"+itoa(hand.ID), nil, http.StatusNoContent)
		var origin string
		if err := srv.Store.DB.QueryRow(`SELECT origin FROM work_cast WHERE id = ?`, hand.ID).Scan(&origin); err != nil {
			t.Fatalf("the row should still be there as a tombstone: %v", err)
		}
		if origin != "removed" {
			t.Fatalf("origin = %q, want \"removed\" — the fixture is not testing what it says", origin)
		}
		if got := autofillActor(srv.Store.DB, "movie", film, "Manchester Man", ""); got != "" {
			t.Errorf("a tombstoned row resolved %q, want empty", got)
		}
	})
}
