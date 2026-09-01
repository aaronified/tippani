package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// The identity endpoints: a person or a character as a RECORD, reached by id.
//
// THE EXISTING /people ENDPOINTS ARE KEYED ON A NAME and they stay that way. They
// serve the Metadata console's "who is credited in this library" view, which is a
// question about NAMES — the list is built from the credit columns and a saved row
// is folded in where one matches. Re-pointing them at ids would answer a different
// question than the screen is asking.
//
// These are the other half, and they are what the person panel and the character
// page talk to: one record, everything it is in, and the deliberate acts that say
// who somebody is — another spelling, a performer for a role.
//
// PER-USER ISOLATION IS A 404, never a 403, which is this package's standing rule:
// another account's row does not exist as far as a caller is concerned, and a 403
// would confirm that it does.

// personDetail is one record with everything a panel draws around it.
type personDetail struct {
	personRow
	SortName string `json:"sort_name"`
	Note     string `json:"note"`
	// Aliases are the other spellings that RESOLVE to this record. Not decoration:
	// each one is why a credit string somewhere lands here instead of making a
	// second person.
	Aliases []string         `json:"aliases"`
	Kinds   []string         `json:"kinds"`
	Credits []store.CreditOf `json:"credits"`
	Roles   []store.CastOf   `json:"roles"`
}

// characterRow is the global record. Deliberately NOT personRow with a flag: a
// character has a description and an appearance, a person has a birth and a death,
// and one struct carrying both would have four fields empty on every row.
type characterRow struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	SortName    string `json:"sort_name"`
	Description string `json:"description"`
	ImagePath   string `json:"image_path"`
	Note        string `json:"note"`
	Links       string `json:"links"`
}

type characterDetail struct {
	characterRow
	Aliases     []string       `json:"aliases"`
	Appearances []store.CastOf `json:"appearances"`
}

const characterCols = `c.id, c.name, c.sort_name, c.description, c.image_path, c.note, c.links`

func scanCharacter(sc interface{ Scan(...any) error }) (characterRow, error) {
	var c characterRow
	err := sc.Scan(&c.ID, &c.Name, &c.SortName, &c.Description, &c.ImagePath, &c.Note, &c.Links)
	return c, err
}

// ---- people, by id ---------------------------------------------------------

// handlePersonByID: GET /people/id/{id} — one record and everything it is in.
//
// THE PATH IS /people/id/{id} AND NOT /people/{id}, because DELETE /people/{id}
// already exists and Go's mux would route GET /people/{id} to a sibling that means
// something else. A segment that says which key follows is cheaper than renaming a
// route the client already calls.
func (s *Server) handlePersonByID(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "people")
	if !ok {
		return
	}
	olog.Tracef("[identity] person uid=%d id=%d", uid, id)
	p, err := scanPerson(s.Store.DB.QueryRow(
		`SELECT `+personCols+` FROM people p WHERE p.user_id = ? AND p.id = ?`, uid, id))
	if err != nil {
		internalError(w, r, "read person", err)
		return
	}
	out := personDetail{personRow: p}
	if err := s.Store.DB.QueryRow(
		`SELECT sort_name, note FROM people WHERE id = ?`, id).Scan(&out.SortName, &out.Note); err != nil {
		internalError(w, r, "read person identity", err)
		return
	}
	out.Kinds = s.personKindsOf(id)
	if out.Aliases, err = store.PersonAliases(s.Store.DB, uid, id); err != nil {
		internalError(w, r, "read aliases", err)
		return
	}
	if out.Credits, err = store.PersonCredits(s.Store.DB, uid, id); err != nil {
		internalError(w, r, "read credits", err)
		return
	}
	if out.Roles, err = store.PersonRoles(s.Store.DB, uid, id); err != nil {
		internalError(w, r, "read roles", err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// handleUpdatePersonByID: PUT /people/id/{id} — the identity fields.
//
// NOT THE PORTRAIT AND NOT THE BIO, which PUT /people already owns along with the
// image fetch and its rollback. This writes what 0056 added and what the panel
// edits: how the name is spelled, how it sorts, the dates, the links, and a note.
// Two handlers writing one row is a smell; two handlers writing DIFFERENT COLUMNS
// of one row, one of which also moves a file, is the smaller of the two costs.
//
// A RENAME HERE RECOMPOSES EVERY CREDIT THE PERSON HOLDS. The column caches the
// name, so changing the record without re-deriving would leave the shelf printing
// the old spelling until something else happened to touch the book.
func (s *Server) handleUpdatePersonByID(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "people")
	if !ok {
		return
	}
	var req struct {
		Name     *string `json:"name"`
		SortName *string `json:"sort_name"`
		Born     *string `json:"born"`
		Died     *string `json:"died"`
		Links    *string `json:"links"`
		Note     *string `json:"note"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	// POINTERS, SO ABSENT AND EMPTY ARE DIFFERENT. A panel that edits one field
	// sends one field; a struct of plain strings would clear every other one, which
	// is the shape of bug that eats a bio nobody was editing.
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		writeErr(w, http.StatusBadRequest, "a name is required")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin", err)
		return
	}
	defer tx.Rollback()

	set, args := []string{}, []any{}
	put := func(col string, v *string) {
		if v == nil {
			return
		}
		set = append(set, col+" = ?")
		args = append(args, strings.TrimSpace(*v))
	}
	put("name", req.Name)
	put("sort_name", req.SortName)
	put("born", req.Born)
	put("died", req.Died)
	put("links", req.Links)
	put("note", req.Note)
	if len(set) > 0 {
		// The column names are literals above, never input.
		args = append(args, id, uid)
		if _, err := tx.Exec(
			`UPDATE people SET `+strings.Join(set, ", ")+` WHERE id = ? AND user_id = ?`, args...); err != nil {
			internalError(w, r, "update person", err)
			return
		}
	}
	if req.Name != nil {
		if err := s.recomposeFor(tx, uid, id); err != nil {
			internalError(w, r, "recompose credits", err)
			return
		}
		// 0059: THE QUOTES THIS RECORD IS LINKED TO FOLLOW THE SAME RENAME, and
		// they have to. Leaving them printing the old spelling would leave the
		// record answering to a name none of its quotes carries — and the next
		// ordinary edit to any of those quotes would then resolve that old
		// spelling into a BRAND NEW person, splitting one record into two, one
		// quote at a time, from a write the reader made about something else.
		_, quotes, err := store.RenameQuotePeople(tx, uid, id, strings.TrimSpace(*req.Name))
		if err != nil {
			internalError(w, r, "rename person on quotes", err)
			return
		}
		// A renamed speaker changes a standalone quote's identity, because
		// UtteranceDedupeHash folds the speaker in. Only when one actually moved:
		// the rehash is an account-wide pass and most renames touch no quote.
		if quotes > 0 {
			if err := rehashRenamedQuotes(tx, uid); err != nil {
				internalError(w, r, "rehash quotes", err)
				return
			}
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit", err)
		return
	}
	s.handlePersonByID(w, r)
}

// recomposeFor re-derives every cached credit column a person appears in.
//
// SCOPED TO THE WORKS THEY ARE ACTUALLY ON, rather than SyncAllCredits over the
// whole account: this handler knows exactly which link rows point at the record it
// just renamed, so re-deriving the library would be work for rows that cannot have
// changed. (Rename-by-NAME still uses SyncAllCredits, and for the opposite reason —
// see handleRenamePerson, whose id list does not say which table each came from.)
func (s *Server) recomposeFor(tx *sql.Tx, uid, personID int64) error {
	rows, err := tx.Query(
		`SELECT DISTINCT kind, work_id, role FROM work_person WHERE user_id = ? AND person_id = ?`,
		uid, personID)
	if err != nil {
		return err
	}
	type ref struct {
		kind string
		id   int64
		role string
	}
	var refs []ref
	for rows.Next() {
		var v ref
		if err := rows.Scan(&v.kind, &v.id, &v.role); err != nil {
			rows.Close()
			return err
		}
		refs = append(refs, v)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	// Collected before writing: the recompose updates the table this was reading.
	seps := s.creditSeps(uid)
	for _, v := range refs {
		if err := store.RecomposeCredit(tx, uid, v.kind, v.id, store.CreditRole(v.role), seps); err != nil {
			return err
		}
	}
	return nil
}

// ---- aliases ---------------------------------------------------------------

// handlePersonAlias: POST /people/id/{id}/aliases {alias} — file another spelling.
//
// THE STORE REFUSES A SPELLING SOMEBODY HOLDS AS A NAME, and that refusal is a 409
// rather than a 500: it is a thing about the reader's library, not a fault, and the
// message is what tells them the name is taken.
func (s *Server) handlePersonAlias(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "people")
	if !ok {
		return
	}
	var req struct {
		Alias string `json:"alias"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	s.aliasWrite(w, r, func(tx *sql.Tx) error {
		return store.AddPersonAlias(tx, uid, id, req.Alias)
	})
}

// handlePersonAliasDelete: DELETE /people/id/{id}/aliases?alias=…
func (s *Server) handlePersonAliasDelete(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "people")
	if !ok {
		return
	}
	alias := r.URL.Query().Get("alias")
	s.aliasWrite(w, r, func(tx *sql.Tx) error {
		return store.RemovePersonAlias(tx, uid, id, alias)
	})
}

func (s *Server) handleCharacterAlias(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "characters")
	if !ok {
		return
	}
	var req struct {
		Alias string `json:"alias"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	s.aliasWrite(w, r, func(tx *sql.Tx) error {
		return store.AddCharacterAlias(tx, uid, id, req.Alias)
	})
}

func (s *Server) handleCharacterAliasDelete(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "characters")
	if !ok {
		return
	}
	alias := r.URL.Query().Get("alias")
	s.aliasWrite(w, r, func(tx *sql.Tx) error {
		return store.RemoveCharacterAlias(tx, uid, id, alias)
	})
}

// aliasWrite runs one alias change in its own transaction and turns the store's
// refusals into a 409 the panel can print.
func (s *Server) aliasWrite(w http.ResponseWriter, r *http.Request, fn func(*sql.Tx) error) {
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin", err)
		return
	}
	defer tx.Rollback()
	// THE STORE SAYS WHICH KIND OF ANSWER IT IS. Its refusals — empty, no such
	// record, already taken — are sentences a reader can act on, and a 500 for them
	// would log a fault every time somebody typed a name twice. A failed write is
	// neither, and this used to answer both with a 409 carrying err.Error(), which
	// reported a broken database as a disagreement about spelling.
	err = fn(tx)
	var refused *store.Refusal
	switch {
	case errors.As(err, &refused):
		writeErr(w, http.StatusConflict, refused.Error())
		return
	case err != nil:
		internalError(w, r, "alias", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- characters ------------------------------------------------------------

// handleCharacters: GET /characters — the library-wide list, with how many works
// each appears in. This is the Metadata console's character review list.
func (s *Server) handleCharacters(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[identity] characters uid=%d", uid)
	rows, err := s.Store.DB.Query(`
		SELECT `+characterCols+`,
		       (SELECT count(*) FROM work_cast wc WHERE wc.user_id = c.user_id AND wc.character_id = c.id)
		  FROM characters c WHERE c.user_id = ?
		 ORDER BY CASE WHEN c.sort_name <> '' THEN c.sort_name ELSE c.name END COLLATE NOCASE, c.id`, uid)
	if err != nil {
		internalError(w, r, "list characters", err)
		return
	}
	defer rows.Close()
	type row struct {
		characterRow
		Works int `json:"works"`
	}
	out := []row{}
	for rows.Next() {
		var v row
		if err := rows.Scan(&v.ID, &v.Name, &v.SortName, &v.Description, &v.ImagePath,
			&v.Note, &v.Links, &v.Works); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[identity] character row scan failed: %v", err)
			continue
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[identity] character iteration failed: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"characters": out})
}

// handleCharacterByID: GET /characters/{id} — one record and every work it is in.
func (s *Server) handleCharacterByID(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "characters")
	if !ok {
		return
	}
	c, err := scanCharacter(s.Store.DB.QueryRow(
		`SELECT `+characterCols+` FROM characters c WHERE c.user_id = ? AND c.id = ?`, uid, id))
	if err != nil {
		internalError(w, r, "read character", err)
		return
	}
	out := characterDetail{characterRow: c}
	if out.Aliases, err = store.CharacterAliases(s.Store.DB, uid, id); err != nil {
		internalError(w, r, "read aliases", err)
		return
	}
	if out.Appearances, err = store.CharacterAppearances(s.Store.DB, uid, id); err != nil {
		internalError(w, r, "read appearances", err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// handleCreateCharacter: POST /characters {name, …}.
//
// IT DOES NOT RESOLVE BY NAME. ResolveCharacter would find an existing "Narrator"
// and hand it back, which is exactly the welding 0056 forbids; a reader asking for
// a new character gets a new record, and linking to an existing one is a different
// act with its own endpoint.
func (s *Server) handleCreateCharacter(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	var req struct {
		Name        string `json:"name"`
		SortName    string `json:"sort_name"`
		Description string `json:"description"`
		Note        string `json:"note"`
		Links       string `json:"links"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeErr(w, http.StatusBadRequest, "a name is required")
		return
	}
	res, err := s.Store.DB.Exec(
		`INSERT INTO characters (user_id, name, sort_name, description, note, links)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		uid, req.Name, strings.TrimSpace(req.SortName), strings.TrimSpace(req.Description),
		strings.TrimSpace(req.Note), strings.TrimSpace(req.Links))
	if err != nil {
		internalError(w, r, "create character", err)
		return
	}
	id, err := res.LastInsertId()
	if err != nil {
		internalError(w, r, "create character", err)
		return
	}
	c, err := scanCharacter(s.Store.DB.QueryRow(
		`SELECT `+characterCols+` FROM characters c WHERE c.id = ?`, id))
	if err != nil {
		internalError(w, r, "reload character", err)
		return
	}
	writeJSON(w, http.StatusCreated, characterDetail{characterRow: c, Aliases: []string{}, Appearances: []store.CastOf{}})
}

// handleUpdateCharacter: PUT /characters/{id}. Same pointer rule as the person
// update — absent and empty are different things.
func (s *Server) handleUpdateCharacter(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "characters")
	if !ok {
		return
	}
	var req struct {
		Name        *string `json:"name"`
		SortName    *string `json:"sort_name"`
		Description *string `json:"description"`
		Note        *string `json:"note"`
		Links       *string `json:"links"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		writeErr(w, http.StatusBadRequest, "a name is required")
		return
	}
	set, args := []string{}, []any{}
	put := func(col string, v *string) {
		if v == nil {
			return
		}
		set = append(set, col+" = ?")
		args = append(args, strings.TrimSpace(*v))
	}
	put("name", req.Name)
	put("sort_name", req.SortName)
	put("description", req.Description)
	put("note", req.Note)
	put("links", req.Links)
	if len(set) > 0 {
		args = append(args, id, uid)
		if _, err := s.Store.DB.Exec(
			`UPDATE characters SET `+strings.Join(set, ", ")+` WHERE id = ? AND user_id = ?`, args...); err != nil {
			internalError(w, r, "update character", err)
			return
		}
	}
	s.handleCharacterByID(w, r)
}

// handleDeleteCharacter: DELETE /characters/{id}.
//
// THE CAST ROWS SURVIVE IT. 0056 made work_cast.character_id ON DELETE SET NULL,
// so deleting the global record leaves every work still listing the character by
// the name printed on it — the pairing is undone, not the cast. Deleting a record
// is "these are not one character after all", and it must not take a work's cast
// list with it.
func (s *Server) handleDeleteCharacter(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "characters")
	if !ok {
		return
	}
	if _, err := s.Store.DB.Exec(`DELETE FROM characters WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		internalError(w, r, "delete character", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- how a name prints on one work -----------------------------------------

// handleCreditAs: PUT /credits {kind, work_id, role, person_id, credit_as}.
//
// THE PANEL'S FIRST SCOPE — "on this work only" — and the endpoint is separate
// from the record update for exactly the reason the field's sub-line exists: these
// are two different acts with two different blast radii, and a single handler
// taking both would be one request away from renaming an author on every book
// they wrote.
//
// The work is addressed by its natural key rather than by a link id, because
// work_person is WITHOUT ROWID and has none — (kind, work_id, role, person_id) is
// what one credit is.
func (s *Server) handleCreditAs(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	var req struct {
		Kind     string `json:"kind"`
		WorkID   int64  `json:"work_id"`
		Role     string `json:"role"`
		PersonID int64  `json:"person_id"`
		CreditAs string `json:"credit_as"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Kind != "book" && req.Kind != "movie" {
		writeErr(w, http.StatusBadRequest, "kind must be book or movie")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin", err)
		return
	}
	defer tx.Rollback()
	if err := store.SetCreditAs(tx, uid, req.Kind, req.WorkID, store.CreditRole(req.Role),
		req.PersonID, req.CreditAs, s.creditSeps(uid)); err != nil {
		// Not found covers both "no such credit" and "not yours" — the same rule the
		// rest of this file follows, and the reason they are indistinguishable.
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- the cast pairing ------------------------------------------------------

// handleCastLink: PUT /cast/{id}/link {person_id, character_id} — say who a role
// is, and who played it.
//
// EITHER FIELD MAY BE ABSENT and each is applied only when present, so a panel
// that sets the performer does not clear the character it never mentioned. Zero is
// the CLEAR, which is why these are pointers: `0` and "not saying" are different
// answers and a plain int64 cannot hold both.
func (s *Server) handleCastLink(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid cast id")
		return
	}
	var req struct {
		PersonID    *int64 `json:"person_id"`
		CharacterID *int64 `json:"character_id"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin", err)
		return
	}
	defer tx.Rollback()
	if req.PersonID != nil {
		if err := store.LinkCastActor(tx, uid, id, *req.PersonID); err != nil {
			writeErr(w, http.StatusNotFound, err.Error())
			return
		}
	}
	if req.CharacterID != nil {
		if err := store.LinkCastCharacter(tx, uid, id, *req.CharacterID); err != nil {
			writeErr(w, http.StatusNotFound, err.Error())
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- shared ----------------------------------------------------------------

// identityTarget reads the id off the path and proves the caller owns the row.
//
// ONE PLACE, because the alternative is nine copies of an ownership check and the
// ninth is the one that is missing. A row belonging to another account answers 404
// — the package's standing rule, and the reason this returns the same status for
// "no such id" and "not yours": the two must be indistinguishable from outside.
func (s *Server) identityTarget(w http.ResponseWriter, r *http.Request, table string) (int64, int64, bool) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return 0, 0, false
	}
	uid := userID(r)
	// The table name is one of two literals from this file's own call sites.
	var n int
	q := `SELECT count(*) FROM people WHERE id = ? AND user_id = ?`
	if table == "characters" {
		q = `SELECT count(*) FROM characters WHERE id = ? AND user_id = ?`
	}
	if err := s.Store.DB.QueryRow(q, id, uid).Scan(&n); err != nil && !errors.Is(err, sql.ErrNoRows) {
		internalError(w, r, "find "+table, err)
		return 0, 0, false
	}
	if n == 0 {
		writeErr(w, http.StatusNotFound, "not found")
		return 0, 0, false
	}
	return uid, id, true
}

// handleSearchPeople: GET /people/search?q= — records by name, for a picker.
//
// IT RETURNS IDS, WHICH IS THE WHOLE POINT AND THE REASON /people/names CANNOT
// SERVE. That endpoint answers a question about NAMES: its list comes from the
// credit columns, and a record's id rides along only where the row has been filed
// under a role. A merge needs the record, and every credited name has had one
// since 0056 — so this reads the table rather than the columns.
//
// THE MATCH IS A FOLDED SUBSTRING, done in Go for the reason CastKey exists:
// SQLite's lower() is ASCII-only, so a LIKE would find "bulgakov" and miss
// "БУЛГАКОВ" on the same keystroke. Capped, because a picker shows a shortlist and
// a reader who cannot see their person types one more letter.
func (s *Server) handleSearchPeople(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	q := store.CastKey(strings.TrimSpace(r.URL.Query().Get("q")))
	// EACH HIT CARRIES ITS WEIGHT, because the one thing this list feeds is the
	// merge, and merging is destructive. Two records called "John Smith" are
	// indistinguishable by name — which is exactly the case a reader reaches for
	// this control to resolve — so the row says how much of the library hangs off
	// each of them. It is the same rule 0056 set for the character picker: a pick
	// that destroys something shows what it is about to destroy.
	//
	// AND IT IS COUNTED IN A SECOND PASS, over the twenty rows that survived the
	// filter rather than over every person in the library. The filter folds in Go
	// (CastKey; SQLite's lower() is ASCII-only — 0048's argument), so SQL cannot
	// narrow it, and counting in the first query would run two correlated
	// subqueries per person per keystroke to throw nearly all of them away.
	rows, err := s.Store.DB.Query(
		`SELECT id, name FROM people WHERE user_id = ? ORDER BY name COLLATE NOCASE`, uid)
	if err != nil {
		internalError(w, r, "search people", err)
		return
	}
	defer rows.Close()
	type hit struct {
		ID    int64  `json:"id"`
		Name  string `json:"name"`
		Works int    `json:"works"`
	}
	out := []hit{}
	const max = 20
	for rows.Next() && len(out) < max {
		var h hit
		if err := rows.Scan(&h.ID, &h.Name); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[identity] people search row scan failed: %v", err)
			continue
		}
		if q != "" && !strings.Contains(store.CastKey(h.Name), q) {
			continue
		}
		out = append(out, h)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[identity] people search iteration failed: %v", err)
	}
	for i := range out {
		if err := s.Store.DB.QueryRow(
			`SELECT (SELECT count(*) FROM work_person WHERE user_id = ? AND person_id = ?)
			      + (SELECT count(*) FROM work_cast   WHERE user_id = ? AND actor_id  = ?)`,
			uid, out[i].ID, uid, out[i].ID).Scan(&out[i].Works); err != nil {
			// The row still lists, with a zero it did not earn — a hit missing from
			// the picker is worse than a hit whose weight failed to read, and the
			// log is where the failure is recorded.
			olog.Warnf(olog.CodePeopleRowScan, "[identity] people search count for %d: %v", out[i].ID, err)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"people": out})
}

// ---- merge, and its undo ----------------------------------------------------

// handleMergePeople: POST /people/merge {keep_id, drop_id}.
//
// THE ONE DESTRUCTIVE ACT IN THE IDENTITY MODEL, and the only one that writes a
// bin entry. The pack's own design stops at "merge asks first, and the confirm
// says so"; this app's standing promise is that the bin holds what you destroy,
// which is the stronger of the two, so the merge returns a reversal and parks it
// where every other undoable act in this app parks one.
//
// THE ENTRY IS NOT A SNAPSHOT AND CANNOT USE THE GENERIC RESTORE. A merge does not
// delete the rows it changes, it re-points them — so the keys are still occupied
// and the bin's row-by-row INSERT would collide on every one. `person-merge` gets
// its own branch in handleRestoreTrash, which applies store.UndoPersonMerge.
func (s *Server) handleMergePeople(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	var req struct {
		KeepID int64 `json:"keep_id"`
		DropID int64 `json:"drop_id"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin", err)
		return
	}
	defer tx.Rollback()

	// The label is read BEFORE the merge, because one of the two rows is about to
	// stop existing and the bin's row is what a reader reads to decide whether to
	// undo it.
	var keepName, dropName string
	if err := tx.QueryRow(`SELECT name FROM people WHERE user_id = ? AND id = ?`, uid, req.KeepID).Scan(&keepName); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err := tx.QueryRow(`SELECT name FROM people WHERE user_id = ? AND id = ?`, uid, req.DropID).Scan(&dropName); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}

	// A REFUSAL AND A FAULT ARE DIFFERENT ANSWERS. "You cannot merge a record into
	// itself" is something the reader can act on and is theirs to see; a database
	// that failed is neither, and answering both with a 409 carrying err.Error()
	// reported a broken database as a disagreement about identity and put the SQL
	// in a toast. store.Refusal is which one the store is returning.
	undo, err := store.MergePeople(tx, uid, req.KeepID, req.DropID, s.creditSeps(uid))
	var refused *store.Refusal
	switch {
	case errors.As(err, &refused):
		writeErr(w, http.StatusConflict, refused.Error())
		return
	case err != nil:
		internalError(w, r, "merge people", err)
		return
	}
	payload, err := json.Marshal(undo)
	if err != nil {
		internalError(w, r, "merge: write the undo", err)
		return
	}
	res, err := tx.Exec(
		`INSERT INTO trash (user_id, kind, label, child_count, payload, files)
		 VALUES (?, 'person-merge', ?, ?, ?, '[]')`,
		uid, dropName+" → "+keepName, len(undo.Credits), string(payload))
	if err != nil {
		internalError(w, r, "merge: park the undo", err)
		return
	}
	trashID, err := res.LastInsertId()
	if err != nil {
		internalError(w, r, "merge: park the undo", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "id": req.KeepID, "trash_id": trashID, "works": len(undo.Credits),
	})
}

// handleSplitAlias: POST /people/id/{id}/split {alias} — one spelling back into a
// record of its own.
//
// IT DOES NOT MOVE THE WORKS, and the response says how many stayed so the client
// can say so too. That is the pack's documented limit rather than a shortcut:
// nothing in the schema remembers which work was credited to the record that got
// folded in, and inventing an answer would be worse than saying there isn't one.
func (s *Server) handleSplitAlias(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "people")
	if !ok {
		return
	}
	var req struct {
		Alias string `json:"alias"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin", err)
		return
	}
	defer tx.Rollback()
	made, err := store.SplitPersonAlias(tx, uid, id, req.Alias)
	var refused *store.Refusal
	switch {
	case errors.As(err, &refused):
		writeErr(w, http.StatusConflict, refused.Error())
		return
	case err != nil:
		internalError(w, r, "split alias", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit", err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": made})
}
