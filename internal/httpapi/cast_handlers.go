package httpapi

import (
	"database/sql"
	"errors"
	"net/http"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// The cast editor's six routes (0048).
//
// Until now a work's cast was `movies.cast_json`, a blob a metadata fetch wrote
// whole and no screen could edit. These are what make it a list the reader owns:
// read it, add to it, correct it, remove from it. The rule the table exists to
// enforce — A REFETCH NEVER OVERWRITES A ROW THE READER HAS TOUCHED — is argued
// in 0048's header, and two thirds of it live here rather than in the merge:
// every write below is what MARKS a row as the reader's, and the delete is what
// leaves a tombstone for the merge to recognise.
//
// The shape follows the read log's (read_history_handlers.go) exactly: the
// work-scoped verbs nest under the work and one handler is parameterised by
// kind, while the row-scoped verbs are flat under the row's own id — a cast row
// id is unique across both kinds, so `PUT /cast/{id}` needs no second word to
// say which shelf it came from.
//
// THERE IS NO SCREEN FOR ANY OF THIS YET, deliberately: the work pages are being
// redesigned and the cast editor is a pending design. Nothing here writes a
// user-facing label for that reason — the actor / voice-actor / no-actor
// distinction ships as `actor_role`, a machine value, so the English and the
// Bengali land in the same commit as the screen that renders them.

// castEdit is the body for creating or correcting one row. Two fields, and every
// other column is the provider's: sending person_id, image_url, billing, origin
// or source is not an error and not honoured.
type castEdit struct {
	Character string `json:"character"`
	Actor     string `json:"actor"`
}

// validate trims both fields and applies the one rule that differs by kind.
//
// A BOOK IS REFUSED AN ACTOR RATHER THAN QUIETLY CLEARED. 0047 drew that line
// and it is followed: the API rejects a field the kind does not have, while an
// IMPORT clears one, because an import is a file somebody already wrote and a
// request is somebody asking now. Both halves of that rule are live —
// applyImportedCast is the clearing half, and it exists because a work's cast
// round-trips through the Markdown export, so a film's file retargeted onto a
// book must lose its actors rather than fail.
func (e *castEdit) validate(role string) string {
	var ok bool
	if e.Character, ok = trimCap(e.Character, maxCastName); !ok {
		return "that character's name is too long"
	}
	if e.Actor, ok = trimCap(e.Actor, maxCastName); !ok {
		return "that actor's name is too long"
	}
	if e.Character == "" {
		// A provider may seed a row with no character — TMDB does it whenever a
		// person's Roles array is empty — and the column has a default so that
		// such a row can be stored. Nobody may type one: a nameless row in a list
		// the reader maintains is a row they cannot find again.
		return "a cast row needs a character"
	}
	if role == actorRoleNone && e.Actor != "" {
		return "a book has characters, not a cast — a novel has speakers"
	}
	return ""
}

// castWork resolves the work a cast list belongs to, scoped to the caller, and
// reports what its second column is called.
//
// OWNERSHIP IS RESOLVED HERE AND NOWHERE ELSE for the work-scoped verbs. work_cast
// has no foreign key to books or movies — 0024's reason, that SQLite cannot point
// one column at two tables — so nothing but this check stops a row being attached
// to somebody else's shelf. A foreign work is 404, never 403: a 403 confirms the
// row exists.
func (s *Server) castWork(uid int64, kind string, workID int64) (role string, ok bool) {
	if kind == "book" {
		var one int
		if err := s.Store.DB.QueryRow(
			`SELECT 1 FROM books WHERE id = ? AND user_id = ?`, workID, uid).Scan(&one); err != nil {
			return "", false
		}
		return actorRoleNone, true
	}
	var mediaType string
	if err := s.Store.DB.QueryRow(
		`SELECT COALESCE(media_type, 'movie') FROM movies WHERE id = ? AND user_id = ?`,
		workID, uid).Scan(&mediaType); err != nil {
		return "", false
	}
	return actorRole(kind, mediaType), true
}

// castOwner reads one row's identity, scoped to the caller. A row that is not
// theirs is not found.
func (s *Server) castOwner(uid, castID int64) (kind string, workID int64, origin, providerKey string, err error) {
	err = s.Store.DB.QueryRow(
		`SELECT kind, work_id, origin, provider_key FROM work_cast WHERE id = ? AND user_id = ?`,
		castID, uid).Scan(&kind, &workID, &origin, &providerKey)
	return
}

// castPairTaken reports the id and origin of the row already holding this folded
// pair on this work, if any. `exclude` is the row being edited, so correcting the
// capitalisation of a name does not collide with itself.
//
// It looks at tombstones too, and the caller decides what to do with one: an ADD
// revives it, an EDIT refuses it. That asymmetry is deliberate — typing a
// character back is the reader undoing their own deletion, while renaming some
// other row on top of a tombstone would silently resurrect a deletion they never
// mentioned.
//
// A QUERY FAILURE IS NOT A "NO", and the two are told apart because collapsing
// them cost the caller its answer. This used to swallow every error into
// found=false, so a genuine read failure sent the add on to its INSERT — which
// then hit idx_work_cast_pair and surfaced as a raw unique-index 500, on a request
// whose real answer was either the 409 "already on this list" or a coded error
// naming the check that failed. sql.ErrNoRows is the only "no" there is.
func castPairTaken(tx *sql.Tx, uid int64, kind string, workID int64, charKey, actorKey string, exclude int64) (id int64, origin string, found bool, err error) {
	// A LIVE ROW IS REPORTED IN PREFERENCE TO A TOMBSTONE. The pair unique is
	// partial, so one live row and any number of tombstones can share a pair, and
	// the answer that matters is "is this pair on the list now?".
	err = tx.QueryRow(
		`SELECT id, origin FROM work_cast
		 WHERE user_id = ? AND kind = ? AND work_id = ? AND character_key = ? AND actor_key = ? AND id <> ?
		 ORDER BY CASE origin WHEN ? THEN 1 ELSE 0 END, id LIMIT 1`,
		uid, kind, workID, charKey, actorKey, exclude, castRemoved).Scan(&id, &origin)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return 0, "", false, nil
	case err != nil:
		return 0, "", false, err
	}
	return id, origin, true, nil
}

// handleListCast: GET /books|movies/{id}/cast.
func (s *Server) handleListCast(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workID, ok := pathID(r)
		if !ok {
			writeErr(w, http.StatusBadRequest, "invalid id")
			return
		}
		uid := userID(r)
		role, ok := s.castWork(uid, kind, workID)
		if !ok {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		// EVERY CHARACTER THIS WORK'S OWN QUOTES NAME IS ONE OF ITS PEOPLE, and this
		// is the one place that is made true — see cast_from_quotes.go for why the
		// list and not the six save paths. Costs one SELECT once every name is on.
		s.adoptQuoteCharacters(uid, kind, workID)
		rows, err := loadCast(s.Store.DB, kind, workID)
		if err != nil {
			codedError(w, r, olog.CodeCastRowScan, "list cast", err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"cast": rows, "actor_role": role})
	}
}

// handleAddCast: POST /books|movies/{id}/cast — a character the provider never
// listed, or never could.
//
// This is the endpoint the whole feature is for. Every game whose Wikidata
// lookup came back empty — most of them, per TIP-META-018 — has had no way to
// name a voice actor at all, and no way to correct a film's minor role either.
func (s *Server) handleAddCast(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workID, ok := pathID(r)
		if !ok {
			writeErr(w, http.StatusBadRequest, "invalid id")
			return
		}
		var req castEdit
		if !decodeBody(w, r, &req) {
			return
		}
		uid := userID(r)
		role, ok := s.castWork(uid, kind, workID)
		if !ok {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		if msg := req.validate(role); msg != "" {
			writeErr(w, http.StatusBadRequest, msg)
			return
		}
		olog.Tracef("[cast] handleAddCast uid=%v kind=%s work=%v", uid, kind, workID)

		// One transaction, because the duplicate check, the cap and the billing
		// are all read-then-write: two tabs pressing Add at once are two request
		// goroutines on one file, and a check outside the write would let both
		// through.
		tx, err := s.Store.DB.Begin()
		if err != nil {
			internalError(w, r, "add cast", err)
			return
		}
		defer tx.Rollback()

		// THE CAP ANSWERS TO BOTH PATHS BELOW, which is why it is a closure and not
		// two copies. A revive puts a row back on the live list exactly as an insert
		// does, and the revive branch used to skip the check the insert applies
		// twenty lines further down — so deleting a row and typing it straight back
		// walked a full list past maxWorkCast, one pair at a time. It counts live
		// rows only, because a tombstone is not on the list it is capping.
		castListFull := func() (bool, error) {
			var live int
			err := tx.QueryRow(
				`SELECT COUNT(*) FROM work_cast WHERE kind = ? AND work_id = ? AND origin <> ?`,
				kind, workID, castRemoved).Scan(&live)
			return live >= maxWorkCast, err
		}

		charKey, actorKey := store.CastKey(req.Character), store.CastKey(req.Actor)
		id, origin, found, err := castPairTaken(tx, uid, kind, workID, charKey, actorKey, 0)
		if err != nil {
			internalError(w, r, "check cast pair", err)
			return
		}
		if found {
			if origin != castRemoved {
				writeErr(w, http.StatusConflict, "that character and actor are already on this list")
				return
			}
			// The cap is checked BEFORE the row is revived and AFTER the 409 above: a
			// pair that is already live has nothing to add and is told so, whether the
			// list is full or not.
			full, cerr := castListFull()
			if cerr != nil {
				internalError(w, r, "count cast", cerr)
				return
			}
			if full {
				writeErr(w, http.StatusBadRequest, "this cast list is full")
				return
			}
			// REVIVED IN PLACE rather than inserted beside the tombstone, and its
			// provider_key is KEPT: this pair came from a provider once, so the
			// next fetch must go on matching it — to a live row now instead of to
			// a tombstone. 'corrected' because the row is the reader's again and a
			// refetch may no longer rewrite the name on it.
			if _, err := tx.Exec(
				`UPDATE work_cast SET character = ?, character_key = ?, actor = ?, actor_key = ?,
				        origin = ?, updated_at = datetime('now')
				 WHERE id = ? AND user_id = ?`,
				req.Character, charKey, req.Actor, actorKey, castCorrected, id, uid); err != nil {
				internalError(w, r, "revive cast row", err)
				return
			}
			row, err := scanCastRow(tx.QueryRow(`SELECT `+castCols+` FROM work_cast WHERE id = ?`, id))
			if err != nil {
				internalError(w, r, "read revived cast row", err)
				return
			}
			if err := tx.Commit(); err != nil {
				internalError(w, r, "add cast: commit", err)
				return
			}
			writeJSON(w, http.StatusCreated, row)
			return
		}

		full, err := castListFull()
		if err != nil {
			internalError(w, r, "count cast", err)
			return
		}
		if full {
			writeErr(w, http.StatusBadRequest, "this cast list is full")
			return
		}
		// MAX(billing)+1, so a hand-typed uncredited role sorts after the billed
		// cast rather than sharing position 0 with the lead. COALESCE(...,-1)
		// makes the first row on an empty work billing 0, which is what a
		// provider's first entry would have been.
		var billing int
		if err := tx.QueryRow(
			`SELECT COALESCE(MAX(billing), -1) + 1 FROM work_cast WHERE kind = ? AND work_id = ?`,
			kind, workID).Scan(&billing); err != nil {
			internalError(w, r, "next billing", err)
			return
		}
		res, err := tx.Exec(
			`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key,
			                        billing, origin)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			uid, kind, workID, req.Character, charKey, req.Actor, actorKey, billing, castReader)
		if err != nil {
			internalError(w, r, "add cast", err)
			return
		}
		id, _ = res.LastInsertId()
		if err := tx.Commit(); err != nil {
			internalError(w, r, "add cast: commit", err)
			return
		}
		writeJSON(w, http.StatusCreated, castRow{
			ID: id, Character: req.Character, Actor: req.Actor,
			Billing: billing, Origin: castReader,
		})
	}
}

// handleUpdateCast: PUT /cast/{id} — correcting a name.
//
// THIS IS WHERE A PROVIDER ROW BECOMES THE READER'S. 'provider' is lifted to
// 'corrected', and from then on a refetch may update the billing, the person id,
// the portrait and the source on this row and may not touch the two names. What
// that costs is stated in 0048's header and is worth restating at the site: a
// name corrected wrongly stays wrong even after the provider agrees with the
// truth, and the way back is to delete the row and let a fetch re-seed it.
func (s *Server) handleUpdateCast(w http.ResponseWriter, r *http.Request) {
	castID, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req castEdit
	if !decodeBody(w, r, &req) {
		return
	}
	uid := userID(r)
	kind, workID, origin, _, err := s.castOwner(uid, castID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "cast row not found")
		return
	case err != nil:
		internalError(w, r, "load cast row", err)
		return
	case origin == castRemoved:
		// A tombstone is not a row. It exists so a refetch can decline to bring a
		// deletion back, and it is reachable only by adding the pair again.
		writeErr(w, http.StatusNotFound, "cast row not found")
		return
	}
	role, ok := s.castWork(uid, kind, workID)
	if !ok {
		writeErr(w, http.StatusNotFound, "cast row not found")
		return
	}
	if msg := req.validate(role); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "update cast", err)
		return
	}
	defer tx.Rollback()

	charKey, actorKey := store.CastKey(req.Character), store.CastKey(req.Actor)
	_, other, found, err := castPairTaken(tx, uid, kind, workID, charKey, actorKey, castID)
	if err != nil {
		internalError(w, r, "check cast pair", err)
		return
	}
	if found {
		if other == castRemoved {
			// Renaming ONE row on top of another's tombstone would resurrect a
			// deletion nobody mentioned, so it is refused rather than merged. The
			// reader can add the pair, which revives the tombstone knowingly.
			writeErr(w, http.StatusConflict, "that character and actor were removed from this list")
			return
		}
		writeErr(w, http.StatusConflict, "that character and actor are already on this list")
		return
	}
	next := origin
	if origin == castProvider {
		next = castCorrected
	}
	if _, err := tx.Exec(
		`UPDATE work_cast SET character = ?, character_key = ?, actor = ?, actor_key = ?,
		        origin = ?, updated_at = datetime('now')
		 WHERE id = ? AND user_id = ?`,
		req.Character, charKey, req.Actor, actorKey, next, castID, uid); err != nil {
		internalError(w, r, "update cast", err)
		return
	}
	row, err := scanCastRow(tx.QueryRow(`SELECT `+castCols+` FROM work_cast WHERE id = ?`, castID))
	if err != nil {
		internalError(w, r, "read cast row", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "update cast: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, row)
}

// handleDeleteCast: DELETE /cast/{id}.
//
// TWO DIFFERENT DELETES, and which one runs is decided by whether a provider
// ever listed this row:
//
//   - a row with a provider_key is TOMBSTONED — origin='removed', both names and
//     the provider key left intact — because the next fetch will list that
//     person again and something has to tell it not to. Hard-deleting would make
//     every refetch undo the deletion, silently, for ever.
//   - a reader-authored row, the ones carrying no provider key at all, is HARD-
//     DELETED, because nothing will ever re-add it and a tombstone for it would
//     be litter that only the pair unique can see.
//
// THE SECOND RULE'S PREMISE CHANGED IN 2.2.8, and this is where it had to be paid
// for. Something DOES re-add a reader row now: a character named on one of the
// work's own quotes is adopted onto its cast (cast_from_quotes.go), which is the
// whole of "the characters i already entered in quotes are not populating that
// list". Left as it was, deleting such a character hard-deleted the row and the
// very next read put it straight back — for ever, with the delete button looking
// broken rather than declined. So the condition is no longer "did a provider list
// this?" but the question that was always underneath it: WILL ANYTHING RE-ADD IT?
// A quoted character is tombstoned; a row nothing names anywhere is still deleted
// outright, and the litter argument survives for the rows it was made about.
//
// Either way the reply is 204 and the row is gone from every read: loadCast
// excludes tombstones. A tombstone is reaped when its work is deleted, by the
// two triggers 0048 adds.
func (s *Server) handleDeleteCast(w http.ResponseWriter, r *http.Request) {
	castID, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	uid := userID(r)
	kind, workID, origin, providerKey, err := s.castOwner(uid, castID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "cast row not found")
		return
	case err != nil:
		internalError(w, r, "load cast row", err)
		return
	case origin == castRemoved:
		writeErr(w, http.StatusNotFound, "cast row not found")
		return
	}
	if providerKey == "" && !s.characterIsQuoted(uid, kind, workID, castID) {
		if _, err := s.Store.DB.Exec(
			`DELETE FROM work_cast WHERE id = ? AND user_id = ?`, castID, uid); err != nil {
			internalError(w, r, "delete cast row", err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE work_cast SET origin = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
		castRemoved, castID, uid); err != nil {
		internalError(w, r, "tombstone cast row", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// characterIsQuoted reports whether this cast row's character is named on one of
// the work's own quotes — which is to say, whether adoption would put the row
// back the moment it was deleted. See handleDeleteCast's header.
//
// Best-effort in the direction that costs least: an error here answers "yes", so
// the row is tombstoned rather than deleted. A tombstone too many is one dead row
// nobody can see; a hard delete too many is a deletion that undoes itself.
func (s *Server) characterIsQuoted(uid int64, kind string, workID, castID int64) bool {
	var key string
	if err := s.Store.DB.QueryRow(
		`SELECT character_key FROM work_cast WHERE id = ? AND user_id = ?`, castID, uid).Scan(&key); err != nil {
		return true
	}
	if key == "" {
		return false
	}
	named, err := s.quoteCharacters(uid, kind, workID)
	if err != nil {
		return true
	}
	for _, c := range named {
		if c.key == key {
			return true
		}
	}
	return false
}
