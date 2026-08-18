package httpapi

// Anthologies (0043) — a named, ordered list of quotes drawn from anywhere in the
// library, carrying prose of its own.
//
// IT IS NOT A TAG WITH A NICER HAT. The two things a tag cannot do are hold an
// ORDER and hold YOUR WRITING, and those are the whole feature. Everything else
// in this app points inward: you file a passage, you find it again, you get asked
// about it. This is the first thing a reader makes OUT of the collection.
//
// Three rules run through every handler here, and each of them is a decision
// rather than a convention:
//
//  1. AN ENTRY IS (kind, item_id) AND CARRIES NO FOREIGN KEY, so every write has
//     to check the quote belongs to the caller. The anthology being theirs is not
//     enough — nothing in the schema stops an entry pointing at somebody else's
//     row, and the read path joins through the parent, so a foreign id would
//     simply render as a missing entry rather than as a leak. quoteOwned is the
//     one place that check lives.
//
//  2. FILING IS NOT MOVING. A quote may be in any number of anthologies and once
//     in each (the primary key says so). Adding one twice is a no-op, not an
//     error and not a duplicate — the bulk bar sends a whole selection, and half
//     of it already being there is the ordinary case, not a mistake.
//
//  3. REORDERING WRITES ONE ROW. `position` is a REAL and a move lands at the
//     midpoint of its new neighbours. The renumbering alternative has to succeed
//     for every row or the order is corrupt, and it runs on every drag.

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/olog"
)

const (
	// A title is a document's name and rides a page header and a tile; the cap is
	// there so a pasted passage fails as a 400 rather than as a row nothing can
	// draw.
	anthologyTitleMax = 120
	// The introduction and each entry's commentary are PROSE, and the caps are set
	// where a reader would have to be pasting a chapter rather than writing a
	// paragraph. They are generous on purpose: this is the one place in the app
	// where the reader's own long-form writing is the content.
	anthologyIntroMax = 20000
	anthologyNoteMax  = 8000
	// A ceiling per anthology, so a client that appends rather than replaces
	// cannot grow one without limit. Thirty is a personal anthology; five hundred
	// is a book.
	anthologyEntriesMax = 500
	// How many can be added in one request — the bulk bar's whole selection.
	anthologyAddMax = 200
)

// anthologyPositionGap is the point at which a gap between two neighbours is too
// small to halve usefully and the whole anthology is renumbered to 1, 2, 3…
//
// A double has about fifty-two bits of mantissa, so a reader would have to drop
// entries into the SAME gap some fifty times running to reach the exact limit —
// reachable by a script and not by a hand. Renumbering early keeps the stored
// numbers legible and keeps the one full rewrite in this file off the common path.
const anthologyPositionGap = 1e-6

type anthologyRow struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	Intro string `json:"intro"`
	// Entries is the count, and it is the reason the list endpoint exists rather
	// than the client counting for itself: a list of anthologies has to say how
	// long each one is without fetching every quote in all of them.
	Entries   int    `json:"entries"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// anthologyEntryRow is one entry as the reading view needs it: the anthology's
// own two facts, then enough of the quote to render it without a second request.
//
// The quote fields are DENORMALISED INTO THE RESPONSE and deliberately not the
// full quote row. An anthology is read, so what it needs is the passage, its
// attribution and its colour; the sticker coordinates, the dedupe hash and the
// review state belong to the screens that edit those things.
type anthologyEntryRow struct {
	Kind     string  `json:"kind"`
	ItemID   int64   `json:"item_id"`
	Position float64 `json:"position"`
	Note     string  `json:"note"`

	Quote     string `json:"quote"`
	QuoteNote string `json:"quote_note"`
	Color     string `json:"color"`
	Favorite  bool   `json:"favorite"`
	// Source is where the passage came from — a book or film title, or a
	// standalone quote's occasion — and Credit is who is answerable for it: an
	// author, an actor, a speaker. Two fields rather than one formatted string,
	// because the client draws them differently and a server-side join of the two
	// would be a layout decision made in SQL.
	Source string `json:"source"`
	Credit string `json:"credit"`
	// WorkID is the parent's id where there is one, so a card can still open the
	// book it came from. Zero for a standalone quote, which has no parent.
	WorkID int64 `json:"work_id,omitempty"`
}

type anthologyReq struct {
	Title string `json:"title"`
	Intro string `json:"intro"`
}

func (a *anthologyReq) normalise() string {
	a.Title = strings.TrimSpace(a.Title)
	// The prose is NOT trimmed of its interior: a blank line between paragraphs is
	// the reader's paragraph break and the only formatting this field has. Only the
	// leading and trailing whitespace goes.
	a.Intro = trimProse(a.Intro)
	if a.Title == "" {
		return "give the anthology a title"
	}
	if len([]rune(a.Title)) > anthologyTitleMax {
		return "that title is too long"
	}
	if len([]rune(a.Intro)) > anthologyIntroMax {
		return "that introduction is too long"
	}
	return ""
}

// trimProse strips the whitespace AROUND a piece of the reader's writing and
// nothing inside it. A blank line between paragraphs is the only formatting these
// fields have, so strings.TrimSpace at the edges is right and a Fields-style
// collapse anywhere else would silently reflow somebody's prose into one block.
func trimProse(s string) string { return strings.Trim(s, " \t\r\n") }

// anthologyOwned is the question every handler taking an anthology id from a
// request has to ask first. A foreign row answers 404 and never 403, because a
// 403 confirms the row exists.
func anthologyOwned(q interface {
	QueryRow(string, ...any) *sql.Row
}, uid, id int64) bool {
	var n int
	if err := q.QueryRow(`SELECT COUNT(*) FROM anthologies WHERE id = ? AND user_id = ?`, id, uid).Scan(&n); err != nil {
		return false
	}
	return n == 1
}

// quoteOwned reports whether one quote of one kind belongs to this reader.
//
// THE THREE KINDS TAKE THREE DIFFERENT PATHS TO THE SAME ANSWER, which is the
// whole reason this is a function rather than a WHERE clause: an annotation is
// owned through its book, a dialogue through its film, and an utterance carries
// its own user_id because it has no parent. 0026's header calls that last one the
// single largest source of risk in the standalone-quote feature, for exactly this
// reason — the parent join that makes the other two safe by construction does not
// exist, so the scope has to be written out and cannot be forgotten.
func quoteOwned(q interface {
	QueryRow(string, ...any) *sql.Row
}, uid int64, kind string, id int64) bool {
	var sqlText string
	switch kind {
	case kindBook:
		sqlText = `SELECT COUNT(*) FROM annotations a JOIN books b ON b.id = a.book_id
		           WHERE a.id = ? AND b.user_id = ?`
	case kindScreen:
		sqlText = `SELECT COUNT(*) FROM dialogues d JOIN movies m ON m.id = d.movie_id
		           WHERE d.id = ? AND m.user_id = ?`
	case kindUtterance:
		sqlText = `SELECT COUNT(*) FROM utterances WHERE id = ? AND user_id = ?`
	default:
		return false
	}
	var n int
	if err := q.QueryRow(sqlText, id, uid).Scan(&n); err != nil {
		return false
	}
	return n == 1
}

// GET /anthologies
func (s *Server) handleListAnthologies(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[anthologies] list uid=%d", uid)
	rows, err := s.Store.DB.Query(`
		SELECT a.id, a.title, a.intro, a.created_at, a.updated_at,
		       (SELECT COUNT(*) FROM anthology_entries e WHERE e.anthology_id = a.id)
		FROM anthologies a WHERE a.user_id = ?
		ORDER BY a.updated_at DESC, a.id DESC`, uid)
	if err != nil {
		internalError(w, r, "list anthologies", err)
		return
	}
	defer rows.Close()
	out := []anthologyRow{}
	for rows.Next() {
		var a anthologyRow
		if err := rows.Scan(&a.ID, &a.Title, &a.Intro, &a.CreatedAt, &a.UpdatedAt, &a.Entries); err != nil {
			olog.Warnf(olog.CodeAnthologyRowScan, "[anthologies] row scan failed: %v", err)
			continue
		}
		out = append(out, a)
	}
	if err := rows.Err(); err != nil {
		internalError(w, r, "list anthologies", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"anthologies": out})
}

// entriesFor reads one anthology's entries in order, joined to their quotes.
//
// ONE QUERY WITH THREE ARMS rather than three queries merged in Go, because the
// ORDER runs across the kinds: an anthology is a sequence of passages and the
// third might be a film line between two book highlights. Sorting in Go would
// mean holding three result sets to merge them, and would put the ordering rule
// somewhere other than the ORDER BY that already expresses it.
//
// Every arm carries the owner scope of its own kind as well, which is redundant
// while the caller has already checked the anthology — and stays because the day
// it stops being redundant is the day an entry points somewhere it should not, and
// then this join is what makes it invisible rather than a leak.
func (s *Server) entriesFor(uid, id int64) ([]anthologyEntryRow, error) {
	const q = `
		SELECT e.kind, e.item_id, e.position, e.note,
		       COALESCE(a.quote,''), COALESCE(a.note,''), a.color, a.favorite,
		       b.title, COALESCE(b.author,''), b.id
		  FROM anthology_entries e
		  JOIN annotations a ON a.id = e.item_id
		  JOIN books b ON b.id = a.book_id
		 WHERE e.anthology_id = ? AND e.kind = 'book' AND b.user_id = ?
		UNION ALL
		SELECT e.kind, e.item_id, e.position, e.note,
		       COALESCE(d.quote,''), COALESCE(d.note,''), d.color, d.favorite,
		       m.title,
		       -- The character is who says it; the actor is who said it. The
		       -- character reads first because that is the attribution a reader
		       -- means by a film quote, and the actor is appended when both exist.
		       TRIM(COALESCE(d.character,'') || CASE
		         WHEN COALESCE(d.character,'') <> '' AND COALESCE(d.actor,'') <> ''
		         THEN ' · ' || d.actor ELSE COALESCE(d.actor,'') END),
		       m.id
		  FROM anthology_entries e
		  JOIN dialogues d ON d.id = e.item_id
		  JOIN movies m ON m.id = d.movie_id
		 WHERE e.anthology_id = ? AND e.kind = 'screen' AND m.user_id = ?
		UNION ALL
		SELECT e.kind, e.item_id, e.position, e.note,
		       u.quote, COALESCE(u.note,''), u.color, u.favorite,
		       COALESCE(u.occasion,''), COALESCE(u.speaker,''), 0
		  FROM anthology_entries e
		  JOIN utterances u ON u.id = e.item_id
		 WHERE e.anthology_id = ? AND e.kind = 'utterance' AND u.user_id = ?
		ORDER BY 3`
	rows, err := s.Store.DB.Query(q, id, uid, id, uid, id, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []anthologyEntryRow{}
	for rows.Next() {
		var e anthologyEntryRow
		if err := rows.Scan(&e.Kind, &e.ItemID, &e.Position, &e.Note,
			&e.Quote, &e.QuoteNote, &e.Color, &e.Favorite, &e.Source, &e.Credit, &e.WorkID); err != nil {
			olog.Warnf(olog.CodeAnthologyRowScan, "[anthologies] entry scan failed: %v", err)
			continue
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// GET /anthologies/{id}
func (s *Server) handleGetAnthology(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	uid := userID(r)
	olog.Tracef("[anthologies] get uid=%d id=%d", uid, id)
	var a anthologyRow
	err := s.Store.DB.QueryRow(`
		SELECT id, title, intro, created_at, updated_at FROM anthologies
		WHERE id = ? AND user_id = ?`, id, uid).Scan(&a.ID, &a.Title, &a.Intro, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	if err != nil {
		internalError(w, r, "get anthology", err)
		return
	}
	entries, err := s.entriesFor(uid, id)
	if err != nil {
		internalError(w, r, "get anthology entries", err)
		return
	}
	a.Entries = len(entries)
	writeJSON(w, http.StatusOK, map[string]any{"anthology": a, "entries": entries})
}

// POST /anthologies
//
// A duplicate title is ALLOWED, unlike a board name (0036), and the difference is
// worth stating: a board is a place and two places with one name is a filing
// error, while an anthology is a document and "Openings" twice is two drafts of
// the same idea. Nothing resolves an anthology by name except an import, and that
// path takes the first match on purpose.
func (s *Server) handleCreateAnthology(w http.ResponseWriter, r *http.Request) {
	var req anthologyReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.normalise(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[anthologies] create uid=%d title=%q", uid, req.Title)
	res, err := s.Store.DB.Exec(`INSERT INTO anthologies (user_id, title, intro) VALUES (?, ?, ?)`,
		uid, req.Title, req.Intro)
	if err != nil {
		internalError(w, r, "insert anthology", err)
		return
	}
	id, err := res.LastInsertId()
	if err != nil {
		internalError(w, r, "insert anthology", err)
		return
	}
	// Read back rather than reporting the request: created_at and updated_at are
	// the database's answer, and a client that has to guess them will guess wrong
	// across a timezone.
	var a anthologyRow
	if err := s.Store.DB.QueryRow(`SELECT id, title, intro, created_at, updated_at FROM anthologies WHERE id = ?`,
		id).Scan(&a.ID, &a.Title, &a.Intro, &a.CreatedAt, &a.UpdatedAt); err != nil {
		internalError(w, r, "read back anthology", err)
		return
	}
	writeJSON(w, http.StatusCreated, a)
}

// PUT /anthologies/{id} — the title and the introduction.
//
// Full-state, like every other PUT here, and it carries exactly the two fields
// the form has. The entries are not in it: an anthology's order and its
// commentary change through their own endpoints, one row at a time, because a
// drag is not an edit of the whole document.
func (s *Server) handleUpdateAnthology(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	var req anthologyReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.normalise(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[anthologies] update uid=%d id=%d", uid, id)
	res, err := s.Store.DB.Exec(`UPDATE anthologies SET title = ?, intro = ?, updated_at = datetime('now')
	                             WHERE id = ? AND user_id = ?`, req.Title, req.Intro, id, uid)
	if err != nil {
		internalError(w, r, "update anthology", err)
		return
	}
	// The ownership check IS the row count here: one statement, and a foreign or
	// missing anthology updates nothing.
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /anthologies/{id}
//
// NOT VIA THE BIN, and that is a decision with a cost. The bin's kinds are an
// allowlist (0031) tied to the id floor, because a restore that lands on a reused
// id is a collision — adding a fourth kind of restorable thing is a much larger
// piece of work than this feature. What is lost is the reader's own prose, so the
// client asks first and says exactly that: the introduction and the commentary go,
// and the quotes themselves are untouched because an anthology never owned them.
func (s *Server) handleDeleteAnthology(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	uid := userID(r)
	olog.Tracef("[anthologies] delete uid=%d id=%d", uid, id)
	// The entries go with it by declared foreign key (ON DELETE CASCADE), which is
	// the one cascade in this feature the schema can express: an entry has exactly
	// one anthology, even though it has three possible parents on the other side.
	res, err := s.Store.DB.Exec(`DELETE FROM anthologies WHERE id = ? AND user_id = ?`, id, uid)
	if err != nil {
		internalError(w, r, "delete anthology", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// entryRef is one (kind, item_id) as a request names it.
type entryRef struct {
	Kind   string `json:"kind"`
	ItemID int64  `json:"item_id"`
}

// POST /anthologies/{id}/entries — add a selection to the end.
//
// The bulk bar sends a whole selection and half of it may already be here, so a
// duplicate is a SKIP and the reply says how many of each. A 409 would be the
// wrong shape: the reader asked for these forty quotes to be in this anthology,
// and after the request they are.
func (s *Server) handleAddAnthologyEntries(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	var body struct {
		Items []entryRef `json:"items"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if len(body.Items) == 0 {
		writeErr(w, http.StatusBadRequest, "no quotes to add")
		return
	}
	if len(body.Items) > anthologyAddMax {
		writeErr(w, http.StatusBadRequest, fmt.Sprintf("that is more than %d quotes at once", anthologyAddMax))
		return
	}
	uid := userID(r)
	olog.Tracef("[anthologies] add uid=%d id=%d items=%d", uid, id, len(body.Items))
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
	if err := tx.QueryRow(`SELECT COUNT(*) FROM anthology_entries WHERE anthology_id = ?`, id).Scan(&held); err != nil {
		internalError(w, r, "count entries", err)
		return
	}
	// The next position, and the only place in this file that appends. Positions
	// are 1-based so the first entry reads as 1 rather than as 0, which matters
	// only because these numbers show up in a database somebody may read by hand.
	var next float64
	if err := tx.QueryRow(`SELECT COALESCE(MAX(position), 0) + 1 FROM anthology_entries WHERE anthology_id = ?`,
		id).Scan(&next); err != nil {
		internalError(w, r, "next position", err)
		return
	}

	added, skipped := 0, 0
	for _, it := range body.Items {
		// The kind vocabulary is item_reviews' (book | screen | utterance) and this
		// is validReviewKind rather than a second list of the same three words. Its
		// own comment gives the reason: "One list, so an endpoint cannot learn a new
		// kind while another silently keeps rejecting it."
		if !validReviewKind(it.Kind) {
			writeErr(w, http.StatusBadRequest, fmt.Sprintf("unknown kind %q", it.Kind))
			return
		}
		// Rule 1. The anthology being theirs says nothing about the quote.
		if !quoteOwned(tx, uid, it.Kind, it.ItemID) {
			writeErr(w, http.StatusNotFound, "one of those quotes does not exist")
			return
		}
		if held+added >= anthologyEntriesMax {
			writeErr(w, http.StatusBadRequest,
				fmt.Sprintf("an anthology holds at most %d entries", anthologyEntriesMax))
			return
		}
		// Rule 2. INSERT OR IGNORE against the primary key IS the once-per-anthology
		// rule, so adding the same quote twice cannot make a second entry even if
		// two tabs ask at the same moment.
		res, err := tx.Exec(`INSERT OR IGNORE INTO anthology_entries (anthology_id, position, kind, item_id)
		                     VALUES (?, ?, ?, ?)`, id, next, it.Kind, it.ItemID)
		if err != nil {
			internalError(w, r, "insert entry", err)
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			added++
			next++
		} else {
			skipped++
		}
	}
	// The anthology's own updated_at moves when its contents do, because the list
	// is ordered by it: adding to an anthology is working on it.
	if added > 0 {
		if _, err := tx.Exec(`UPDATE anthologies SET updated_at = datetime('now') WHERE id = ?`, id); err != nil {
			internalError(w, r, "touch anthology", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit entries", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"added": added, "skipped": skipped, "entries": held + added})
}

// PUT /anthologies/{id}/entries — the commentary that introduces one entry.
//
// Its own endpoint rather than a field of the anthology PUT: the commentary is
// per entry, there may be thirty of them, and saving one paragraph should not
// send the other twenty-nine back.
func (s *Server) handleAnthologyEntryNote(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	var body struct {
		entryRef
		Note string `json:"note"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if !validReviewKind(body.Kind) {
		writeErr(w, http.StatusBadRequest, fmt.Sprintf("unknown kind %q", body.Kind))
		return
	}
	note := trimProse(body.Note)
	if len([]rune(note)) > anthologyNoteMax {
		writeErr(w, http.StatusBadRequest, "that note is too long")
		return
	}
	uid := userID(r)
	olog.Tracef("[anthologies] note uid=%d id=%d kind=%s item=%d", uid, id, body.Kind, body.ItemID)
	if !anthologyOwned(s.Store.DB, uid, id) {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	res, err := s.Store.DB.Exec(`UPDATE anthology_entries SET note = ?
	                             WHERE anthology_id = ? AND kind = ? AND item_id = ?`,
		note, id, body.Kind, body.ItemID)
	if err != nil {
		internalError(w, r, "update entry note", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "that quote is not in this anthology")
		return
	}
	if _, err := s.Store.DB.Exec(`UPDATE anthologies SET updated_at = datetime('now') WHERE id = ?`, id); err != nil {
		internalError(w, r, "touch anthology", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /anthologies/{id}/entries/{kind}/{itemID}
//
// The reference is in the PATH rather than in a body, because a DELETE with a
// body is a shape half the HTTP stack in the world treats as optional — and
// because (anthology, kind, item) IS the entry's identity, which is what a path
// is for.
func (s *Server) handleRemoveAnthologyEntry(w http.ResponseWriter, r *http.Request) {
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
	olog.Tracef("[anthologies] remove uid=%d id=%d kind=%s item=%d", uid, id, kind, itemID)
	if !anthologyOwned(s.Store.DB, uid, id) {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	// The commentary goes with the entry, and that is worth being deliberate about:
	// a note is written ABOUT a passage in a place, so keeping it after the passage
	// leaves would be keeping a sentence about nothing. The quote itself is
	// untouched — an anthology never owned it.
	res, err := s.Store.DB.Exec(`DELETE FROM anthology_entries
	                             WHERE anthology_id = ? AND kind = ? AND item_id = ?`, id, kind, itemID)
	if err != nil {
		internalError(w, r, "remove entry", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "that quote is not in this anthology")
		return
	}
	if _, err := s.Store.DB.Exec(`UPDATE anthologies SET updated_at = datetime('now') WHERE id = ?`, id); err != nil {
		internalError(w, r, "touch anthology", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /anthologies/{id}/order — move one entry.
//
// `after` names the entry it should follow, or is absent to mean "first". The
// SERVER computes the position, not the client: a client that sent a number would
// be reimplementing the midpoint rule, and the two would disagree the first time
// a second tab moved something.
//
// Rule 3, and the one measurable claim in this file: it writes ONE row. The test
// counts it.
func (s *Server) handleReorderAnthology(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad anthology id")
		return
	}
	var body struct {
		entryRef
		After *entryRef `json:"after"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if !validReviewKind(body.Kind) {
		writeErr(w, http.StatusBadRequest, fmt.Sprintf("unknown kind %q", body.Kind))
		return
	}
	if body.After != nil && !validReviewKind(body.After.Kind) {
		writeErr(w, http.StatusBadRequest, fmt.Sprintf("unknown kind %q", body.After.Kind))
		return
	}
	if body.After != nil && body.After.Kind == body.Kind && body.After.ItemID == body.ItemID {
		writeErr(w, http.StatusBadRequest, "an entry cannot follow itself")
		return
	}
	uid := userID(r)
	olog.Tracef("[anthologies] reorder uid=%d id=%d kind=%s item=%d", uid, id, body.Kind, body.ItemID)
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
	var moving float64
	if err := tx.QueryRow(`SELECT position FROM anthology_entries
	                       WHERE anthology_id = ? AND kind = ? AND item_id = ?`,
		id, body.Kind, body.ItemID).Scan(&moving); err == sql.ErrNoRows {
		writeErr(w, http.StatusNotFound, "that quote is not in this anthology")
		return
	} else if err != nil {
		internalError(w, r, "read position", err)
		return
	}

	// prev is the position the moved entry lands after, and next the one it lands
	// before. "First" is prev = 0, which is below every stored position because
	// they start at 1.
	prev := 0.0
	if body.After != nil {
		if err := tx.QueryRow(`SELECT position FROM anthology_entries
		                       WHERE anthology_id = ? AND kind = ? AND item_id = ?`,
			id, body.After.Kind, body.After.ItemID).Scan(&prev); err == sql.ErrNoRows {
			writeErr(w, http.StatusNotFound, "the entry it should follow is not in this anthology")
			return
		} else if err != nil {
			internalError(w, r, "read anchor position", err)
			return
		}
	}
	// The next position after prev, EXCLUDING the row being moved — otherwise
	// nudging an entry one place down would compute a midpoint against itself and
	// go nowhere.
	var next sql.NullFloat64
	if err := tx.QueryRow(`SELECT MIN(position) FROM anthology_entries
	                       WHERE anthology_id = ? AND position > ?
	                         AND NOT (kind = ? AND item_id = ?)`,
		id, prev, body.Kind, body.ItemID).Scan(&next); err != nil {
		internalError(w, r, "read next position", err)
		return
	}

	target := prev + 1 // moving to the end: past everything, no midpoint needed
	if next.Valid {
		target = prev + (next.Float64-prev)/2
		// THE ONE CASE WHERE THE WHOLE ANTHOLOGY IS REWRITTEN. Either the gap is
		// too small to be worth halving again, or the midpoint is not representable
		// at all — both mean the float has run out of room between these two
		// neighbours. Renumbering to 1, 2, 3… is exact, and it is affordable here
		// precisely because it is not the common path.
		if next.Float64-prev < anthologyPositionGap || target <= prev || target >= next.Float64 {
			if err := renumberAnthology(tx, id); err != nil {
				internalError(w, r, "renumber anthology", err)
				return
			}
			// Re-read both anchors at their new integer positions and take the
			// midpoint again, which is now guaranteed to have room.
			if body.After == nil {
				prev = 0
			} else if err := tx.QueryRow(`SELECT position FROM anthology_entries
			                              WHERE anthology_id = ? AND kind = ? AND item_id = ?`,
				id, body.After.Kind, body.After.ItemID).Scan(&prev); err != nil {
				internalError(w, r, "re-read anchor position", err)
				return
			}
			var after2 sql.NullFloat64
			if err := tx.QueryRow(`SELECT MIN(position) FROM anthology_entries
			                       WHERE anthology_id = ? AND position > ?
			                         AND NOT (kind = ? AND item_id = ?)`,
				id, prev, body.Kind, body.ItemID).Scan(&after2); err != nil {
				internalError(w, r, "re-read next position", err)
				return
			}
			if after2.Valid {
				target = prev + (after2.Float64-prev)/2
			} else {
				target = prev + 1
			}
		}
	}

	if _, err := tx.Exec(`UPDATE anthology_entries SET position = ?
	                      WHERE anthology_id = ? AND kind = ? AND item_id = ?`,
		target, id, body.Kind, body.ItemID); err != nil {
		internalError(w, r, "move entry", err)
		return
	}
	if _, err := tx.Exec(`UPDATE anthologies SET updated_at = datetime('now') WHERE id = ?`, id); err != nil {
		internalError(w, r, "touch anthology", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit reorder", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"position": target})
}

// renumberAnthology rewrites every position to 1, 2, 3… in the order they are
// already in. Called only when a midpoint has run out of room.
//
// The order is (position, kind, item_id) rather than position alone, so the
// rewrite is deterministic even if two rows somehow hold the same number — which
// nothing here can produce, and which a hand-edited database can.
func renumberAnthology(tx *sql.Tx, id int64) error {
	rows, err := tx.Query(`SELECT kind, item_id FROM anthology_entries
	                       WHERE anthology_id = ? ORDER BY position, kind, item_id`, id)
	if err != nil {
		return err
	}
	type ref struct {
		kind string
		item int64
	}
	var refs []ref
	for rows.Next() {
		var e ref
		if err := rows.Scan(&e.kind, &e.item); err != nil {
			rows.Close()
			return err
		}
		refs = append(refs, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for i, e := range refs {
		if _, err := tx.Exec(`UPDATE anthology_entries SET position = ?
		                      WHERE anthology_id = ? AND kind = ? AND item_id = ?`,
			float64(i+1), id, e.kind, e.item); err != nil {
			return err
		}
	}
	return nil
}

// anthologyByName finds or creates an anthology for an import, which is the one
// path that resolves one by TITLE.
//
// A typo makes a second anthology. That cost is accepted for the same reason
// boardByName accepts it and 1.13.1 accepted it for credit suffixes: the mistake
// is visible in the list and fixable by renaming, whereas a refused import is a
// wall. The first match wins because titles are not unique here — two drafts of
// "Openings" is a legitimate thing to have, and an import naming one of them
// means the one that exists.
// The second return says whether the row was MADE by this call, which the import
// needs: an introduction may be written into an anthology this import created and
// never over one that was already there.
func anthologyByName(tx *sql.Tx, uid int64, title string) (int64, bool, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return 0, false, sql.ErrNoRows
	}
	if len([]rune(title)) > anthologyTitleMax {
		title = string([]rune(title)[:anthologyTitleMax])
	}
	var id int64
	err := tx.QueryRow(`SELECT id FROM anthologies WHERE user_id = ? AND lower(title) = lower(?)
	                    ORDER BY id LIMIT 1`, uid, title).Scan(&id)
	if err == nil {
		return id, false, nil
	}
	if err != sql.ErrNoRows {
		return 0, false, err
	}
	res, err := tx.Exec(`INSERT INTO anthologies (user_id, title) VALUES (?, ?)`, uid, title)
	if err != nil {
		return 0, false, err
	}
	id, err = res.LastInsertId()
	return id, true, err
}

// addAnthologyEntry appends one quote to an anthology at import time.
//
// Shared with nothing else on purpose: the interactive path above adds a whole
// selection inside one transaction with a running position, and an import adds
// one row per quote as it writes it. Both go through INSERT OR IGNORE, so the
// once-per-anthology rule holds on both.
func addAnthologyEntry(tx *sql.Tx, anthologyID int64, kind string, itemID int64, note string) error {
	var next float64
	if err := tx.QueryRow(`SELECT COALESCE(MAX(position), 0) + 1 FROM anthology_entries WHERE anthology_id = ?`,
		anthologyID).Scan(&next); err != nil {
		return err
	}
	if len([]rune(note)) > anthologyNoteMax {
		note = string([]rune(note)[:anthologyNoteMax])
	}
	_, err := tx.Exec(`INSERT OR IGNORE INTO anthology_entries (anthology_id, position, kind, item_id, note)
	                   VALUES (?, ?, ?, ?, ?)`, anthologyID, next, kind, itemID, note)
	return err
}
