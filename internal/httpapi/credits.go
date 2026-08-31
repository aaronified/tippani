package httpapi

import (
	"database/sql"

	"tippani/internal/metadata"
	"tippani/internal/store"
)

// Keeping the credit link rows in step with the columns that cache them.
//
// 0056 made work_person the truth and books.author / translator / editor and
// movies.director a derived cache — see internal/store/credits.go for why the
// columns survive at all, and 0056's header for the FTS argument behind it.
//
// TWENTY-ONE PLACES WRITE THOSE COLUMNS: create, update, import approval, import
// backfill, bulk edit, metadata backfill, re-verify, and the person rename that
// does string surgery across all four. Rewriting each of them to compose a
// credit from link rows would be twenty-one chances to get it subtly different.
// So they keep their write — it is the value the reader supplied — and gain ONE
// line that turns it into link rows and recomposes the column from them.
//
// THE RECOMPOSE MAKES THE CALL IDEMPOTENT rather than redundant. Writing
// "Gaiman & Pratchett" and then syncing yields "Gaiman, Pratchett" in the column
// and two link rows behind it, which is the same state a second write of either
// spelling would produce. The column a caller wrote is therefore the INPUT, and
// what lands is always the app's own composition of it.
//
// THE SPLIT HAPPENS HERE, NOT IN store. Whether "&" means two people is a
// per-account preference, and internal/store has no business reading the
// preferences of an HTTP caller — the same boundary that keeps store from
// importing httpapi. This package has the user's settings to hand, so it splits
// and passes the components.

// syncBookCredits writes the link rows behind a book's three credit columns and
// recomposes all three. Every caller that writes any of them calls this in the
// same transaction, so the cache is never observed disagreeing.
//
// ALL THREE, EVEN WHEN ONE CHANGED. A book's editor is far more often cleared
// than set, and a caller that syncs only what it believes it touched leaves the
// link rows for the other two describing a state that no longer exists. The cost
// is two extra deletes over rows that are usually empty.
func (s *Server) syncBookCredits(tx *sql.Tx, uid, id int64, author, translator, editor string) error {
	seps := s.creditSeps(uid)
	for _, c := range []struct {
		role store.CreditRole
		raw  string
	}{
		{store.RoleAuthor, author},
		{store.RoleTranslator, translator},
		{store.RoleEditor, editor},
	} {
		if err := store.SetCredits(tx, uid, "book", id, c.role, metadata.SplitCredits(c.raw, seps), seps); err != nil {
			return err
		}
	}
	return nil
}

// syncMovieCredits is the same for a film, show or game's one credit column.
//
// A GAME'S "DIRECTOR" IS ITS STUDIO, which the app already stores in this column
// and displays under its own label. It splits and resolves like any other credit
// — a studio is a name that appears on many works, which is exactly what a
// person record is for here, whatever the word above it says.
func (s *Server) syncMovieCredits(tx *sql.Tx, uid, id int64, director string) error {
	seps := s.creditSeps(uid)
	return store.SetCredits(tx, uid, "movie", id, store.RoleDirector,
		metadata.SplitCredits(director, seps), seps)
}
