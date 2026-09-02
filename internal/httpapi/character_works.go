package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// The character page's own three verbs: put this character in a work, take them
// out of one, and choose which of their pictures is THE picture.
//
// WHY THEY ARE NOT THE CAST ENDPOINTS. `POST /movies/{id}/cast` takes a NAME and
// resolves it — store.LinkCastRow finds a character on that work with the same
// folded name, or makes a new record. That is the right behaviour when a reader
// is typing into a work's cast list, and the wrong behaviour entirely when they
// are looking at one character record and saying "and this one is in that book
// too": name resolution would hand them a DIFFERENT record with the same name,
// which is precisely the welding 0056 refuses to do by accident. So these carry
// the character's id and the row is linked to that record and no other.
//
// -------------------------------------------------------- the removal, and why
//
// A CHARACTER IS NOT REMOVED FROM A WORK THAT STILL QUOTES THEM. Not silently
// tombstoned — refused, with the number, and with the two ways forward stated:
// rewrite those lines to name somebody else, or clear the speaker off them. The
// owner's ruling, in their words: "Refuse while there are quotes. Ask the user to
// either replace them all or remove them (give that option)."
//
// The reason it cannot be a plain delete is cast_from_quotes.go. A character named
// on one of the work's own lines is ADOPTED back onto its cast on the next read,
// for ever — so a removal that leaves the quotes alone either undoes itself (if
// the row is hard-deleted) or leaves the reader with a work whose quotes name a
// character its cast will not admit to (if it is tombstoned). Neither is a
// removal. The quotes are the fact; the cast row is downstream of it.
//
// THE THREE ANSWERS ARE A QUERY PARAMETER AND NOT THREE ENDPOINTS, because they
// are one act with a decision in it, and the decision is made in a dialog raised
// by the 409 this returns. A caller that sends none gets the count and nothing is
// written.

// characterWorkAdd is the body for putting a character into a work.
type characterWorkAdd struct {
	Kind   string `json:"kind"`
	WorkID int64  `json:"work_id"`
	// Actor is optional and film-side only, exactly as a cast row's is: a book has
	// characters, not a cast. Blank means the pairing is not known yet, which is
	// the ordinary case when a reader is tagging from the character's own page.
	Actor string `json:"actor"`
}

// handleCharacterAddWork: POST /characters/{id}/works {kind, work_id, actor}.
func (s *Server) handleCharacterAddWork(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "characters")
	if !ok {
		return
	}
	var req characterWorkAdd
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Kind != "book" && req.Kind != "movie" {
		writeErr(w, http.StatusBadRequest, "a work is a book or a movie")
		return
	}
	role, ok := s.castWork(uid, req.Kind, req.WorkID)
	if !ok {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	var name string
	if err := s.Store.DB.QueryRow(
		`SELECT name FROM characters WHERE id = ? AND user_id = ?`, id, uid).Scan(&name); err != nil {
		internalError(w, r, "read character", err)
		return
	}
	// The row's two names go through the cast list's own validator, so a name too
	// long for a cast row is refused here in the same words rather than truncated
	// on the way in.
	edit := castEdit{Character: name, Actor: req.Actor}
	if msg := edit.validate(role); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	olog.Tracef("[identity] character %d + %s %d uid=%d", id, req.Kind, req.WorkID, uid)

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "add character work", err)
		return
	}
	defer tx.Rollback()

	// ALREADY THERE IS ALREADY THERE, and the check is on the RECORD rather than on
	// the folded name: two characters legitimately share a name — that is the whole
	// reason 0056 creates one per work rather than resolving — so "is this record
	// on this work" and "is something called that on this work" are different
	// questions and only the first one belongs here. A tombstone is revived rather
	// than duplicated, for the reason handleAddCast gives.
	var existing int64
	var origin string
	err = tx.QueryRow(
		`SELECT id, origin FROM work_cast
		  WHERE user_id = ? AND kind = ? AND work_id = ? AND character_id = ?
		  ORDER BY origin = 'removed', id LIMIT 1`, uid, req.Kind, req.WorkID, id).Scan(&existing, &origin)
	switch {
	case err == nil && origin != castRemoved:
		writeErr(w, http.StatusConflict, "this character is already on that work")
		return
	case err != nil && !errors.Is(err, sql.ErrNoRows):
		internalError(w, r, "check character work", err)
		return
	}

	var live int
	if err := tx.QueryRow(
		`SELECT COUNT(*) FROM work_cast WHERE kind = ? AND work_id = ? AND origin <> ?`,
		req.Kind, req.WorkID, castRemoved).Scan(&live); err != nil {
		internalError(w, r, "count cast", err)
		return
	}
	if live >= maxWorkCast {
		writeErr(w, http.StatusBadRequest, "this cast list is full")
		return
	}

	charKey, actorKey := store.CastKey(edit.Character), store.CastKey(edit.Actor)
	castID := existing
	if err == nil {
		// Revived in place with its provider_key kept, so the next fetch goes on
		// matching it — the same reasoning handleAddCast writes out at length.
		if _, err := tx.Exec(
			`UPDATE work_cast SET character = ?, character_key = ?, actor = ?, actor_key = ?,
			        origin = ?, updated_at = datetime('now')
			 WHERE id = ? AND user_id = ?`,
			edit.Character, charKey, edit.Actor, actorKey, castCorrected, castID, uid); err != nil {
			internalError(w, r, "revive cast row", err)
			return
		}
	} else {
		var billing int
		if err := tx.QueryRow(
			`SELECT COALESCE(MAX(billing), -1) + 1 FROM work_cast WHERE kind = ? AND work_id = ?`,
			req.Kind, req.WorkID).Scan(&billing); err != nil {
			internalError(w, r, "next billing", err)
			return
		}
		// THE LINK IS WRITTEN BY THE INSERT, not left for LinkCastRow to guess at.
		// That function fills a null character_id by resolving the NAME, which on a
		// work already holding a different character of the same name would file this
		// row under the wrong record — silently, and permanently.
		res, err := tx.Exec(
			`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key,
			                        billing, origin, character_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			uid, req.Kind, req.WorkID, edit.Character, charKey, edit.Actor, actorKey,
			billing, castReader, id)
		if err != nil {
			internalError(w, r, "add character work", err)
			return
		}
		if castID, err = res.LastInsertId(); err != nil {
			internalError(w, r, "add character work", err)
			return
		}
	}
	// Still called, and it still has work to do: the actor half. character_id is
	// already set on both paths above, and LinkCastRow only fills what is null.
	if err := store.LinkCastRow(tx, uid, castID); err != nil {
		internalError(w, r, "link cast row", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "add character work: commit", err)
		return
	}
	s.writeCastRow(w, r, castID, uid)
}

// handleCharacterDropWork: DELETE /characters/{id}/works/{cast} — take this
// character off one work.
//
// `?quotes=` says what to do about the lines on that work that name them:
// absent refuses with the count, `clear` empties the speaker on each, and
// `replace&to=<name>` rewrites it. See this file's header for why doing nothing
// is not among the options.
func (s *Server) handleCharacterDropWork(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "characters")
	if !ok {
		return
	}
	castID, err := strconv.ParseInt(r.PathValue("cast"), 10, 64)
	if err != nil || castID <= 0 {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	mode := r.URL.Query().Get("quotes")
	to := strings.TrimSpace(r.URL.Query().Get("to"))
	switch mode {
	case "", "clear":
	case "replace":
		if to == "" {
			writeErr(w, http.StatusBadRequest, "replacing needs a name to replace with")
			return
		}
	default:
		writeErr(w, http.StatusBadRequest, "quotes must be clear or replace")
		return
	}

	kind, workID, origin, _, err := s.castOwner(uid, castID)
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
	// THE ROW HAS TO BE THIS CHARACTER'S. Without it the path would be two
	// unrelated ids and a caller could untag any of their own cast rows through a
	// character that has nothing to do with it — which would still be their own
	// data, and would still be a removal they never asked for.
	var linked sql.NullInt64
	if err := s.Store.DB.QueryRow(
		`SELECT character_id FROM work_cast WHERE id = ? AND user_id = ?`, castID, uid).Scan(&linked); err != nil {
		internalError(w, r, "read cast link", err)
		return
	}
	if !linked.Valid || linked.Int64 != id {
		writeErr(w, http.StatusNotFound, "cast row not found")
		return
	}

	var charKey string
	if err := s.Store.DB.QueryRow(
		`SELECT character_key FROM work_cast WHERE id = ? AND user_id = ?`, castID, uid).Scan(&charKey); err != nil {
		internalError(w, r, "read cast row", err)
		return
	}
	quoted, err := s.quotesNaming(uid, kind, workID, castID, charKey)
	if err != nil {
		internalError(w, r, "count quotes", err)
		return
	}
	if len(quoted) > 0 && mode == "" {
		// 409 WITH THE NUMBER IN THE BODY, because the dialog this raises has to say
		// how many lines it is about to rewrite. A bare "conflict" would make the
		// reader guess, and the guess is the difference between fixing three lines
		// and rewriting ninety.
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":  "quotes on this work still name this character",
			"quotes": len(quoted),
		})
		return
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "drop character work", err)
		return
	}
	defer tx.Rollback()
	if len(quoted) > 0 {
		replacement := ""
		if mode == "replace" {
			replacement = to
		}
		if err := s.rewriteQuoteCharacters(tx, uid, kind, quoted, charKey, replacement); err != nil {
			internalError(w, r, "rewrite quotes", err)
			return
		}
	}
	// TOMBSTONED, NEVER DELETED, and that is not the usual "it might come back from
	// a provider" argument — it is this file's own. The quotes have just been
	// rewritten, so adoption will not re-add the row; but a provider refetch still
	// might, and a reader who has gone to the trouble of clearing ninety lines to
	// get a character off a film should not find them back after the next fetch.
	if _, err := tx.Exec(
		`UPDATE work_cast SET origin = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
		castRemoved, castID, uid); err != nil {
		internalError(w, r, "tombstone cast row", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "drop character work: commit", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"quotes": len(quoted)})
}

// quotedLine is one quote that names a character, with the whole of its character
// column — the column, not the name, because a line can name several and only one
// of them is being taken out.
type quotedLine struct {
	ID        int64
	Character string
}

// quotesNaming returns the quotes on this work that belong to ONE cast row.
//
// THE ROW, NOT THE NAME, AND THE DIFFERENCE IS DATA. `idx_work_cast_pair` is unique
// on (kind, work_id, character_key, actor_key), so two LIVE rows on one work may
// share a folded character name as long as their performers differ — which is the
// recast case work_cast was designed around and quote_cast.go describes in as many
// words: young and old Vito, a part recast between seasons. Selecting by name alone
// meant taking one of those two off a work rewrote or cleared the OTHER one's lines
// as well, silently, in a flow whose whole purpose is to ask before it touches a
// quote. That is destruction of the reader's own words by a control that promised
// to count them first.
//
// So the link decides, where there is one — which is what the link is for, and the
// first thing in the app to depend on it rather than merely maintain it:
//
//   POINTING AT THIS ROW is this row's line, whatever the text says.
//   POINTING AT ANOTHER LIVE ROW is not, however the name folds.
//   POINTING AT NOTHING falls back to the fold, because that is the un-caught-up
//   history and the genuinely ambiguous line, and leaving those out would let a
//   removal proceed past quotes it was supposed to refuse over.
//
// A tombstoned target counts as pointing at nothing: the row it named is not on the
// list any more, so the line is the fold's to claim.
func (s *Server) quotesNaming(uid int64, kind string, workID int64, castID int64, charKey string) ([]quotedLine, error) {
	if charKey == "" {
		return nil, nil
	}
	col, table := "book_id", "annotations"
	if kind != "book" {
		col, table = "movie_id", "dialogues"
	}
	rows, err := s.Store.DB.Query(
		`SELECT q.id, q.character, q.speaker_cast_id, COALESCE(wc.origin, '')
		   FROM `+table+` q
		   LEFT JOIN work_cast wc ON wc.id = q.speaker_cast_id AND wc.user_id = ?
		  WHERE q.`+col+` = ? AND TRIM(q.character) <> '' ORDER BY q.id`, uid, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seps := s.creditSeps(uid)
	out := []quotedLine{}
	for rows.Next() {
		var l quotedLine
		var linked sql.NullInt64
		var origin string
		if err := rows.Scan(&l.ID, &l.Character, &linked, &origin); err != nil {
			return nil, err
		}
		if linked.Valid && origin != "" && origin != castRemoved {
			if linked.Int64 == castID {
				out = append(out, l)
			}
			continue
		}
		for _, n := range metadata.SplitCredits(l.Character, seps) {
			if store.CastKey(n) == charKey {
				out = append(out, l)
				break
			}
		}
	}
	return out, rows.Err()
}

// rewriteQuoteCharacters replaces or drops ONE name in each line's character
// column, leaving every other name on the line exactly where it was.
//
// A LINE THAT NAMES THREE CHARACTERS LOSES ONE, and that is the whole reason this
// is not `UPDATE ... SET character = ?`. "Woland, Behemoth, Azazello" with Woland
// taken out is "Behemoth, Azazello" — an emptied column there would be two
// speakers destroyed to satisfy a removal that was about a third.
//
// THE REPLACEMENT GOES WHERE THE OLD NAME WAS, not at the end: the order a reader
// typed their speakers in is the order the line reads in, and on a two-hander it
// is the difference between a conversation and its reverse.
//
// FTS FOLLOWS BY TRIGGER. dialogues_fts indexes `character` and 0051's
// `dialogues_au` reindexes the row on any update, so the search index needs
// nothing here; annotations_fts indexes quote and note only and never held it.
func (s *Server) rewriteQuoteCharacters(tx *sql.Tx, uid int64, kind string, lines []quotedLine, charKey, to string) error {
	seps := s.creditSeps(uid)
	table := "annotations"
	if kind != "book" {
		table = "dialogues"
	}
	sep := rejoinSep(seps)
	toKey := store.CastKey(to)
	for _, l := range lines {
		out := []string{}
		replaced := false
		for _, n := range metadata.SplitCredits(l.Character, seps) {
			n = strings.TrimSpace(n)
			if n == "" {
				continue
			}
			if store.CastKey(n) != charKey {
				out = append(out, n)
				continue
			}
			// Nothing takes its place when clearing; and a replacement the line
			// already names is not added a second time, which is the ordinary case
			// when two spellings of one character are being folded together.
			if to == "" || replaced || containsKey(out, toKey) {
				continue
			}
			replaced = true
			out = append(out, to)
		}
		if _, err := tx.Exec(
			`UPDATE `+table+` SET character = ? WHERE id = ?`, strings.Join(out, sep), l.ID); err != nil {
			return err
		}
		// AND THE LINK FOLLOWS THE NAME, in the same transaction that changed it.
		// The row this quote pointed at is about to be tombstoned, and a link left
		// on a tombstone is a quote whose speaker is a deletion — invisible on every
		// list and still joined. Leaving it for the next cast-list read would be
		// leaving the library inconsistent between two requests, and on the "clear"
		// path there would be no next read to fix it: adoption returns early when no
		// quote names anybody, which is exactly the state clearing produces.
		if err := store.SyncQuoteCast(tx, uid, kind, l.ID, seps); err != nil {
			return err
		}
	}
	return nil
}

// rejoinSep is the separator a rewritten line is put back together with: the
// reader's own first enabled one, so a library filed with semicolons does not
// come back with commas in it. Every separator disabled still has to join with
// something, and a comma is what the app writes by default.
func rejoinSep(seps metadata.CreditSeps) string {
	switch {
	case seps.Comma:
		return ", "
	case seps.Semicolon:
		return "; "
	case seps.Amp:
		return " & "
	case seps.And:
		return " and "
	}
	return ", "
}

func containsKey(names []string, key string) bool {
	if key == "" {
		return false
	}
	for _, n := range names {
		if store.CastKey(n) == key {
			return true
		}
	}
	return false
}

// ---- the record's own picture ----------------------------------------------

// handleCharacterImage: PUT /characters/{id}/image {cast_id} | {path: ""}.
//
// PROMOTION, NOT A SECOND UPLOAD. Every picture a character has is already stored
// against a cast row — `work_cast.character_image_path`, fetched by
// `POST /cast/{id}/image` from a provider or from a URL the reader chose. What the
// record lacked was a way to say which of them IS them: the column has existed
// since 0056 and nothing has ever written it, so a character with eight film
// stills had no face of their own and every list that wanted one had nothing to
// draw.
//
// So this endpoint stores a REFERENCE to a file that already exists rather than
// fetching a second copy. Two consequences worth stating because both are load-
// bearing:
//
//   THE FILE IS NOT OWNED HERE. Deleting the cast row it came from would leave
//   this pointing at a path that no longer resolves — which is why the read
//   falls back rather than erroring, and why the character list treats a missing
//   file the same as no file.
//
//   IT IS THE READER'S JUDGEMENT AND NOT A DEFAULT. Nothing picks one
//   automatically. Eight Harry Potters is 0056's deliberate over-splitting, and
//   auto-promoting the first still would put a face on a record the reader has
//   not yet decided is one character or eight.
//
// An empty `path` clears it, which is the only other thing a reader can want.
func (s *Server) handleCharacterImage(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := s.identityTarget(w, r, "characters")
	if !ok {
		return
	}
	var req struct {
		CastID int64   `json:"cast_id"`
		Path   *string `json:"path"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	path := ""
	if req.CastID > 0 {
		// SCOPED TWICE: the row is the caller's, and it is THIS character's. The
		// second half is what stops a reader pointing one character's record at
		// another character's still — their own data either way, and still not what
		// they asked for.
		var linked sql.NullInt64
		if err := s.Store.DB.QueryRow(
			`SELECT COALESCE(character_image_path, ''), character_id FROM work_cast
			  WHERE id = ? AND user_id = ? AND origin <> 'removed'`, req.CastID, uid).Scan(&path, &linked); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeErr(w, http.StatusNotFound, "cast row not found")
				return
			}
			internalError(w, r, "read cast image", err)
			return
		}
		if !linked.Valid || linked.Int64 != id {
			writeErr(w, http.StatusNotFound, "cast row not found")
			return
		}
		if path == "" {
			writeErr(w, http.StatusBadRequest, "that appearance has no stored picture yet")
			return
		}
	} else if req.Path == nil || *req.Path != "" {
		writeErr(w, http.StatusBadRequest, "send a cast_id to promote, or an empty path to clear")
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE characters SET image_path = ? WHERE id = ? AND user_id = ?`, path, id, uid); err != nil {
		internalError(w, r, "set character image", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"image_path": path})
}
