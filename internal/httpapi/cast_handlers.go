package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

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
	// A POINTER, unlike the two above, and that asymmetry is the contract rather
	// than an oversight. The two names are what a cast row IS — an edit that omits
	// them is not an edit — while the per-work description is one more field on a
	// row several screens save, and a plain string would let the cast panel's
	// Save, which has no box for it, clear what the character page wrote. Absent
	// leaves it; empty clears it.
	Description *string `json:"description"`
	// ── 0063'S SIX, ALL POINTERS, and Description's reason applies to each of
	// them with more force: five screens save this row now — the cast panel, and
	// the character screen in each of its four scopes — and no one of them has a
	// box for every field. A plain string would let the cast panel's Save, which
	// has boxes for two names, clear the note a film screen wrote about a dub.
	// Absent leaves it; empty clears it.
	CreditNote   *string `json:"credit_note"`
	CreditLang   *string `json:"credit_lang"`
	Part         *string `json:"part"`
	FirstAppears *string `json:"first_appears"`
	AgeHere      *string `json:"age_here"`
	Aliases      *string `json:"aliases"`
}

// creditFields pairs each of 0063's optional fields with its column and its cap,
// so the validator and the set-builder walk one list. Two loops over two
// hand-written lists is how a field arrives that validates and never stores.
func (e *castEdit) creditFields() []struct {
	col string
	val **string
	cap int
} {
	return []struct {
		col string
		val **string
		cap int
	}{
		{"credit_note", &e.CreditNote, maxCastDescription},
		// A LANGUAGE IS SHORT AND A NOTE IS NOT. Capping the language at a name's
		// length is not tidiness: this field is what tells two otherwise identical
		// dub rows apart, and a paragraph in it reads as a note in the wrong box.
		{"credit_lang", &e.CreditLang, maxCastName},
		{"part", &e.Part, maxCastName},
		{"first_appears", &e.FirstAppears, maxCastName},
		{"age_here", &e.AgeHere, maxCastName},
		// The per-work spellings, one per line, so this takes a description's cap
		// rather than a name's — it holds several names.
		{"aliases", &e.Aliases, maxCastDescription},
	}
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
	if e.Description != nil {
		d, ok := trimCap(*e.Description, maxCastDescription)
		if !ok {
			return "that description is too long"
		}
		e.Description = &d
	}
	for _, f := range e.creditFields() {
		if *f.val == nil {
			continue
		}
		v, ok := trimCap(**f.val, f.cap)
		if !ok {
			return "that " + f.col + " is too long"
		}
		*f.val = &v
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
	var mediaType, castRole string
	if err := s.Store.DB.QueryRow(
		`SELECT COALESCE(media_type, 'movie'), cast_role FROM movies WHERE id = ? AND user_id = ?`,
		workID, uid).Scan(&mediaType, &castRole); err != nil {
		return "", false
	}
	return actorRoleOr(kind, mediaType, castRole), true
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
	// A CREDIT WITH NOBODY NAMED IS NOT A PAIR, so no LIVE row can take it (0063).
	//
	// This guard and idx_work_cast_pair were one rule in two places, and 0063
	// changed the rule in one of them: a work may hold any number of credits
	// waiting for a name — the design pack's film screen holds two, a flashback
	// nobody has cast and a dub nobody has named — while a named duplicate stays
	// refused, which is what the refetch merge relies on. Leaving this half
	// behind made the index permissive and the request still a 409, which is the
	// worse of the two failures: the schema says yes and the app says no.
	//
	// A TOMBSTONE IS STILL FOUND, and this is the half that must not be lost with
	// it. ON A BOOK EVERY CHARACTER HAS AN EMPTY actor_key — a novel has speakers,
	// not a cast — so a blanket "an empty name is never taken" stops the revival
	// path for every book character there is: delete Behemoth, add Behemoth, and
	// instead of the row coming back with its description you get a second row and
	// a tombstone nobody can reach. The index never covered tombstones either, so
	// nothing about 0063 touches them.
	where, args := `AND actor_key = ?`, []any{actorKey}
	if actorKey == "" {
		where, args = `AND actor_key = '' AND origin = ?`, []any{castRemoved}
	}
	// A LIVE ROW IS REPORTED IN PREFERENCE TO A TOMBSTONE. The pair unique is
	// partial, so one live row and any number of tombstones can share a pair, and
	// the answer that matters is "is this pair on the list now?".
	q := `SELECT id, origin FROM work_cast
	       WHERE user_id = ? AND kind = ? AND work_id = ? AND character_key = ? ` + where + ` AND id <> ?
	       ORDER BY CASE origin WHEN ? THEN 1 ELSE 0 END, id LIMIT 1`
	all := append([]any{uid, kind, workID, charKey}, args...)
	all = append(all, exclude, castRemoved)
	err = tx.QueryRow(q, all...).Scan(&id, &origin)
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
			// The description follows the pointer's contract here too: sent, it lands
			// on the revived row; absent, the tombstone's own description survives,
			// which is the same "absent leaves it" the PUT means.
			set := `character = ?, character_key = ?, actor = ?, actor_key = ?, origin = ?`
			args := []any{req.Character, charKey, req.Actor, actorKey, castCorrected}
			if req.Description != nil {
				set += `, description = ?`
				args = append(args, *req.Description)
			}
			// AND THE SIX ON THIS BRANCH AS WELL, for the insert's reason. Reviving a
			// tombstoned row is the other way a POST creates a visible credit, so a
			// language dropped here is the same silent loss by a different door — and
			// re-adding a dub somebody had removed is exactly when it happens.
			for _, f := range req.creditFields() {
				if *f.val == nil {
					continue
				}
				set += ", " + f.col + " = ?"
				args = append(args, **f.val)
			}
			args = append(args, id, uid)
			if _, err := tx.Exec(
				`UPDATE work_cast SET `+set+`, updated_at = datetime('now')
				 WHERE id = ? AND user_id = ?`, args...); err != nil {
				internalError(w, r, "revive cast row", err)
				return
			}
			// A tombstone may predate 0056, or may have lost its character record to
			// a delete while it lay there. Filling a null link on the way back is
			// the difference between a revived row that the character list can see
			// and one it cannot; a link still on the row is left exactly as it was.
			if err := store.LinkCastRow(tx, uid, id); err != nil {
				internalError(w, r, "link revived cast row", err)
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
		// `description` IS ON THE INSERT because it is on the body: castEdit accepts
		// it, PUT honours it, and a POST that dropped it made "add the character,
		// then describe it" two requests where the caller had sent one — silently,
		// with a 201 carrying the empty description back.
		// A CHARACTER RECORD FOR THE ROW — the same rule as every other writer of
		// this table, and see cast.go's insert for why a row without one is a chip
		// that opens nothing. A hand-added cast row is the path where the reader is
		// most obviously naming somebody they mean to be able to open.
		desc := ""
		if req.Description != nil {
			desc = *req.Description
		}
		// 0063'S SIX ARE WRITTEN HERE TOO, and until this line they were not.
		//
		// `castEdit` declares all six, `validate` checks and caps all six, and the
		// PUT path writes all six by walking `creditFields()` — but this INSERT
		// named `description` and nothing else. So a POST carrying a language was
		// validated, accepted, answered 201, and silently dropped it. That is worse
		// than a rejection: the "Add a dubbing credit" row on the character sheet
		// sends `credit_lang`, and `credit_lang` is the ONLY thing that makes a
		// credit a dub — `creditsFor` splits on it — so the row came back filed
		// under the original cast with the language gone, and nothing anywhere said
		// so. A write that succeeds while the screen denies it.
		//
		// The columns are appended rather than listed inline because the set is
		// `creditFields()`'s to define: a seventh field added there must not be
		// able to arrive in the validator and miss the writer, which is exactly
		// how these six did.
		cols := []string{"user_id", "kind", "work_id", "character", "character_key", "actor", "actor_key",
			"billing", "origin", "description"}
		vals := []any{uid, kind, workID, req.Character, charKey, req.Actor, actorKey, billing, castReader, desc}
		for _, f := range req.creditFields() {
			if *f.val == nil {
				continue
			}
			cols = append(cols, f.col)
			vals = append(vals, **f.val)
		}
		res, err := tx.Exec(
			`INSERT INTO work_cast (`+strings.Join(cols, ", ")+`)
			 VALUES (`+inClause(len(vals))+`)`, vals...)
		if err != nil {
			internalError(w, r, "add cast", err)
			return
		}
		id, _ = res.LastInsertId()
		// THE ROW GETS ITS RECORDS IN THE SAME TRANSACTION that wrote it. A cast
		// row whose character exists nowhere is a character the review list cannot
		// show and a quote's speaker cannot point at — which is what the whole of
		// 0056 was for.
		if err := store.LinkCastRow(tx, uid, id); err != nil {
			internalError(w, r, "link cast row", err)
			return
		}
		// READ BACK RATHER THAN HAND-BUILT, which the revive branch above has always
		// done and this one did not. LinkCastRow has just written character_id and
		// actor_id onto the row, and a body assembled from the request cannot carry
		// them — so the one reply that says "here is your new cast row" was the one
		// reply with no way to open the character it had just created.
		row, err := scanCastRow(tx.QueryRow(`SELECT `+castCols+` FROM work_cast WHERE id = ?`, id))
		if err != nil {
			internalError(w, r, "read new cast row", err)
			return
		}
		if err := tx.Commit(); err != nil {
			internalError(w, r, "add cast: commit", err)
			return
		}
		writeJSON(w, http.StatusCreated, row)
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
	set := `character = ?, character_key = ?, actor = ?, actor_key = ?,
	        origin = ?, updated_at = datetime('now')`
	args := []any{req.Character, charKey, req.Actor, actorKey, next}
	if req.Description != nil {
		set += ", description = ?"
		args = append(args, *req.Description)
	}
	for _, f := range req.creditFields() {
		if *f.val == nil {
			continue
		}
		set += ", " + f.col + " = ?"
		args = append(args, **f.val)
	}
	args = append(args, castID, uid)
	if _, err := tx.Exec(
		`UPDATE work_cast SET `+set+` WHERE id = ? AND user_id = ?`, args...); err != nil {
		internalError(w, r, "update cast", err)
		return
	}
	// A row that predates 0056 gets its records the first time somebody corrects
	// it. It does NOT get re-pointed: this handler changes what THIS work prints,
	// and re-aiming the record at whatever the new spelling resolves to would make
	// a typo fix into a silent identity change on every other work the record is on.
	if err := store.LinkCastRow(tx, uid, castID); err != nil {
		internalError(w, r, "link cast row", err)
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
