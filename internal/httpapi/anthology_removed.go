package httpapi

import (
	"database/sql"
	"net/http"
	"strconv"

	"tippani/internal/olog"
)

// WHAT WAS TAKEN OUT OF AN ANTHOLOGY, and how to put it back (0088).
//
// A removal used to be a DELETE, so a rule that fills the anthology (anthology_fill.go) put the
// passage straight back the next time it ran. Now removing writes a row here, keyed the way an
// entry is, holding the entry's place and its commentary. The fill skips what is here, and the
// anthology page lists it with a way back.
//
// THE TWO TABLES NEVER BOTH HOLD A PASSAGE. Removing moves the row from entries to removed in one
// transaction; restoring moves it back; adding a passage by hand (or importing one) clears its
// removal. The primary keys alike are what make "once per anthology" and "removed once" the same
// rule.

type anthologyRemovedRow struct {
	Kind   string `json:"kind"`
	ItemID int64  `json:"item_id"`
	Note   string `json:"note"`
	Quote  string `json:"quote"`
	// Source is the book, film or occasion, and Credit the author, actor or speaker: the same two
	// facts an entry carries, so the list reads like the anthology does.
	Source string `json:"source"`
	Credit string `json:"credit"`
	WorkID int64  `json:"work_id,omitempty"`
}

// isRemoved says whether the passage was taken out of this anthology and not brought back.
func isRemoved(db interface {
	QueryRow(string, ...any) *sql.Row
}, anthologyID int64, kind string, itemID int64) (bool, error) {
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM anthology_removed
	                    WHERE anthology_id = ? AND kind = ? AND item_id = ?`, anthologyID, kind, itemID).Scan(&n)
	return n > 0, err
}

// forgetRemoval clears a passage's removal because it is in the anthology again, by hand or by an
// import. A fill never calls it: a fill is the thing the removal exists to hold back.
func forgetRemoval(db interface {
	Exec(string, ...any) (sql.Result, error)
}, anthologyID int64, kind string, itemID int64) error {
	_, err := db.Exec(`DELETE FROM anthology_removed
	                   WHERE anthology_id = ? AND kind = ? AND item_id = ?`, anthologyID, kind, itemID)
	return err
}

// passageSummaries says what each passage is (its words, where from, who by), for a preview that lets
// the reader look before they take. Scoped to the caller through the quote's own parent, like every read of a
// quote here; a passage that is not theirs is left out.
func passageSummaries(db interface {
	QueryRow(string, ...any) *sql.Row
}, uid int64, items []anthologyFillItem) ([]anthologyFillPassage, error) {
	out := make([]anthologyFillPassage, 0, len(items))
	for _, it := range items {
		var p anthologyFillPassage
		var q string
		switch it.Kind {
		case "book":
			q = `SELECT COALESCE(a.quote,''), COALESCE(b.title,''), COALESCE(b.author,'') FROM annotations a
			     JOIN books b ON b.id = a.book_id WHERE a.id = ? AND b.user_id = ?`
		case "screen":
			q = `SELECT COALESCE(d.quote,''), COALESCE(m.title,''), COALESCE(d.actor,'') FROM dialogues d
			     JOIN movies m ON m.id = d.movie_id WHERE d.id = ? AND m.user_id = ?`
		default:
			q = `SELECT COALESCE(u.quote,''), COALESCE(u.occasion,''), COALESCE(u.speaker,'') FROM utterances u
			     WHERE u.id = ? AND u.user_id = ?`
		}
		err := db.QueryRow(q, it.ItemID, uid).Scan(&p.Quote, &p.Source, &p.Credit)
		if err == sql.ErrNoRows {
			continue
		}
		if err != nil {
			return nil, err
		}
		p.Kind, p.ItemID = it.Kind, it.ItemID
		out = append(out, p)
	}
	return out, nil
}

// GET /anthologies/{id}/removed — the passages taken out, most recently removed last.
//
// SCOPED THROUGH THE QUOTE'S OWN PARENT, as entriesFor is: the table has no user_id, and a row
// whose quote is not the caller's is not listed whatever it says.
func (s *Server) handleListAnthologyRemoved(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	uid := userID(r)
	if !anthologyOwned(s.Store.DB, uid, id) {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	rows, err := s.Store.DB.Query(`
		SELECT x.kind, x.item_id, x.note, COALESCE(a.quote,''), b.title, COALESCE(b.author,''), b.id, x.position
		  FROM anthology_removed x
		  JOIN annotations a ON a.id = x.item_id
		  JOIN books b ON b.id = a.book_id
		 WHERE x.anthology_id = ? AND x.kind = 'book' AND b.user_id = ?
		UNION ALL
		SELECT x.kind, x.item_id, x.note, COALESCE(d.quote,''), m.title, COALESCE(d.actor,''), m.id, x.position
		  FROM anthology_removed x
		  JOIN dialogues d ON d.id = x.item_id
		  JOIN movies m ON m.id = d.movie_id
		 WHERE x.anthology_id = ? AND x.kind = 'screen' AND m.user_id = ?
		UNION ALL
		SELECT x.kind, x.item_id, x.note, COALESCE(u.quote,''), COALESCE(u.occasion,''), COALESCE(u.speaker,''), 0, x.position
		  FROM anthology_removed x
		  JOIN utterances u ON u.id = x.item_id
		 WHERE x.anthology_id = ? AND x.kind = 'utterance' AND u.user_id = ?
		ORDER BY 8`, id, uid, id, uid, id, uid)
	if err != nil {
		internalError(w, r, "list removed entries", err)
		return
	}
	defer rows.Close()
	out := []anthologyRemovedRow{}
	for rows.Next() {
		var x anthologyRemovedRow
		var pos float64
		if err := rows.Scan(&x.Kind, &x.ItemID, &x.Note, &x.Quote, &x.Source, &x.Credit, &x.WorkID, &pos); err != nil {
			internalError(w, r, "scan removed entry", err)
			return
		}
		out = append(out, x)
	}
	if err := rows.Err(); err != nil {
		internalError(w, r, "read removed entries", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"removed": out})
}

// POST /anthologies/{id}/removed/{kind}/{itemID} — bring one passage back, to the place it was
// taken from and with its commentary. A position another passage now holds is not a collision:
// order is by position and the reorder rule (anthologyPositionGap) already copes with equal ones.
func (s *Server) handleRestoreAnthologyEntry(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	kind := r.PathValue("kind")
	itemID, err := strconv.ParseInt(r.PathValue("itemID"), 10, 64)
	if !validReviewKind(kind) || err != nil || itemID <= 0 {
		writeErr(w, http.StatusBadRequest, "bad entry reference")
		return
	}
	uid := userID(r)
	olog.Tracef("[anthologies] restore uid=%d id=%d kind=%s item=%d", uid, id, kind, itemID)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	if !anthologyOwned(tx, uid, id) {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	var pos float64
	var note string
	err = tx.QueryRow(`SELECT position, note FROM anthology_removed
	                   WHERE anthology_id = ? AND kind = ? AND item_id = ?`, id, kind, itemID).Scan(&pos, &note)
	if err == sql.ErrNoRows {
		writeErr(w, http.StatusNotFound, "that quote was not removed from this anthology")
		return
	}
	if err != nil {
		internalError(w, r, "read removed entry", err)
		return
	}
	// The quote has to still be the caller's, as it is for every write that names one.
	if !quoteOwned(tx, uid, kind, itemID) {
		writeErr(w, http.StatusNotFound, "that quote does not exist")
		return
	}
	if _, err := tx.Exec(`INSERT OR IGNORE INTO anthology_entries (anthology_id, position, kind, item_id, note)
	                      VALUES (?, ?, ?, ?, ?)`, id, pos, kind, itemID, note); err != nil {
		internalError(w, r, "restore entry", err)
		return
	}
	if err := forgetRemoval(tx, id, kind, itemID); err != nil {
		internalError(w, r, "clear removal", err)
		return
	}
	if _, err := tx.Exec(`UPDATE anthologies SET updated_at = datetime('now') WHERE id = ?`, id); err != nil {
		internalError(w, r, "touch anthology", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit restore", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
