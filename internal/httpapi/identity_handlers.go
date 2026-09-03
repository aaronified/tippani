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
	// Lines are the quotes that POINT AT this record — 0059's dialogues.actor_id
	// and utterances.speaker_id, which were written from the day they landed and
	// read by nothing until here.
	//
	// SharedLines is how many further quotes name this person ALONGSIDE SOMEBODY
	// ELSE and are therefore not linked at all. It is reported rather than folded
	// into the list because the linker's refusal to guess is deliberate — a
	// two-hander has no honest single speaker — and a panel that listed only the
	// linked ones would be quietly wrong about how many lines this person has.
	Lines       []store.QuoteLine `json:"lines"`
	SharedLines int               `json:"shared_lines"`
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
	// IN-WORLD, WHERE A WORK STATES IT (0063). A person has had `born` and `died`
	// since the table existed, because a person is a person; a character had
	// neither, so a birthday a book prints on the page had nowhere to go. Only
	// `born`: a character's death is a plot point and belongs in the description a
	// reader writes, not in a field the app prints beside their name.
	Born string `json:"born"`
}

type characterDetail struct {
	characterRow
	Aliases     []string       `json:"aliases"`
	Appearances []store.CastOf `json:"appearances"`
	// Lines are the quotes that POINT AT this character through their cast row —
	// the question the fold could never answer, because "which quotes are this
	// role's" has no honest answer over a text column. See store/quote_cast.go.
	//
	// SharedLines is how many further quotes name this character ALONGSIDE somebody
	// else and are therefore not linked at all. Reported rather than folded in,
	// exactly as the person panel does it: the linker's refusal to guess on a
	// two-hander is deliberate, and a list of only the linked ones would be quietly
	// wrong about how much this character has said.
	Lines       []store.QuoteLine `json:"lines"`
	SharedLines int               `json:"shared_lines"`
}

const characterCols = `c.id, c.name, c.sort_name, c.description, c.image_path, c.note, c.links, c.born`

func scanCharacter(sc interface{ Scan(...any) error }) (characterRow, error) {
	var c characterRow
	err := sc.Scan(&c.ID, &c.Name, &c.SortName, &c.Description, &c.ImagePath, &c.Note, &c.Links, &c.Born)
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
	// CAPPED, AND THE COUNT IS NOT. personLineCap bounds what the panel draws; the
	// shared count walks the unlinked rows whatever the cap, because it is the
	// number that would otherwise be silently wrong.
	if out.Lines, out.SharedLines, err = store.PersonLines(s.Store.DB, uid, id, s.creditSeps(uid), personLineCap); err != nil {
		internalError(w, r, "read lines", err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// personLineCap is how many of a person's lines the record carries.
//
// A PANEL, NOT A SEARCH RESULT. Somebody with four hundred linked lines wants the
// recent ones and a way to see the rest, and the way to see the rest is the search
// screen, which is built for it. Fifty is enough that a normal record is complete
// and a heavy one is obviously truncated.
const personLineCap = 50

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
		Bio      *string `json:"bio"`
		Born     *string `json:"born"`
		Died     *string `json:"died"`
		Links    *string `json:"links"`
		Note     *string `json:"note"`
		// THE PORTRAIT, BY RECORD ID. It has only ever been settable through
		// `PUT /people`, which upserts by (kind, name) and lands on the LOWEST id
		// where two records share one — so choosing a picture for the second of two
		// namesakes put it on the first, and the record panel, which is the one
		// surface that knows which record it is looking at, could not offer a
		// portrait at all. Same two fields and the same fetcher as the upsert: a URL
		// the reader chose is fetched with no host allowlist, because their picture
		// is wherever they found it.
		ImageURL   string `json:"image_url"`
		ClearImage bool   `json:"clear_image"`
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
	// THE FETCH HAPPENS BEFORE THE TRANSACTION, and it has to: it is a network
	// round trip, and holding SQLite's single write lock open across one would
	// block every other writer for as long as the far end takes to answer.
	var oldImage, newImage string
	changeImage := req.ClearImage || req.ImageURL != ""
	if changeImage {
		if err := s.Store.DB.QueryRow(
			`SELECT image_path FROM people WHERE id = ? AND user_id = ?`, id, uid).Scan(&oldImage); err != nil {
			internalError(w, r, "read portrait", err)
			return
		}
		if req.ImageURL != "" {
			name, ferr := s.fetchUserImage(r.Context(), req.ImageURL, s.coversDir())
			if ferr != nil {
				olog.Errorf(olog.CodePeopleImageFetch, "[identity] person %d image fetch failed: %v", id, ferr)
				writeErr(w, http.StatusBadGateway,
					"couldn't fetch that image — check the URL points directly at a JPG/PNG/WebP/GIF under 2 MB")
				return
			}
			newImage = name
		}
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		// The file was fetched for a write that is not going to happen.
		s.removeCoverFile(newImage)
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
	put("bio", req.Bio)
	put("born", req.Born)
	put("died", req.Died)
	put("links", req.Links)
	put("note", req.Note)
	if changeImage {
		set = append(set, "image_path = ?")
		args = append(args, newImage)
	}
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
		s.removeCoverFile(newImage)
		internalError(w, r, "commit", err)
		return
	}
	// THE OLD FILE GOES AFTER THE COMMIT, never before: a delete that ran first
	// and a write that then failed would leave the record pointing at a file that
	// is gone, which reads as a broken portrait rather than as a failed save.
	if changeImage && oldImage != "" && oldImage != newImage {
		s.removeCoverFile(oldImage)
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
	s.aliasWrite204(w, r, func(tx *sql.Tx) error {
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
	s.aliasWrite204(w, r, func(tx *sql.Tx) error {
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
	s.aliasWrite204(w, r, func(tx *sql.Tx) error {
		return store.AddCharacterAlias(tx, uid, id, req.Alias)
	})
}

// ---- the name field ---------------------------------------------------------

// handleCharacterNames: PUT /characters/{id}/names — the whole field at once.
// handlePersonNames does the same on the other table.
//
// ONE REQUEST BECAUSE IT IS ONE FIELD. The design pack edits a record's name and
// its spellings as a single multi-line box whose first line prints, so promoting
// an alias is a line move. Saved as several requests it could fail halfway and
// leave a record whose printing name is in neither place — see store/names.go.
//
// The existing per-alias verbs stay: the chips in the metadata console add and
// remove one spelling at a time, which is a different gesture and a legitimate
// one, and neither writes a position.
func (s *Server) handleCharacterNames(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "characters")
	if !ok {
		return
	}
	lines, ok := decodeNameLines(w, r)
	if !ok {
		return
	}
	// THE RECORD COMES BACK, unlike the per-alias verbs' 204. This is a FIELD
	// save — the screen's box redraws from what the server stored, the same
	// contract every other row on that panel keeps — and the field's whole point
	// is that the printing name may have moved, which a 204 cannot report.
	if !s.aliasWrite(w, r, func(tx *sql.Tx) error {
		return store.SetCharacterNames(tx, uid, id, lines)
	}) {
		return
	}
	s.handleCharacterByID(w, r)
}

func (s *Server) handlePersonNames(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "people")
	if !ok {
		return
	}
	lines, ok := decodeNameLines(w, r)
	if !ok {
		return
	}
	if !s.aliasWrite(w, r, func(tx *sql.Tx) error {
		return store.SetPersonNames(tx, uid, id, lines)
	}) {
		return
	}
	s.handlePersonByID(w, r)
}

// decodeNameLines takes the field's value either way it is sent.
//
// A LIST OR A STRING, and both because the field IS a string on the screen while
// a list is what the store wants — so the client may send whichever it has
// without either side splitting the other's lines. The split is here so there is
// exactly one rule about what a line break is, rather than one in the client and
// one in Go that agree until somebody pastes text with a carriage return in it.
func decodeNameLines(w http.ResponseWriter, r *http.Request) ([]string, bool) {
	var req struct {
		Lines []string `json:"lines"`
		Text  *string  `json:"text"`
	}
	if !decodeBody(w, r, &req) {
		return nil, false
	}
	if req.Text != nil {
		return strings.Split(strings.ReplaceAll(*req.Text, "\r\n", "\n"), "\n"), true
	}
	if len(req.Lines) == 0 {
		writeErr(w, http.StatusBadRequest, "a record needs a name")
		return nil, false
	}
	return req.Lines, true
}

func (s *Server) handleCharacterAliasDelete(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "characters")
	if !ok {
		return
	}
	alias := r.URL.Query().Get("alias")
	s.aliasWrite204(w, r, func(tx *sql.Tx) error {
		return store.RemoveCharacterAlias(tx, uid, id, alias)
	})
}

// aliasWrite runs one alias change in its own transaction and turns the store's
// refusals into a 409 the panel can print.
// IT REPORTS WHETHER IT ANSWERED, so a caller that wants to serve the record
// instead of a 204 can. The per-alias verbs ignore the bool and keep the 204
// they have always sent — one chip added is not a field save and the console
// does not redraw from it — while the name field's own verbs re-serve, because
// their whole point is that the printing name may have moved.
func (s *Server) aliasWrite(w http.ResponseWriter, r *http.Request, fn func(*sql.Tx) error) bool {
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin", err)
		return false
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
		return false
	case err != nil:
		internalError(w, r, "alias", err)
		return false
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit", err)
		return false
	}
	return true
}

// aliasWrite204 is aliasWrite for the callers whose answer is "done": it sends
// the 204 they have always sent. Separate rather than a flag, so a caller cannot
// commit a write and then forget to answer at all.
func (s *Server) aliasWrite204(w http.ResponseWriter, r *http.Request, fn func(*sql.Tx) error) {
	if s.aliasWrite(w, r, fn) {
		w.WriteHeader(http.StatusNoContent)
	}
}

// ---- characters ------------------------------------------------------------

// handleCharacters: GET /characters — the library-wide list, with how many works
// each appears in. This is the Metadata console's character review list.
func (s *Server) handleCharacters(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[identity] characters uid=%d", uid)
	rows, err := s.Store.DB.Query(`
		SELECT `+characterCols+`,
		       (SELECT count(*) FROM work_cast wc WHERE wc.user_id = c.user_id AND wc.character_id = c.id
		                                            AND wc.origin <> 'removed')
		  FROM characters c WHERE c.user_id = ?
		 ORDER BY CASE WHEN c.sort_name <> '' THEN c.sort_name ELSE c.name END COLLATE NOCASE, c.id`, uid)
	if err != nil {
		internalError(w, r, "list characters", err)
		return
	}
	defer rows.Close()
	out := []characterListRow{}
	byID := map[int64]*characterListRow{}
	for rows.Next() {
		var v characterListRow
		// EVERY COLUMN OF characterCols AND THEN THE COUNT. Scanned by hand rather
		// than through scanCharacter because of that trailing count, which is why
		// 0063's `born` had to be added here too — the shared SELECT list grew and
		// this destination list did not, so every read answered "expected 9
		// destination arguments" and the character list came back empty.
		if err := rows.Scan(&v.ID, &v.Name, &v.SortName, &v.Description, &v.ImagePath,
			&v.Note, &v.Links, &v.Born, &v.Works); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[identity] character row scan failed: %v", err)
			continue
		}
		v.WorksIn = []characterWorkRef{}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[identity] character iteration failed: %v", err)
	}
	for i := range out {
		byID[out[i].ID] = &out[i]
	}
	if err := attachCharacterWorks(s.Store.DB, uid, byID); err != nil {
		// NOT FATAL. The list is useful without the filter and useless without the
		// list, so a failure here costs the dropdown and nothing else.
		olog.Warnf(olog.CodePeopleRowScan, "[identity] character works failed: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"characters": out})
}

// characterListRow is one row of GET /characters.
type characterListRow struct {
	characterRow
	Works int `json:"works"`
	// WHICH works, not just how many. The console filters this list by work, and
	// the count alone cannot answer "show me everybody in Solaris" — the
	// alternative was one request per row to /characters/{id}, which on a library
	// of four hundred characters is four hundred requests to draw a dropdown.
	//
	// The pairs are attached from ONE extra query rather than a correlated
	// subquery per row: a character appears in a handful of works, so the whole
	// set is smaller than the character list it hangs off.
	WorksIn []characterWorkRef `json:"works_in"`
}

// characterWorkRef is one work a character appears in, in the shape the console's
// filter needs: enough to name the work and to tell two works of different kinds
// with the same title apart.
type characterWorkRef struct {
	Kind  string `json:"kind"`
	ID    int64  `json:"id"`
	Title string `json:"title"`
}

// attachCharacterWorks fills every row's WorksIn in one pass over work_cast.
//
// DISTINCT, because a character cast twice on one work is one appearance as far as
// "which works is this character in" is concerned — the `works` count beside it
// deliberately answers the other question and counts rows.
func attachCharacterWorks(db *sql.DB, uid int64, byID map[int64]*characterListRow) error {
	rows, err := db.Query(`
		SELECT DISTINCT wc.character_id, 'book', b.id, b.title
		  FROM work_cast wc JOIN books b ON b.id = wc.work_id
		 WHERE wc.user_id = ? AND wc.kind = 'book' AND wc.origin <> 'removed' AND wc.character_id IS NOT NULL
		UNION ALL
		SELECT DISTINCT wc.character_id, 'movie', m.id, m.title
		  FROM work_cast wc JOIN movies m ON m.id = wc.work_id
		 WHERE wc.user_id = ? AND wc.kind = 'movie' AND wc.origin <> 'removed' AND wc.character_id IS NOT NULL
		 ORDER BY 4 COLLATE NOCASE`, uid, uid)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int64
		var ref characterWorkRef
		if err := rows.Scan(&cid, &ref.Kind, &ref.ID, &ref.Title); err != nil {
			return err
		}
		if r := byID[cid]; r != nil {
			r.WorksIn = append(r.WorksIn, ref)
		}
	}
	return rows.Err()
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
	if out.Lines, out.SharedLines, err = store.CharacterLines(
		s.Store.DB, uid, id, s.creditSeps(uid), personLineCap); err != nil {
		internalError(w, r, "read character lines", err)
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
		Born        *string `json:"born"`
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
	put("born", req.Born)
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
	var name string
	if err := s.Store.DB.QueryRow(
		`SELECT name FROM characters WHERE id = ? AND user_id = ?`, id, uid).Scan(&name); err != nil {
		internalError(w, r, "load character", err)
		return
	}
	trashID, err := s.binRecord(w, r, "character", uid, id, name)
	if err != nil {
		return // binRecord has answered
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "trash_id": trashID})
}

// binRecord deletes a person or a character into the bin, parking its portrait.
//
// ONE FUNCTION OVER BOTH TABLES, unlike the two merges beside it: the transaction,
// the refusal handling, the payload write and the file parking are identical, and
// the only thing that differs is which store call runs. The merges are written out
// twice because their MEANINGS differ table by table; there is no meaning here.
//
// THE FILE IS PARKED AFTER THE COMMIT, never before — the repo's rule for every
// binned delete: write the snapshot, delete, commit, only then touch the
// filesystem. A rename that happens before a rollback is a picture lost for a row
// that is still there.
//
// It answers the request itself on every failure path and returns the error so the
// caller can stop; a caller that wrote a second response would be the one bug this
// shape cannot have.
func (s *Server) binRecord(w http.ResponseWriter, r *http.Request, kind string, uid, id int64, label string) (int64, error) {
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin", err)
		return 0, err
	}
	defer tx.Rollback()

	var undo *store.RecordDeleteUndo
	var image string
	if kind == "person" {
		undo, image, err = store.DeletePersonRecord(tx, uid, id)
	} else {
		undo, image, err = store.DeleteCharacterRecord(tx, uid, id)
	}
	var refused *store.Refusal
	switch {
	case errors.As(err, &refused):
		// "Still credited on 6 works" is something the reader can act on and is
		// theirs to see; a database that failed is neither. store.Refusal is which
		// one this is — handleMergePeople's note, and the same 409.
		writeErr(w, http.StatusConflict, refused.Error())
		return 0, err
	case err != nil:
		internalError(w, r, "delete "+kind, err)
		return 0, err
	}
	payload, err := json.Marshal(undo)
	if err != nil {
		internalError(w, r, "delete: write the undo", err)
		return 0, err
	}
	files := "[]"
	if image != "" {
		if b, err := json.Marshal([]string{image}); err == nil {
			files = string(b)
		}
	}
	// child_count is what came off the record with it — the aliases, the cast rows
	// and the quotes — so the bin row can say how much this delete moved.
	children := len(undo.Aliases) + len(undo.Cast) + len(undo.Screen) + len(undo.Utterance)
	res, err := tx.Exec(
		`INSERT INTO trash (user_id, kind, label, child_count, payload, files)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		uid, kind+"-delete", label, children, string(payload), files)
	if err != nil {
		internalError(w, r, "delete: park the undo", err)
		return 0, err
	}
	trashID, err := res.LastInsertId()
	if err != nil {
		internalError(w, r, "delete: park the undo", err)
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit", err)
		return 0, err
	}
	if image != "" {
		s.parkFiles([]string{image})
	}
	return trashID, nil
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
			      + (SELECT count(*) FROM work_cast   WHERE user_id = ? AND actor_id  = ?
			                                            AND origin <> 'removed')`,
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

// ---- the character half of merge, split and the picker ----------------------
//
// WRITTEN IN PARALLEL WITH THE PERSON HANDLERS ABOVE for the reason 0056 gives and
// store/identity.go repeats: two things meant to behave alike stay auditable side
// by side, and a helper taking a table would hide the moment one of them stopped.
// Read each against its twin; every difference below is a fact about characters.

// handleSearchCharacters: GET /characters/search?q= — records by name, for the
// merge picker. handleSearchPeople's twin, and the same folded-substring match in
// Go for the same reason (SQLite's lower() is ASCII-only, so a LIKE would find
// "woland" and miss "ВОЛАНД" on the same keystroke).
//
// A NOTE ON THE ROUTE, because it is the one place the two halves could not be
// spelt alike. `/people/search` has no wildcard sibling — 0056 put the record
// under `/people/id/{id}` precisely so `DELETE /people/{id}` could keep its
// meaning — whereas `GET /characters/{id}` does exist. Go's mux resolves the pair
// by specificity, and a literal segment beats a wildcard, so `/characters/search`
// is reached and never arrives at handleCharacterByID as an id of "search".
func (s *Server) handleSearchCharacters(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	q := store.CastKey(strings.TrimSpace(r.URL.Query().Get("q")))
	// EACH HIT CARRIES ITS WEIGHT, for handleSearchPeople's reason: the one thing
	// this list feeds is a merge, merging is destructive, and two characters called
	// "The Narrator" are indistinguishable by name — which is the case a reader
	// reaches for this control to resolve. A pick that destroys something shows
	// what it is about to destroy.
	//
	// The weight is APPEARANCES rather than works-plus-cast: a character reaches a
	// work only through the cast, so one count says everything the person half
	// needs two for.
	rows, err := s.Store.DB.Query(
		`SELECT id, name FROM characters WHERE user_id = ? ORDER BY name COLLATE NOCASE`, uid)
	if err != nil {
		internalError(w, r, "search characters", err)
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
			olog.Warnf(olog.CodePeopleRowScan, "[identity] character search row scan failed: %v", err)
			continue
		}
		if q != "" && !strings.Contains(store.CastKey(h.Name), q) {
			continue
		}
		out = append(out, h)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[identity] character search iteration failed: %v", err)
	}
	// Counted in a second pass over the twenty that survived, not over every
	// character in the library — handleSearchPeople's note, and its arithmetic.
	for i := range out {
		// `origin <> 'removed'` matches what PeopleOfWork counts as a cast, so the
		// number in the picker and the number of rows the panel draws cannot differ
		// by a tombstone — 0048 keeps a removed row rather than deleting it.
		if err := s.Store.DB.QueryRow(
			`SELECT count(*) FROM work_cast
			  WHERE user_id = ? AND character_id = ? AND origin <> 'removed'`,
			uid, out[i].ID).Scan(&out[i].Works); err != nil {
			// The row still lists, with a zero it did not earn: a hit missing from the
			// picker is worse than a hit whose weight failed to read.
			olog.Warnf(olog.CodePeopleRowScan, "[identity] character search count for %d: %v", out[i].ID, err)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"characters": out})
}

// handleMergeCharacters: POST /characters/merge {keep_id, drop_id}.
//
// THE SECOND DESTRUCTIVE ACT IN THE IDENTITY MODEL, and it parks an undo for the
// first one's reason: this app's standing promise is that the bin holds what you
// destroy. 0060 gave the bin the kind, and `character-merge` has its own branch in
// handleRestoreTrash beside `person-merge` — a reversal, not a snapshot, because a
// merge re-points rows rather than deleting them and the generic restore's INSERT
// would collide on keys that are all still occupied.
//
// WHY THIS EXISTS AT ALL is the 3.1.0 backfill's promise: it creates one character
// record PER WORK on purpose, so that eight Harry Potters are visible and can be
// welded rather than forty Narrators silently becoming one. The visible half
// shipped in 3.1.0 and this is the half that makes the promise keepable.
func (s *Server) handleMergeCharacters(w http.ResponseWriter, r *http.Request) {
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

	// Read BEFORE the merge: one of the two rows is about to stop existing, and the
	// bin's label is what a reader reads to decide whether to undo it.
	var keepName, dropName string
	if err := tx.QueryRow(`SELECT name FROM characters WHERE user_id = ? AND id = ?`, uid, req.KeepID).Scan(&keepName); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err := tx.QueryRow(`SELECT name FROM characters WHERE user_id = ? AND id = ?`, uid, req.DropID).Scan(&dropName); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}

	// A refusal and a fault are different answers — handleMergePeople's note.
	undo, err := store.MergeCharacters(tx, uid, req.KeepID, req.DropID)
	var refused *store.Refusal
	switch {
	case errors.As(err, &refused):
		writeErr(w, http.StatusConflict, refused.Error())
		return
	case err != nil:
		internalError(w, r, "merge characters", err)
		return
	}
	payload, err := json.Marshal(undo)
	if err != nil {
		internalError(w, r, "merge: write the undo", err)
		return
	}
	// child_count is the APPEARANCES that changed hands, which is what the person
	// half puts there too — the number the bin row shows is "how much this moved".
	res, err := tx.Exec(
		`INSERT INTO trash (user_id, kind, label, child_count, payload, files)
		 VALUES (?, 'character-merge', ?, ?, ?, '[]')`,
		uid, dropName+" → "+keepName, len(undo.Cast), string(payload))
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
		"ok": true, "id": req.KeepID, "trash_id": trashID, "works": len(undo.Cast),
	})
}

// handleSplitCharacterAlias: POST /characters/{id}/split {alias}.
//
// handleSplitAlias's twin, and partial in the same way: the appearances stay with
// the record they are on, because nothing in the schema remembers which of them
// came from the record that was folded in. The response says how many stayed so
// the client can say so too.
func (s *Server) handleSplitCharacterAlias(w http.ResponseWriter, r *http.Request) {
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
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin", err)
		return
	}
	defer tx.Rollback()
	made, err := store.SplitCharacterAlias(tx, uid, id, req.Alias)
	var refused *store.Refusal
	switch {
	case errors.As(err, &refused):
		writeErr(w, http.StatusConflict, refused.Error())
		return
	case err != nil:
		internalError(w, r, "split character alias", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit", err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": made})
}

// handleWorkPeople: GET /books|movies/{id}/people — everyone attached to one work.
//
// THE DOOR THE IDENTITY MODEL HAD NO DOOR FOR. 0056 gave credits and cast records
// to point at, and 0059 gave quotes one too, but every person link on every screen
// still opened a name; there was nowhere a reader could stand on a work and see
// the RECORDS behind it. This is what the ⋯ menu's People entry opens.
//
// CURRIED BY KIND, like handleListCast beside it, and for the same reason: the two
// routes are two literals in the mux and the kind is therefore never parsed out of
// a path segment that a caller controls.
//
// It reads and never writes. The one write this panel offers is the pairing, which
// is PUT /cast/{id}/link — its own endpoint since 0056, so that "who this role is"
// can never become a side effect of saving something else.
func (s *Server) handleWorkPeople(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		workID, ok := pathID(r)
		if !ok {
			writeErr(w, http.StatusBadRequest, "invalid id")
			return
		}
		uid := userID(r)
		if _, ok := s.castWork(uid, kind, workID); !ok {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		out, err := store.PeopleOfWork(s.Store.DB, uid, kind, workID)
		if err != nil {
			internalError(w, r, "work people", err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// ---- the record-keyed people list -------------------------------------------

// personRecord is one people row with everything the Metadata review list ranks by.
type personRecord struct {
	personRow
	SortName string `json:"sort_name"`
	// Spellings are every OTHER way this record is reached or printed — its aliases,
	// and the credit_as values works use for it. What makes one row here able to
	// stand for the several rows the spelling-keyed list used to show.
	Spellings []string `json:"spellings"`
	Works     int      `json:"works"`
	Quotes    int      `json:"quotes"`
}

// handlePeopleRecords: GET /people/records — one row per record, not per spelling.
//
// WHY THIS EXISTS BESIDE /people/names, WHICH IS NOT RETIRED. They answer two
// questions and the screen was asking the wrong one. /people/names answers "which
// names does my library PRINT": it groups the credit columns, splits them, and a
// record's id rides along. That is the right question for a re-verify sweep and
// the wrong one for a review list, because one record with three aliases is three
// rows in it and a record no work prints is not in it at all.
//
// The character list beside it has been record-keyed since it was built. Two lists
// under one heading keyed differently is the thing a reader notices first.
//
// THE COUNTS ARE PER RECORD AND THAT IS THE POINT: `works` is credits plus cast
// appearances, `quotes` is 0059's two link columns. A merged Bulgakov reads 12 and
// 128 here where the spelling list showed four rows of a quarter each.
func (s *Server) handlePeopleRecords(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[identity] people records uid=%d", uid)
	rows, err := s.Store.DB.Query(`
		SELECT `+personCols+`, p.sort_name,
		       (SELECT count(*) FROM work_person wp WHERE wp.user_id = p.user_id AND wp.person_id = p.id)
		     + (SELECT count(*) FROM work_cast   wc WHERE wc.user_id = p.user_id AND wc.actor_id  = p.id
		                                              AND wc.origin <> 'removed'),
		       (SELECT count(*) FROM utterances u WHERE u.user_id = p.user_id AND u.speaker_id = p.id)
		     + (SELECT count(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		         WHERE m.user_id = p.user_id AND d.actor_id = p.id)
		  FROM people p WHERE p.user_id = ?
		 ORDER BY CASE WHEN p.sort_name <> '' THEN p.sort_name ELSE p.name END COLLATE NOCASE, p.id`, uid)
	if err != nil {
		internalError(w, r, "list person records", err)
		return
	}
	defer rows.Close()
	out := []personRecord{}
	for rows.Next() {
		var v personRecord
		if err := rows.Scan(&v.ID, &v.Name, &v.Bio, &v.ImagePath, &v.Born, &v.Died,
			&v.Links, &v.Source, &v.SourceID, &v.SortName, &v.Works, &v.Quotes); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[identity] person record scan failed: %v", err)
			continue
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[identity] person record iteration failed: %v", err)
	}
	// THE ROLES AND THE SPELLINGS IN THREE MORE QUERIES, NOT THREE PER PERSON.
	//
	// They are lists, so they cannot be columns on the statement above — a
	// group_concat of two of them in one row is a string this would have to take
	// apart again, with a separator that either appears in a name or is one more
	// thing to escape. But a read per person is a read per person, and this is the
	// screen with the most of them: a library with six hundred credited names would
	// have made eighteen hundred round trips to draw one list. Each of the three
	// reads the whole account once and is bucketed by id here.
	// THE ROLES ARE DERIVED FROM THE LINKS, NOT READ FROM person_kinds.
	//
	// 0027's table is written by the enrichment upsert — PUT /people, the modal that
	// saves a bio and a portrait under a (kind, name) — and NOT by the credit path
	// that 0056 introduced. So a record created by adding a book is filed under no
	// role at all, which is most records in any library: reading the table here
	// would have shown an empty roles cell on nearly every row. 0056's own note
	// says person_kinds "becomes derivable from the credit rows; check before
	// keeping it", and this is that check coming back derived.
	//
	// person_kinds is left alone rather than dropped: the `kind=` endpoints are a
	// namespace for saved enrichment and still mean what they meant.
	kinds := s.personListsBy(`SELECT person_id, role FROM work_person WHERE user_id = ?
	                          UNION
	                          SELECT actor_id, 'actor' FROM work_cast
	                           WHERE user_id = ? AND actor_id IS NOT NULL AND origin <> 'removed'
	                          UNION
	                          SELECT speaker_id, 'speaker' FROM utterances
	                           WHERE user_id = ? AND speaker_id IS NOT NULL
	                          UNION
	                          SELECT d.actor_id, 'actor' FROM dialogues d
	                            JOIN movies m ON m.id = d.movie_id
	                           WHERE m.user_id = ? AND d.actor_id IS NOT NULL
	                          ORDER BY 2`, "roles", uid, uid, uid, uid)
	aliases := s.personListsBy(`SELECT person_id, alias FROM person_alias
	                             WHERE user_id = ? ORDER BY alias_key`, "aliases", uid)
	// A CREDIT_AS IS NOT AN ALIAS, and the schema is right to keep them apart: an
	// alias says "this spelling FINDS this record", a credit_as says "this cover
	// PRINTS it this way". A list asking "is this one person or several" wants both
	// on one line, because both are spellings of them a reader will meet.
	credited := s.personListsBy(`SELECT DISTINCT person_id, credit_as FROM work_person
	                              WHERE user_id = ? AND credit_as <> '' ORDER BY credit_as`, "credit spellings", uid)
	for i := range out {
		out[i].Kinds = kinds[out[i].ID]
		out[i].Spellings = foldSpellings(out[i].Name, aliases[out[i].ID], credited[out[i].ID])
	}
	writeJSON(w, http.StatusOK, map[string]any{"people": out})
}

// personListsBy runs one (person_id, value) query for the whole account and buckets
// it by id, in the order the query returns them. `what` names the read in the log
// and nothing else.
//
// A FAILED READ RETURNS AN EMPTY MAP RATHER THAN AN ERROR, because the caller is a
// review list: a record missing from it is worse than a record whose other
// spellings failed to read, and the log is where the failure is recorded.
func (s *Server) personListsBy(q, what string, args ...any) map[int64][]string {
	out := map[int64][]string{}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[identity] person record %s: %v", what, err)
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var v string
		if err := rows.Scan(&id, &v); err != nil {
			olog.Warnf(olog.CodePeopleRowScan, "[identity] person record %s scan: %v", what, err)
			return out
		}
		out[id] = append(out[id], v)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[identity] person record %s iteration: %v", what, err)
	}
	return out
}

// foldSpellings merges a record's aliases with the spellings its covers print,
// deduplicated by the folded key and without the record's own name.
func foldSpellings(name string, lists ...[]string) []string {
	seen := map[string]bool{store.CastKey(name): true}
	out := []string{}
	for _, list := range lists {
		for _, v := range list {
			v = strings.TrimSpace(v)
			if v == "" || seen[store.CastKey(v)] {
				continue
			}
			seen[store.CastKey(v)] = true
			out = append(out, v)
		}
	}
	return out
}
