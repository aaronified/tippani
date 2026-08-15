package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"tippani/internal/olog"
)

// Boards (0036) — the shelves a standalone quote sits on, and the top level of
// /quotes the way books are the top level of the Library.
//
// NOTHING IN THIS FILE KNOWS A BOARD'S NAME. The three seeded by 0036 are seeded
// and then ordinary: renamable, deletable, hidable. A special case for 'Others'
// would break the moment somebody renamed it, silently, and the reader is the
// only one who could see that it broke. Where a fallback is genuinely needed it
// is the DEFAULT BOARD — a preference pointing at a row, resolved by
// defaultBoardID below.

// boardNameMax is generous because a board name is a shelf label rather than a
// field anything joins on; the cap exists so a paste of a whole quote into the
// name box fails as a 400 rather than as a row nothing can display.
const boardNameMax = 80

const boardDescriptionMax = 2000

// The two kinds 0037 defines. 'speech' is deliberately absent: a speech quote
// uses the same fields every other quote uses, so a kind for it would be a label
// with no behaviour behind it.
const (
	boardKindPlain   = "plain"
	boardKindProverb = "proverb"
)

// A language name, not a tag — long enough for "Scottish Gaelic" and short enough
// that a pasted sentence fails as a 400.
const boardLanguageMax = 40

// Enough for a reader who collects widely, and a ceiling so the row cannot be
// grown without limit by a client that appends rather than replaces.
const boardLanguagesMax = 40

type boardRow struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	ImagePath   string `json:"image_path"`
	Hidden      bool   `json:"hidden"`
	Pos         int    `json:"pos"`
	// Quotes is the count on this board — the number the tile shows, and the
	// reason the list endpoint exists rather than the client counting for
	// itself. Counting client-side would mean fetching every quote to draw a
	// shelf, which is the thing the two-level screen is built to avoid.
	Quotes int `json:"quotes"`
	// Kind (0037) is what the board HOLDS, and it is deliberately not its name.
	// This file still knows no board's name; it knows that a proverb board puts
	// the language and the English translation first, because those are the
	// fields that carry a proverb and are noise on a board of speeches.
	Kind string `json:"kind"`
	// Languages is meaningful only on a proverb board: the short list the quote
	// form offers instead of a free-text box somebody has to spell the same way
	// twice, and what the optional per-language sections group by. Always sent as
	// an array, never null, so the client never branches on absent-vs-empty.
	Languages []string `json:"languages"`
}

type boardReq struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Color       string   `json:"color"`
	ImagePath   string   `json:"image_path"`
	Hidden      *bool    `json:"hidden"` // pointer: absent means "leave it"
	Pos         *int     `json:"pos"`
	MoveTo      *int64   `json:"move_to"` // delete only
	Kind        string   `json:"kind"`
	Languages   []string `json:"languages"`
}

func (b *boardReq) normalise() string {
	b.Name = strings.TrimSpace(b.Name)
	b.Description = strings.TrimSpace(b.Description)
	b.Color = strings.TrimSpace(b.Color)
	if b.Name == "" {
		return "name is required"
	}
	if len([]rune(b.Name)) > boardNameMax {
		return "name is too long"
	}
	if len([]rune(b.Description)) > boardDescriptionMax {
		return "description is too long"
	}
	if b.Color == "" {
		b.Color = "yellow"
	}
	if !validColor(b.Color) {
		return "color must be one of " + strings.Join(annotationColors, ", ")
	}
	// An absent kind is 'plain' rather than an error, so every client written
	// against 1.14.0 and every board in an older export keeps working untouched.
	b.Kind = strings.TrimSpace(b.Kind)
	if b.Kind == "" {
		b.Kind = boardKindPlain
	}
	if b.Kind != boardKindPlain && b.Kind != boardKindProverb {
		return "kind must be " + boardKindPlain + " or " + boardKindProverb
	}
	// Languages belong to a proverb board and are dropped from any other, rather
	// than refused. A reader who fills the list in and then switches the kind back
	// has not made a mistake worth a 400 — they have changed their mind, and the
	// list would otherwise sit invisible in the row waiting to reappear.
	if b.Kind != boardKindProverb {
		b.Languages = nil
		return ""
	}
	seen := map[string]bool{}
	clean := make([]string, 0, len(b.Languages))
	for _, l := range b.Languages {
		l = strings.TrimSpace(l)
		if l == "" {
			continue
		}
		if len([]rune(l)) > boardLanguageMax {
			return "language name is too long"
		}
		// Case-insensitively unique, but the reader's own capitalisation is what
		// is stored: "bengali" typed second should not win over "Bengali".
		if key := strings.ToLower(l); !seen[key] {
			seen[key] = true
			clean = append(clean, l)
		}
	}
	if len(clean) > boardLanguagesMax {
		return "that is too many languages for one board"
	}
	b.Languages = clean
	return ""
}

// encodeLanguages stores the list the way 0037's backfill does — a JSON array —
// with the EMPTY LIST STORED AS THE EMPTY STRING rather than as "[]". That is the
// column default, so a board nobody has touched and a board whose languages were
// all removed hold the same value, and neither has to be told apart from the
// other when reading.
func encodeLanguages(langs []string) string {
	if len(langs) == 0 {
		return ""
	}
	b, err := json.Marshal(langs)
	if err != nil {
		return ""
	}
	return string(b)
}

// decodeLanguages never returns nil, so the JSON going out is [] rather than
// null: a client that has to check for both is a client that will one day check
// for only one.
func decodeLanguages(raw string) []string {
	out := []string{}
	if strings.TrimSpace(raw) == "" {
		return out
	}
	if err := json.Unmarshal([]byte(raw), &out); err != nil || out == nil {
		return []string{}
	}
	return out
}

// defaultBoardID resolves where a quote goes when nothing named a board: the ＋
// pressed outside a board, and an import with no board key.
//
// Three steps, and the third is what makes a brand-new account work. 0036 seeds
// boards only from quotes a reader ALREADY had, deliberately — somebody who has
// never saved a standalone quote should not open the app to three empty shelves —
// so the first quote of a fresh account arrives with no board in existence at
// all. Rather than seed shelves nobody asked for, the first one is made here, at
// the moment there is finally something to put on it.
func defaultBoardID(tx *sql.Tx, uid int64) (int64, error) {
	var id int64
	err := tx.QueryRow(`SELECT CAST(json_extract(preferences, '$.defaultBoardId') AS INTEGER)
	                    FROM users WHERE id = ?`, uid).Scan(&id)
	if err == nil && id > 0 {
		// The preference points at a row, so it can outlive the row it points
		// at — a board the reader deleted. Verified rather than trusted.
		var ok int
		if err := tx.QueryRow(`SELECT COUNT(*) FROM boards WHERE id = ? AND user_id = ?`, id, uid).Scan(&ok); err == nil && ok == 1 {
			return id, nil
		}
	}
	// Fall back to their first board before making one: a reader who deleted the
	// board the preference named still has shelves, and a new one would be a
	// fourth thing on a screen that already had three.
	if err := tx.QueryRow(`SELECT id FROM boards WHERE user_id = ? ORDER BY pos, id LIMIT 1`, uid).Scan(&id); err == nil {
		return setDefaultBoard(tx, uid, id)
	}
	// SQLite assigns the id. Boards are deliberately NOT on the id floor: that
	// allowlist is exactly the kinds the bin can hold, because a reused id is a
	// restore that collides — and a board never enters the bin, so it would be a
	// create path paying for a guarantee nobody needs.
	res, err := tx.Exec(`INSERT INTO boards (user_id, name, color, pos) VALUES (?, 'Others', 'yellow', 0)`, uid)
	if err != nil {
		return 0, err
	}
	newID, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	return setDefaultBoard(tx, uid, newID)
}

func setDefaultBoard(tx *sql.Tx, uid, boardID int64) (int64, error) {
	_, err := tx.Exec(`UPDATE users SET preferences = json_set(
	                     CASE WHEN COALESCE(preferences,'') = '' THEN '{}' ELSE preferences END,
	                     '$.defaultBoardId', ?) WHERE id = ?`, boardID, uid)
	return boardID, err
}

// resolveBoard turns whatever the client sent into a board this reader owns.
//
// nil means "the default board", which is what the ＋ pressed outside a board
// sends and what an import with no board key produces. A board id that is not
// theirs is an error rather than a silent fall back to the default: filing a
// quote somewhere other than where the request said is worse than refusing it,
// because nothing on screen would say it happened.
func resolveBoard(tx *sql.Tx, uid int64, want *int64) (int64, error) {
	if want == nil {
		return defaultBoardID(tx, uid)
	}
	if !boardOwned(tx, uid, *want) {
		return 0, sql.ErrNoRows
	}
	return *want, nil
}

// boardByName finds or creates a board, which is what an import does with a name
// it does not recognise (0036). The cost is stated in the plan and accepted: a
// typo creates a board. That is visible in the list and fixable by renaming it,
// which is far cheaper than a refused import — the same reasoning 1.13.1 used
// for credit suffixes, where a wrongly-split name is visible and a wrongly-merged
// one hides a whole person.
//
// Matched case-insensitively so `board: proverbs` from an older export finds the
// seeded Proverbs rather than making a second shelf beside it.
func boardByName(tx *sql.Tx, uid int64, name string) (int64, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return defaultBoardID(tx, uid)
	}
	if len([]rune(name)) > boardNameMax {
		name = string([]rune(name)[:boardNameMax])
	}
	var id int64
	err := tx.QueryRow(`SELECT id FROM boards WHERE user_id = ? AND lower(name) = lower(?)`, uid, name).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != sql.ErrNoRows {
		return 0, err
	}
	// Appended at the end rather than inserted anywhere meaningful: a board made
	// by an import has no place in an order the reader chose.
	var pos int
	_ = tx.QueryRow(`SELECT COALESCE(MAX(pos), -1) + 1 FROM boards WHERE user_id = ?`, uid).Scan(&pos)
	res, err := tx.Exec(`INSERT INTO boards (user_id, name, pos) VALUES (?, ?, ?)`, uid, name, pos)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// boardOwned reports whether this board is this reader's, which every handler
// taking a board id from a request has to ask before using it.
func boardOwned(q interface {
	QueryRow(string, ...any) *sql.Row
}, uid, boardID int64) bool {
	var n int
	if err := q.QueryRow(`SELECT COUNT(*) FROM boards WHERE id = ? AND user_id = ?`, boardID, uid).Scan(&n); err != nil {
		return false
	}
	return n == 1
}

// GET /boards — every board with its count, hidden ones included.
//
// HIDDEN BOARDS ARE SENT, not filtered out here. Hiding is a view the reader can
// switch off ("show hidden"), so the client needs the whole list to be able to
// show it without a second request — and a count that changed depending on a
// filter would be a count about nothing.
func (s *Server) handleListBoards(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[boards] handleListBoards uid=%d", uid)
	rows, err := s.Store.DB.Query(`
		SELECT b.id, b.name, b.description, b.color, b.image_path, b.hidden, b.pos,
		       (SELECT COUNT(*) FROM utterances u WHERE u.board_id = b.id),
		       b.kind, b.languages
		FROM boards b WHERE b.user_id = ? ORDER BY b.pos, b.id`, uid)
	if err != nil {
		internalError(w, r, "list boards", err)
		return
	}
	defer rows.Close()
	out := []boardRow{}
	for rows.Next() {
		var b boardRow
		var langs string
		if err := rows.Scan(&b.ID, &b.Name, &b.Description, &b.Color, &b.ImagePath, &b.Hidden, &b.Pos, &b.Quotes,
			&b.Kind, &langs); err != nil {
			olog.Warnf(olog.CodeBoardRowScan, "[boards] row scan failed: %v", err)
			continue
		}
		b.Languages = decodeLanguages(langs)
		out = append(out, b)
	}
	if err := rows.Err(); err != nil {
		internalError(w, r, "list boards", err)
		return
	}
	// `total` is the All quotes count, which is not the sum of the boards above
	// only if something has gone wrong — sent anyway, because the pinned All
	// quotes entry has to show a number even while a board list is empty.
	var total int
	if err := s.Store.DB.QueryRow(`SELECT COUNT(*) FROM utterances WHERE user_id = ?`, uid).Scan(&total); err != nil {
		internalError(w, r, "count quotes", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"boards": out, "total": total})
}

func (s *Server) handleCreateBoard(w http.ResponseWriter, r *http.Request) {
	var req boardReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.normalise(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[boards] handleCreateBoard uid=%d name=%q", uid, req.Name)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	var dupe int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM boards WHERE user_id = ? AND lower(name) = lower(?)`,
		uid, req.Name).Scan(&dupe); err != nil {
		internalError(w, r, "check board name", err)
		return
	}
	if dupe > 0 {
		// 409 rather than silently returning the existing one: the reader typed
		// a name meaning to make something new, and handing back an existing
		// shelf would look like it worked.
		writeErr(w, http.StatusConflict, "a board called that already exists")
		return
	}
	var pos int
	_ = tx.QueryRow(`SELECT COALESCE(MAX(pos), -1) + 1 FROM boards WHERE user_id = ?`, uid).Scan(&pos)
	res, err := tx.Exec(`INSERT INTO boards (user_id, name, description, color, image_path, pos, kind, languages)
	                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		uid, req.Name, req.Description, req.Color, req.ImagePath, pos, req.Kind, encodeLanguages(req.Languages))
	if err != nil {
		internalError(w, r, "insert board", err)
		return
	}
	id, err := res.LastInsertId()
	if err != nil {
		internalError(w, r, "insert board", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit board", err)
		return
	}
	writeJSON(w, http.StatusCreated, boardRow{ID: id, Name: req.Name, Description: req.Description,
		Color: req.Color, ImagePath: req.ImagePath, Pos: pos, Kind: req.Kind,
		Languages: decodeLanguages(encodeLanguages(req.Languages))})
}

func (s *Server) handleUpdateBoard(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad board id")
		return
	}
	var req boardReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.normalise(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[boards] handleUpdateBoard uid=%d id=%d", uid, id)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	if !boardOwned(tx, uid, id) {
		writeErr(w, http.StatusNotFound, "board not found")
		return
	}
	var clash int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM boards WHERE user_id = ? AND lower(name) = lower(?) AND id <> ?`,
		uid, req.Name, id).Scan(&clash); err != nil {
		internalError(w, r, "check board name", err)
		return
	}
	if clash > 0 {
		writeErr(w, http.StatusConflict, "a board called that already exists")
		return
	}
	// hidden and pos are pointers so an edit of the name cannot un-hide a board
	// as a side effect. Every other field is full-state, like every PUT here.
	set := `name = ?, description = ?, color = ?, image_path = ?, kind = ?, languages = ?, updated_at = datetime('now')`
	args := []any{req.Name, req.Description, req.Color, req.ImagePath, req.Kind, encodeLanguages(req.Languages)}
	if req.Hidden != nil {
		set += `, hidden = ?`
		args = append(args, *req.Hidden)
	}
	if req.Pos != nil {
		set += `, pos = ?`
		args = append(args, *req.Pos)
	}
	args = append(args, id, uid)
	if _, err := tx.Exec(`UPDATE boards SET `+set+` WHERE id = ? AND user_id = ?`, args...); err != nil {
		internalError(w, r, "update board", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit board", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /boards/{id} — and it asks where the quotes go.
//
// The rule (0036) is that no quote is ever orphaned, and that this is achieved
// through a rule about the OPERATION rather than by making one board permanent.
// So: an empty board deletes freely; a board with quotes needs `move_to` naming
// another board of the reader's, and the quotes move first. The database backs
// this up with ON DELETE RESTRICT, so a bug here fails loudly rather than losing
// somebody's filing.
func (s *Server) handleDeleteBoard(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad board id")
		return
	}
	// A DELETE with no body is the ordinary case (an empty board), so an
	// unreadable body is not an error here — move_to simply stays nil and the
	// "say which board these quotes move to" branch below reports it properly.
	var req boardReq
	_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, maxCRUDBody)).Decode(&req)
	uid := userID(r)
	olog.Tracef("[boards] handleDeleteBoard uid=%d id=%d", uid, id)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	if !boardOwned(tx, uid, id) {
		writeErr(w, http.StatusNotFound, "board not found")
		return
	}
	var held int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM utterances WHERE board_id = ?`, id).Scan(&held); err != nil {
		internalError(w, r, "count board quotes", err)
		return
	}
	if held > 0 {
		if req.MoveTo == nil || *req.MoveTo == id {
			writeErr(w, http.StatusBadRequest, "say which board these quotes move to")
			return
		}
		if !boardOwned(tx, uid, *req.MoveTo) {
			writeErr(w, http.StatusBadRequest, "that board does not exist")
			return
		}
		if _, err := tx.Exec(`UPDATE utterances SET board_id = ? WHERE board_id = ?`, *req.MoveTo, id); err != nil {
			internalError(w, r, "move quotes", err)
			return
		}
	}
	if _, err := tx.Exec(`DELETE FROM boards WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		internalError(w, r, "delete board", err)
		return
	}
	// The default board is a preference pointing at a row, so deleting that row
	// has to repoint it — otherwise the next quote captured outside a board
	// resolves a dangling id. defaultBoardID tolerates that, but leaving it to be
	// tolerated is how a stale pointer survives a release.
	var def int64
	_ = tx.QueryRow(`SELECT CAST(json_extract(preferences, '$.defaultBoardId') AS INTEGER) FROM users WHERE id = ?`,
		uid).Scan(&def)
	if def == id {
		if _, err := defaultBoardID(tx, uid); err != nil {
			internalError(w, r, "repoint default board", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit board delete", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
