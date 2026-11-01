package httpapi

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/olog"
)

// SECTIONS IN AN ANTHOLOGY (0089), and how an anthology is grouped on the page.
//
// A section is a heading the reader writes, with optional prose under it, placed anywhere among
// the entries. It shares the entries' position space (the anthology_slots view reads both), so
// "after this one" means the same thing for a passage and for a heading and one reorder route
// moves either.
//
// DELETING A SECTION DELETES THE HEADING AND NOTHING ELSE. The passages under it stay where they
// are and simply read as part of whatever section is above. The reader's prose under the heading
// goes with it, and the delete says so before it is pressed (the client's confirm).

const (
	anthologySectionTitleMax = 200
	anthologySectionProseMax = 4000
	anthologySectionsMax     = 500
)

// slotKind is the vocabulary of the order route: the three quote kinds and a section.
const slotSection = "section"

func validSlotKind(k string) bool { return k == slotSection || validReviewKind(k) }

type anthologySectionRow struct {
	ID       int64   `json:"id"`
	Position float64 `json:"position"`
	Title    string  `json:"title"`
	Prose    string  `json:"prose"`
}

// sectionsFor reads an anthology's sections in order. The client interleaves them with the entries
// by position, which is why both lists carry it.
func sectionsFor(db interface {
	Query(string, ...any) (*sql.Rows, error)
}, id int64) ([]anthologySectionRow, error) {
	rows, err := db.Query(`SELECT id, position, title, prose FROM anthology_sections
	                       WHERE anthology_id = ? ORDER BY position, id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []anthologySectionRow{}
	for rows.Next() {
		var x anthologySectionRow
		if err := rows.Scan(&x.ID, &x.Position, &x.Title, &x.Prose); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// positionAfter is the position a new slot takes when it goes after `after` (nil means first, and
// "the end" is the caller's own default), computed the way the reorder route does: the midpoint
// between the anchor and whatever follows it, renumbering first when the gap has run out.
func positionAfter(tx *sql.Tx, id int64, after *entryRef) (float64, error) {
	prev := 0.0
	if after != nil {
		if err := tx.QueryRow(`SELECT position FROM anthology_slots
		                       WHERE anthology_id = ? AND kind = ? AND item_id = ?`,
			id, after.Kind, after.ItemID).Scan(&prev); err != nil {
			return 0, err
		}
	}
	var next sql.NullFloat64
	if err := tx.QueryRow(`SELECT MIN(position) FROM anthology_slots
	                       WHERE anthology_id = ? AND position > ?`, id, prev).Scan(&next); err != nil {
		return 0, err
	}
	if !next.Valid {
		return prev + 1, nil
	}
	target := prev + (next.Float64-prev)/2
	if next.Float64-prev >= anthologyPositionGap && target > prev && target < next.Float64 {
		return target, nil
	}
	// The float has run out of room between these two: renumber (exact) and try again.
	if err := renumberAnthology(tx, id); err != nil {
		return 0, err
	}
	return positionAfter(tx, id, after)
}

// POST /anthologies/{id}/sections — add a heading. `after` names the slot it follows, or is absent
// to mean the end, which is where a reader building an anthology top to bottom wants it.
func (s *Server) handleAddAnthologySection(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	var body struct {
		Title string    `json:"title"`
		Prose string    `json:"prose"`
		After *entryRef `json:"after"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	title, prose, bad := cleanSection(body.Title, body.Prose)
	if bad != "" {
		writeErr(w, http.StatusBadRequest, bad)
		return
	}
	if body.After != nil && !validSlotKind(body.After.Kind) {
		writeErr(w, http.StatusBadRequest, "unknown kind")
		return
	}
	uid := userID(r)
	olog.Tracef("[anthologies] add section uid=%d id=%d", uid, id)
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
	var held int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM anthology_sections WHERE anthology_id = ?`, id).Scan(&held); err != nil {
		internalError(w, r, "count sections", err)
		return
	}
	if held >= anthologySectionsMax {
		writeErr(w, http.StatusBadRequest, "an anthology holds at most "+strconv.Itoa(anthologySectionsMax)+" sections")
		return
	}
	var pos float64
	if body.After == nil {
		// The end: past every entry and every section.
		if err := tx.QueryRow(`SELECT COALESCE(MAX(position), 0) + 1 FROM anthology_slots WHERE anthology_id = ?`, id).Scan(&pos); err != nil {
			internalError(w, r, "next position", err)
			return
		}
	} else {
		pos, err = positionAfter(tx, id, body.After)
		if err == sql.ErrNoRows {
			writeErr(w, http.StatusNotFound, "the slot it should follow is not in this anthology")
			return
		}
		if err != nil {
			internalError(w, r, "position section", err)
			return
		}
	}
	res, err := tx.Exec(`INSERT INTO anthology_sections (anthology_id, position, title, prose) VALUES (?, ?, ?, ?)`,
		id, pos, title, prose)
	if err != nil {
		internalError(w, r, "insert section", err)
		return
	}
	sid, _ := res.LastInsertId()
	if _, err := tx.Exec(`UPDATE anthologies SET updated_at = datetime('now') WHERE id = ?`, id); err != nil {
		internalError(w, r, "touch anthology", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit section", err)
		return
	}
	writeJSON(w, http.StatusCreated, anthologySectionRow{ID: sid, Position: pos, Title: title, Prose: prose})
}

// PUT /anthologies/{id}/sections/{sid} — the heading and its prose. The position is not here: a
// section moves through the order route, like everything else in the anthology.
func (s *Server) handleUpdateAnthologySection(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	sid, err := strconv.ParseInt(r.PathValue("sid"), 10, 64)
	if !ok || err != nil || sid <= 0 {
		writeErr(w, http.StatusBadRequest, "bad section reference")
		return
	}
	var body struct {
		Title string `json:"title"`
		Prose string `json:"prose"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	title, prose, bad := cleanSection(body.Title, body.Prose)
	if bad != "" {
		writeErr(w, http.StatusBadRequest, bad)
		return
	}
	uid := userID(r)
	if !anthologyOwned(s.Store.DB, uid, id) {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	res, err := s.Store.DB.Exec(`UPDATE anthology_sections SET title = ?, prose = ? WHERE id = ? AND anthology_id = ?`,
		title, prose, sid, id)
	if err != nil {
		internalError(w, r, "update section", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "section not found")
		return
	}
	if _, err := s.Store.DB.Exec(`UPDATE anthologies SET updated_at = datetime('now') WHERE id = ?`, id); err != nil {
		internalError(w, r, "touch anthology", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /anthologies/{id}/sections/{sid} — the heading goes, and the passages stay.
func (s *Server) handleDeleteAnthologySection(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	sid, err := strconv.ParseInt(r.PathValue("sid"), 10, 64)
	if !ok || err != nil || sid <= 0 {
		writeErr(w, http.StatusBadRequest, "bad section reference")
		return
	}
	uid := userID(r)
	if !anthologyOwned(s.Store.DB, uid, id) {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	res, err := s.Store.DB.Exec(`DELETE FROM anthology_sections WHERE id = ? AND anthology_id = ?`, sid, id)
	if err != nil {
		internalError(w, r, "delete section", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "section not found")
		return
	}
	if _, err := s.Store.DB.Exec(`UPDATE anthologies SET updated_at = datetime('now') WHERE id = ?`, id); err != nil {
		internalError(w, r, "touch anthology", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// addAnthologySection appends a heading at the end, as an import does: the entry it opens is
// written straight after it, so the order is the file's. Bounded the way an interactive one is.
func addAnthologySection(tx *sql.Tx, anthologyID int64, title, prose string) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil
	}
	if r := []rune(title); len(r) > anthologySectionTitleMax {
		title = string(r[:anthologySectionTitleMax])
	}
	prose = trimProse(prose)
	if r := []rune(prose); len(r) > anthologySectionProseMax {
		prose = string(r[:anthologySectionProseMax])
	}
	var next float64
	if err := tx.QueryRow(`SELECT COALESCE(MAX(position), 0) + 1 FROM anthology_slots WHERE anthology_id = ?`, anthologyID).Scan(&next); err != nil {
		return err
	}
	_, err := tx.Exec(`INSERT INTO anthology_sections (anthology_id, position, title, prose) VALUES (?, ?, ?, ?)`,
		anthologyID, next, title, prose)
	return err
}

// cleanSection trims and bounds what a section carries. A heading is required: an empty one would
// draw a rule with nothing on it.
func cleanSection(title, prose string) (string, string, string) {
	title = strings.TrimSpace(title)
	prose = trimProse(prose)
	if title == "" {
		return "", "", "a section needs a heading"
	}
	if len([]rune(title)) > anthologySectionTitleMax {
		return "", "", "a section heading is at most " + strconv.Itoa(anthologySectionTitleMax) + " characters"
	}
	if len([]rune(prose)) > anthologySectionProseMax {
		return "", "", "the text under a heading is at most " + strconv.Itoa(anthologySectionProseMax) + " characters"
	}
	return title, prose, ""
}

// anthologyGroupings is the vocabulary of how consecutive passages are grouped under a header.
var anthologyGroupings = map[string]bool{"": true, "work": true, "person": true, "character": true}

// PUT /anthologies/{id}/grouping — a display setting of its own endpoint rather than a field of the
// anthology PUT, for the reason the rule columns are: a full-state PUT from a form that has not heard
// of the setting would silently clear it.
func (s *Server) handleAnthologyGrouping(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	var body struct {
		GroupBy string `json:"group_by"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if !anthologyGroupings[body.GroupBy] {
		writeErr(w, http.StatusBadRequest, "group by work, person, character or nothing")
		return
	}
	uid := userID(r)
	res, err := s.Store.DB.Exec(`UPDATE anthologies SET group_by = ? WHERE id = ? AND user_id = ?`, body.GroupBy, id, uid)
	if err != nil {
		internalError(w, r, "set grouping", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
