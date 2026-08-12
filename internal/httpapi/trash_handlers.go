package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"tippani/internal/olog"
)

// The bin's endpoints: what is in it, putting one back, and throwing one away.
//
// GET    /trash              the list, newest first
// GET    /trash/{id}         one entry with its contents, for the expanded row
// POST   /trash/{id}/restore put it back
// DELETE /trash/{id}         throw this one away now
// DELETE /trash              empty it
//
// Ownership is filtered in the same statement as every read and every write, so a
// foreign id is NOT FOUND rather than forbidden — the house rule, and here it also
// avoids telling a stranger that somebody else deleted something.

// restoreOrder is the order rows go back in, and it is FK order: a child cannot be
// inserted before its parent. Tables absent from a payload are skipped, so one
// list serves all five kinds rather than five nearly-identical lists.
//
// `tags` and `genres` are NOT in this list. They are re-created by name before
// anything else (see resolveVocabulary), because their ids may have moved.
var restoreOrder = []string{
	"books", "movies",
	"annotations", "dialogues", "utterances",
	"book_genres", "movie_genres",
	"annotation_tags", "dialogue_tags", "utterance_tags",
	"item_reviews", "work_reads",
}

// remapColumn names, per join table, the column holding a vocabulary id that may
// have to be re-pointed on the way back in.
var remapColumn = map[string]struct{ col, kind string }{
	"book_genres":     {"genre_id", "genres"},
	"movie_genres":    {"genre_id", "genres"},
	"annotation_tags": {"tag_id", "tags"},
	"dialogue_tags":   {"tag_id", "tags"},
	"utterance_tags":  {"tag_id", "tags"},
}

func (s *Server) handleListTrash(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[trash] handleListTrash uid=%v", uid)
	rows, err := s.Store.DB.Query(`
		SELECT id, kind, label, child_count, deleted_at, files
		FROM trash WHERE user_id = ? ORDER BY deleted_at DESC, id DESC`, uid)
	if err != nil {
		internalError(w, r, "list trash", err)
		return
	}
	defer rows.Close()
	items := []trashRow{}
	for rows.Next() {
		var t trashRow
		var files string
		if err := rows.Scan(&t.ID, &t.Kind, &t.Label, &t.ChildCount, &t.DeletedAt, &files); err != nil {
			olog.Warnf(olog.CodeTrashRowScan, "[trash] list row scan failed: %v", err)
			continue
		}
		t.Files = len(fileList(files))
		items = append(items, t)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeTrashRowScan, "[trash] list row iteration failed: %v", err)
	}
	// The retention window rides with the list so the card can say "gone in N
	// days" without a second request, and so the number it shows and the number
	// the purge uses are the same number.
	writeJSON(w, http.StatusOK, map[string]any{"trash": items, "days": s.trashDays(uid)})
}

// handleGetTrashEntry returns one entry with a READ-ONLY summary of what is inside
// it, straight from the payload. No second read path per kind: the expanded row in
// the UI lists the quotes it is holding, and the payload already has them.
func (s *Server) handleGetTrashEntry(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid trash id")
		return
	}
	uid := userID(r)
	var t trashRow
	var payload, files string
	err := s.Store.DB.QueryRow(`
		SELECT id, kind, label, child_count, deleted_at, payload, files
		FROM trash WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&t.ID, &t.Kind, &t.Label, &t.ChildCount, &t.DeletedAt, &payload, &files)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "not in the bin")
		return
	case err != nil:
		internalError(w, r, "read trash entry", err)
		return
	}
	t.Files = len(fileList(files))
	var snap snapshot
	if err := json.Unmarshal([]byte(payload), &snap); err != nil {
		internalError(w, r, "read trash payload", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entry": t, "contents": snapshotContents(snap)})
}

// snapshotContents flattens a payload into the lines a reader would recognise:
// the quotes it is holding, in the order they were read. Deliberately not the
// whole payload — a bin row is not a debugging surface, and shipping every column
// of every row to the client would be handing over a database dump because
// somebody clicked a chevron.
func snapshotContents(snap snapshot) []map[string]any {
	out := []map[string]any{}
	for _, table := range []string{"annotations", "dialogues", "utterances"} {
		for _, row := range snap[table] {
			text := strings.TrimSpace(stringOf(row["quote"]))
			if text == "" {
				text = strings.TrimSpace(stringOf(row["note"]))
			}
			if text == "" {
				continue
			}
			out = append(out, map[string]any{"text": text, "color": stringOf(row["color"])})
		}
	}
	return out
}

// handleRestoreTrash puts one entry back, whole, in one transaction.
func (s *Server) handleRestoreTrash(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid trash id")
		return
	}
	uid := userID(r)
	olog.Tracef("[trash] handleRestoreTrash uid=%v id=%v", uid, id)

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "restore: begin tx", err)
		return
	}
	defer tx.Rollback()

	var kind, payload, files string
	// The read and the ownership filter are one statement, and the DELETE below is
	// scoped the same way — so two clients racing the same Undo cannot both restore
	// it: the second finds nothing to delete and rolls back.
	err = tx.QueryRow(`SELECT kind, payload, files FROM trash WHERE id = ? AND user_id = ?`,
		id, uid).Scan(&kind, &payload, &files)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "not in the bin")
		return
	case err != nil:
		internalError(w, r, "restore: read entry", err)
		return
	}
	var snap snapshot
	if err := json.Unmarshal([]byte(payload), &snap); err != nil {
		olog.Warnf(olog.CodeTrashRestore, "[trash] entry %d has an unreadable payload: %v", id, err)
		internalError(w, r, "restore: read payload", err)
		return
	}
	if err := s.restoreSnapshot(tx, uid, snap); err != nil {
		olog.Warnf(olog.CodeTrashRestore, "[trash] restoring entry %d for user %d failed: %v", id, uid, err)
		internalError(w, r, "restore", err)
		return
	}
	res, err := tx.Exec(`DELETE FROM trash WHERE id = ? AND user_id = ?`, id, uid)
	if err != nil {
		internalError(w, r, "restore: clear entry", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Somebody else restored or purged it while this transaction was open.
		writeErr(w, http.StatusNotFound, "not in the bin")
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "restore: commit", err)
		return
	}
	// Files last, after the rows are safely back: a picture that fails to come out
	// of the bin is a missing cover, which is recoverable by hand. Rows are not.
	s.unparkFiles(fileList(files))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "kind": kind})
}

// restoreSnapshot re-inserts a payload in foreign-key order.
//
// Ids are the ORIGINAL ids, always. Nothing has to be renumbered because no id was
// ever reused — the create paths allocate above a floor (id_floor.go) — and the
// floor is raised past everything restored here, so a create that follows cannot
// land on top of it either. If an id somehow IS taken, the insert fails the
// primary key and the whole restore rolls back; that is the honest outcome, and it
// is asserted rather than assumed.
func (s *Server) restoreSnapshot(tx *sql.Tx, uid int64, snap snapshot) error {
	vocab, err := resolveVocabulary(tx, uid, snap)
	if err != nil {
		return err
	}
	for _, table := range restoreOrder {
		rows := snap[table]
		if len(rows) == 0 {
			continue
		}
		cols, err := tableColumns(tx, table)
		if err != nil {
			return err
		}
		remap, hasRemap := remapColumn[table]
		for _, row := range rows {
			if hasRemap {
				if old, ok := intOf(row[remap.col]); ok {
					if now, ok := vocab[remap.kind][old]; ok {
						row[remap.col] = now
					}
				}
			}
			if err := insertRow(tx, table, cols, row); err != nil {
				return fmt.Errorf("%s: %w", table, err)
			}
			if idFloorTables[table] {
				if n, ok := intOf(row["id"]); ok {
					if err := reserveAbove(tx, table, n); err != nil {
						return err
					}
				}
			}
		}
	}
	return nil
}

// resolveVocabulary puts the tags and genres a payload names back, BY NAME, and
// returns old id -> current id for each.
//
// This is the one place a restore is allowed to renumber anything, and it has to
// be: a tag is managed vocabulary that outlives the quotes using it, and a genre
// is garbage-collected when its last work goes. So between the delete and the
// restore, a tag may have been deleted (its id now free or reused by another tag)
// and a genre may have been dropped and re-created with a different id. The NAME
// is the stable thing, which is why the writer carries the rows and not just the
// join.
func resolveVocabulary(tx *sql.Tx, uid int64, snap snapshot) (map[string]map[int64]int64, error) {
	out := map[string]map[int64]int64{"tags": {}, "genres": {}}
	for _, table := range []string{"tags", "genres"} {
		for _, row := range snap[table] {
			name := stringOf(row["name"])
			oldID, ok := intOf(row["id"])
			if name == "" || !ok {
				continue
			}
			var nowID int64
			err := tx.QueryRow(`SELECT id FROM `+table+` WHERE user_id = ? AND name = ?`, uid, name).Scan(&nowID)
			if errors.Is(err, sql.ErrNoRows) {
				// Gone since the delete: re-create it with whatever presentation it
				// had (tags carry a colour and a style), and let SQLite choose the id.
				cols, err := tableColumns(tx, table)
				if err != nil {
					return nil, err
				}
				fresh := map[string]any{}
				for _, c := range cols {
					if c == "id" {
						continue // a vocabulary row's id is not part of its identity
					}
					if v, ok := row[c]; ok {
						fresh[c] = v
					}
				}
				fresh["user_id"] = uid
				if err := insertRow(tx, table, cols, fresh); err != nil {
					return nil, fmt.Errorf("%s %q: %w", table, name, err)
				}
				if err := tx.QueryRow(`SELECT id FROM `+table+` WHERE user_id = ? AND name = ?`,
					uid, name).Scan(&nowID); err != nil {
					return nil, err
				}
			} else if err != nil {
				return nil, err
			}
			out[table][oldID] = nowID
		}
	}
	return out, nil
}

// tableColumns is the live column list, used to drop any column the snapshot has
// that the table no longer does.
//
// A column removed by a migration between the delete and the restore is data the
// app has nowhere to put; refusing the whole restore over it would strip somebody
// of a book to preserve a field that no longer exists. The columns are read from
// the database for the same reason the writer reads them there.
func tableColumns(tx *sql.Tx, table string) ([]string, error) {
	rows, err := tx.Query(`SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cols []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, err
		}
		cols = append(cols, n)
	}
	return cols, rows.Err()
}

// insertRow writes one snapshot row, using only the columns the table still has.
func insertRow(tx *sql.Tx, table string, cols []string, row map[string]any) error {
	names := make([]string, 0, len(cols))
	marks := make([]string, 0, len(cols))
	args := make([]any, 0, len(cols))
	for _, c := range cols {
		v, ok := row[c]
		if !ok {
			continue // absent from the snapshot: let the column's default apply
		}
		names = append(names, c)
		marks = append(marks, "?")
		args = append(args, v)
	}
	if len(names) == 0 {
		return nil
	}
	_, err := tx.Exec(
		`INSERT INTO `+table+` (`+strings.Join(names, ", ")+`) VALUES (`+strings.Join(marks, ", ")+`)`, args...)
	return err
}

// handleDeleteTrashEntry throws one entry away now, files included. The only way
// to lose something for good before its retention window is up, and it is a
// deliberate act on one row.
func (s *Server) handleDeleteTrashEntry(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid trash id")
		return
	}
	uid := userID(r)
	var files string
	err := s.Store.DB.QueryRow(`SELECT files FROM trash WHERE id = ? AND user_id = ?`, id, uid).Scan(&files)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "not in the bin")
		return
	case err != nil:
		internalError(w, r, "empty one: read entry", err)
		return
	}
	if _, err := s.Store.DB.Exec(`DELETE FROM trash WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		internalError(w, r, "empty one", err)
		return
	}
	s.removeParked(fileList(files))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handleEmptyTrash empties the caller's bin. Their own only: an admin's bin is
// not a superset of anybody else's, and "empty the bin" must never mean "empty
// everyone's".
func (s *Server) handleEmptyTrash(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[trash] handleEmptyTrash uid=%v", uid)
	rows, err := s.Store.DB.Query(`SELECT files FROM trash WHERE user_id = ?`, uid)
	if err != nil {
		internalError(w, r, "empty bin: read", err)
		return
	}
	var parked []string
	for rows.Next() {
		var files string
		if err := rows.Scan(&files); err != nil {
			continue
		}
		parked = append(parked, fileList(files)...)
	}
	rows.Close()
	res, err := s.Store.DB.Exec(`DELETE FROM trash WHERE user_id = ?`, uid)
	if err != nil {
		internalError(w, r, "empty bin", err)
		return
	}
	n, _ := res.RowsAffected()
	s.removeParked(parked)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "removed": n})
}
