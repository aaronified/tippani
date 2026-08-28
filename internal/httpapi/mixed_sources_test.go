package httpapi

// MIXING SUPPLIERS: TMDB's metadata with TheTVDB's character art.
//
// The two halves are already separate controls — a re-sync pulls the record from
// the source the title is pinned to, and POST /movies/{id}/cast/tvdb pulls only
// the cast, from TheTVDB, whatever the pin says. What connected them was a
// column: that route needs `movies.tvdb_id` on the row and refuses to search for
// one, so a title that loses its TheTVDB id loses the only picture of a character
// in costume this app can get.
//
// And a re-sync erased it. The record is written from ONE supplier's payload,
// TMDB's details carry no TheTVDB id, so every id column was written from a
// response that could not know two of them.

import (
	"net/http"
	"testing"
)

// A RE-SYNC FROM ONE SUPPLIER MUST NOT ERASE ANOTHER'S ID. The rule was already
// written for imdb_id — "a supplier is the authority on what it knows, never on
// what it does not" — and applied to one column out of four.
func TestARefetchKeepsTheOtherSuppliersIDs(t *testing.T) {
	stub := &castStub{cast: `[{"id":1,"character":"Chell","name":"Alésia Glidewell"}]`}
	_, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	// The reader adopts TheTVDB's id for this title — the whole point being to
	// keep TMDB's record and reach TheTVDB's per-role art with it.
	// A full-state PUT, like every other save in this app — the panel sends the
	// whole record and this is the field the reader changed.
	c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{"title": m.Title, "tvdb_id": 297762}, http.StatusOK)
	if got := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(m.ID), nil, 200)); got.TVDBID != 297762 {
		t.Fatalf("the id did not save: %+v", got)
	}

	// Re-fetch the metadata from TMDB, which is the ordinary "this record is
	// stale" button and knows nothing about TheTVDB.
	resyncFromTMDB(t, c, m.ID)

	after := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(m.ID), nil, 200))
	if after.TVDBID != 297762 {
		t.Fatalf("re-fetching from TMDB erased the TheTVDB id (%d) — the character art goes with it", after.TVDBID)
	}
	// And the supplier's OWN id is still authoritative: this is a re-sync of that
	// record, so it writes it.
	if after.TMDBID != 603 {
		t.Errorf("the pinned supplier's own id did not survive its own re-sync: %+v", after)
	}
}

// The same rule from the other end, and the case that shows it is about the
// COLUMN rather than about TheTVDB: a title with an IGDB id must not lose it to a
// film re-sync either.
func TestARefetchKeepsAnIGDBIDToo(t *testing.T) {
	stub := &castStub{cast: `[]`}
	_, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{"title": m.Title, "igdb_id": 1942}, http.StatusOK)
	resyncFromTMDB(t, c, m.ID)
	if after := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(m.ID), nil, 200)); after.IGDBID != 1942 {
		t.Fatalf("re-fetching erased the IGDB id: %+v", after)
	}
}
