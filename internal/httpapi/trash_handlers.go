package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"tippani/internal/olog"
	"tippani/internal/store"
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
// inserted before its parent. Tables absent from a payload are skipped, which is
// what lets ONE list serve all six kinds — a highlight's payload holds three of
// these tables and an account's holds all of them, and neither needs its own list
// to walk. It IS accountTables, deliberately: two orderings of the same foreign
// keys would be two places to get the order wrong, and the one that is wrong is
// the one nobody exercises until an account restore.
var restoreOrder = accountTables

// vocabularyTables are handled before the walk and skipped inside it: their rows
// go back by NAME rather than by id (see resolveVocabulary), because a tag can be
// deleted and a genre garbage-collected while the entry sits in the bin.
var vocabularyTables = map[string]bool{"tags": true, "genres": true}

// idNotIdentity names the tables whose surrogate id is bookkeeping rather than
// identity, so a restore drops it and lets SQLite issue a fresh one. insertRow
// already skips a column the snapshot does not carry, so deleting the key is the
// whole mechanism.
//
// WHY THIS IS NEEDED AT ALL. The comment above restoreSnapshot is right that ids
// are the ORIGINAL ids and that nothing has to be renumbered — but the guarantee
// underneath it is idFloorTables, which is "exactly the five kinds the bin can
// hold". A table not on that list gets its ids from SQLite's rowid, and SQLite
// reissues a rowid freed by a DELETE. So a film's cast row, deleted with the film
// by 0048's trigger, can have its id handed to a cast row typed on a different
// film while the first sits in the bin — and the restore then fails the primary
// key and rolls back WHOLE, losing the film to protect a number.
//
// Putting work_cast on idFloorTables instead was the alternative and is worse: it
// would make every cast row a floor reservation for a guarantee only spaced
// repetition needs (id_floor.go says so — an id is kept stable there because a
// review schedule is keyed by it). Nothing references a cast row's id, nothing
// exports one, and the row's real identity is (kind, work_id, character_key,
// actor_key), which the restore preserves exactly.
var idNotIdentity = map[string]bool{"work_cast": true}

// relinkOnRestore names the tables whose person link is DROPPED on the way back
// in and re-derived from the name the row still carries (0059).
//
// A DANGLING LINK WOULD ROLL BACK THE WHOLE RESTORE. dialogues.actor_id and
// utterances.speaker_id are real foreign keys and the pool runs with
// foreign_keys(1), while the snapshot is a SELECT * taken before the delete —
// and handleDeleteDialogue calls gcOrphanPeople immediately after binning, so
// the actor whose last line this was can be gone by the time the reader presses
// undo. The insert would then fail the constraint and lose the quote to protect
// a number, which is the same failure idNotIdentity exists to prevent one table
// over.
//
// RE-DERIVING IS ALSO THE RIGHT ANSWER, not merely the safe one. The name is
// still printed on the row, SyncQuotePerson resolves it exactly as a fresh write
// would — creating the person again if the GC took them, which is precisely what
// gcOrphanPeople's own comment says a person row is for ("a reference row that
// re-fetches, not part of the quote") — and an entry binned BEFORE 0059 carries
// no such column at all and comes back linked rather than bare.
// THE CAST LINK IS THE SAME HAZARD AND THE SAME ANSWER. `speaker_cast_id` is a
// real foreign key into work_cast, and a work_cast row can be gone by the time a
// quote comes back — 0048's triggers reap a work's whole cast when the work is
// deleted, and adoption creates rows only on a list read. So it is dropped on the
// way in and re-derived from the character the row still prints, exactly as the
// person link is. `castKind` is empty for a table that has no work to hang a cast
// on, which is what an utterance is.
var relinkOnRestore = map[string]struct {
	kind     store.QuoteKind
	col      string
	castKind string
	castCol  string
}{
	"dialogues":   {store.KindScreen, "actor_id", "movie", "speaker_cast_id"},
	"utterances":  {store.KindUtterance, "speaker_id", "", ""},
	"annotations": {"", "", "book", "speaker_cast_id"},
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
	// A MERGE IS NOT A SNAPSHOT, AND ITS ENTRY CANNOT TAKE THIS PATH. Everything
	// below re-INSERTS rows into their tables; a merge deletes almost nothing, it
	// re-points — so the keys are still occupied and the first insert would collide.
	// Its payload is a reversal (store.MergeUndo, store.CharacterMergeUndo), applied
	// by targeted updates, and it is read before the snapshot decode because it
	// would not decode as one.
	//
	// A RECORD DELETE IS NOT A SNAPSHOT EITHER, and for a reason worth stating
	// separately: it DOES insert its row back, but two of the three things it
	// disturbed are `ON DELETE SET NULL` columns on rows that still exist — the cast
	// rows and the quotes that pointed at the record — and putting those back is an
	// UPDATE by id. Taking the generic path would return the record and leave every
	// one of them pointing at nothing.
	//
	// FOUR KINDS, ONE BRANCH, chosen by the entry's own kind rather than by trying
	// each decoder: a payload that will not decode is a corrupt entry and the reader
	// must see that, which a fall-through to another shape would turn into a silent
	// no-op on an entry they pressed Undo on.
	if undo, ok := identityReversals[kind]; ok {
		if err := undo(s, tx, uid, payload); err != nil {
			olog.Warnf(olog.CodeTrashRestore, "[trash] undoing %s %d for user %d failed: %v", kind, id, uid, err)
			internalError(w, r, "restore", err)
			return
		}
		res, err := tx.Exec(`DELETE FROM trash WHERE id = ? AND user_id = ?`, id, uid)
		if err != nil {
			internalError(w, r, "restore: clear entry", err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeErr(w, http.StatusNotFound, "not in the bin")
			return
		}
		if err := tx.Commit(); err != nil {
			internalError(w, r, "restore: commit", err)
			return
		}
		// The portrait comes back after the commit, the mirror of the delete parking
		// it after its own — see parkFiles. A merge carries no files and this is a
		// no-op for one.
		s.unparkFiles(fileList(files))
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "kind": kind})
		return
	}
	var snap snapshot
	if err := json.Unmarshal([]byte(payload), &snap); err != nil {
		olog.Warnf(olog.CodeTrashRestore, "[trash] entry %d has an unreadable payload: %v", id, err)
		internalError(w, r, "restore: read payload", err)
		return
	}
	// An account entry is a whole library and a login. Admin-only, and the rows
	// belong to the user being restored rather than to whoever is restoring them —
	// so the vocabulary resolution runs against the RESTORED user's id, not the
	// admin's. It is also the one restore that can be refused by something outside
	// the payload: a username somebody else has taken in the meantime.
	owner := uid
	if kind == "account" {
		if !isAdmin(r) {
			writeErr(w, http.StatusForbidden, "admin only")
			return
		}
		if n, ok := accountOwner(snap); ok {
			owner = n
		}
		if taken, err := usernameTaken(tx, snap); err != nil {
			internalError(w, r, "restore: check the username", err)
			return
		} else if taken != "" {
			writeErr(w, http.StatusConflict,
				"the name \u201c"+taken+"\u201d is taken now \u2014 rename that account first")
			return
		}
	}
	if err := s.restoreSnapshot(tx, owner, snap); err != nil {
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

// accountOwner is the user id an account snapshot belongs to, read from the row it
// carries rather than from the request — the admin restoring it is a different
// person, and every FK in the payload points at this id.
func accountOwner(snap snapshot) (int64, bool) {
	rows := snap["users"]
	if len(rows) == 0 {
		return 0, false
	}
	return intOf(rows[0]["id"])
}

// usernameTaken reports the username in an account snapshot if somebody else holds
// it now, so the restore can say which name is in the way instead of failing on a
// UNIQUE constraint. Returns "" when the name is free.
func usernameTaken(tx *sql.Tx, snap snapshot) (string, error) {
	rows := snap["users"]
	if len(rows) == 0 {
		return "", nil
	}
	name := stringOf(rows[0]["username"])
	if name == "" {
		return "", nil
	}
	var n int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM users WHERE username = ?`, name).Scan(&n); err != nil {
		return "", err
	}
	if n > 0 {
		return name, nil
	}
	return "", nil
}

// anthologyStillThere reports whether the anthology an entry points at survived
// however long the quote sat in the bin.
func anthologyStillThere(tx *sql.Tx, row map[string]any) bool {
	id, ok := intOf(row["anthology_id"])
	if !ok {
		return false
	}
	var n int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM anthologies WHERE id = ?`, id).Scan(&n); err != nil {
		return false
	}
	return n == 1
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
	// THE USER ROW GOES IN FIRST, before anything else including the vocabulary.
	// Every other table in an account payload has a foreign key to it — directly or
	// through a parent — and the tags re-created in the next step are the first
	// thing to trip on its absence. (A single-item payload has no user row, so this
	// is a no-op there.)
	for _, row := range snap["users"] {
		cols, err := tableColumns(tx, "users")
		if err != nil {
			return err
		}
		if err := insertRow(tx, "users", cols, row); err != nil {
			return fmt.Errorf("users: %w", err)
		}
	}
	vocab, err := resolveVocabulary(tx, uid, snap)
	if err != nil {
		return err
	}
	// Read once for the walk: a whole-account restore visits every quote in the
	// library, and loading a preferences document per row would be the same answer
	// fetched thousands of times.
	seps := s.creditSeps(uid)
	for _, table := range restoreOrder {
		rows := snap[table]
		if len(rows) == 0 || table == "users" || vocabularyTables[table] {
			continue
		}
		cols, err := tableColumns(tx, table)
		if err != nil {
			return err
		}
		remap, hasRemap := remapColumn[table]
		for _, row := range rows {
			// AN ANTHOLOGY CAN GO WHILE A QUOTE SITS IN THE BIN, and an entry has a
			// real foreign key to it — so putting one back would fail the constraint
			// and roll back the whole restore. The quote is what the reader asked for;
			// its place in a document that no longer exists is not worth refusing them
			// that. Dropped silently, because there is nothing they could do about it
			// and nothing left to tell them about.
			if table == "anthology_entries" && !anthologyStillThere(tx, row) {
				continue
			}
			if hasRemap {
				if old, ok := intOf(row[remap.col]); ok {
					if now, ok := vocab[remap.kind][old]; ok {
						row[remap.col] = now
					}
				}
			}
			if idNotIdentity[table] {
				delete(row, "id")
			}
			if rl, ok := relinkOnRestore[table]; ok {
				if rl.col != "" {
					delete(row, rl.col)
				}
				if rl.castCol != "" {
					delete(row, rl.castCol)
				}
			}
			if err := insertRow(tx, table, cols, row); err != nil {
				return fmt.Errorf("%s: %w", table, err)
			}
			if rl, ok := relinkOnRestore[table]; ok {
				if id, ok := intOf(row["id"]); ok {
					if rl.kind != "" {
						if err := store.SyncQuotePerson(tx, uid, rl.kind, id, seps); err != nil {
							return fmt.Errorf("%s: relink person: %w", table, err)
						}
					}
					if rl.castKind != "" {
						if err := store.SyncQuoteCast(tx, uid, rl.castKind, id, seps); err != nil {
							return fmt.Errorf("%s: relink speaker: %w", table, err)
						}
					}
				}
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

// undoPersonMerge applies a parked merge reversal.
//
// A SEPARATE FUNCTION SO THE PAYLOAD IS DECODED IN ONE PLACE, and so the shape it
// decodes into is store.MergeUndo rather than the generic snapshot every other bin
// entry carries. A payload that will not decode is a corrupt entry, and the reader
// gets a failure rather than a partial reversal.
func (s *Server) undoPersonMerge(tx *sql.Tx, uid int64, payload string) error {
	var u store.MergeUndo
	if err := json.Unmarshal([]byte(payload), &u); err != nil {
		return fmt.Errorf("undo merge: unreadable entry: %w", err)
	}
	return store.UndoPersonMerge(tx, uid, &u, s.creditSeps(uid))
}

// identityReversals are the bin kinds whose payload is a REVERSAL rather than a
// snapshot, each with the function that applies it.
//
// A TABLE RATHER THAN A CHAIN OF ifs, because the set is the same set 0060's CHECK
// enumerates and a kind that is in one and not the other is the failure that
// migration's header is about: an entry that lists, sits for thirty days, and fails
// when somebody presses Undo. Two lists side by side is still two lists, but this
// one is three lines and reads as a list, which the four-way if it replaced did not.
var identityReversals = map[string]func(*Server, *sql.Tx, int64, string) error{
	"person-merge":     (*Server).undoPersonMerge,
	"character-merge":  (*Server).undoCharacterMerge,
	"person-delete":    (*Server).undoPersonDelete,
	"character-delete": (*Server).undoCharacterDelete,
}

// undoPersonDelete and undoCharacterDelete put a binned record back.
//
// ONE PAYLOAD SHAPE OVER BOTH TABLES — store.RecordDeleteUndo — unlike the merges,
// whose halves are written out separately because their meanings differ. A delete
// captures the row and the things that pointed at it, which is the same list either
// side with some fields empty.
func (s *Server) undoPersonDelete(tx *sql.Tx, uid int64, payload string) error {
	var u store.RecordDeleteUndo
	if err := json.Unmarshal([]byte(payload), &u); err != nil {
		return fmt.Errorf("undo delete: unreadable entry: %w", err)
	}
	return store.UndoPersonDelete(tx, uid, &u)
}

func (s *Server) undoCharacterDelete(tx *sql.Tx, uid int64, payload string) error {
	var u store.RecordDeleteUndo
	if err := json.Unmarshal([]byte(payload), &u); err != nil {
		return fmt.Errorf("undo delete: unreadable entry: %w", err)
	}
	return store.UndoCharacterDelete(tx, uid, &u)
}

// undoCharacterMerge is undoPersonMerge for the other table.
//
// NO CREDIT SEPARATORS, and that is the whole difference. A person merge ends by
// recomposing the derived credit columns, which needs the account's own idea of
// what separates two names; nothing composes a column out of characters, so there
// is nothing here to recompose and nothing to read the preference for.
func (s *Server) undoCharacterMerge(tx *sql.Tx, uid int64, payload string) error {
	var u store.CharacterMergeUndo
	if err := json.Unmarshal([]byte(payload), &u); err != nil {
		return fmt.Errorf("undo merge: unreadable entry: %w", err)
	}
	return store.UndoCharacterMerge(tx, uid, &u)
}
